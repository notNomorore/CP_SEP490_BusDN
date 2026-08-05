/* eslint-env node */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const frontendRunId = Date.now().toString()

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_URL || env.VITE_API_BASE_URL
  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL is required for the Vite API proxy.')
  }
  const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, '')

  return {
    plugins: [react()],
    cacheDir: '.vite',
    server: {
      port: 5173,
      strictPort: false,
      open: true,
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
    },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: 'esbuild',
  },
  define: {
    'process.env': {},
    __FRONTEND_RUN_ID__: JSON.stringify(frontendRunId),
  },
  }
});
