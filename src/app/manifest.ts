import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Delivoo',
    short_name: 'Delivoo',
    description: 'Delivoo logistics dashboard',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#10B981',
    orientation: 'portrait',
    icons: [
      {
        src: '/img/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/img/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
