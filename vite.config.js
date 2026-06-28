import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/Reservation-system/',
  plugins: [vue()],
  build: {
    emptyOutDir: true
  }
})