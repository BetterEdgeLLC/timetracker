import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/** Strikte CSP nur im Produktions-Build, der Vite-Dev-Server braucht Inline-Skripte. */
function productionCsp(): Plugin {
  const csp =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
  return {
    name: 'production-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }
    ]
  }
}

export default defineConfig({
  main: {
    build: { outDir: 'out/main', rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    build: { outDir: 'out/preload', rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss(), productionCsp()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@': resolve('src/renderer/src')
      }
    },
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          widget: resolve('src/renderer/widget.html')
        }
      }
    }
  }
})
