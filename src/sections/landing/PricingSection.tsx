import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PricingSection = () => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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

  const plans = [
    {
      key: 'starter',
      popular: false,
      gradient: 'from-gray-500/20 to-gray-600/10',
      buttonVariant: 'outline' as const
    },
    {
      key: 'professional',
      popular: true,
      gradient: 'from-orange-500/20 via-purple-500/20 to-orange-600/10',
      buttonVariant: 'default' as const
    },
    {
      key: 'enterprise',
      popular: false,
      gradient: 'from-blue-500/20 to-blue-600/10',
      buttonVariant: 'outline' as const
    }
  ];

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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.pricing.title')}
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
            {t('landing.pricing.subtitle')}
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1 bg-white/5 rounded-xl border border-white/10">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-orange-500 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-orange-500 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Annuel
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <div
              key={plan.key}
              className={`relative transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${
                plan.popular ? 'lg:-mt-4 lg:mb-4' : ''
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-purple-600 rounded-full text-sm font-medium text-white">
                    <Sparkles className="w-4 h-4" />
                    {t('landing.pricing.plans.professional.popular')}
                  </div>
                </div>
              )}

              <div className={`h-full glass-card p-8 ${plan.popular ? 'border-orange-500/30' : ''}`}>
                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold text-white mb-2">
                    {t(`landing.pricing.plans.${plan.key}.name`)}
                  </h3>
                  <p className="text-sm text-white/50 mb-6">
                    {t(`landing.pricing.plans.${plan.key}.description`)}
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">
                      {billingCycle === 'yearly' && plan.key !== 'enterprise'
                        ? Math.round(parseInt(t(`landing.pricing.plans.${plan.key}.price`).replace(/[^0-9]/g, '')) * 0.8) + '€'
                        : t(`landing.pricing.plans.${plan.key}.price`)}
                    </span>
                    {plan.key !== 'enterprise' && (
                      <span className="text-white/50">
                        {t(`landing.pricing.plans.${plan.key}.period`)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {[0, 1, 2, 3, 4, 5].map((featureIndex) => {
                    const feature = t(`landing.pricing.plans.${plan.key}.features.${featureIndex}`, { defaultValue: '' });
                    if (!feature) return null;
                    return (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.popular ? 'bg-orange-500/20' : 'bg-white/10'
                        }`}>
                          <Check className={`w-3 h-3 ${plan.popular ? 'text-orange-400' : 'text-white/60'}`} />
                        </div>
                        <span className="text-sm text-white/70">{feature}</span>
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
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/20'
                    }`}
                    variant={plan.buttonVariant}
                  >
                    {t(`landing.pricing.plans.${plan.key}.cta`)}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Link */}
        <div className={`text-center mt-12 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <p className="text-white/50">
            Des questions ?{' '}
            <a href="#faq" className="text-orange-400 hover:text-orange-300 transition-colors">
              Consultez notre FAQ
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;