import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GoogleIcon from '@/components/icons/GoogleIcon';
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const error = url.searchParams.get('error');
    if (!error) return;
    showToast(t(`errors.auth.${error}`) || t('errors.auth.GOOGLE_AUTH_FAILED'), 'error');
    url.searchParams.delete('error');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [showToast, t]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('auth.login.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('auth.login.subtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            {t('auth.login.email')}
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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
          <label className="text-sm text-muted-foreground">
            {t('auth.login.password')}
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
            <span className="text-sm text-muted-foreground">{t('auth.login.rememberMe')}</span>
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

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-4 font-semibold tracking-[0.18em] text-muted-foreground">
            {t('auth.login.or')}
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleLogin}
        className="h-14 w-full rounded-2xl border border-border bg-card text-base font-semibold text-foreground hover:text-foreground active:text-foreground focus-visible:text-foreground shadow-sm shadow-slate-950/5 hover:-translate-y-0.5 hover:bg-background hover:shadow-lg hover:shadow-slate-950/10 dark:border-white/10 dark:bg-white dark:text-slate-950 dark:hover:text-slate-950 dark:active:text-slate-950 dark:focus-visible:text-slate-950 dark:hover:bg-white/95"
      >
        <GoogleIcon className="mr-2 h-5 w-5" />
        {t('auth.login.google')}
      </Button>

      {/* Register Link */}
      <p className="text-center text-sm text-muted-foreground">
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
