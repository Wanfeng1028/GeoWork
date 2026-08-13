import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/main.ts')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        output: {
          format: 'cjs'
        }
      }
    }
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
          changeOrigin: true
        },
        '/worker': {
          target: 'http://localhost:8766',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/worker/, '')
        }
      }
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    }
  }
})
