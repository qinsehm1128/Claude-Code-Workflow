import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get base path from environment variable
// Default to / for development (CCW server proxies /* to Vite)
// Can be overridden by VITE_BASE_URL environment variable
const basePath = process.env.VITE_BASE_URL || '/'

// Backend target for Vite proxy (used when directly opening the Vite dev server port).
// In `ccw view`, this is set to the dashboard server port so /api and /ws route correctly.
const backendHost = process.env.VITE_BACKEND_HOST || 'localhost'
const backendPort = Number(process.env.VITE_BACKEND_PORT || '3456')
const backendHttpTarget = `http://${backendHost}:${backendPort}`
const backendWsTarget = `ws://${backendHost}:${backendPort}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: basePath,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Ensure a single React instance in Vitest (avoid invalid hook call from nested node_modules)
      react: path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, '../../node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, '../../node_modules/react/jsx-dev-runtime.js'),
      'react-dom/client': path.resolve(__dirname, '../../node_modules/react-dom/client.js'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  server: {
    // Don't hardcode port - allow command line override
    // strictPort: true ensures the specified port is used or fails
    strictPort: true,
    proxy: {
      // Backend API proxy
      '/api': {
        target: backendHttpTarget,
        changeOrigin: true,
      },
      // WebSocket proxy for real-time updates
      '/ws': {
        target: backendWsTarget,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
        'src/main.tsx',
      ],
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: true,
  },
})
