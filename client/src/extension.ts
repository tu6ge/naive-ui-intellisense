import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {

  // 调试选项
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009']};

  // 服务器选项
  const serverOptions: ServerOptions = {
    run: { module: context.asAbsolutePath(
        path.join('out', 'server.js')
      ),
      transport: TransportKind.ipc 
    },
    debug: {
      module: context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
      ),
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // 客户端选项
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'vue' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.vue')
    }
  };

  // 创建语言客户端并启动
  client = new LanguageClient(
    'naiveUIIntelliSense',
    'Naive UI IntelliSense',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
