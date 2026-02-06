import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
import copy from 'rollup-plugin-copy'

const production = process.env.NODE_ENV === 'production'

export default [
  // Client extension
  {
    input: 'client/out/extension.js',
    output: {
      file: 'out/extension.js',
      format: 'cjs',
      sourcemap: !production,
      exports: 'auto'
    },
    external: ['vscode'],
    plugins: [
      // typescript({
      //   tsconfig: 'client/tsconfig.json',
      //   sourceMap: !production,
      //   inlineSources: !production
      // }),
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      production && terser()
    ]
  },
  // Language Server
  {
    input: 'server/out/server.js',
    output: {
      file: 'out/server.js',
      format: 'cjs',
      sourcemap: !production,
      exports: 'auto'
    },
    external: [
      'vscode'
      // 'vscode-languageserver',
      // 'vscode-languageserver-textdocument',
      // 'https',
      // 'fs',
      // 'path',
      // 'util',
      // 'crypto',
      // 'stream',
      // 'events'
    ],
    plugins: [
      // typescript({
      //   tsconfig: 'server/tsconfig.json',
      //   sourceMap: !production,
      //   inlineSources: !production
      // }),
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      production && terser(),
      copy({
        targets: [
          {
            src: 'server/cache/json',
            dest: 'cache/'
          }
        ]
      })
    ]
  }
]
