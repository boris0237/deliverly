import { NextResponse } from 'next/server';
import { CompanyModel, connectDb, NotificationModel, UserModel } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

async function resolveCompanyId(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user?.companyId) return null;
  const company = await CompanyModel.findOne({ id: user.companyId }).lean();
  if (!company) return null;
  return company.id;
}

export async function PATCH(_: Request, context: { params: Promise<{ notificationId: string }> }) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const companyId = await resolveCompanyId(currentUserId);
    if (!companyId) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const { notificationId } = await context.params;
    const updated = await NotificationModel.findOneAndUpdate(
      { id: notificationId, companyId, userId: currentUserId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Notification not found', code: 'NOTIFICATION_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Notification marked as read.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notification', code: 'NOTIFICATION_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}

