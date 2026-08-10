import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local development uses /. GitHub Pages passes its repository path to the
// build command in .github/workflows/deploy-pages.yml.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
})
