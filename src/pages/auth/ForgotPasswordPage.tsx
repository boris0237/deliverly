import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

const ForgotPasswordPage = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          locale: i18n.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setIsSubmitted(true);
      showToast(data?.message || t('auth.forgotPassword.success') || 'Reset email sent', 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {t('auth.forgotPassword.success')}
          </h1>
          <p className="text-white/50">
            Nous avons envoyé un lien de réinitialisation à {email}
          </p>
        </div>

        <Link href="/auth/login">
          <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('auth.forgotPassword.backToLogin')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link 
        href="/auth/login" 
        className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">{t('auth.forgotPassword.backToLogin')}</span>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          {t('auth.forgotPassword.title')}
        </h1>
        <p className="text-white/50">
          {t('auth.forgotPassword.subtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm text-white/70">
            {t('auth.forgotPassword.email')}
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

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            t('auth.forgotPassword.submit')
          )}
        </Button>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
