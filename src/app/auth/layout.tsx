'use client';

import AuthLayout from '@/layouts/AuthLayout';
import PublicRoute from '@/components/routing/PublicRoute';

export default function AuthRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicRoute>
      <AuthLayout>{children}</AuthLayout>
    </PublicRoute>
  );
}
