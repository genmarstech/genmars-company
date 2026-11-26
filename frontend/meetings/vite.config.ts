import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // In development, sign-in goes to the main API (:8000) and meetings to the Meetings API (:8001).
    proxy: {
      '/api/v1/meetings': 'http://localhost:8001',
      '/api/v1/integrations': 'http://localhost:8001',
      '/api': 'http://localhost:8000',
    },
  },
})
