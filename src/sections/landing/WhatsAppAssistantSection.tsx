import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Bot, Sparkles, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WhatsAppAssistantSection = () => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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

  return (
    <section ref={sectionRef} className="relative py-24 px-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 right-10 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div
          className={`text-center mb-14 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            {t('landing.whatsappAssistant.badge')}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mt-4 mb-4">
            {t('landing.whatsappAssistant.title')}
          </h2>
          <p className="text-lg text-white/60 max-w-3xl mx-auto">
            {t('landing.whatsappAssistant.subtitle')}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-8 items-stretch">
          <div
            className={`glass-card-hover p-8 lg:p-10 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-white/50">{t('landing.whatsappAssistant.kicker')}</p>
                <h3 className="text-xl font-semibold text-white">{t('landing.whatsappAssistant.cardTitle')}</h3>
              </div>
            </div>

            <ul className="space-y-4">
              {['step1', 'step2', 'step3', 'step4'].map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-sm text-white/70">{t(`landing.whatsappAssistant.${key}`)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button className="bg-green-500 hover:bg-green-600">
                {t('landing.whatsappAssistant.ctaPrimary')}
              </Button>
              <Button variant="outline" className="border-green-500/30 text-green-700 hover:bg-green-500/10">
                {t('landing.whatsappAssistant.ctaSecondary')}
              </Button>
            </div>
          </div>

          <div
            className={`glass-card p-8 lg:p-10 flex flex-col justify-between transition-all duration-700 delay-150 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm text-white/50">{t('landing.whatsappAssistant.quickTitle')}</p>
                  <h4 className="text-lg font-semibold text-white">{t('landing.whatsappAssistant.quickSubtitle')}</h4>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50 mb-2">{t('landing.whatsappAssistant.flowTitle')}</div>
                <div className="grid gap-3">
                  {['flow1', 'flow2', 'flow3'].map((key) => (
                    <div key={key} className="flex items-center gap-3 text-sm text-white/70">
                      <Zap className="w-4 h-4 text-green-400" />
                      <span>{t(`landing.whatsappAssistant.${key}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-gradient-to-r from-green-500/20 to-emerald-500/10 border border-green-500/20 p-4">
              <p className="text-sm text-white/70">{t('landing.whatsappAssistant.highlight')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhatsAppAssistantSection;
