import { NextResponse } from 'next/server';
import { CampaignModel, CampaignRecipientModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';
import { sendBulkMailWithMailjetResults } from '@/lib/auth/mailjet';
import { buildCampaignTemplate } from '@/lib/auth/email-templates';

const BATCH_SIZE = 200;
const MAX_BATCHES_PER_RUN = 5;

async function ensureSuperAdmin(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return { ok: false, status: 404, error: 'User not found', code: 'USER_NOT_FOUND' } as const;
  if (user.role !== 'superAdmin') {
    return { ok: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' } as const;
  }
  return { ok: true, user } as const;
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    let campaignId = '';
    try {
      const body = await request.json();
      campaignId = String(body?.campaignId || '').trim();
    } catch {
      campaignId = '';
    }

    let processedBatches = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let activeCampaignId = '';

    while (processedBatches < MAX_BATCHES_PER_RUN) {
      const campaign = campaignId
        ? await CampaignModel.findOne({ id: campaignId }).lean()
        : await CampaignModel.findOne({ status: { $in: ['queued', 'sending'] } })
            .sort({ createdAt: 1 })
            .lean();

      if (!campaign) break;
      activeCampaignId = campaign.id;

      if (campaign.status === 'queued') {
        await CampaignModel.updateOne({ id: campaign.id }, { $set: { status: 'sending' } });
      }

      const recipients = await CampaignRecipientModel.find({ campaignId: campaign.id, status: 'pending' })
        .limit(BATCH_SIZE)
        .lean();

      if (!recipients.length) {
        const finalStatus = campaign.failedCount > 0 ? 'failed' : 'sent';
        await CampaignModel.updateOne({ id: campaign.id }, { $set: { status: finalStatus } });
        break;
      }

      const wrappedHtml = buildCampaignTemplate({
        locale: 'fr',
        subject: campaign.subject,
        bodyHtml: campaign.html,
      });

      const result = await sendBulkMailWithMailjetResults({
        subject: campaign.subject,
        html: wrappedHtml,
        text: campaign.text || '',
        recipients: recipients.map((recipient) => ({
          email: recipient.email,
          name: recipient.name || '',
          companyName: recipient.companyName || '',
        })),
      });

      const sentEmails = result.sent;
      const failedEmails = result.failed.map((item) => item.email);

      if (sentEmails.length) {
        await CampaignRecipientModel.updateMany(
          { campaignId: campaign.id, email: { $in: sentEmails } },
          { $set: { status: 'sent', errorMessage: '' } }
        );
      }

      if (failedEmails.length) {
        await CampaignRecipientModel.updateMany(
          { campaignId: campaign.id, email: { $in: failedEmails } },
          { $set: { status: 'failed', errorMessage: 'MAILJET_FAILED' } }
        );
      }

      totalSent += sentEmails.length;
      totalFailed += failedEmails.length;
      processedBatches += 1;

      await CampaignModel.updateOne(
        { id: campaign.id },
        {
          $inc: {
            sentCount: sentEmails.length,
            failedCount: failedEmails.length,
          },
        }
      );

      if (recipients.length < BATCH_SIZE) {
        const remaining = await CampaignRecipientModel.countDocuments({ campaignId: campaign.id, status: 'pending' });
        if (remaining === 0) {
          const finalStatus = campaign.failedCount + totalFailed > 0 ? 'failed' : 'sent';
          await CampaignModel.updateOne({ id: campaign.id }, { $set: { status: finalStatus } });
          break;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      campaignId: activeCampaignId || campaignId,
      processedBatches,
      sent: totalSent,
      failed: totalFailed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to dispatch campaign', code: 'CAMPAIGN_DISPATCH_FAILED' },
      { status: 500 }
    );
  }
}
