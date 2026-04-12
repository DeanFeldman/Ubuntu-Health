import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://ubuntu-health-geb6dbegejfmenc7.southafricanorth-01.azurewebsites.net/', 
        changeOrigin: true,
      },
    },
  },
})