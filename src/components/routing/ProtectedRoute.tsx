'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store';
import { canAccessPath, getDefaultPathForRole } from '@/lib/auth/access';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [billingChecked, setBillingChecked] = useState(false);
  const [billingExpired, setBillingExpired] = useState(false);
  const checkBilling = useCallback(async () => {
    if (!isAuthenticated || !user || user.role === 'superAdmin') {
      setBillingExpired(false);
      setBillingChecked(true);
      return;
    }

    setBillingChecked(false);
    try {
      const response = await fetch('/api/dashboard/billing/status', { cache: 'no-store' });
      const payload = await response.json();
      if (response.ok) {
        setBillingExpired(Boolean(payload?.expired));
      }
    } catch {
      // ignore billing check errors
    } finally {
      setBillingChecked(true);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    if (!isLoading && isAuthenticated && user && pathname && !canAccessPath(user.role, pathname)) {
      router.replace(getDefaultPathForRole(user?.role));
    }
  }, [isAuthenticated, isLoading, pathname, router, user]);

  useEffect(() => {
    void checkBilling();
  }, [checkBilling]);

  useEffect(() => {
    const handleBillingStatusChanged = () => {
      void checkBilling();
    };

    window.addEventListener('billing-status-changed', handleBillingStatusChanged);
    return () => window.removeEventListener('billing-status-changed', handleBillingStatusChanged);
  }, [checkBilling]);

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!billingChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (billingExpired) {
    const isBillingPage = pathname === '/dashboard/billing';
    const isExpiredPage = pathname === '/subscription-expired';
    const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
    if (!isBillingPage && !isExpiredPage) {
      router.replace(isAdminOrManager ? '/dashboard/billing' : '/subscription-expired');
      return null;
    }
    if (!isAdminOrManager && !isExpiredPage) {
      router.replace('/subscription-expired');
      return null;
    }
  }

  if (pathname && !canAccessPath(user.role, pathname)) {
    return null;
  }

  return <>{children}</>;
}
