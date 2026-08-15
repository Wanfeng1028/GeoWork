import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// 路径别名必须与 electron.vite.config.ts 的 renderer.resolve.alias 保持一致，
// 否则用别名导入的模块在测试中无法解析。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@shell': resolve(__dirname, 'src/shell'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@app': resolve(__dirname, 'src/app'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
})
