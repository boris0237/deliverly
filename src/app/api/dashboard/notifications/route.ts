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

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '20') || 20));

    const notifications = await NotificationModel.find({
      companyId,
      userId: currentUserId,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        companyId: notification.companyId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        isRead: notification.isRead === true,
        createdAt: notification.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notifications', code: 'NOTIFICATIONS_FETCH_FAILED' },
      { status: 500 }
    );
  }
}

export async function PATCH() {
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

    await NotificationModel.updateMany(
      { companyId, userId: currentUserId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return NextResponse.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notifications', code: 'NOTIFICATIONS_UPDATE_FAILED' },
      { status: 500 }
    );
  }
}

