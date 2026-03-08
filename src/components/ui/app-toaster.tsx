'use client';

import { useEffect } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';
import { useThemeStore, useUIStore } from '@/store';

export default function AppToaster() {
  const { isDark } = useThemeStore();
  const { toast, hideToast } = useUIStore();

  useEffect(() => {
    if (!toast.show || !toast.message) return;

    if (toast.type === 'success') sonnerToast.success(toast.message);
    if (toast.type === 'error') sonnerToast.error(toast.message);
    if (toast.type === 'warning') sonnerToast.warning(toast.message);
    if (toast.type === 'info') sonnerToast.info(toast.message);

    hideToast();
  }, [toast.id, toast.show, toast.message, toast.type, hideToast]);

  return <Toaster position="top-right" richColors theme={isDark ? 'dark' : 'light'} />;
}
