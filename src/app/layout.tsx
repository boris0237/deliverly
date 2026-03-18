import type { Metadata } from 'next';
import '@/index.css';
import AppProviders from '@/providers/AppProviders';

export const metadata: Metadata = {
  title: 'Delivoo',
  description: 'Delivoo logistics dashboard',
  manifest: '/manifest.webmanifest',
  themeColor: '#10B981',
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
