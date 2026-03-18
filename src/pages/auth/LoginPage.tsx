import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';
import { getDefaultPathForRole } from '@/lib/auth/access';

const LoginPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuthStore();
  const { showToast } = useUIStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const translatedError = getLocalizedApiError(t, data, response.status, 'errors.validation');
        showToast(translatedError, data?.code === 'EMAIL_NOT_VERIFIED' ? 'warning' : 'error');
        return;
      }

      login(data.user, null);
      showToast(t('auth.login.success') || 'Login successful', 'success');
      router.push(getDefaultPathForRole(data.user?.role));
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    showToast('Google login is not implemented yet.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">
          {t('auth.login.title')}
        </h1>
        <p className="text-white/50">
          {t('auth.login.subtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm text-white/70">
            {t('auth.login.email')}
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-glass pl-12"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label className="text-sm text-white/70">
            {t('auth.login.password')}
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-glass pl-12 pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500/20"
            />
            <span className="text-sm text-white/60">{t('auth.login.rememberMe')}</span>
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
          >
            {t('auth.login.forgotPassword')}
          </Link>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            t('auth.login.submit')
          )}
        </Button>
      </form>

   

      {/* Register Link */}
      <p className="text-center text-sm text-white/50">
        {t('auth.login.noAccount')}{' '}
        <Link
          href="/auth/register"
          className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
        >
          {t('auth.login.register')}
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;
