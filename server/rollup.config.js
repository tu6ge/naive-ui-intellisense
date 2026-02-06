import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'

const production = process.env.NODE_ENV === 'production'

export default [
  {
    input: 'out/server.js',
    output: {
      file: 'dist/server.js',
      format: 'cjs',
      sourcemap: !production,
      exports: 'auto'
    },
    external: ['vscode', 'vscode-languageserver', 'vscode-languageserver-textdocument', 'https', 'fs', 'path', 'util', 'crypto', 'stream', 'events'],
    plugins: [
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      production && terser()
    ]
  }
]
