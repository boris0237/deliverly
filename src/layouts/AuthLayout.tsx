import { useTranslation } from 'react-i18next';
import { Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useThemeStore } from '@/store';

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const { isDark } = useThemeStore();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-orange-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">{t('common.back')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
        
        {/* Form Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Delivoo. {t('landing.footer.rights')}</p>
        </div>
      </div>
      
      {/* Right Side - Visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-purple-500/20 to-blue-500/20" />
        
        {/* Animated Shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse animation-delay-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse animation-delay-1000" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center">
          <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/30 border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/icon.svg" alt="Delivoo" className="w-20 h-20 object-contain" />
          </div>
          <div className="flex items-center justify-center">
            <img src={isDark ? "/img/delivoo_wordmark_dark.svg" : "/img/delivoo_wordmark_light.svg"} alt="Delivoo" className="h-10 ml-10" />
          </div>
          <p className="text-lg text-white/70 max-w-md">
            {t('landing.hero.subtitle')}
          </p>
          
          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">10k+</div>
              <div className="text-sm text-white/50">{t('landing.hero.stats.deliveries')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">500+</div>
              <div className="text-sm text-white/50">{t('landing.hero.stats.activeUsers')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">99%</div>
              <div className="text-sm text-white/50">{t('landing.hero.stats.satisfaction')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
