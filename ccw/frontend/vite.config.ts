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
      // Backend API proxy
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      // WebSocket proxy for real-time updates
      '/ws': {
        target: 'ws://localhost:3456',
        ws: true,
      },
      // Docusaurus documentation site proxy
      // Forwards /docs requests to Docusaurus dev server running on port 3001
      '/docs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Preserve /docs prefix to match Docusaurus baseUrl configuration
        // Example: /docs/overview -> http://localhost:3001/docs/overview
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
