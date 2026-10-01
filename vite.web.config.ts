import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The browser build of the same React app, for the Cloudflare Worker to serve
 * (wrangler.jsonc → assets). `webApi.ts` stands in for the desktop's preload.
 */
export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  build: { outDir: resolve('dist-web'), emptyOutDir: true }
})
