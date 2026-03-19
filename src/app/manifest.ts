import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Delivoo',
    short_name: 'Delivoo',
    description: 'Delivoo logistics dashboard',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fff',
    theme_color: '#f97316',
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
