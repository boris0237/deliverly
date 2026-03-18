import type { UserRole } from '@/types';

export const ALL_DASHBOARD_PATHS = [
  '/dashboard',
  '/dashboard/deliveries',
  '/dashboard/drivers',
  '/dashboard/partners',
  '/dashboard/inventory',
  '/dashboard/expenses',
  '/dashboard/billing',
  '/dashboard/reports',
  '/dashboard/remittances',
  '/dashboard/tracking',
  '/dashboard/whatsapp-assistant',
  '/dashboard/users',
  '/dashboard/settings',
  '/dashboard/profile',
] as const;

export const SUPERADMIN_PATHS = ['/superadmin/overview', '/superadmin/companies', '/superadmin/billing-plans', '/superadmin/campaigns'] as const;

const ROLE_ALLOWED_PATHS: Record<UserRole, string[]> = {
  superAdmin: ['/superadmin/overview', '/superadmin/companies', '/superadmin/billing-plans', '/superadmin/campaigns', '/dashboard/profile'],
  admin: [...ALL_DASHBOARD_PATHS, '/subscription-expired'],
  manager: [
    '/dashboard',
    '/dashboard/deliveries',
    '/dashboard/drivers',
    '/dashboard/partners',
    '/dashboard/inventory',
    '/dashboard/expenses',
    '/dashboard/billing',
    '/dashboard/reports',
    '/dashboard/remittances',
    '/dashboard/tracking',
    '/dashboard/whatsapp-assistant',
    '/dashboard/profile',
    '/subscription-expired',
  ],
  stockManager: ['/dashboard/inventory', '/dashboard/deliveries', '/dashboard/reports', '/dashboard/profile', '/subscription-expired'],
  partnerManager: ['/dashboard/partners', '/dashboard/deliveries', '/dashboard/reports', '/dashboard/remittances', '/dashboard/profile', '/subscription-expired'],
  accountant: ['/dashboard', '/dashboard/expenses', '/dashboard/billing', '/dashboard/reports', '/dashboard/remittances', '/dashboard/profile', '/subscription-expired'],
  driver: ['/dashboard/deliveries', '/dashboard/reports', '/dashboard/profile', '/subscription-expired'],
};

const ROLE_DEFAULT_PATH: Record<UserRole, string> = {
  superAdmin: '/superadmin/overview',
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

export type AccessPermission =
  | 'manageDeliveries'
  | 'manageInventory'
  | 'managePartners'
  | 'manageExpenses'
  | 'manageDrivers'
  | 'manageUsers'
  | 'manageSettings'
  | 'manageRemittances'
  | 'manageTracking'
  | 'manageWhatsapp';

const ROLE_PERMISSIONS: Record<UserRole, Record<AccessPermission, boolean>> = {
  superAdmin: {
    manageDeliveries: true,
    manageInventory: true,
    managePartners: true,
    manageExpenses: true,
    manageDrivers: true,
    manageUsers: true,
    manageSettings: true,
    manageRemittances: true,
    manageTracking: true,
    manageWhatsapp: true,
  },
  admin: {
    manageDeliveries: true,
    manageInventory: true,
    managePartners: true,
    manageExpenses: true,
    manageDrivers: true,
    manageUsers: true,
    manageSettings: true,
    manageRemittances: true,
    manageTracking: true,
    manageWhatsapp: true,
  },
  manager: {
    manageDeliveries: true,
    manageInventory: true,
    managePartners: true,
    manageExpenses: true,
    manageDrivers: true,
    manageUsers: false,
    manageSettings: false,
    manageRemittances: true,
    manageTracking: true,
    manageWhatsapp: true,
  },
  stockManager: {
    manageDeliveries: false,
    manageInventory: true,
    managePartners: false,
    manageExpenses: false,
    manageDrivers: false,
    manageUsers: false,
    manageSettings: false,
    manageRemittances: false,
    manageTracking: false,
    manageWhatsapp: false,
  },
  partnerManager: {
    manageDeliveries: true,
    manageInventory: false,
    managePartners: true,
    manageExpenses: false,
    manageDrivers: false,
    manageUsers: false,
    manageSettings: false,
    manageRemittances: true,
    manageTracking: false,
    manageWhatsapp: false,
  },
  accountant: {
    manageDeliveries: false,
    manageInventory: false,
    managePartners: false,
    manageExpenses: true,
    manageDrivers: false,
    manageUsers: false,
    manageSettings: false,
    manageRemittances: true,
    manageTracking: false,
    manageWhatsapp: false,
  },
  driver: {
    manageDeliveries: false,
    manageInventory: false,
    managePartners: false,
    manageExpenses: false,
    manageDrivers: false,
    manageUsers: false,
    manageSettings: false,
    manageRemittances: false,
    manageTracking: false,
    manageWhatsapp: false,
  },
};

export const canManage = (role: UserRole | undefined, permission: AccessPermission) => {
  if (!role) return false;
  return Boolean(ROLE_PERMISSIONS[role]?.[permission]);
};

export type ReportTypeKey = 'deliveries' | 'financial' | 'driver' | 'inventory' | 'partner';

const ROLE_REPORT_TYPES: Record<UserRole, ReportTypeKey[]> = {
  superAdmin: ['deliveries', 'financial', 'driver', 'inventory', 'partner'],
  admin: ['deliveries', 'financial', 'driver', 'inventory', 'partner'],
  manager: ['deliveries', 'financial', 'driver', 'inventory', 'partner'],
  stockManager: ['inventory'],
  partnerManager: ['deliveries', 'partner', 'financial'],
  accountant: ['financial', 'partner'],
  driver: ['deliveries'],
};

export const getAllowedReportTypes = (role: UserRole | undefined): ReportTypeKey[] => {
  if (!role) return [];
  return ROLE_REPORT_TYPES[role] || [];
};
