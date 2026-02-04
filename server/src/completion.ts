import { CompletionItem, CompletionItemKind, Connection } from 'vscode-languageserver/node'
import { RootNode } from '@vue/compiler-dom'

import { getCursorContext } from './vue-ast-utils'
import { NaiveMetaMap } from './naive-meta/types'

export function provideCompletion(ast: RootNode, offset: number, naiveMeta: NaiveMetaMap, connection: Connection): CompletionItem[] {
  const ctx = getCursorContext(ast, offset)

  connection.console.log(ast.children[0].type.toLocaleString())

  switch (ctx.type) {
    case 'component':
      return componentCompletion(naiveMeta)

    case 'prop':
      return propCompletion(ctx.tag, naiveMeta)

    case 'prop-value':
      return propValueCompletion(ctx.tag, ctx.propName, naiveMeta)

    default:
      return []
  }
}

function componentCompletion(naiveMeta: NaiveMetaMap): CompletionItem[] {
  return Object.values(naiveMeta).map((comp) => ({
    label: comp.name,
    kind: CompletionItemKind.Class,
    detail: 'Naive UI Component',
    documentation: comp.description,
    insertText: comp.name
  }))
}

function propCompletion(tag: string, naiveMeta: NaiveMetaMap): CompletionItem[] {
  const comp = naiveMeta[tag]
  if (!comp) return []

  return Object.entries(comp.props).map(([propName, prop]) => ({
    label: propName,
    kind: CompletionItemKind.Property,
    detail: prop.type,
    documentation: prop.description,
    insertText: propName
  }))
}

function propValueCompletion(tag: string, propName: string, naiveMeta: NaiveMetaMap): CompletionItem[] {
  const comp = naiveMeta[tag]
  if (!comp) return []

  const prop = comp.props[propName]
  if (!prop) return []

  // enum
  if (Array.isArray(prop.values)) {
    return prop.values.map((value) => ({
      label: value,
      kind: CompletionItemKind.EnumMember,
      insertText: value
    }))
  }

  // boolean
  if (prop.type === 'boolean') {
    return [
      {
        label: 'true',
        kind: CompletionItemKind.Keyword,
        insertText: 'true'
      },
      {
        label: 'false',
        kind: CompletionItemKind.Keyword,
        insertText: 'false'
      }
    ]
  }

  // string / number 兜底
  return [
    {
      label: prop.type,
      kind: CompletionItemKind.Value,
      insertText: prop.type === 'number' ? '0' : '""'
    }
  ]
}
