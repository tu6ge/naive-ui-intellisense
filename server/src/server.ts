import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  Hover,
  MarkupKind,
  InitializeResult,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InsertTextFormat
} from 'vscode-languageserver/node'

import { TextDocument } from 'vscode-languageserver-textdocument'
import { generatePropsTable, NaiveUIMetadataExtractor } from './metadata'
import { RegexVueParser } from './regexVueParser'
import { NaiveUIExtractor } from './naiveUIExtractor'

// 创建连接
const connection = createConnection(ProposedFeatures.all)

// 创建文档管理器
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

// 元数据提取器
const metadataExtractor = new NaiveUIMetadataExtractor(false)

// Vue 正则解析器
const vueParser = new RegexVueParser()

let hasConfigurationCapability = false
let hasWorkspaceFolderCapability = false

metadataExtractor.initialize()

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities

  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration)
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders)

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['<', 'N', ' ', ':', '@', '"', "'"]
      },
      hoverProvider: true
    }
  }

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    }
  }

  return result
})

connection.onInitialized(async () => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }

  // 异步初始化元数据提取器
  console.log('Starting metadata initialization...')
  try {
    await metadataExtractor.initialize()
    console.log('Metadata initialization completed')
  } catch (error) {
    console.error('Metadata initialization failed:', error)
    // 失败时使用同步初始化（手动元数据）
    metadataExtractor.initializeSync()
  }
})

// 补全提供
connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(textDocumentPosition.textDocument.uri)
  if (!document) {
    return []
  }

  const text = document.getText()
  const offset = document.offsetAt(textDocumentPosition.position)

  // 场景 1: 组件名补全 - 检测 <n- 后面
  if (vueParser.shouldTriggerComponentCompletion(text, offset)) {
    return getComponentCompletions()
  }
  if (vueParser.shouldTriggerComponentCompletionUpper(text, offset)) {
    return getComponentCompletionsUpper()
  }

  // 场景 2: 属性名补全
  if (vueParser.shouldTriggerAttributeCompletion(text, offset)) {
    const element = vueParser.findElementAtPosition(text, offset)
    if (element && isNaiveUIComponent(element.tag)) {
      return getAttributeCompletions(element.tag)
    }
  }

  // 场景 3: 属性值补全
  if (vueParser.shouldTriggerValueCompletion(text, offset)) {
    const element = vueParser.findElementAtPosition(text, offset)
    const currentAttr = vueParser.findAttributeAtPosition(text, offset)

    if (element && currentAttr && isNaiveUIComponent(element.tag)) {
      return getAttributeValueCompletions(element.tag, currentAttr.name)
    }
  }

  return []
})

// 补全项解析
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item
})

// Hover 提供
connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover | null => {
  const document = documents.get(textDocumentPosition.textDocument.uri)
  if (!document) {
    return null
  }

  const text = document.getText()
  const offset = document.offsetAt(textDocumentPosition.position)

  // 查找当前元素
  const currentElementTag = vueParser.findTagAtPositionOnHover(text, offset)

  if (currentElementTag == null) {
    return null
  }

  // 检查是否在标签名上
  if (vueParser.isOnTagName(text, offset)) {
    const meta = metadataExtractor.getComponentMeta(currentElementTag)
    if (meta && meta.description) {
      const fallbackPath = metadataExtractor.fallbackComponentsDocPath()
      const tag = currentElementTag.replace(/^n-/, '')
      let url = `https://www.naiveui.com/zh-CN/os-theme/components/${tag}`
      if (fallbackPath[tag]) {
        url = `https://www.naiveui.com/zh-CN/os-theme/components/${fallbackPath[tag]}`
      }

      const props_md = generatePropsTable(meta.props)
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${meta.name}**\n\n${meta.description}\n\n**Props**\n\n${props_md}\n\n[Naive UI 文档](${url})`
        }
      }
    } else {
      const fallbackPath = metadataExtractor.fallbackComponentsDocPath()
      const tag = currentElementTag.replace(/^n-/, '')
      if (fallbackPath[tag]) {
        const url = `https://www.naiveui.com/zh-CN/os-theme/components/${fallbackPath[tag]}`
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: `**${currentElementTag}**\n\n[Naive UI 文档](${url})`
          }
        }
      }
    }
  }

  // 检查是否在属性上
  const currentAttr = vueParser.findAttributeAtPosition(text, offset)
  if (currentAttr && vueParser.isOnAttributeName(text, offset)) {
    const meta = metadataExtractor.getComponentMeta(currentElementTag)
    if (meta) {
      // 移除可能的 : 或 @ 前缀
      const cleanAttrName = currentAttr.name.replace(/^[:@]/, '')
      const prop = meta.props.find((p) => p.name === cleanAttrName)

      if (prop && prop.description) {
        let hoverText = `**${prop.name}**: \`${prop.type}\`\n\n${prop.description}`
        if (prop.default !== undefined) {
          hoverText += `\n\n*默认值:* \`${prop.default}\``
        }
        if (prop.options && prop.options.length > 0) {
          hoverText += `\n\n*可选值:* ${prop.options.map((o) => `\`${o}\``).join(', ')}`
        }
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: hoverText
          }
        }
      }
    }
  }

  return null
})

// 辅助函数：获取组件名补全
function getComponentCompletions(): CompletionItem[] {
  const ui = new NaiveUIExtractor()

  const components = ui.extractAll()
  return components.map((comp) => ({
    label: comp.tag,
    kind: CompletionItemKind.Class,
    detail: 'Naive UI',
    documentation: {
      kind: MarkupKind.Markdown,
      value: ''
    },
    insertText: `${comp.tag}$1>$2</${comp.tag}>`,
    insertTextFormat: InsertTextFormat.Snippet
  }))
}

function getComponentCompletionsUpper(): CompletionItem[] {
  const ui = new NaiveUIExtractor()

  const components = ui.extractAll()

  // 写一个函数，input-group -> InputGroup
  function toPascalCase(tag: string): string {
    return tag
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  }

  return components.map((comp) => {
    const upperTag = toPascalCase(comp.tag)
    return {
      label: upperTag,
      kind: CompletionItemKind.Class,
      detail: 'Naive UI',
      documentation: {
        kind: MarkupKind.Markdown,
        value: ''
      },
      insertText: `${upperTag}$1>$2</${upperTag}>`,
      insertTextFormat: InsertTextFormat.Snippet
    }
  })
}

// 辅助函数：获取属性名补全
function getAttributeCompletions(tagName: string): CompletionItem[] {
  const meta = metadataExtractor.getComponentMeta(tagName)
  if (!meta) {
    return []
  }

  return meta.props.map((prop) => ({
    label: prop.name,
    kind: CompletionItemKind.Property,
    detail: prop.type,
    documentation: {
      kind: MarkupKind.Markdown,
      value: prop.description || ''
    },
    insertText: prop.name
  }))
}

// 辅助函数：获取属性值补全
function getAttributeValueCompletions(tagName: string, attrName: string): CompletionItem[] {
  const meta = metadataExtractor.getComponentMeta(tagName)
  if (!meta) {
    return []
  }

  const prop = meta.props.find((p) => p.name === attrName)
  if (!prop || !prop.options || prop.options.length === 0) {
    return []
  }

  return prop.options.map((option) => ({
    label: option,
    kind: CompletionItemKind.Value,
    detail: `${prop.name} option`,
    insertText: `${option}`
  }))
}

// 辅助函数：检查是否是 Naive UI 组件
function isNaiveUIComponent(tagName: string): boolean {
  return tagName.startsWith('n-') || tagName.startsWith('N')
}

// 监听文档
documents.listen(connection)

// 启动连接
connection.listen()
