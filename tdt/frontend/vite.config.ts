import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true, // This allows the Google Cloud Run URL to work
    proxy: {
      '/api': {
        target: 'https://tourdepubcrawlbff-46150979625.europe-west1.run.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})