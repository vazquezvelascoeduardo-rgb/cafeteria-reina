import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages la aplicación no cuelga de la raíz del dominio, sino de
// /nombre-del-repositorio/. El workflow de publicación pasa esa ruta aquí.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cafetería Reina',
        short_name: 'Reina',
        description: 'Gestión de mesas, cobros y facturas de la Cafetería Reina',
        theme_color: '#33200f',
        background_color: '#faf6f0',
        display: 'standalone',
        orientation: 'any',
        // Relativas al propio manifiesto: así valen tanto si la aplicación
        // cuelga de la raíz como de un subdirectorio
        start_url: './',
        scope: './',
        lang: 'es',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-recortable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
