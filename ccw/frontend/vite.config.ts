import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get base path from environment variable
// Always use VITE_BASE_URL if set (for both dev and production)
const basePath = process.env.VITE_BASE_URL || '/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: basePath,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  server: {
    // Don't hardcode port - allow command line override
    // strictPort: true ensures the specified port is used or fails
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3456',
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
