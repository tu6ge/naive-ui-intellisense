import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'

let client: LanguageClient

export function activate(context: vscode.ExtensionContext) {
  // 服务端可执行文件路径（Node 或 Rust 编译产物）
  let serverModule = context.asAbsolutePath(path.join('server', 'dist', 'server.js'))
  // 如果是 Rust，可以写成 ./target/debug/my-lsp-server

  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

  let serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'vue' }] // 绑定语言
  }

  client = new LanguageClient('NaiveClient', 'Naive UI Intelligence', serverOptions, clientOptions)

  client.start()

  // 🔥 热更新监听
  if (process.env.NODE_ENV !== 'production') {
    const chokidar = require('chokidar')
    const watcher = chokidar.watch(serverModule)
    watcher.on('change', () => {
      console.log('[LSP Server] server.js changed, restarting client...')
      client.stop().then(() => client.start())
    })
    context.subscriptions.push({ dispose: () => watcher.close() })
  }
}

export function deactivate(): Promise<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}
