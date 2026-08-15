import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// 仅供 E2E（Playwright）使用的独立 renderer dev server。
// 不启动 Electron / Go core / Python worker，只把 React renderer 跑在浏览器里。
// renderer 代码对 window.geowork 全部使用可选链，因此在纯浏览器中可渲染。
// 路径别名必须与 electron.vite.config.ts / vitest.config.ts 保持一致。
export default defineConfig({
  root: __dirname,
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
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
})
