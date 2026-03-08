import { randomToken } from '@/lib/auth/crypto';
import { NotificationModel, UserModel } from '@/lib/auth/db';
import { emitNotificationRealtimeEvent } from '@/lib/realtime/socket-server';

type NotificationType = 'delivery' | 'driver' | 'inventory' | 'system';

type CreateCompanyNotificationsInput = {
  companyId: string;
  actorUserId?: string;
  recipientUserIds?: string[];
  title: string;
  message: string;
  type?: NotificationType;
  data?: Record<string, unknown>;
};

export async function createCompanyNotifications(input: CreateCompanyNotificationsInput) {
  const normalizedRecipientIds = Array.isArray(input.recipientUserIds)
    ? Array.from(new Set(input.recipientUserIds.map((id) => String(id || '').trim()).filter(Boolean)))
    : [];

  const recipients = normalizedRecipientIds.length
    ? await UserModel.find({
        companyId: input.companyId,
        isActive: true,
        id: input.actorUserId
          ? { $in: normalizedRecipientIds.filter((id) => id !== input.actorUserId) }
          : { $in: normalizedRecipientIds },
      })
        .select({ id: 1 })
        .lean()
    : await UserModel.find({
        companyId: input.companyId,
        isActive: true,
        ...(input.actorUserId ? { id: { $ne: input.actorUserId } } : {}),
      })
        .select({ id: 1 })
        .lean();

  if (!recipients.length) return;

  const now = new Date();
  const docs = recipients.map((recipient) => ({
    id: randomToken(12),
    userId: recipient.id,
    companyId: input.companyId,
    type: input.type || 'system',
    title: input.title,
    message: input.message,
    data: input.data || {},
    isRead: false,
    readAt: null,
    createdAt: now,
  }));

  await NotificationModel.insertMany(docs, { ordered: false });

  for (const doc of docs) {
    emitNotificationRealtimeEvent({
      companyId: input.companyId,
      userId: doc.userId,
      notification: {
        id: doc.id,
        userId: doc.userId,
        companyId: doc.companyId,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        data: doc.data,
        isRead: false,
        createdAt: now.toISOString(),
      },
    });
  }
}
