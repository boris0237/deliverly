'use client';

import SuperAdminLayoutShell from '@/layouts/SuperAdminLayout';
import SuperAdminRoute from '@/components/routing/SuperAdminRoute';

export default function SuperAdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperAdminRoute>
      <SuperAdminLayoutShell>{children}</SuperAdminLayoutShell>
    </SuperAdminRoute>
  );
}
