import type { Metadata } from 'next';
import LandingLayout from '@/layouts/LandingLayout';
import ModernLandingPage from '@/pages/landing/ModernLandingPage';

export const metadata: Metadata = {
  title: 'Aperçu landing Delivoo',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ModernLandingPreviewPage() {
  return (
    <LandingLayout>
      <ModernLandingPage />
    </LandingLayout>
  );
}
