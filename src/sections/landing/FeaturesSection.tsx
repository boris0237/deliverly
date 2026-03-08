import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Package, 
  MapPin, 
  Boxes, 
  Store, 
  FileText, 
  TrendingUp,
  ArrowRight
} from 'lucide-react';

const FeaturesSection = () => {
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
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      key: 'delivery',
      icon: Package,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
      size: 'large'
    },
    {
      key: 'tracking',
      icon: MapPin,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      size: 'small'
    },
    {
      key: 'inventory',
      icon: Boxes,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      size: 'small'
    },
    {
      key: 'partners',
      icon: Store,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/20',
      iconColor: 'text-green-400',
      size: 'small'
    },
    {
      key: 'reports',
      icon: FileText,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-500/20',
      iconColor: 'text-pink-400',
      size: 'small'
    },
    {
      key: 'analytics',
      icon: TrendingUp,
      color: 'from-cyan-500 to-cyan-600',
      bgColor: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
      size: 'small'
    }
  ];

  return (
    <section 
      ref={sectionRef}
      id="features" 
      className="relative py-24 px-6"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.features.title')}
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            {t('landing.features.subtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Large Feature Card */}
          <div 
            className={`md:row-span-2 glass-card-hover p-8 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <div className={`w-16 h-16 ${features[0].bgColor} rounded-2xl flex items-center justify-center mb-6`}>
              <Package className={`w-8 h-8 ${features[0].iconColor}`} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">
              {t(`landing.features.items.${features[0].key}.title`)}
            </h3>
            <p className="text-white/60 mb-8">
              {t(`landing.features.items.${features[0].key}.description`)}
            </p>
            
            {/* Mini Dashboard Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">DEL-001</div>
                    <div className="text-xs text-white/50">En cours</div>
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">DEL-002</div>
                    <div className="text-xs text-white/50">Assigné</div>
                  </div>
                </div>
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">DEL-003</div>
                    <div className="text-xs text-white/50">Livré</div>
                  </div>
                </div>
                <div className="w-2 h-2 bg-gray-500 rounded-full" />
              </div>
            </div>
          </div>

          {/* Small Feature Cards */}
          {features.slice(1).map((feature, index) => (
            <div 
              key={feature.key}
              className={`glass-card-hover p-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${(index + 2) * 100}ms` }}
            >
              <div className={`w-14 h-14 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-4`}>
                <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {t(`landing.features.items.${feature.key}.title`)}
              </h3>
              <p className="text-white/60 text-sm mb-4">
                {t(`landing.features.items.${feature.key}.description`)}
              </p>
              <button className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors group">
                En savoir plus
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;