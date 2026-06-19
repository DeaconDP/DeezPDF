import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

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
    ...(isCapacitorBuild
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
            manifest: {
              name: 'DeezPDF Reader',
              short_name: 'DeezPDF',
              description: 'A cyberpunk PDF reader with local library support',
              theme_color: '#080b10',
              background_color: '#080b10',
              display: 'standalone',
              start_url: '/',
              icons: [
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
                  src: 'favicon.svg',
                  sizes: 'any',
                  type: 'image/svg+xml',
                  purpose: 'any',
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
