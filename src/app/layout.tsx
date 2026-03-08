import type { Metadata } from 'next';
import '@/index.css';
import AppProviders from '@/providers/AppProviders';

export const metadata: Metadata = {
  title: 'Deliverly',
  description: 'Deliverly logistics dashboard',
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
