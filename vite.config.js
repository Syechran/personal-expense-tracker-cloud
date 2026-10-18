import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Keuangan Pribadi',
        short_name: 'Keuangan',
        description: 'Aplikasi pencatat keuangan pribadi super cepat',
        theme_color: '#000000', // Warna hitam sesuai desainmu
        background_color: '#ffffff',
        display: 'standalone', // Membuatnya tampil full screen seperti aplikasi asli
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
