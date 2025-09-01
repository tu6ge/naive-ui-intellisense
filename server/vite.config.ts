import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/server.ts',
      formats: ['cjs'],
      fileName: () => 'server.js'
    },
    rollupOptions: {
      external: ['vscode', 'vscode-languageserver']
    },
    outDir: 'dist'
  }
})
