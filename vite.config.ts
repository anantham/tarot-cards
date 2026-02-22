import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expose only VITE_* values to client bundles.
  envPrefix: ['VITE_'],
  server: {
    port: 5173,
    proxy: {
      // Dev proxy to avoid browser CORS errors when calling OpenRouter
      '/openrouter': {
        target: 'https://openrouter.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openrouter/, '/api/v1'),
        secure: true,
      },
      // Dev proxy for local API (serverless functions / backend)
      '/api': {
        target: process.env.API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
