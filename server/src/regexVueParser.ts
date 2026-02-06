/**
 * 基于正则表达式的 Vue 模板解析器
 * 优势：处理不完整标签、实时输入时的解析
 */

export interface ElementInfo {
  tag: string;
  startOffset: number;
  endOffset: number;
  attributes: AttributeInfo[];
  isComplete: boolean;
}

export interface AttributeInfo {
  name: string;
  value?: string;
  startOffset: number;
  endOffset: number;
  valueStartOffset?: number;
  valueEndOffset?: number;
}

export class RegexVueParser {
  /**
   * 查找光标位置的元素
   */
  public findElementAtPosition(content: string, offset: number): ElementInfo | null {
    // 向前查找最近的开始标签
    const beforeCursor = content.substring(0, offset);
    const afterCursor = content.substring(offset);

    // 匹配开始标签（包括不完整的）
    // 支持: <n-button, <n-button type="primary", <n-button type="primary">
    const tagPattern = /<(n-[\w-]+)([^>]*)$/;
    const match = beforeCursor.match(tagPattern);

    if (!match) {
      return null;
    }

    const tagName = match[1];
    const tagStart = beforeCursor.lastIndexOf('<' + tagName);
    const attrsText = match[2];

    // 查找标签结束位置
    const closeMatch = afterCursor.match(/^[^>]*>/);
    const isComplete = closeMatch !== null;
    const tagEnd = isComplete 
      ? offset + closeMatch[0].length 
      : content.length;

    // 解析属性
    const fullTagText = content.substring(tagStart, tagEnd);
    const attributes = this.parseAttributes(fullTagText, tagStart);

    return {
      tag: tagName,
      startOffset: tagStart,
      endOffset: tagEnd,
      attributes,
      isComplete
    };
  }

  public findTagAtPositionOnHover(content: string, offset: number): string | null {
    const len = content.length;

    // 向前找到最近的 '<'
    const tagStart = content.lastIndexOf('<', offset - 1);
    if (tagStart === -1 || tagStart + 1 >= len) return null;

    // 从 '<' 向后扫描，直到空格、'>' 或光标后第一个不合法字符
    let i = tagStart + 1;
    while (i < len && /[^\s>]/.test(content[i])) i++;

    const tagName = content.substring(tagStart + 1, i);

    return tagName.startsWith('n-') ? tagName : null;
}

  /**
   * 解析标签中的所有属性
   */
  private parseAttributes(tagText: string, baseOffset: number): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];
    
    // 匹配属性：支持多种格式
    // 1. name="value"
    // 2. name='value'
    // 3. :name="value"
    // 4. @name="value"
    // 5. v-model="value"
    // 6. name (boolean)
    // 7. name= (incomplete)
    
    const attrPattern = /([:@]?[\w-]+)(?:=(?:["']([^"']*)["']?|([^\s>]*)))?/g;
    let match;

    while ((match = attrPattern.exec(tagText)) !== null) {
      const attrName = match[1];
      const attrValue = match[2] || match[3];
      const attrStart = baseOffset + match.index;
      const attrEnd = baseOffset + match.index + match[0].length;

      // 跳过标签名本身
      if (match.index < tagText.indexOf(' ') && match.index < 10) {
        continue;
      }

      const attr: AttributeInfo = {
        name: attrName,
        value: attrValue,
        startOffset: attrStart,
        endOffset: attrEnd
      };

      // 如果有值，记录值的位置
      if (attrValue !== undefined) {
        const valueMatch = tagText.substring(match.index).match(/=\s*["']?/);
        if (valueMatch) {
          const valueStart = attrStart + match[1].length + valueMatch[0].length;
          attr.valueStartOffset = valueStart;
          attr.valueEndOffset = valueStart + (attrValue?.length || 0);
        }
      }

      attributes.push(attr);
    }

    return attributes;
  }

  /**
   * 检查光标是否在标签名上
   */
  public isOnTagName(content: string, offset: number): boolean {
    const beforeCursor = content.substring(0, offset);
    
    // 检查光标前是否是标签名
    // 匹配: <n-button|, <n-in|
    const match = beforeCursor.match(/<(n-[\w-]*)$/);
    if (match) {
      return true;
    }

    // 检查光标是否在已完成的标签名中
    // 匹配: <n-but|ton type="primary">
    const beforeMatch = beforeCursor.match(/<(n-[\w-]+)/);
    if (beforeMatch) {
      const tagStart = beforeCursor.lastIndexOf('<');
      const tagNameEnd = tagStart + 1 + beforeMatch[1].length;
      if (offset <= tagNameEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查光标是否在属性名上
   */
  public isOnAttributeName(content: string, offset: number): boolean {
    const element = this.findElementAtPosition(content, offset);
    if (!element) {
      return false;
    }

    // 检查是否在某个属性上
    for (const attr of element.attributes) {
      if (offset >= attr.startOffset && offset <= attr.startOffset + attr.name.length) {
        return true;
      }
    }

    // 检查是否在属性名输入中（空格后）
    const beforeCursor = content.substring(element.startOffset, offset);
    const afterLastSpace = beforeCursor.split(/\s+/).pop() || '';
    
    // 如果最后一段不包含 = 且不包含 >，则可能在输入属性名
    if (!afterLastSpace.includes('=') && !afterLastSpace.includes('>')) {
      const trimmed = afterLastSpace.trim();
      // 不是标签名，不是空的，可能是属性名
      if (trimmed && !trimmed.startsWith('<')) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查光标是否在属性值上
   */
  public isOnAttributeValue(content: string, offset: number): boolean {
    const element = this.findElementAtPosition(content, offset);
    if (!element) {
      return false;
    }

    // 检查光标前是否有 = 且在引号内
    const beforeCursor = content.substring(element.startOffset, offset);
    
    // 检查最近的 = 号
    const lastEqualIndex = beforeCursor.lastIndexOf('=');
    if (lastEqualIndex === -1) {
      return false;
    }

    const afterEqual = beforeCursor.substring(lastEqualIndex + 1);
    
    // 检查是否在引号内
    const hasOpenQuote = /["']/.test(afterEqual);
    const openQuote = afterEqual.match(/["']/)?.[0];
    
    if (hasOpenQuote && openQuote) {
      // 检查引号是否已闭合
      const afterQuote = afterEqual.substring(afterEqual.indexOf(openQuote) + 1);
      const hasCloseQuote = afterQuote.includes(openQuote);
      
      // 在引号内
      return !hasCloseQuote || offset <= element.startOffset + lastEqualIndex + 1 + afterEqual.lastIndexOf(openQuote);
    }

    // 等号后立即位置，视为在属性值位置（即将输入引号）
    return /^\s*$/.test(afterEqual);
  }

  /**
   * 获取当前光标所在的属性
   */
  public findAttributeAtPosition(content: string, offset: number): AttributeInfo | null {
    const element = this.findElementAtPosition(content, offset);
    if (!element) {
      return null;
    }

    // 查找光标所在的属性
    for (const attr of element.attributes) {
      if (offset >= attr.startOffset && offset <= attr.endOffset) {
        return attr;
      }
    }

    // 检查是否在属性值输入中（在 = 之后）
    const beforeCursor = content.substring(element.startOffset, offset);
    const lastEqualIndex = beforeCursor.lastIndexOf('=');
    
    if (lastEqualIndex !== -1) {
      // 找到这个等号对应的属性名
      const beforeEqual = beforeCursor.substring(0, lastEqualIndex);
      const attrNameMatch = beforeEqual.match(/([:@]?[\w-]+)\s*$/);
      
      if (attrNameMatch) {
        return {
          name: attrNameMatch[1],
          startOffset: element.startOffset + beforeEqual.lastIndexOf(attrNameMatch[1]),
          endOffset: offset
        };
      }
    }

    return null;
  }

  /**
   * 检查是否应该触发组件名补全
   */
  public shouldTriggerComponentCompletion(content: string, offset: number): boolean {
    const beforeCursor = content.substring(0, offset);
    
    // 检查是否刚输入 <n-
    return /<n-[\w-]*$/.test(beforeCursor);
  }

  /**
   * 检查是否应该触发属性名补全
   */
  public shouldTriggerAttributeCompletion(content: string, offset: number): boolean {
    const element = this.findElementAtPosition(content, offset);
    if (!element) {
      return false;
    }

    // 检查是否是 naive-ui 组件
    if (!element.tag.startsWith('n-')) {
      return false;
    }

    // 在标签内，但不在属性值上
    return !this.isOnAttributeValue(content, offset);
  }

  /**
   * 检查是否应该触发属性值补全
   */
  public shouldTriggerValueCompletion(content: string, offset: number): boolean {
    return this.isOnAttributeValue(content, offset);
  }

  /**
   * 获取所有 naive-ui 组件标签
   */
  public findAllNaiveUITags(content: string): ElementInfo[] {
    const tags: ElementInfo[] = [];
    const tagPattern = /<(n-[\w-]+)([^>]*)>/g;
    let match;

    while ((match = tagPattern.exec(content)) !== null) {
      const tagName = match[1];
      const tagStart = match.index;
      const tagEnd = match.index + match[0].length;
      const attributes = this.parseAttributes(match[0], tagStart);

      tags.push({
        tag: tagName,
        startOffset: tagStart,
        endOffset: tagEnd,
        attributes,
        isComplete: true
      });
    }

    return tags;
  }
}
