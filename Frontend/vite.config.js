/* eslint-env node */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const frontendRunId = Date.now().toString()

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL || ''
  const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, '') || env.VITE_API_URL || 'http://localhost:5000'

  return {
    plugins: [react()],
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
