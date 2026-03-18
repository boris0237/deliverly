import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, User, Building2, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { showToast } = useUIStore();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      showToast(t('errors.auth.PASSWORDS_DO_NOT_MATCH'), 'error');
      return;
    }
    
    if (!acceptTerms) {
      showToast(t('errors.auth.TERMS_NOT_ACCEPTED'), 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          companyName: formData.companyName,
          locale: i18n.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      showToast(data?.message || t('auth.register.success') || 'Registration successful', 'success');
      router.push('/auth/login');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = () => {
    showToast('Google registration is not implemented yet.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">
          {t('auth.register.title')}
        </h1>
        <p className="text-white/50">
          {t('auth.register.subtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-white/70">
              {t('auth.register.firstName')}
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                className="input-glass pl-12"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">
              {t('auth.register.lastName')}
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                className="input-glass pl-12"
                required
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm text-white/70">
            {t('auth.register.email')}
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="input-glass pl-12"
              required
            />
          </div>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <label className="text-sm text-white/70">
            {t('auth.register.companyName')}
          </label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="Your Company"
              className="input-glass pl-12"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label className="text-sm text-white/70">
            {t('auth.register.password')}
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="input-glass pl-12 pr-12"
              required
              minLength={8}
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

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="text-sm text-white/70">
            {t('auth.register.confirmPassword')}
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className="input-glass pl-12"
              required
            />
          </div>
        </div>

        {/* Terms */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500/20"
            required
          />
          <span className="text-sm text-white/60">
            {t('auth.register.acceptTerms')}
          </span>
        </label>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            t('auth.register.submit')
          )}
        </Button>
      </form>


      {/* Login Link */}
      <p className="text-center text-sm text-white/50">
        {t('auth.register.hasAccount')}{' '}
        <Link
          href="/auth/login"
          className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
        >
          {t('auth.register.login')}
        </Link>
      </p>
    </div>
  );
};

export default RegisterPage;
