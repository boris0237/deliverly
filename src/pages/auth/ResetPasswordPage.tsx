import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { getLocalizedApiError } from '@/lib/auth/error-message';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useUIStore();

  const token = searchParams?.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      showToast(t('errors.auth.RESET_TOKEN_MISSING'), 'error');
      return;
    }

    if (password.length < 8) {
      showToast(t('errors.auth.PASSWORD_TOO_SHORT'), 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast(t('errors.auth.PASSWORDS_DO_NOT_MATCH'), 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      showToast(t('errors.auth.PASSWORD_RESET_SUCCESS'), 'success');
      router.push('/auth/login');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/auth/login" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to login</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Reset password</h1>
        <p className="text-white/50">Choose a new secure password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-white/70">New password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-glass pl-12 pr-12"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-white/70">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-glass pl-12"
              minLength={8}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full btn-primary" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update password'}
        </Button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
