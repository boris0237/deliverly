import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Quote, Star } from 'lucide-react';

const TestimonialsSection = () => {
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

  const testimonials = [
    {
      key: '1',
      rating: 5,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marie',
      bgColor: 'from-orange-500/20 to-orange-600/10'
    },
    {
      key: '2',
      rating: 5,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jean',
      bgColor: 'from-purple-500/20 to-purple-600/10'
    },
    {
      key: '3',
      rating: 5,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sophie',
      bgColor: 'from-blue-500/20 to-blue-600/10'
    }
  ];

  return (
    <section 
      ref={sectionRef}
      className="relative py-24 px-6"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('landing.testimonials.title')}
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            {t('landing.testimonials.subtitle')}
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.key}
              className={`relative glass-card p-8 transition-all duration-700 hover:scale-[1.02] ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              {/* Quote Icon */}
              <div className="absolute -top-4 -left-2 w-10 h-10 bg-gradient-to-br from-orange-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Quote className="w-5 h-5 text-white" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-6">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-white/80 text-lg mb-8 leading-relaxed">
                "{t(`landing.testimonials.items.${testimonial.key}.quote`)}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <img
                  src={testimonial.avatar}
                  alt={t(`landing.testimonials.items.${testimonial.key}.author`)}
                  className="w-14 h-14 rounded-full bg-white/10"
                />
                <div>
                  <div className="text-white font-semibold">
                    {t(`landing.testimonials.items.${testimonial.key}.author`)}
                  </div>
                  <div className="text-sm text-white/50">
                    {t(`landing.testimonials.items.${testimonial.key}.role`)}
                  </div>
                </div>
              </div>

              {/* Decorative Gradient */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${testimonial.bgColor} rounded-b-2xl`} />
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className={`mt-16 text-center transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <p className="text-white/40 text-sm mb-6">Ils nous font confiance</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            {['FoodExpress', 'RapidLivraison', 'PharmaPlus', 'TechStore', 'FashionOnline'].map((company) => (
              <div key={company} className="text-xl font-bold text-white/30">
                {company}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;