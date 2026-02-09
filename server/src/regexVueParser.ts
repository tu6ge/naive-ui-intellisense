/**
 * 基于正则表达式的 Vue 模板解析器
 * 优势：处理不完整标签、实时输入时的解析
 */

export interface ElementInfo {
  tag: string
  startOffset: number
  endOffset: number
  attributes: AttributeInfo[]
  isComplete: boolean
}

export interface AttributeInfo {
  name: string
  value?: string
  startOffset: number
  endOffset: number
  valueStartOffset?: number
  valueEndOffset?: number
}

export class RegexVueParser {
  /**
   * 查找光标位置的元素
   */
  public findElementAtPosition(content: string, offset: number): ElementInfo | null {
    const beforeCursor = content.substring(0, offset)
    const afterCursor = content.substring(offset)

    // 同时支持 <n-input 和 <NInput
    const tagPattern = /<([A-Za-z][\w-]*)([^>]*)$/
    const match = beforeCursor.match(tagPattern)

    if (!match) {
      return null
    }

    const rawTagName = match[1]
    const normalizedTag = this.normalizeNaiveTag(rawTagName)

    if (!normalizedTag) {
      return null
    }

    const tagStart = beforeCursor.lastIndexOf('<' + rawTagName)
    const attrsText = match[2]

    const closeMatch = afterCursor.match(/^[^>]*>/)
    const isComplete = closeMatch !== null
    const tagEnd = isComplete ? offset + closeMatch[0].length : content.length

    const fullTagText = content.substring(tagStart, tagEnd)
    const attributes = this.parseAttributes(fullTagText, tagStart)

    return {
      tag: 'n-' + normalizedTag, // ← 统一后的 tag（input / form-item）
      startOffset: tagStart,
      endOffset: tagEnd,
      attributes,
      isComplete
    }
  }
  private normalizeNaiveTag(rawTag: string): string | null {
    // <n-input> -> input
    if (rawTag.startsWith('n-')) {
      return rawTag.slice(2)
    }

    // <NInput> -> input
    if (rawTag.startsWith('N') && /[A-Z]/.test(rawTag[1])) {
      // PascalCase -> kebab-case
      const kebab = rawTag
        .replace(/^N/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()

      return kebab
    }

    return null
  }

  public findTagAtPositionOnHover(content: string, offset: number): string | null {
    const len = content.length

    // 向前找到最近的 '<'
    const tagStart = content.lastIndexOf('<', offset - 1)
    if (tagStart === -1 || tagStart + 1 >= len) return null

    // 从 '<' 后扫描 tag 名
    let i = tagStart + 1
    while (i < len && /[^\s>/]/.test(content[i])) {
      i++
    }

    const rawTag = content.substring(tagStart + 1, i)

    let tag = this.normalizeNaiveTag(rawTag)
    return tag ? 'n-' + tag : null
  }

  /**
   * 解析标签中的所有属性
   */
  private parseAttributes(tagText: string, baseOffset: number): AttributeInfo[] {
    const attributes: AttributeInfo[] = []

    // 匹配属性：支持多种格式
    // 1. name="value"
    // 2. name='value'
    // 3. :name="value"
    // 4. @name="value"
    // 5. v-model="value"
    // 6. name (boolean)
    // 7. name= (incomplete)

    const attrPattern = /([:@]?[\w-]+)(?:=(?:["']([^"']*)["']?|([^\s>]*)))?/g
    let match

    while ((match = attrPattern.exec(tagText)) !== null) {
      const attrName = match[1]
      const attrValue = match[2] || match[3]
      const attrStart = baseOffset + match.index
      const attrEnd = baseOffset + match.index + match[0].length

      // 跳过标签名本身
      if (match.index < tagText.indexOf(' ') && match.index < 10) {
        continue
      }

      const attr: AttributeInfo = {
        name: attrName,
        value: attrValue,
        startOffset: attrStart,
        endOffset: attrEnd
      }

      // 如果有值，记录值的位置
      if (attrValue !== undefined) {
        const valueMatch = tagText.substring(match.index).match(/=\s*["']?/)
        if (valueMatch) {
          const valueStart = attrStart + match[1].length + valueMatch[0].length
          attr.valueStartOffset = valueStart
          attr.valueEndOffset = valueStart + (attrValue?.length || 0)
        }
      }

      attributes.push(attr)
    }

    return attributes
  }

  /**
   * 检查光标是否在标签名上
   */
  public isOnTagName(content: string, offset: number): boolean {
    const beforeCursor = content.substring(0, offset)

    // 统一抓取 tag（不管 n-input 还是 NInput）
    // <n-in|, <NInp|
    const tagMatch = beforeCursor.match(/<([A-Za-z][\w-]*)$/)
    if (tagMatch) {
      const rawTag = tagMatch[1]
      return this.isNaiveTag(rawTag)
    }

    // 光标在已输入的 tagName 中
    // <n-but|ton>, <NInp|ut>
    const partialMatch = beforeCursor.match(/<([A-Za-z][\w-]+)/)
    if (partialMatch) {
      const rawTag = partialMatch[1]
      if (!this.isNaiveTag(rawTag)) return false

      const tagStart = beforeCursor.lastIndexOf('<')
      const tagNameEnd = tagStart + 1 + rawTag.length
      return offset <= tagNameEnd
    }

    return false
  }

  private isNaiveTag(rawTag: string): boolean {
    // <n-input>
    if (rawTag.startsWith('n-')) return true

    // <NInput>
    // 必须是 N + 大写字母开头，避免误判 <Nav>
    if (rawTag.startsWith('N') && /[A-Z]/.test(rawTag[1])) {
      return true
    }

    return false
  }

  /**
   * 检查光标是否在属性名上
   */
  public isOnAttributeName(content: string, offset: number): boolean {
    const element = this.findElementAtPosition(content, offset)
    if (!element) {
      return false
    }

    // 检查是否在某个属性上
    for (const attr of element.attributes) {
      if (offset >= attr.startOffset && offset <= attr.startOffset + attr.name.length) {
        return true
      }
    }

    // 检查是否在属性名输入中（空格后）
    const beforeCursor = content.substring(element.startOffset, offset)
    const afterLastSpace = beforeCursor.split(/\s+/).pop() || ''

    // 如果最后一段不包含 = 且不包含 >，则可能在输入属性名
    if (!afterLastSpace.includes('=') && !afterLastSpace.includes('>')) {
      const trimmed = afterLastSpace.trim()
      // 不是标签名，不是空的，可能是属性名
      if (trimmed && !trimmed.startsWith('<')) {
        return true
      }
    }

    return false
  }

  /**
   * 检查光标是否在属性值上
   */
  public isOnAttributeValue(content: string, offset: number): boolean {
    const element = this.findElementAtPosition(content, offset)
    if (!element) {
      return false
    }

    // 检查光标前是否有 = 且在引号内
    const beforeCursor = content.substring(element.startOffset, offset)

    // 检查最近的 = 号
    const lastEqualIndex = beforeCursor.lastIndexOf('=')
    if (lastEqualIndex === -1) {
      return false
    }

    const afterEqual = beforeCursor.substring(lastEqualIndex + 1)

    // 检查是否在引号内
    const hasOpenQuote = /["']/.test(afterEqual)
    const openQuote = afterEqual.match(/["']/)?.[0]

    if (hasOpenQuote && openQuote) {
      // 检查引号是否已闭合
      const afterQuote = afterEqual.substring(afterEqual.indexOf(openQuote) + 1)
      const hasCloseQuote = afterQuote.includes(openQuote)

      // 在引号内
      return !hasCloseQuote || offset <= element.startOffset + lastEqualIndex + 1 + afterEqual.lastIndexOf(openQuote)
    }

    // 等号后立即位置，视为在属性值位置（即将输入引号）
    return /^\s*$/.test(afterEqual)
  }

  /**
   * 获取当前光标所在的属性
   */
  public findAttributeAtPosition(content: string, offset: number): AttributeInfo | null {
    const element = this.findElementAtPosition(content, offset)
    if (!element) {
      return null
    }

    // 查找光标所在的属性
    for (const attr of element.attributes) {
      if (offset >= attr.startOffset && offset <= attr.endOffset) {
        return attr
      }
    }

    // 检查是否在属性值输入中（在 = 之后）
    const beforeCursor = content.substring(element.startOffset, offset)
    const lastEqualIndex = beforeCursor.lastIndexOf('=')

    if (lastEqualIndex !== -1) {
      // 找到这个等号对应的属性名
      const beforeEqual = beforeCursor.substring(0, lastEqualIndex)
      const attrNameMatch = beforeEqual.match(/([:@]?[\w-]+)\s*$/)

      if (attrNameMatch) {
        return {
          name: attrNameMatch[1],
          startOffset: element.startOffset + beforeEqual.lastIndexOf(attrNameMatch[1]),
          endOffset: offset
        }
      }
    }

    return null
  }

  /**
   * 检查是否应该触发组件名补全
   */
  public shouldTriggerComponentCompletion(content: string, offset: number): boolean {
    const beforeCursor = content.substring(0, offset)

    // 检查是否刚输入 <n-
    return /<n-[\w-]*$/.test(beforeCursor)
  }

  /**
   * 检查是否应该触发组件名补全
   */
  public shouldTriggerComponentCompletionUpper(content: string, offset: number): boolean {
    const beforeCursor = content.substring(0, offset)

    // 检查是否刚输入 <N
    return /<N[\w]*$/.test(beforeCursor)
  }

  /**
   * 检查是否应该触发属性名补全
   */
  public shouldTriggerAttributeCompletion(content: string, offset: number): boolean {
    const element = this.findElementAtPosition(content, offset)
    if (!element) {
      return false
    }

    // 检查是否是 naive-ui 组件
    if (!(element.tag.startsWith('n-') || element.tag.startsWith('N'))) {
      return false
    }

    // 在标签内，但不在属性值上
    return !this.isOnAttributeValue(content, offset)
  }

  /**
   * 检查是否应该触发属性值补全
   */
  public shouldTriggerValueCompletion(content: string, offset: number): boolean {
    return this.isOnAttributeValue(content, offset)
  }

  /**
   * 获取所有 naive-ui 组件标签
   */
  public findAllNaiveUITags(content: string): ElementInfo[] {
    const tags: ElementInfo[] = []
    const tagPattern = /<(n-[\w-]+)([^>]*)>/g
    let match

    while ((match = tagPattern.exec(content)) !== null) {
      const tagName = match[1]
      const tagStart = match.index
      const tagEnd = match.index + match[0].length
      const attributes = this.parseAttributes(match[0], tagStart)

      tags.push({
        tag: tagName,
        startOffset: tagStart,
        endOffset: tagEnd,
        attributes,
        isComplete: true
      })
    }

    return tags
  }
}
