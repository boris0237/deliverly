'use client';

import DashboardLayout from '@/layouts/DashboardLayout';
import ProtectedRoute from '@/components/routing/ProtectedRoute';

export default function DashboardRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}
