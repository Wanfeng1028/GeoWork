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
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true
        },
        '/worker': {
          target: 'http://localhost:8000',
          changeOrigin: true
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
