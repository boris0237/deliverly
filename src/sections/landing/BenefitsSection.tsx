import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, TrendingDown, MapPin, TrendingUp } from 'lucide-react';

const BenefitsSection = () => {
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

  const benefits = [
    {
      key: 'time',
      icon: Clock,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/20',
      iconColor: 'text-orange-400'
    },
    {
      key: 'costs',
      icon: TrendingDown,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/20',
      iconColor: 'text-green-400'
    },
    {
      key: 'tracking',
      icon: MapPin,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/20',
      iconColor: 'text-blue-400'
    },
    {
      key: 'performance',
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/20',
      iconColor: 'text-purple-400'
    }
  ];

  return (
    <section 
      ref={sectionRef}
      className="relative py-24 px-6"
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.benefits.title')}
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            {t('landing.benefits.subtitle')}
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.key}
              className={`glass-card-hover p-6 text-center group transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className={`w-16 h-16 ${benefit.bgColor} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <benefit.icon className={`w-8 h-8 ${benefit.iconColor}`} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                {t(`landing.benefits.items.${benefit.key}.title`)}
              </h3>
              <p className="text-white/60 text-sm">
                {t(`landing.benefits.items.${benefit.key}.description`)}
              </p>
            </div>
          ))}
        </div>

        {/* Stats Banner */}
        <div className={`mt-16 glass-card p-8 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient-orange mb-2">30%</div>
              <div className="text-sm text-white/60">de temps économisé</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient-purple mb-2">20%</div>
              <div className="text-sm text-white/60">de coûts réduits</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">99%</div>
              <div className="text-sm text-white/60">de livraisons à temps</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">4.9</div>
              <div className="text-sm text-white/60">note moyenne</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;