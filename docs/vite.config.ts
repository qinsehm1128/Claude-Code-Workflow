import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['flexsearch']
  },
  build: {
    target: 'es2019',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200
  }
})

