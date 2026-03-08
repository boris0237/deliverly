import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Package, Twitter, Linkedin, Github, Instagram } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const FooterSection = () => {
  const { t } = useTranslation();

  const footerLinks = {
    product: [
      { label: t('landing.footer.features'), href: '#features' },
      { label: t('landing.footer.pricing'), href: '#pricing' },
      { label: t('landing.footer.documentation'), href: '#' },
    ],
    company: [
      { label: t('landing.footer.about'), href: '#' },
      { label: t('landing.footer.careers'), href: '#' },
      { label: t('landing.footer.contact'), href: '#' },
    ],
    legal: [
      { label: t('landing.footer.privacy'), href: '#' },
      { label: t('landing.footer.terms'), href: '#' },
      { label: t('landing.footer.cookies'), href: '#' },
    ],
  };

  const socialLinks = [
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: Github, href: '#', label: 'GitHub' },
    { icon: Instagram, href: '#', label: 'Instagram' },
  ];

  return (
    <footer className="relative py-16 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Deliverly</span>
            </Link>
            <p className="text-sm text-white/50 mb-6 max-w-xs">
              {t('landing.hero.subtitle')}
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5 text-white/50 hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">
              {t('landing.footer.product')}
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-white/50 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">
              {t('landing.footer.company')}
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-white/50 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">
              {t('landing.footer.legal')}
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-white/50 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Language */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">
              {t('common.language')}
            </h4>
            <LanguageSwitcher />
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/40">
            © 2024 Deliverly. {t('landing.footer.rights')}
          </p>
          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="text-sm text-white/50 hover:text-white transition-colors">
              {t('common.login')}
            </Link>
            <Link href="/auth/register" className="text-sm text-white/50 hover:text-white transition-colors">
              {t('common.register')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;