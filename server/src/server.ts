import { CompletionParams } from 'vscode-languageserver'

const { ProposedFeatures, TextDocumentSyncKind } = require('vscode-languageserver/node')
import { createConnection, TextDocuments } from 'vscode-languageserver/node'

import { TextDocument } from 'vscode-languageserver-textdocument'
import { parse as parseDOM } from '@vue/compiler-dom'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { provideCompletion } from './completion'
import { loadNaiveMeta } from './naive-meta'

const naiveMeta = loadNaiveMeta()

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

// ========== LSP 服务器 ==========
connection.onInitialize(() => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['<', ' ', '"', '=', '-', ':'] // 简单触发
      }
    }
  }
})

connection.onCompletion((params: CompletionParams) => {
  const document = documents.get(params.textDocument.uri)
  if (!document) return []

  const sfc = parseSFC(document.getText())

  if (!sfc.descriptor.template) return []

  const templateBlock = sfc.descriptor.template
  const templateContent = templateBlock.content
  const startOffset = templateBlock.loc.start.offset

  // 转成 AST
  const ast = parseDOM(templateContent, {
    onError: () => {} // 容错
  })

  connection.console.log('触发了代码补全3333333')

  if (naiveMeta == null) {
    return []
  }

  const offsetInTemplate = document.offsetAt(params.position) - startOffset

  return provideCompletion(ast, offsetInTemplate, naiveMeta, connection)
})

documents.listen(connection)
connection.listen()
