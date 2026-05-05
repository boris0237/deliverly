import type { Metadata } from 'next';
import LandingLayout from '@/layouts/LandingLayout';
import ModernLandingPage from '@/pages/landing/ModernLandingPage';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://delivoo.pro';

export const metadata: Metadata = {
  title: 'Delivoo | Plateforme de gestion des livraisons et assistant WhatsApp',
  description:
    'Delivoo aide les entreprises à gérer leurs livraisons, livreurs, partenaires, stocks, reversements et commandes WhatsApp depuis une plateforme tout-en-un.',
  alternates: {
    canonical: '/',
    languages: {
      fr: '/',
      en: '/',
    },
  },
  openGraph: {
    title: 'Delivoo | Gestion de livraison, suivi temps réel et assistant WhatsApp',
    description:
      'Centralisez vos livraisons, automatisez les commandes WhatsApp, suivez vos livreurs et gérez vos reversements partenaires avec Delivoo.',
    url: appUrl,
    siteName: 'Delivoo',
    locale: 'fr_CM',
    type: 'website',
    images: [
      {
        url: '/img/delivoo_logo_light.svg',
        width: 1200,
        height: 630,
        alt: 'Delivoo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Delivoo | Gestion des livraisons moderne',
    description: 'Livraisons, livreurs, partenaires, stocks, reversements et assistant WhatsApp dans un seul cockpit.',
    images: ['/img/delivoo_logo_light.svg'],
  },
};

export default function HomePage() {
  return (
    <LandingLayout>
      <ModernLandingPage />
    </LandingLayout>
  );
}
