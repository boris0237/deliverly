import type { User } from '@/types';
import type { AuthUserRecord } from './types';

export function toPublicUser(user: AuthUserRecord): User {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phone: user.phone || '',
    companyId: user.companyId || 'default',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`,
    isActive: user.isActive,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
    preferences: {
      language: 'fr',
      theme: 'light',
      notifications: {
        email: true,
        inApp: true,
        whatsapp: false,
      },
    },
  };
}
