import { NextResponse } from 'next/server';
import { BillingHistoryModel, CompanyModel, NotificationModel, UserModel, connectDb } from '@/lib/auth/db';
import { randomToken } from '@/lib/auth/crypto';
import { sendMailWithMailjet } from '@/lib/auth/mailjet';
import { buildBillingNoticeTemplate } from '@/lib/auth/email-templates';

export const runtime = 'nodejs';

const NOTICE_DAYS = [14, 7, 3];

function resolveLocale(value?: string) {
  return value === 'en' ? 'en' : 'fr';
}

function buildNoticeMessage(locale: 'fr' | 'en', planName: string, days: number, endDate: string) {
  if (locale === 'fr') {
    return {
      title: 'Renouvellement du plan',
      message: `Votre plan ${planName} se termine dans ${days} jours (fin le ${endDate}).`,
    };
  }
  return {
    title: 'Plan renewal',
    message: `Your ${planName} plan ends in ${days} days (ends on ${endDate}).`,
  };
}

export async function POST(request: Request) {
  const secret = process.env.BILLING_CRON_SECRET || '';
  const authHeader = request.headers.get('authorization') || '';
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  await connectDb();

  const now = new Date();
  const companies = await CompanyModel.find({
    isActive: true,
    $or: [
      { 'billing.currentPeriodEnd': { $ne: null } },
      { 'billing.trialEndsAt': { $ne: null } },
    ],
  }).lean();

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const billingLink = `${appUrl}/dashboard/billing`;

  let processed = 0;
  let notified = 0;

  for (const company of companies) {
    processed += 1;
    const billing = company.billing ;
    const endDate = billing?.trialEndsAt || billing?.currentPeriodEnd;
    if (!endDate) continue;

    const daysRemaining = Math.ceil((new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (!NOTICE_DAYS.includes(daysRemaining)) continue;
    if (billing.lastNoticeDays === daysRemaining) continue;

    const admins = await UserModel.find({
      companyId: company.id,
      role: { $in: ['admin', 'manager'] },
      isActive: true,
    }).lean();

    const locale = resolveLocale(company?.whatsappDefaultLocale);
    const formattedEndDate = new Date(endDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US');
    const planName = billing.planName || 'Starter';

    for (const admin of admins) {
      const userLocale = resolveLocale((admin as any)?.preferences?.language || locale);
      const { title, message } = buildNoticeMessage(userLocale, planName, daysRemaining, formattedEndDate);

      await NotificationModel.create({
        id: randomToken(12),
        userId: admin.id,
        companyId: company.id,
        type: 'system',
        title,
        message,
        data: { planName, daysRemaining, endDate },
        isRead: false,
        createdAt: now,
      });

      try {
        const emailTemplate = buildBillingNoticeTemplate({
          companyName: company.name,
          planName,
          daysRemaining,
          endDate: formattedEndDate,
          billingLink,
          locale: userLocale,
        });
        await sendMailWithMailjet({
          to: admin.email,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
        });
      } catch {
        // ignore mail errors for cron to continue
      }
    }

    await CompanyModel.updateOne(
      { id: company.id },
      {
        $set: {
          'billing.lastNoticeDays': daysRemaining,
          'billing.lastNoticeAt': now,
          updatedAt: now,
        },
      }
    );

    await BillingHistoryModel.updateMany(
      { companyId: company.id, status: 'pending' },
      { $set: { updatedAt: now } }
    );

    notified += 1;
  }

  return NextResponse.json({ processed, notified });
}
