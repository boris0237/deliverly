import type { UserRole } from '@/types';

export const ALL_DASHBOARD_PATHS = [
  '/dashboard',
  '/dashboard/deliveries',
  '/dashboard/drivers',
  '/dashboard/partners',
  '/dashboard/inventory',
  '/dashboard/expenses',
  '/dashboard/reports',
  '/dashboard/remittances',
  '/dashboard/tracking',
  '/dashboard/whatsapp-assistant',
  '/dashboard/users',
  '/dashboard/settings',
  '/dashboard/profile',
] as const;

const ROLE_ALLOWED_PATHS: Record<UserRole, string[]> = {
  superAdmin: [...ALL_DASHBOARD_PATHS],
  admin: [...ALL_DASHBOARD_PATHS],
  manager: [
    '/dashboard',
    '/dashboard/deliveries',
    '/dashboard/drivers',
    '/dashboard/partners',
    '/dashboard/inventory',
    '/dashboard/expenses',
    '/dashboard/reports',
    '/dashboard/remittances',
    '/dashboard/tracking',
    '/dashboard/whatsapp-assistant',
    '/dashboard/profile',
  ],
  stockManager: ['/dashboard/inventory', '/dashboard/deliveries', '/dashboard/reports', '/dashboard/profile'],
  partnerManager: ['/dashboard/partners', '/dashboard/deliveries', '/dashboard/reports', '/dashboard/remittances', '/dashboard/profile'],
  accountant: ['/dashboard', '/dashboard/expenses', '/dashboard/reports', '/dashboard/remittances', '/dashboard/profile'],
  driver: ['/dashboard/deliveries', '/dashboard/reports', '/dashboard/profile'],
};

const ROLE_DEFAULT_PATH: Record<UserRole, string> = {
  superAdmin: '/dashboard',
  admin: '/dashboard',
  manager: '/dashboard',
  stockManager: '/dashboard/inventory',
  partnerManager: '/dashboard/partners',
  accountant: '/dashboard',
  driver: '/dashboard/deliveries',
};

const normalizePath = (path: string) => path.split('?')[0].split('#')[0];

export const canAccessPath = (role: UserRole | undefined, path: string) => {
  if (!role) return false;
  const clean = normalizePath(path);
  const allowed = ROLE_ALLOWED_PATHS[role] || [];
  return allowed.some((allowedPath) => clean === allowedPath || clean.startsWith(`${allowedPath}/`));
};

export const getDefaultPathForRole = (role: UserRole | undefined) => {
  if (!role) return '/dashboard';
  return ROLE_DEFAULT_PATH[role] || '/dashboard';
};

export const getAllowedPathsForRole = (role: UserRole | undefined) => {
  if (!role) return [];
  return ROLE_ALLOWED_PATHS[role] || [];
};
