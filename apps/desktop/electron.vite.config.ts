import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/main.ts'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        output: {
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
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
      proxy: {
        '/api': {
          target: 'http://localhost:8767',
          changeOrigin: true,
        },
        '/worker': {
          target: 'http://localhost:8766',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/worker/, ''),
        },
      },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          // A5（doc/23）：把最稳定的两个大依赖拆进独立 vendor chunk，
          // 与业务代码分离——依赖不升级时 chunk 哈希不变、可长期缓存。
          // 其余 node_modules 不设兜底 chunk，跟随自然导入图走：
          // 页面专属依赖（如 xterm）留在各自的懒加载 chunk 里。
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
              return 'vendor-react'
            }
            if (/[\\/]node_modules[\\/](antd|@ant-design|rc-[a-z-]+|@rc-component)[\\/]/.test(id)) {
              return 'vendor-antd'
            }
          },
        },
      },
    },
  },
})
