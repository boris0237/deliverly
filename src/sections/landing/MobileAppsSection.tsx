import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, Apple, Play, Check, Bell, MapPin, ShieldCheck, Sparkles, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallStore } from '@/store';

const MobileAppsSection = () => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { deferredPrompt, openPrompt } = usePwaInstallStore();

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

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      return;
    }
    openPrompt();
  };

  return (
    <section ref={sectionRef} className="relative py-28 px-6 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-28 right-10 w-[32rem] h-[32rem] bg-emerald-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[24rem] h-[24rem] bg-orange-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[60rem] h-[60rem] opacity-40">
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_55%)]" />
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div
          className={`text-center mb-14 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold uppercase tracking-widest">
            <Smartphone className="w-4 h-4" />
            {t('landing.mobileApps.badge')}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mt-4 mb-4">
            {t('landing.mobileApps.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t('landing.mobileApps.subtitle')}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-10 items-stretch">
          <div
            className={`glass-card-hover p-8 lg:p-10 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('landing.mobileApps.kicker')}</p>
                  <h3 className="text-xl font-semibold text-foreground">{t('landing.mobileApps.cardTitle')}</h3>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <Sparkles className="w-4 h-4" />
                {t('landing.mobileApps.badge')}
              </div>
            </div>

            <ul className="space-y-4">
              {['feature1', 'feature2', 'feature3', 'feature4'].map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">{t(`landing.mobileApps.${key}`)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['stat1', 'stat2', 'stat3', 'stat4'].map((key) => (
                <div key={key} className="rounded-2xl border border-border/60 bg-background/60 p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{t(`landing.mobileApps.${key}.value`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`landing.mobileApps.${key}.label`)}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Button
                className="group h-20 justify-between rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-600 px-5  shadow-lg shadow-emerald-500/30 hover:from-emerald-500 hover:to-emerald-700"
                onClick={handleInstallClick}
              >
                <span className="flex items-center gap-2 text-left">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <Apple className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[11px] uppercase tracking-widest">{t('landing.mobileApps.installLabel')}</span>
                    <span className="text-sm font-semibold">{t('landing.mobileApps.appStore')}</span>
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
              <Button
                variant="outline"
                className="group h-20 justify-between rounded-2xl border border-emerald-500/30 bg-background/70 px-5 text-emerald-700 shadow-sm shadow-emerald-500/10 hover:to-emerald-700"
                onClick={handleInstallClick}
              >
                <span className="flex items-center gap-2 text-left">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <Play className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[11px] uppercase tracking-widest text-emerald-500/70">{t('landing.mobileApps.installLabel')}</span>
                    <span className="text-sm font-semibold">{t('landing.mobileApps.playStore')}</span>
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
            </div>
          </div>

          <div
            className={`glass-card p-8 lg:p-10 transition-all duration-700 delay-150 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className="grid gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/15 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('landing.mobileApps.previewKicker')}</p>
                  <h4 className="text-lg font-semibold text-foreground">{t('landing.mobileApps.previewTitle')}</h4>
                </div>
              </div>

              <div className="rounded-[2rem] border border-border/60 bg-gradient-to-br from-muted/40 via-background to-emerald-500/10 p-6 relative overflow-hidden">
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-orange-500/20 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-emerald-500/10 blur-2xl" />

                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('landing.mobileApps.previewSubtitle')}</p>
                    <p className="text-lg font-semibold text-foreground">{t('landing.mobileApps.previewHeadline')}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>

                <div className="space-y-3">
                  {[MapPin, Bell, Smartphone].map((Icon, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/70 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-orange-500/15 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {t(`landing.mobileApps.previewItems.${index}.title`)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`landing.mobileApps.previewItems.${index}.description`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>


              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between gap-3">
                <p className="text-sm text-emerald-700 dark:text-emerald-200">{t('landing.mobileApps.highlight')}</p>
                <Button size="sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700">
                  {t('landing.mobileApps.learnMore')}
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MobileAppsSection;
