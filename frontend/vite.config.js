import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiTarget = (env.VITE_API_URL || "http://localhost:5001").replace(/\/$/, "")

  return {
    plugins: [react()],
    server: {
      open: true,
      proxy: {
        '/auth': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/admin': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
