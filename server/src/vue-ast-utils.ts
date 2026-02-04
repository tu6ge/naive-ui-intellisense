import { RootNode, NodeTypes, ElementNode, AttributeNode, DirectiveNode, SimpleExpressionNode } from '@vue/compiler-dom'

/* ------------------------------------------------------------------ */
/* -------------------------- 类型定义 -------------------------------- */
/* ------------------------------------------------------------------ */

export type CursorContext =
  | {
      type: 'component'
      tag: string
      node: ElementNode
    }
  | {
      type: 'prop'
      tag: string
      propName: string
      node: AttributeNode | DirectiveNode
    }
  | {
      type: 'prop-value'
      tag: string
      propName: string
      valueNode?: SimpleExpressionNode
    }
  | {
      type: 'unknown'
    }

/* ------------------------------------------------------------------ */
/* ------------------------ 主入口函数 -------------------------------- */
/* ------------------------------------------------------------------ */

export function getCursorContext(ast: RootNode, offset: number): CursorContext {
  let result: CursorContext = { type: 'unknown' }

  walk(ast, (node) => {
    if (node.type !== NodeTypes.ELEMENT) return

    // 1️⃣ 组件名
    if (isInRange(offset, node.tagLoc)) {
      result = {
        type: 'component',
        tag: node.tag,
        node
      }
      return
    }

    // 2️⃣ 属性 & 值
    for (const prop of node.props) {
      // 普通属性：size="xxx"
      if (prop.type === NodeTypes.ATTRIBUTE) {
        if (isInRange(offset, prop.loc)) {
          if (prop.value && isInRange(offset, prop.value.loc)) {
            result = {
              type: 'prop-value',
              tag: node.tag,
              propName: prop.name,
              valueNode: prop.value
            }
          } else {
            result = {
              type: 'prop',
              tag: node.tag,
              propName: prop.name,
              node: prop
            }
          }
          return
        }
      }

      // 指令：:size="xxx"
      if (prop.type === NodeTypes.DIRECTIVE) {
        const name = prop.arg?.content || ''

        if (isInRange(offset, prop.loc)) {
          if (prop.exp && isInRange(offset, prop.exp.loc)) {
            result = {
              type: 'prop-value',
              tag: node.tag,
              propName: name
            }
          } else {
            result = {
              type: 'prop',
              tag: node.tag,
              propName: name,
              node: prop
            }
          }
          return
        }
      }
    }
  })

  return result
}

/* ------------------------------------------------------------------ */
/* ------------------------ 遍历工具 ---------------------------------- */
/* ------------------------------------------------------------------ */

function walk(node: any, cb: (node: any) => void) {
  cb(node)
  if (Array.isArray(node.children)) {
    node.children.forEach((child: any) => walk(child, cb))
  }
}

/* ------------------------------------------------------------------ */
/* ------------------------- Range 判断 ------------------------------- */
/* ------------------------------------------------------------------ */

function isInRange(offset: number, loc?: { start: { offset: number }; end: { offset: number } }) {
  if (!loc) return false
  return offset >= loc.start.offset && offset <= loc.end.offset
}
