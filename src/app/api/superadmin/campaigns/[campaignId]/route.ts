import { NextResponse } from 'next/server';
import { CampaignModel, CampaignRecipientModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

async function ensureSuperAdmin(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return { ok: false, status: 404, error: 'User not found', code: 'USER_NOT_FOUND' } as const;
  if (user.role !== 'superAdmin') {
    return { ok: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' } as const;
  }
  return { ok: true, user } as const;
}

export async function GET(_: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const { campaignId } = await context.params;
    const campaign = await CampaignModel.findOne({ id: campaignId }).lean();
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 });
    }

    const recipients = await CampaignRecipientModel.find({ campaignId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        subject: campaign.subject,
        status: campaign.status,
        audienceType: campaign.audienceType,
        totalRecipients: campaign.totalRecipients || 0,
        sentCount: campaign.sentCount || 0,
        failedCount: campaign.failedCount || 0,
        createdAt: campaign.createdAt,
        templateId: campaign.templateId || '',
      },
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        name: recipient.name || '',
        companyName: recipient.companyName || '',
        status: recipient.status,
        errorMessage: recipient.errorMessage || '',
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch campaign', code: 'CAMPAIGN_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
