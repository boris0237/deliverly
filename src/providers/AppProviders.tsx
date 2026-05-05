'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { useAuthStore, useThemeStore, usePwaInstallStore } from '@/store';
import AppToaster from '@/components/ui/app-toaster';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore();
  const { login, logout, setLoading, user, isAuthenticated } = useAuthStore();
  const { setDeferredPrompt, setInstallable, setInstalled } = usePwaInstallStore();

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      const needsBootstrap = !user || !isAuthenticated;
      if (!needsBootstrap) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/auth/me', { method: 'GET', cache: 'no-store' });
        if (!mounted) return;

        if (!response.ok) {
          if (!user) {
            logout();
          }
          return;
        }

        const data = await response.json();
        if (data?.user) {
          login(data.user, null);
        } else {
          if (!user) {
            logout();
          }
        }
      } catch {
        if (!mounted) return;
        if (!user) {
          logout();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, login, logout, setLoading, user]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(isStandalone);

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as any);
      setInstallable(true);
    };

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [setDeferredPrompt, setInstallable, setInstalled]);

  return (
    <I18nextProvider i18n={i18n}>
      {children}
      <GoogleAnalytics />
      <PwaInstallPrompt />
      <AppToaster />
    </I18nextProvider>
  );
}
