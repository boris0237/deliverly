import { useRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Check, Sparkles, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PricingPlan = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  yearlyDiscountPercent: number;
  limits: { partners: number; drivers: number; users: number };
  features: { tracking: boolean; financialReports: boolean; whatsappAssistant: boolean };
};

const PricingSection = () => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [plansData, setPlansData] = useState<PricingPlan[]>([]);
  const [enterprisePlan, setEnterprisePlan] = useState<PricingPlan | null>(null);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [fxRate, setFxRate] = useState(1);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const locale = navigator.language || 'fr-CM';
    const region = new Intl.Locale(locale).region || '';
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const currencyByRegion: Record<string, string> = {
      CM: 'XAF',
      CI: 'XOF',
      SN: 'XOF',
      ML: 'XOF',
      BF: 'XOF',
      NE: 'XOF',
      TG: 'XOF',
      BJ: 'XOF',
      GA: 'XAF',
      GQ: 'XAF',
      TD: 'XAF',
      CF: 'XAF',
      CG: 'XAF',
      CD: 'CDF',
      NG: 'NGN',
      GH: 'GHS',
      KE: 'KES',
      TZ: 'TZS',
      UG: 'UGX',
      ZA: 'ZAR',
      MA: 'MAD',
      DZ: 'DZD',
      TN: 'TND',
      EG: 'EGP',
      FR: 'EUR',
      BE: 'EUR',
      DE: 'EUR',
      ES: 'EUR',
      IT: 'EUR',
      PT: 'EUR',
      US: 'USD',
      CA: 'CAD',
      GB: 'GBP',
    };
    const guessedByTimeZone = timeZone.includes('Africa/Douala') ? 'XAF' : '';
    const detectedCurrency = guessedByTimeZone || currencyByRegion[region] || (locale.startsWith('fr') ? 'XAF' : 'USD');
    setCurrencyCode(detectedCurrency);

    const fallbackRates: Record<string, number> = {
      XAF: 600,
      XOF: 600,
      CDF: 2800,
      NGN: 1500,
      GHS: 13,
      KES: 130,
      TZS: 2600,
      UGX: 3900,
      ZAR: 19,
      MAD: 10,
      DZD: 135,
      TND: 3.1,
      EGP: 48,
      EUR: 0.92,
      GBP: 0.79,
      CAD: 1.35,
    };

    if (detectedCurrency === 'USD') {
      setFxRate(1);
      return;
    }

    const cacheKey = `fx-USD-${detectedCurrency}`;
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { rate: number; ts: number };
        if (Date.now() - parsed.ts < 12 * 60 * 60 * 1000) {
          setFxRate(parsed.rate || fallbackRates[detectedCurrency] || 1);
          return;
        }
      } catch {
        // ignore cache errors
      }
    }

    fetch(`https://api.exchangerate.host/latest?base=USD&symbols=${detectedCurrency}`)
      .then((res) => res.json())
      .then((data) => {
        const rate = Number(data?.rates?.[detectedCurrency]);
        if (!rate) {
          setFxRate(fallbackRates[detectedCurrency] || 1);
          return;
        }
        setFxRate(rate);
        window.sessionStorage.setItem(cacheKey, JSON.stringify({ rate, ts: Date.now() }));
      })
      .catch(() => {
        setFxRate(fallbackRates[detectedCurrency] || 1);
      });
  }, []);

  const fallbackPlans = useMemo<PricingPlan[]>(
    () => [
      {
        id: 'starter',
        name: t('landing.pricing.plans.starter.name'),
        description: t('landing.pricing.plans.starter.description'),
        priceUsd: Number(t('landing.pricing.plans.starter.price').replace(/[^0-9]/g, '')) || 29,
        yearlyDiscountPercent: 20,
        limits: { partners: 3, drivers: 3, users: 5 },
        features: { tracking: true, financialReports: true, whatsappAssistant: false },
      },
      {
        id: 'professional',
        name: t('landing.pricing.plans.professional.name'),
        description: t('landing.pricing.plans.professional.description'),
        priceUsd: Number(t('landing.pricing.plans.professional.price').replace(/[^0-9]/g, '')) || 79,
        yearlyDiscountPercent: 20,
        limits: { partners: 15, drivers: 15, users: 30 },
        features: { tracking: true, financialReports: true, whatsappAssistant: true },
      },
    ],
    [t]
  );

  const fallbackEnterprise = useMemo<PricingPlan>(
    () => ({
      id: 'enterprise',
      name: t('landing.pricing.plans.enterprise.name'),
      description: t('landing.pricing.plans.enterprise.description'),
      priceUsd: 0,
      yearlyDiscountPercent: 0,
      limits: { partners: 0, drivers: 0, users: 0 },
      features: { tracking: true, financialReports: true, whatsappAssistant: true },
    }),
    [t]
  );

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await fetch('/api/public/billing-plans', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) {
          setPlansData(fallbackPlans);
          setEnterprisePlan(null);
          return;
        }
        setPlansData(payload.plans || fallbackPlans);
        setEnterprisePlan(payload.enterprisePlan || null);
      } catch {
        setPlansData(fallbackPlans);
        setEnterprisePlan(null);
      } finally {
        // no-op
      }
    };
    void loadPlans();
  }, [fallbackPlans]);

  const plans = useMemo(() => {
    const base = plansData.length ? plansData : fallbackPlans;
    const composed = enterprisePlan ? [...base, enterprisePlan] : [...base, fallbackEnterprise];
    return composed.map((plan, index) => ({
      ...plan,
      popular: index === 1,
      buttonVariant: index === 1 ? ('default' as const) : ('outline' as const),
      isEnterprise: plan.id === (enterprisePlan?.id || fallbackEnterprise.id),
    }));
  }, [plansData, enterprisePlan, fallbackPlans, fallbackEnterprise]);

  useEffect(() => {
    if (!plans.length) return;
    const defaultPlan = plans.find((plan) => plan.popular) || plans[0];
    setActivePlanId((current) => current || defaultPlan.id);
  }, [plans]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === activePlanId) || plans[1] || plans[0],
    [activePlanId, plans]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(typeof navigator !== 'undefined' ? navigator.language || 'fr-CM' : 'fr-CM', {
      style: 'currency',
      currency: isHydrated ? currencyCode : 'USD',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const getPlanPrice = (plan: PricingPlan & { isEnterprise?: boolean }) => {
    if (plan.isEnterprise || plan.priceUsd === 0) return t('landing.pricing.contactPrice');
    const discount = plan.yearlyDiscountPercent || 0;
    const yearlyPrice = Math.round(plan.priceUsd * 12 * (1 - discount / 100));
    const basePrice = billingCycle === 'yearly' ? yearlyPrice : plan.priceUsd;
    const rate = isHydrated ? fxRate : 1;
    return formatCurrency(basePrice * rate);
  };

  const formatLimit = (value:any) => {
    if (!value) return t('landing.pricing.features.unlimited');
    return value.toString();
  };
  const getPlanFeatures = (plan: PricingPlan) => [
    t('landing.pricing.features.partners', { count: formatLimit(plan.limits.partners) }),
    t('landing.pricing.features.drivers', { count: formatLimit(plan.limits.drivers) }),
    t('landing.pricing.features.users', { count: formatLimit(plan.limits.users) }),
    plan.features.tracking ? t('landing.pricing.features.tracking') : null,
    plan.features.financialReports ? t('landing.pricing.features.financialReports') : null,
    plan.features.whatsappAssistant ? t('landing.pricing.features.whatsappAssistant') : null,
  ].filter(Boolean);

  return (
    <section 
      ref={sectionRef}
      id="pricing" 
      className="relative py-24 px-6"
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            {t('landing.pricing.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('landing.pricing.subtitle')}
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 p-1 bg-muted/60 rounded-2xl border border-border/60">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('landing.pricing.billing.monthly')}
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('landing.pricing.billing.yearly')}
              <span
                className="px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-xs rounded-full"
                suppressHydrationWarning
              >
                {t('landing.pricing.billing.discount', {
                  percent: plans[0]?.yearlyDiscountPercent ?? 0,
                })}
              </span>
            </button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground" suppressHydrationWarning>
            {t('landing.pricing.billing.note', { percent: plans[0]?.yearlyDiscountPercent ?? 0 })}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              className={`relative transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${
                plan.popular ? 'lg:-mt-4 lg:mb-4' : ''
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-purple-600 rounded-full text-sm font-medium text-white shadow-lg shadow-orange-500/30">
                    <Sparkles className="w-4 h-4" />
                    {t('landing.pricing.plans.professional.popular')}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setActivePlanId(plan.id)}
                className={`h-full w-full text-left glass-card p-8 transition-all ${plan.popular ? 'border-orange-500/30' : ''} ${
                  activePlanId === plan.id ? 'ring-2 ring-orange-500/40 shadow-xl shadow-orange-500/10' : ''
                }`}
              >
                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {plan.description || t('landing.pricing.defaultDescription')}
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-foreground" suppressHydrationWarning>
                      {getPlanPrice(plan)}
                    </span>
                    {!plan.isEnterprise && (
                      <span className="text-muted-foreground">
                        {t('landing.pricing.period')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {getPlanFeatures(plan).map((feature, featureIndex) => {
                    return (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.popular ? 'bg-orange-500/20' : 'bg-white/10'
                        }`}>
                          <Check className={`w-3 h-3 ${plan.popular ? 'text-orange-400' : 'text-white/60'}`} />
                        </div>
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    );
                  })}
                </ul>

                {/* CTA Button */}
                <Link href="/auth/register">
                  <Button 
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white' 
                        : 'bg-background/80 hover:bg-muted text-foreground border border-border/60'
                    }`}
                    variant={plan.buttonVariant}
                  >
                    {plan.isEnterprise
                      ? t('landing.pricing.cta.contact')
                      : t('landing.pricing.cta.start')}
                  </Button>
                </Link>
              </button>
            </div>
          ))}
        </div>

        <div className={`mt-10 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="glass-card p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-orange-500 uppercase tracking-widest">
                {t('landing.pricing.highlight.label')}
              </div>
              <h4 className="text-xl font-semibold text-foreground">
                {selectedPlan?.name} · {t('landing.pricing.highlight.title')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {selectedPlan?.description || t('landing.pricing.defaultDescription')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[0, 1, 2].map((featureIndex) => {
                const feature = selectedPlan ? getPlanFeatures(selectedPlan)[featureIndex] : null;
                if (!feature) return null;
                return (
                  <span
                    key={featureIndex}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground"
                  >
                    <Check className="w-3 h-3 text-emerald-500" />
                    {feature}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t('landing.pricing.highlight.ctaLabel')}</span>
              <Link href="/auth/register" className="inline-flex items-center gap-2 text-orange-500 font-semibold">
                {t('landing.pricing.highlight.cta')}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ Link */}
        <div className={`text-center mt-12 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <p className="text-muted-foreground">
            {t('landing.pricing.faq.label')}{' '}
            <a href="#faq" className="text-orange-500 hover:text-orange-400 transition-colors">
              {t('landing.pricing.faq.link')}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
