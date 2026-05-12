import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(__dirname, '__tests__/setup.ts')],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.gemini-gui-home/**', '**/.agents/**', '**/dist/**'],
    alias: {
      '@': resolve(__dirname, './'),
    },
    env: {
      NODE_ENV: 'development',
    },
  },
})
