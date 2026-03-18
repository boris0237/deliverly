'use client';

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, Share2, PlusSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePwaInstallStore } from '@/store';

const DISMISS_KEY = 'pwa-install-dismissed';

const isIosDevice = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
};

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod|android/.test(window.navigator.userAgent.toLowerCase());
};

const PwaInstallPrompt = () => {
  const { t } = useTranslation();
  const {
    deferredPrompt,
    isInstallable,
    isInstalled,
    isPromptOpen,
    openPrompt,
    closePrompt,
  } = usePwaInstallStore();

  const isMobile = useMemo(() => isMobileDevice(), []);
  const isIos = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    if (!isMobile || isInstalled) return;
    const dismissed = typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_KEY);
    if (!dismissed && (isInstallable || isIos)) {
      const timeout = window.setTimeout(() => openPrompt(), 900);
      return () => window.clearTimeout(timeout);
    }
  }, [isInstallable, isInstalled, isIos, isMobile, openPrompt]);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    }
    closePrompt();
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    closePrompt();
  };

  if (!isMobile || isInstalled) return null;

  return (
    <Dialog open={isPromptOpen} onOpenChange={(open) => (open ? openPrompt() : handleDismiss())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Smartphone className="w-5 h-5 text-emerald-500" />
            {t('pwa.title')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t('pwa.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground space-y-3">
          <p>{t('pwa.benefit')}</p>
          {isIos && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-500" />
                <span>{t('pwa.iosStep1')}</span>
              </div>
              <div className="flex items-center gap-2">
                <PlusSquare className="w-4 h-4 text-emerald-500" />
                <span>{t('pwa.iosStep2')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={handleDismiss}>
            {t('pwa.later')}
          </Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleInstall} disabled={!deferredPrompt}>
            {t('pwa.install')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PwaInstallPrompt;
