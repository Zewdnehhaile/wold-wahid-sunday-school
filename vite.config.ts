import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'manifest.json'],
        manifest: {
          id: '/',
          name: 'ወልደ ዋሕድ ሰንበት ትምህርት ቤት',
          short_name: 'ወልደ ዋሕድ',
          description: 'የወልደ ዋሕድ ሰንበት ትምህርት ቤት የተማሪዎች መታወቂያ፣ የሳምንታዊ መርሐ ግብርና የመገኘት ክትትል ሥርዓት',
          theme_color: '#062414',
          background_color: '#062414',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/assets/aistudio/photo_2026-10-22_10-46-07__2__5dd80c37.jpg',
              sizes: '192x192',
              type: 'image/jpeg',
              purpose: 'any'
            },
            {
              src: '/assets/aistudio/photo_2026-10-22_10-46-07__2__5dd80c37.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'maskable'
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio preview environment.
      hmr: false,
      ws: false as const,
      watch: null,
    },
  };
});
