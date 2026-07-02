import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { pdfDownloadProxy } from './vite-pdf-proxy';
import { pdfSearchProxy } from './vite-pdf-search';

const isCapacitorBuild = process.env.VITE_CAPACITOR === 'true';
const pwaStub = fileURLToPath(new URL('./src/lib/pwa-stub.ts', import.meta.url));

export default defineConfig({
  base: isCapacitorBuild ? './' : '/',
  resolve: {
    alias: isCapacitorBuild
      ? {
          'virtual:pwa-register': pwaStub,
        }
      : undefined,
  },
  plugins: [
    pdfDownloadProxy(),
    pdfSearchProxy(),
    ...(isCapacitorBuild
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
              'favicon.ico',
              'icon-192.png',
              'icon-512.png',
              'icon-192-maskable.png',
              'icon-512-maskable.png',
              'apple-touch-icon.png',
            ],
            manifest: {
              name: 'DeezPDF Reader',
              short_name: 'DeezPDF',
              description: 'A cyberpunk PDF reader with local library support',
              theme_color: '#060810',
              background_color: '#060810',
              display: 'standalone',
              start_url: '/',
              icons: [
                {
                  src: 'favicon.ico',
                  sizes: '16x16 32x32',
                  type: 'image/x-icon',
                  purpose: 'any',
                },
                {
                  src: 'icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'icon-192-maskable.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'maskable',
                },
                {
                  src: 'icon-512-maskable.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            },
          }),
        ]),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
});
