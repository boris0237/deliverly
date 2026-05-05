'use client';

import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  MapPinned,
  MessageCircle,
  PackageCheck,
  Play,
  ReceiptText,
  Smartphone,
  Truck,
  WalletCards,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PricingSection from '@/sections/landing/PricingSection';
import { useThemeStore } from '@/store';

const ModernLandingPage = () => {
  const { i18n } = useTranslation();
  const { isDark } = useThemeStore();
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const isFr = (i18n.language || 'fr').startsWith('fr');
  const demoEmbedUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      playsinline: '1',
      rel: '0',
      modestbranding: '1',
      enablejsapi: '1',
    });
    if (origin) params.set('origin', origin);
    return `https://www.youtube.com/embed/T4u4eOngjAA?${params.toString()}`;
  }, []);

  const copy = isFr
    ? {
        navFeatures: 'Fonctionnalités',
        navWhatsapp: 'Assistant WhatsApp',
        navPricing: 'Tarifs',
        login: 'Connexion',
        try: 'Essayer',
        badge: 'Logistique, WhatsApp et finance dans un seul cockpit',
        title: 'Delivoo pilote vos livraisons sans friction.',
        subtitle:
          "Une plateforme moderne pour capturer les commandes, suivre les livreurs, gérer l'inventaire et calculer les reversements partenaires avec précision.",
        start: 'Commencer gratuitement',
        viewFlow: 'Voir la démo',
        demoTitle: 'Démo Delivoo',
        opsTag: 'Opérations',
        opsTitle: "Tout ce qui bouge dans l'entreprise devient mesurable.",
        whatsappTag: 'Assistant WhatsApp',
        whatsappTitle: 'Transformez les groupes partenaires en canal de commande.',
        whatsappText:
          'Delivoo lit les commandes dans les groupes liés, crée les livraisons et renvoie les statuts directement dans la conversation.',
        ctaTitle: 'Prêt à voir Delivoo tourner chez vous ?',
        ctaText: 'Lancez votre espace, invitez vos équipes et connectez vos partenaires sans repartir de zéro.',
        createAccount: 'Créer un compte',
        liveOps: 'Live Ops',
        board: 'Tableau des livraisons',
        online: 'En ligne',
        partner: 'Partenaire',
        fees: 'Frais',
        map: 'Carte livreurs',
        statuses: ['En cours', 'Assignée', 'En attente'],
        stats: [
          { value: '24/7', label: 'Suivi terrain' },
          { value: '3 min', label: 'Création moyenne' },
          { value: '+30k', label: 'Comptes WhatsApp prévus' },
        ],
        features: [
          'Inventaire synchronisé aux livraisons',
          'Carte en temps réel des livreurs',
          'Reversements partenaires',
          'Rapports financiers exportables',
          'Application PWA installable',
          'Historique complet des actions',
        ],
        workflows: [
          ['Commandes depuis WhatsApp', 'Les groupes partenaires deviennent un canal de création automatique des livraisons.'],
          ['Affectation livreur', 'Un dispatcher peut assigner, ou laisser les livreurs accepter les courses disponibles.'],
          ['Comptabilité claire', 'Frais, reversements, dépenses et montants collectés restent traçables.'],
        ],
      }
    : {
        navFeatures: 'Features',
        navWhatsapp: 'WhatsApp Assistant',
        navPricing: 'Pricing',
        login: 'Login',
        try: 'Try it',
        badge: 'Logistics, WhatsApp and finance in one cockpit',
        title: 'Delivoo runs deliveries without friction.',
        subtitle:
          'A modern platform to capture orders, track drivers, manage inventory and calculate partner payouts with precision.',
        start: 'Get started for free',
        viewFlow: 'View Demo',
        demoTitle: 'Delivoo Demo',
        opsTag: 'Operations',
        opsTitle: 'Everything that moves in your business becomes measurable.',
        whatsappTag: 'WhatsApp Assistant',
        whatsappTitle: 'Turn partner groups into an order channel.',
        whatsappText:
          'Delivoo reads orders from linked groups, creates deliveries and sends status updates back into the conversation.',
        ctaTitle: 'Ready to see Delivoo run for you?',
        ctaText: 'Launch your workspace, invite your team and connect partners without starting from scratch.',
        createAccount: 'Create account',
        liveOps: 'Live Ops',
        board: 'Delivery board',
        online: 'Online',
        partner: 'Partner',
        fees: 'Fees',
        map: 'Driver map',
        statuses: ['In progress', 'Assigned', 'Pending'],
        stats: [
          { value: '24/7', label: 'Field tracking' },
          { value: '3 min', label: 'Average creation' },
          { value: '+30k', label: 'WhatsApp accounts ready' },
        ],
        features: [
          'Inventory synced with deliveries',
          'Real-time driver map',
          'Partner payouts',
          'Exportable financial reports',
          'Installable PWA application',
          'Complete action history',
        ],
        workflows: [
          ['Orders from WhatsApp', 'Partner groups become an automatic delivery creation channel.'],
          ['Driver assignment', 'Dispatchers can assign jobs, or let drivers accept available deliveries.'],
          ['Clear accounting', 'Fees, payouts, expenses and collected amounts stay traceable.'],
        ],
      };

  const featureIcons = [PackageCheck, MapPinned, WalletCards, BarChart3, Smartphone, ClipboardList];
  const workflowIcons = [MessageCircle, Truck, ReceiptText];
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://delivoo.pro/#organization',
        name: 'Delivoo',
        url: 'https://delivoo.pro',
        logo: 'https://delivoo.pro/img/icon.svg',
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+237621918555',
          contactType: 'customer support',
          availableLanguage: ['fr', 'en'],
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': 'https://delivoo.pro/#software',
        name: 'Delivoo',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Android, iOS',
        url: 'https://delivoo.pro',
        description:
          "Plateforme de gestion de livraisons avec suivi en temps réel, assistant WhatsApp, gestion des partenaires, stocks, dépenses et reversements.",
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        publisher: {
          '@id': 'https://delivoo.pro/#organization',
        },
        featureList: [
          'Gestion des livraisons',
          'Suivi des livreurs en temps réel',
          'Assistant WhatsApp',
          'Gestion des partenaires',
          'Gestion des stocks',
          'Reversements partenaires',
          'Rapports financiers',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://delivoo.pro/#website',
        name: 'Delivoo',
        url: 'https://delivoo.pro',
        inLanguage: 'fr',
        publisher: {
          '@id': 'https://delivoo.pro/#organization',
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <a href="/" className="inline-flex items-center gap-3">
            <img
              src={isDark ? '/img/delivoo_logo_dark_v2.svg' : '/img/delivoo_logo_light.svg'}
              alt="Delivoo"
              className="h-20 w-auto"
            />
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#fonctionnalites" className="hover:text-foreground">{copy.navFeatures}</a>
            <a href="#whatsapp" className="hover:text-foreground">{copy.navWhatsapp}</a>
            <a href="#tarifs" className="hover:text-foreground">{copy.navPricing}</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <a href="/auth/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted sm:inline-flex">
              {copy.login}
            </a>
            <a href="/auth/register" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm transition hover:opacity-90">
              {copy.try}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-24 lg:pt-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <Zap className="h-4 w-4" />
              {copy.badge}
            </div>
            <h1 className="text-4xl font-black leading-[1.02] tracking-normal text-foreground sm:text-5xl lg:text-7xl">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              {copy.subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/auth/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700">
                {copy.start}
                <ArrowRight className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={() => setIsDemoOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-base font-bold text-foreground transition hover:bg-muted"
              >
                <Play className="h-5 w-5" />
                {copy.viewFlow}
              </button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3">
              {copy.stats.map((stat) => (
                <div key={stat.label} className="border-l border-border pl-4">
                  <div className="text-2xl font-black text-foreground">{stat.value}</div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div id="demo" className="relative">
            <div className="absolute -right-8 top-10 hidden h-40 w-40 rounded-full border border-orange-200 lg:block" />
            <div className="landing-dark-surface relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-2xl shadow-slate-950/20">
              <div className="rounded-[22px] bg-[#101827] p-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">{copy.liveOps}</p>
                    <h2 className="mt-1 text-xl font-bold text-white">{copy.board}</h2>
                  </div>
                  <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">{copy.online}</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.8fr]">
                  <div className="space-y-3">
                    {['Commande #A3F92', 'Commande #B21C8', 'Commande #C91D0'].map((item, index) => (
                      <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{item}</div>
                            <div className="mt-1 text-sm text-slate-400">{copy.partner}: Dream Shop</div>
                          </div>
                          <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300">
                            {copy.statuses[index]}
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <span className="text-slate-400">{copy.fees}</span>
                          <span className="font-bold text-white">1 000 FCFA</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-semibold text-white">{copy.map}</span>
                      <MapPinned className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div className="relative h-72 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#183144,#132236)]">
                      <div className="absolute left-8 top-8 h-24 w-24 rounded-full border border-emerald-300/20" />
                      <div className="absolute bottom-8 right-8 h-32 w-32 rounded-full border border-orange-300/20" />
                      <div className="absolute left-[22%] top-[34%] rounded-full bg-orange-500 px-2 py-1 text-xs font-black text-white">M1</div>
                      <div className="absolute right-[22%] top-[26%] rounded-full bg-emerald-500 px-2 py-1 text-xs font-black text-white">V2</div>
                      <div className="absolute bottom-[22%] left-[42%] rounded-full bg-blue-500 px-2 py-1 text-xs font-black text-white">L3</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">{copy.opsTag}</p>
          <h2 className="mt-3 text-3xl font-black text-foreground md:text-5xl">{copy.opsTitle}</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <div key={feature} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <Icon className="h-6 w-6 text-orange-600" />
                <p className="mt-5 text-lg font-bold text-foreground">{feature}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="whatsapp" className="landing-dark-surface bg-slate-950 py-16 text-white dark:bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">{copy.whatsappTag}</p>
            <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">{copy.whatsappTitle}</h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              {copy.whatsappText}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {copy.workflows.map((item, index) => {
              const Icon = workflowIcons[index];
              return (
                <div key={item[0]} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <Icon className="h-6 w-6 text-emerald-300" />
                  <h3 className="mt-5 text-lg font-bold text-white">{item[0]}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{item[1]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="tarifs" className="bg-card py-16">
        <PricingSection />
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="landing-dark-surface rounded-[28px] bg-slate-950 p-8 text-white md:p-12 dark:border dark:border-border dark:bg-card">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-3xl font-black md:text-5xl">{copy.ctaTitle}</h2>
              <p className="mt-4 max-w-2xl text-slate-300">
                {copy.ctaText}
              </p>
            </div>
            <a href="/auth/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-slate-950 transition hover:bg-orange-100">
              {copy.createAccount}
              <Check className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      <Dialog  open={isDemoOpen} onOpenChange={setIsDemoOpen}>
        <DialogContent className="sm:max-w-[950px] border-border bg-card p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-foreground">{copy.demoTitle}</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5">
            <div className="landing-dark-surface overflow-hidden rounded-2xl border border-border bg-slate-950">
              {isDemoOpen ? (
             <iframe
                className="aspect-video w-full border-0"
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/T4u4eOngjAA?autoplay=1&playsinline=1&rel=0"
                title={copy.demoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <a
        href="https://wa.me/237621918555"
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl shadow-emerald-900/25 ring-4 ring-white/80 transition hover:scale-105 hover:bg-[#1ebe5d] dark:ring-slate-950/80"
      >
        <img src="/img/whatsapp.png" alt="WhatsApp"  />
      </a>
    </main>
  );
};

export default ModernLandingPage;
