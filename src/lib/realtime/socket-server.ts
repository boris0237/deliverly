import type { Server as SocketIOServer } from 'socket.io';

type DeliveryRealtimeEvent = {
  companyId: string;
  deliveryId?: string;
  type: 'created' | 'updated' | 'deleted' | 'accepted';
};
type NotificationRealtimeEvent = {
  companyId: string;
  userId: string;
  notification: {
    id: string;
    userId: string;
    companyId: string;
    type: 'delivery' | 'driver' | 'inventory' | 'system';
    title: string;
    message: string;
    data?: Record<string, unknown>;
    isRead: boolean;
    createdAt: string;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __deliverlySocketServer: SocketIOServer | undefined;
}

export function setSocketServer(io: SocketIOServer) {
  globalThis.__deliverlySocketServer = io;
}

export function getSocketServer() {
  return globalThis.__deliverlySocketServer;
}

export function emitDeliveryRealtimeEvent(event: DeliveryRealtimeEvent) {
  const io = getSocketServer();
  if (!io) return;
  io.emit('deliveries:updated', event);
}

export function emitNotificationRealtimeEvent(event: NotificationRealtimeEvent) {
  const io = getSocketServer();
  if (!io) return;
  io.emit('notifications:new', event);
}
