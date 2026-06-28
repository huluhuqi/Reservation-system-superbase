import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],

  server: {
    port: 5173,
    historyApiFallback: true
  },

  preview: {
    historyApiFallback: true
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true
  }
})
