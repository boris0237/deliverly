'use client';

import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';

export default function SubscriptionExpiredPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="glass-card max-w-xl w-full p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">{t('subscriptionExpired.title')}</h1>
        <p className="text-white/60">{t('subscriptionExpired.subtitle')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button className="btn-primary" onClick={() => router.push('/dashboard/billing')}>
            {t('subscriptionExpired.contactAdmin')}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
              logout();
              router.replace('/auth/login');
            }}
          >
            {t('subscriptionExpired.logout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
