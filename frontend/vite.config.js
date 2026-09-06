import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 109', 'safari >= 16', 'firefox >= 100', 'edge >= 109', 'defaults', 'not IE 11'],
    }),
    tailwindcss(),
  ],
  build: {
    target: 'es2015', //Downgrades primary build from 2022 to allow support for older browsers
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
