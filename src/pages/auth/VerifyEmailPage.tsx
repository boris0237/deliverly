import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useUIStore();
  const { login } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(t('errors.auth.VERIFYING_EMAIL'));
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    if (hasVerifiedRef.current) return;
    const token = searchParams?.get('token');

    if (!token) {
      const errorMessage = t('errors.auth.VERIFICATION_TOKEN_MISSING');
      setStatus('error');
      setMessage(errorMessage);
      showToast(errorMessage, 'error');
      return;
    }

    const verificationKey = `verify_email:${token}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(verificationKey) === 'success') {
      const successMessage = t('errors.auth.EMAIL_VERIFIED_SUCCESS');
      setStatus('success');
      setMessage(successMessage);
      router.replace('/dashboard');
      return;
    }

    const verify = async () => {
      hasVerifiedRef.current = true;
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        if (!response.ok) {
          const errorMessage = getLocalizedApiError(t, data, response.status);
          setStatus('error');
          setMessage(errorMessage);
          showToast(errorMessage, 'error');
          return;
        }

        const successMessage = t('errors.auth.EMAIL_VERIFIED_SUCCESS');
        setStatus('success');
        setMessage(successMessage);
        showToast(successMessage, 'success');
        if (typeof window !== 'undefined') sessionStorage.setItem(verificationKey, 'success');
        if (data?.user) {
          login(data.user, null);
        }
        router.replace(data?.redirectTo || '/dashboard');
      } catch {
        const errorMessage = t('errors.network');
        setStatus('error');
        setMessage(errorMessage);
        showToast(errorMessage, 'error');
      }
    };

    verify();
  }, [searchParams, showToast, t, router]);

  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-white/5 border border-white/10">
        {status === 'loading' && <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />}
        {status === 'success' && <CheckCircle2 className="w-10 h-10 text-green-400" />}
        {status === 'error' && <XCircle className="w-10 h-10 text-red-400" />}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {status === 'loading' ? 'Verification in progress' : status === 'success' ? 'Email verified' : 'Verification failed'}
        </h1>
        <p className="text-white/60">{message}</p>
      </div>

      <Link href="/auth/login">
        <Button className="btn-primary">Go to login</Button>
      </Link>
    </div>
  );
};

export default VerifyEmailPage;
