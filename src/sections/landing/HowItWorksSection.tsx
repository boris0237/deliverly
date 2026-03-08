import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, UserCheck, MapPin } from 'lucide-react';

const HowItWorksSection = () => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

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

  // Auto-advance steps
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 3000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const steps = [
    {
      key: '1',
      icon: Package,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/20',
      iconColor: 'text-orange-400'
    },
    {
      key: '2',
      icon: UserCheck,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/20',
      iconColor: 'text-purple-400'
    },
    {
      key: '3',
      icon: MapPin,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/20',
      iconColor: 'text-blue-400'
    }
  ];

  return (
    <section 
      ref={sectionRef}
      id="how-it-works" 
      className="relative py-24 px-6"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.howItWorks.title')}
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            {t('landing.howItWorks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Steps List */}
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div
                key={step.key}
                className={`relative flex gap-6 p-6 rounded-2xl transition-all duration-500 cursor-pointer ${
                  activeStep === index 
                    ? 'bg-white/10 border border-white/20' 
                    : 'bg-transparent border border-transparent hover:bg-white/5'
                } ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}
                style={{ transitionDelay: `${index * 150}ms` }}
                onClick={() => setActiveStep(index)}
              >
                {/* Step Number */}
                <div className="flex-shrink-0">
                  <div className={`w-14 h-14 ${step.bgColor} rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    activeStep === index ? 'scale-110' : ''
                  }`}>
                    <step.icon className={`w-7 h-7 ${step.iconColor}`} />
                  </div>
                </div>

                {/* Step Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-sm font-medium ${step.iconColor}`}>
                      Étape {step.key}
                    </span>
                    {activeStep === index && (
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {t(`landing.howItWorks.steps.${step.key}.title`)}
                  </h3>
                  <p className="text-white/60">
                    {t(`landing.howItWorks.steps.${step.key}.description`)}
                  </p>
                </div>

                {/* Progress Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-[2.875rem] top-[5.5rem] w-0.5 h-6 bg-white/10">
                    <div 
                      className={`w-full bg-gradient-to-b ${step.color} transition-all duration-500`}
                      style={{ 
                        height: activeStep > index ? '100%' : '0%',
                        transitionDelay: '300ms'
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Visual Preview */}
          <div className={`relative transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-50" />
              
              {/* Preview Card */}
              <div className="relative glass-card p-8">
                {/* Step Preview Content */}
                <div className="space-y-6">
                  {activeStep === 0 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center gap-4 p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                          <Package className="w-6 h-6 text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium">Nouvelle livraison</div>
                          <div className="text-sm text-white/50">Création en cours...</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-10 bg-white/5 rounded-lg flex items-center px-4">
                          <span className="text-sm text-white/40">Nom du client</span>
                        </div>
                        <div className="h-10 bg-white/5 rounded-lg flex items-center px-4">
                          <span className="text-sm text-white/40">Adresse de livraison</span>
                        </div>
                        <div className="h-10 bg-white/5 rounded-lg flex items-center px-4">
                          <span className="text-sm text-white/40">Téléphone</span>
                        </div>
                      </div>
                      <button className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors">
                        Créer la livraison
                      </button>
                    </div>
                  )}

                  {activeStep === 1 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center gap-4 p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                          <UserCheck className="w-6 h-6 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium">Assigner un livreur</div>
                          <div className="text-sm text-white/50">3 livreurs disponibles</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {['Jean Dupont', 'Marie Martin', 'Pierre Bernard'].map((name, i) => (
                          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            i === 0 
                              ? 'bg-purple-500/10 border-purple-500/30' 
                              : 'bg-white/5 border-transparent hover:bg-white/10'
                          }`}>
                            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                              <span className="text-sm text-white/70">{name.charAt(0)}</span>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm text-white">{name}</div>
                              <div className="text-xs text-white/50">
                                {i === 0 ? 'À 0.5km' : i === 1 ? 'À 1.2km' : 'À 2.1km'}
                              </div>
                            </div>
                            {i === 0 && (
                              <div className="w-3 h-3 bg-purple-500 rounded-full" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center gap-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium">Suivi en temps réel</div>
                          <div className="text-sm text-white/50">Livraison en cours</div>
                        </div>
                      </div>
                      <div className="aspect-video bg-white/5 rounded-xl relative overflow-hidden">
                        {/* Mock Map */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-purple-900/30">
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200">
                            {/* Route Line */}
                            <path 
                              d="M 50 150 Q 150 100 200 80 T 350 50" 
                              fill="none" 
                              stroke="rgba(59, 130, 246, 0.5)" 
                              strokeWidth="3"
                              strokeDasharray="5,5"
                            />
                            {/* Start Point */}
                            <circle cx="50" cy="150" r="8" fill="#10B981" />
                            {/* Driver Position */}
                            <circle cx="200" cy="80" r="10" fill="#3B82F6">
                              <animate attributeName="r" values="10;12;10" dur="2s" repeatCount="indefinite" />
                            </circle>
                            {/* End Point */}
                            <circle cx="350" cy="50" r="8" fill="#EF4444" />
                          </svg>
                        </div>
                        {/* ETA Badge */}
                        <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/50 backdrop-blur rounded-lg">
                          <div className="text-xs text-white/50">Arrivée estimée</div>
                          <div className="text-lg font-bold text-white">14:30</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Distance restante</span>
                        <span className="text-white font-medium">2.5 km</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step Indicators */}
                <div className="flex justify-center gap-2 mt-6">
                  {steps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveStep(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        activeStep === index 
                          ? 'w-8 bg-orange-500' 
                          : 'bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;