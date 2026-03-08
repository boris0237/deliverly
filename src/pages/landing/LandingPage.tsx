import HeroSection from '@/sections/landing/HeroSection';
import FeaturesSection from '@/sections/landing/FeaturesSection';
import HowItWorksSection from '@/sections/landing/HowItWorksSection';
import BenefitsSection from '@/sections/landing/BenefitsSection';
import TestimonialsSection from '@/sections/landing/TestimonialsSection';
import PricingSection from '@/sections/landing/PricingSection';
import FAQSection from '@/sections/landing/FAQSection';
import CTASection from '@/sections/landing/CTASection';
import FooterSection from '@/sections/landing/FooterSection';

const LandingPage = () => {
  return (
    <div className="bg-background">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <BenefitsSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default LandingPage;