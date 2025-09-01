import { CompletionParams, Position } from 'vscode-languageserver'

const { createConnection, ProposedFeatures, TextDocuments, TextDocumentSyncKind, CompletionItemKind } = require('vscode-languageserver/node')

import { parse as parseSFC, SFCParseResult } from '@vue/compiler-sfc'
import { ElementNode, Node, NodeTypes, parse as parseTemplate, RootNode, TemplateChildNode } from '@vue/compiler-dom'
const fs = require('fs')
const path = require('path')
import { TextDocument } from 'vscode-languageserver-textdocument'

const naiveSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '../naive.schema.json'), 'utf8'))

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

function positionToOffset(text: string, position: Position): number {
  const lines = text.split(/\r?\n/)
  let offset = 0
  for (let i = 0; i < position.line; i++) offset += lines[i].length + 1 // '\n'
  return offset + position.character
}

/** 找到光标所在的 template 内容与其在整份文本中的起始 offset */
function getTemplateContent(text: string): { content: string; templateStartInDoc: number } | null {
  try {
    const sfc: SFCParseResult = parseSFC(text, { sourceMap: false })
    const tpl = sfc.descriptor.template
    if (!tpl) return null
    // 注意：SFC 的 template 块在整文中的位置（start/end）
    // 但 compiler-dom 返回的 loc.offset 是以 template 内容起始为 0 的局部偏移
    return {
      content: tpl.content,
      templateStartInDoc: tpl.loc.start.offset
    }
  } catch {
    return null
  }
}

/** 遍历 AST，找到包含 offset 的最小 Element 节点 */
function findElementAtOffset(node: RootNode, offset: number): ElementNode | null {
  let found: ElementNode | null = null

  function visit(n: TemplateChildNode) {
    if (!n || !n.loc) return
    const start = n.loc.start.offset
    const end = n.loc.end.offset
    if (offset < start || offset > end) return

    if (n.type === 1) {
      // NodeTypes.ELEMENT
      found = n
      // 继续深入找更小的包含节点
      if ('children' in n && Array.isArray(n.children)) {
        for (const c of n.children) visit(c)
      }
    }
    // else {
    //   // 其他节点继续遍历（比如嵌套元素）
    //   if ('children' in n && Array.isArray(n.children)) {
    //     for (const c of n.children) visit(c);
    //   }
    // }
  }

  for (const item of node.children) {
    visit(item)
    if (found) {
      return found
    }
  }

  return found
}

/** 判断光标是否位于某个 Attribute 的 value 范围（用于枚举值补全） */
function findAttrAtOffset(el: ElementNode, relOffset: number) {
  if (!el || !Array.isArray(el.props)) return null
  for (const p of el.props) {
    // 仅处理普通属性 (type=6: ATTRIBUTE)，不处理指令 (type=7)
    if (p.type === 6) {
      const name = p.name
      const nameStart = p.loc.start.offset // 粗略范围：整个 attr 的区间
      const nameEnd = p.loc.end.offset
      if (relOffset >= nameStart && relOffset <= nameEnd) {
        // 若有值，精确到 value 的区间
        if (p.value && p.value.loc) {
          const vs = p.value.loc.start.offset
          const ve = p.value.loc.end.offset
          if (relOffset >= vs && relOffset <= ve) {
            return { name, attr: p, inValue: true }
          }
        }
        return { name, attr: p, inValue: false }
      }
    }
  }
  return null
}

/** 简单判定：是否在开始标签的“属性区”内（不在任何子节点内 & 在开始标签范围） */
function inStartTagPropsZone(el: Node, relOffset: number, templateSource: string) {
  // 通过源码来估算：<tag ...> 的范围 —— 找到起始 '<' 与对应的 '>'
  const src = templateSource
  const elStart = el.loc.start.offset
  const elEnd = el.loc.end.offset

  // 向前从 elStart 找第一个 '<'
  let lt = elStart
  while (lt > 0 && src[lt] !== '<') lt--
  // 向后找第一个 '>'
  let gt = elStart
  while (gt < elEnd && src[gt] !== '>') gt++

  if (relOffset <= lt || relOffset >= gt) return false

  // 需要排除在标签名内部的位置（例如 <n-b|utton>）
  // 标签名大致在 "<" 后紧跟直到空白或 ">"，做个粗略分割
  let i = lt + 1
  while (i < gt && /\s/.test(src[i]) === false) i++
  const afterTagName = i
  return relOffset >= afterTagName && relOffset < gt
}

/** 根据上下文给出补全项 */
function completeAt(docText: string, pos: Position) {
  //connection.console.log(docText)
  // return [
  //   {
  //     label:'n-button',
  //     kind: CompletionItemKind.Class, // 7
  //     detail: 'Naive UI component'
  //   }
  // ]
  const docOffset = positionToOffset(docText, pos)

  const tpl = getTemplateContent(docText)
  if (!tpl) return []

  const { content, templateStartInDoc } = tpl
  const rel = docOffset - templateStartInDoc
  if (rel < 0 || rel > content.length) return []

  //connection.console.log(ast)

  // 1) 若在文本中出现 `<n-` 且位于标签名上下文：提示组件名
  // 简单向后看不到 '>' 且向前近距离存在 '<n-'
  const left = content.slice(Math.max(0, rel - 32), rel)
  if (/<n\-[\w\-]*$/g.test(left)) {
    //connection.console.log('match regex')
    return Object.entries(naiveSchema).map(([name, meta]) => ({
      label: name,
      kind: CompletionItemKind.Class, // 7
      detail: 'Naive UI component'
    }))
  }

  // 解析 template 成 AST（节点 loc.offset 相对 template 开头）
  let ast: RootNode
  try {
    ast = parseTemplate(content, { comments: false })
  } catch (error) {
    connection.console.log(error)
    return []
  }

  // 2) 找到包含当前 offset 的最小元素
  const el = findElementAtOffset(ast, rel)
  if (!el) return []

  // 组件名（例如 n-button）
  const tag = el.tag || ''
  const schema = naiveSchema[tag]

  // 3) 若在开始标签属性区：提示 props
  if (schema && inStartTagPropsZone(el, rel, content)) {
    return Object.keys(schema.props).map((prop) => ({
      label: prop,
      kind: CompletionItemKind.Property, // 10
      detail: `prop of ${tag}`,
      insertText: `${prop}=""`
      // 可额外提供文档/提示
    }))
  }

  function isElementNode(node: TemplateChildNode): node is ElementNode {
    return node.type === NodeTypes.ELEMENT
  }

  // 4) 若在某个属性的值里：提示枚举值
  if (schema) {
    const hit = findAttrAtOffset(el, rel)
    if (hit && hit.inValue) {
      const values = schema.props[hit.name]
      if (Array.isArray(values)) {
        // 枚举值
        return values.map((v) => ({
          label: String(v),
          kind: CompletionItemKind.Value, // 12
          detail: `${tag}.${hit.name}`
        }))
      }
    }
  }

  return []
}

// ========== LSP 服务器 ==========
connection.onInitialize(() => {
  connection.console.log('navie ui lsp server initing')
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
  connection.console.log('触发了代码补全')
  // return [
  //   {
  //     label: 'n-button',
  //     kind: CompletionItemKind.Class, // 7
  //     detail: 'Naive UI component'
  //   }
  // ]
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return []
  try {
    return completeAt(doc.getText(), params.position)
  } catch (e) {
    // 避免出错影响体验
    return []
  }
})

documents.listen(connection)
connection.listen()
