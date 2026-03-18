import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'next/navigation';
import { CreditCard, BadgeCheck, BadgeX, PhoneCall, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type BillingPlan = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  yearlyDiscountPercent: number;
  limits: { partners: number; drivers: number; users: number };
  features: { tracking: boolean; financialReports: boolean; whatsappAssistant: boolean };
};

type BillingHistory = {
  id: string;
  planName: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paidAt: string | null;
  createdAt: string;
};

type BillingResponse = {
  company: {
    name: string;
    billing: {
      planId: string;
      planName: string;
      status: string;
      interval: string;
      trialEndsAt: string | null;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
    };
  };
  usage: {
    partners: number;
    users: number;
    drivers: number;
  };
  plans: BillingPlan[];
  enterprisePlan: BillingPlan | null;
  history: BillingHistory[];
};

const BillingPage = () => {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const searchParams = useSearchParams();
  const [data, setData] = useState<BillingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      Number(value || 0)
    );

  const loadBilling = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dashboard/billing', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      setData(payload);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBilling();
  }, []);

  useEffect(() => {
    const success = searchParams?.get('success');
    if (success !== '1') return;
    const refresh = async () => {
      try {
        await fetch('/api/dashboard/billing/refresh', { method: 'POST' });
      } catch {
        // ignore refresh errors
      } finally {
        void loadBilling();
      }
    };
    void refresh();
  }, [searchParams]);

  const handleCheckout = async (planId: string, interval: 'month' | 'year') => {
    setIsPaying(`${planId}-${interval}`);
    try {
      const response = await fetch('/api/dashboard/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval }),
      });
      const payload = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, payload, response.status), 'error');
        return;
      }
      if (payload?.url) {
        window.location.href = payload.url as string;
      }
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsPaying(null);
    }
  };

  const currentPlan = data?.company.billing;
  const trialInfo = useMemo(() => {
    if (!currentPlan?.trialEndsAt) return '';
    const end = new Date(currentPlan.trialEndsAt);
    return end.toLocaleDateString();
  }, [currentPlan?.trialEndsAt]);

  const periodStart = useMemo(() => {
    if (!currentPlan?.currentPeriodStart) return '';
    return new Date(currentPlan.currentPeriodStart).toLocaleDateString();
  }, [currentPlan?.currentPeriodStart]);

  const periodEnd = useMemo(() => {
    const raw = currentPlan?.trialEndsAt || currentPlan?.currentPeriodEnd;
    if (!raw) return '';
    return new Date(raw).toLocaleDateString();
  }, [currentPlan?.currentPeriodEnd, currentPlan?.trialEndsAt]);

  const renewalNotice = useMemo(() => {
    const raw = currentPlan?.trialEndsAt || currentPlan?.currentPeriodEnd;
    if (!raw) return null;
    const endDate = new Date(raw);
    const now = new Date();
    const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isNaN(diffDays)) return null;
    if (diffDays <= 3) return { level: 'critical', days: diffDays };
    if (diffDays <= 7) return { level: 'warning', days: diffDays };
    if (diffDays <= 14) return { level: 'info', days: diffDays };
    return null;
  }, [currentPlan?.currentPeriodEnd, currentPlan?.trialEndsAt]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard.billing.title')}</h1>
        <p className="text-white/50">{t('dashboard.billing.subtitle')}</p>
      </div>

      {isLoading || !data ? (
        <div className="glass-card p-8 text-center text-white/60">{t('common.loading')}</div>
      ) : (
        <>
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-orange-400" />
              <div>
                <div className="text-sm text-white/60">{t('dashboard.billing.currentPlan')}</div>
                <div className="text-xl font-semibold text-white">{currentPlan?.planName || 'Starter'}</div>
              </div>
              <span className="ml-auto text-xs text-white/60">
                {currentPlan?.status === 'trialing'
                  ? t('dashboard.billing.status.trial')
                  : currentPlan?.status === 'active'
                  ? t('dashboard.billing.status.active')
                  : t('dashboard.billing.status.inactive')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-white/50">{t('dashboard.billing.usage.partners')}</div>
                <div className="text-white font-semibold">{data.usage.partners}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-white/50">{t('dashboard.billing.usage.drivers')}</div>
                <div className="text-white font-semibold">{data.usage.drivers}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-white/50">{t('dashboard.billing.usage.users')}</div>
                <div className="text-white font-semibold">{data.usage.users}</div>
              </div>
            </div>

            {currentPlan?.status === 'trialing' && trialInfo ? (
              <div className="text-sm text-orange-700">
                {t('dashboard.billing.trialEnds')} {trialInfo}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-white/50">{t('dashboard.billing.periodStart')}</div>
                <div className="text-white font-semibold">{periodStart || '-'}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-white/50">{t('dashboard.billing.periodEnd')}</div>
                <div className="text-white font-semibold">{periodEnd || '-'}</div>
              </div>
            </div>

            {renewalNotice ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${
                  renewalNotice.level === 'critical'
                    ? 'border-red-500/30 bg-red-500/10 text-red-700'
                    : renewalNotice.level === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-700'
                }`}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>
                  {renewalNotice.level === 'critical'
                    ? t('dashboard.billing.notice.critical', { days: renewalNotice.days })
                    : renewalNotice.level === 'warning'
                    ? t('dashboard.billing.notice.warning', { days: renewalNotice.days })
                    : t('dashboard.billing.notice.info', { days: renewalNotice.days })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass-card p-4 flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-4 p-1 bg-white/5 rounded-xl border border-white/10">
              <button
                onClick={() => setBillingCycle('month')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                  billingCycle === 'month' ? 'bg-orange-500 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {t('dashboard.billing.interval.month')}
              </button>
              <button
                onClick={() => setBillingCycle('year')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  billingCycle === 'year' ? 'bg-orange-500 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {t('dashboard.billing.interval.year')}
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                  -{data.plans[0]?.yearlyDiscountPercent ?? 0}%
                </span>
              </button>
            </div>
            <p className="text-sm text-white/50">{t('dashboard.billing.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {data.plans.map((plan, index) => {
              const yearly = plan.priceUsd * 12 * (1 - (plan.yearlyDiscountPercent || 0) / 100);
              const price = billingCycle === 'year' ? yearly : plan.priceUsd;
              const isPopular = index === 1;
              const planKey = plan.name?.toLowerCase().includes('starter')
                ? 'starter'
                : plan.name?.toLowerCase().includes('professional')
                ? 'professional'
                : plan.name?.toLowerCase().includes('enterprise')
                ? 'enterprise'
                : '';
              const translatedDescription = planKey
                ? t(`landing.pricing.plans.${planKey}.description`, { defaultValue: plan.description })
                : plan.description;
              return (
                <div
                  key={plan.id}
                  className={`relative transition-all ${isPopular ? 'lg:-mt-4 lg:mb-4' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <div className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-purple-600 rounded-full text-sm font-medium text-white">
                        <Sparkles className="w-4 h-4" />
                        {t('dashboard.billing.popular')}
                      </div>
                    </div>
                  )}

                  <div className={`h-full glass-card p-8 ${isPopular ? 'border-orange-500/30' : ''}`}>
                    <div className="text-center mb-8">
                      <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                      <p className="text-sm text-white/50 mb-6">{translatedDescription || t('dashboard.billing.noDescription')}</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-white">{formatMoney(price)}</span>
                        <span className="text-white/50">/{billingCycle === 'year' ? t('dashboard.billing.interval.year') : t('dashboard.billing.interval.month')}</span>
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8">
                      {[
                        `${t('dashboard.billing.usage.partners')}: ${plan.limits.partners}`,
                        `${t('dashboard.billing.usage.drivers')}: ${plan.limits.drivers}`,
                        `${t('dashboard.billing.usage.users')}: ${plan.limits.users}`,
                        plan.features.tracking
                          ? t('dashboard.billing.features.tracking')
                          : t('dashboard.billing.features.noTracking'),
                        plan.features.financialReports
                          ? t('dashboard.billing.features.financialReports')
                          : t('dashboard.billing.features.noFinancialReports'),
                        plan.features.whatsappAssistant ? t('dashboard.billing.features.whatsapp') : t('dashboard.billing.features.noWhatsapp'),
                      ].map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isPopular ? 'bg-orange-500/20' : 'bg-white/10'
                          }`}>
                            <Check className={`w-3 h-3 ${isPopular ? 'text-orange-400' : 'text-white/60'}`} />
                          </div>
                          <span className="text-sm text-white/70">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full ${
                        isPopular
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-white border border-white/20'
                      }`}
                      variant={isPopular ? 'default' : 'outline'}
                      onClick={() => handleCheckout(plan.id, billingCycle)}
                      disabled={isPaying === `${plan.id}-${billingCycle}`}
                    >
                      {isPaying === `${plan.id}-${billingCycle}` ? t('common.loading') : t('dashboard.billing.choosePlan')}
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="glass-card p-8 space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-white mb-2">{t('dashboard.billing.enterprise.title')}</h3>
                <p className="text-sm text-white/50">{t('dashboard.billing.enterprise.subtitle')}</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-white/10">
                    <Check className="w-3 h-3 text-white/60" />
                  </div>
                  <span className="text-sm text-white/70">{t('dashboard.billing.enterprise.feature1')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-white/10">
                    <Check className="w-3 h-3 text-white/60" />
                  </div>
                  <span className="text-sm text-white/70">{t('dashboard.billing.enterprise.feature2')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-white/10">
                    <Check className="w-3 h-3 text-white/60" />
                  </div>
                  <span className="text-sm text-white/70">{t('dashboard.billing.enterprise.feature3')}</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full">
                <PhoneCall className="w-4 h-4 mr-2" />
                {t('dashboard.billing.enterprise.contact')}
              </Button>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{t('dashboard.billing.history.title')}</h2>
            </div>
            {data.history.length === 0 ? (
              <div className="text-sm text-white/60">{t('dashboard.billing.history.empty')}</div>
            ) : (
              <div className="space-y-3">
                {data.history.map((entry) => (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="text-sm text-white font-medium">{entry.planName}</div>
                      <div className="text-xs text-white/50">
                        {entry.interval === 'year' ? t('dashboard.billing.interval.year') : t('dashboard.billing.interval.month')}
                      </div>
                    </div>
                    <div className="text-sm text-white/70">{formatMoney(entry.amount)}</div>
                    <div className="text-xs text-white/50">
                      {entry.status === 'paid'
                        ? t('dashboard.billing.status.paid')
                        : entry.status === 'failed'
                        ? t('dashboard.billing.status.failed')
                        : entry.status === 'refunded'
                        ? t('dashboard.billing.status.refunded')
                        : t('dashboard.billing.status.pending')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BillingPage;
