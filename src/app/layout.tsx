import type { Metadata, Viewport } from 'next';
import '@/index.css';
import AppProviders from '@/providers/AppProviders';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://delivoo.pro';

export const viewport: Viewport = {
  themeColor: '#10B981',
};

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Delivoo | Gestion de livraison et assistant WhatsApp',
    template: '%s | Delivoo',
  },
  description:
    'Plateforme de gestion de livraisons pour suivre les livreurs, gérer les partenaires, automatiser les commandes WhatsApp, contrôler les stocks et calculer les reversements.',
  keywords: [
    'gestion livraison',
    'logiciel livraison',
    'suivi livreur',
    'assistant WhatsApp',
    'gestion partenaires',
    'reversements partenaires',
    'gestion stock livraison',
    'livraison Cameroun',
    'Delivoo',
  ],
  applicationName: 'Delivoo',
  authors: [{ name: 'Delivoo' }],
  creator: 'Delivoo',
  publisher: 'Delivoo',
  category: 'Logistics Software',
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
    languages: {
      fr: '/',
      en: '/',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: appUrl,
    siteName: 'Delivoo',
    title: 'Delivoo | Gestion de livraison et assistant WhatsApp',
    description:
      'Pilotez vos livraisons, livreurs, stocks, partenaires, reversements et commandes WhatsApp dans une seule plateforme.',
    locale: 'fr_CM',
    images: [
      {
        url: '/img/delivoo_logo_light.svg',
        width: 1200,
        height: 630,
        alt: 'Delivoo - plateforme de gestion de livraison',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Delivoo | Gestion de livraison moderne',
    description: 'Livraisons, suivi temps réel, assistant WhatsApp, stocks et reversements partenaires.',
    images: ['/img/delivoo_logo_light.svg'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Delivoo',
  },
  icons: {
    icon: '/img/icon.svg',
    apple: '/img/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
