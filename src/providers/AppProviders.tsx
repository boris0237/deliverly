'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { useAuthStore, useThemeStore } from '@/store';
import AppToaster from '@/components/ui/app-toaster';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore();
  const { login, logout, setLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/auth/me', { method: 'GET', cache: 'no-store' });
        if (!mounted) return;

        if (!response.ok) {
          logout();
          return;
        }

        const data = await response.json();
        if (data?.user) {
          login(data.user, null);
        } else {
          logout();
        }
      } catch {
        if (mounted) logout();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, [login, logout, setLoading]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <I18nextProvider i18n={i18n}>
      {children}
      <AppToaster />
    </I18nextProvider>
  );
}
