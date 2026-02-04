import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/server.ts',
      formats: ['cjs'],
      fileName: () => 'server.js'
    },
    rollupOptions: {
      external: ['vscode', 'vscode-languageserver', 'vscode-languageserver/node', 'path', 'fs']
    },
    outDir: 'dist',
    watch: process.env.WATCH === 'true' ? {} : null, // watch 模式可通过环境变量开启
    target: 'node20',
    emptyOutDir: true
  }
})
