import { parse, SFCDescriptor, SFCTemplateBlock } from '@vue/compiler-sfc';

export interface VueElement {
  tag: string;
  startOffset: number;
  endOffset: number;
  attributes: VueAttribute[];
  loc: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
}

export interface VueAttribute {
  name: string;
  value?: string;
  startOffset: number;
  endOffset: number;
  loc: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
}

export class VueASTParser {
  /**
   * 解析 Vue 文件
   */
  public parseVueFile(content: string): {
    descriptor: SFCDescriptor | null;
    elements: VueElement[];
  } {
    try {
      const { descriptor } = parse(content, { filename: 'temp.vue' });
      const elements: VueElement[] = [];

      if (descriptor.template) {
        this.extractElements(descriptor.template, elements);
      }

      return { descriptor, elements };
    } catch (error) {
      console.error('Parse error:', error);
      return { descriptor: null, elements: [] };
    }
  }

  /**
   * 从模板中提取元素
   */
  private extractElements(template: SFCTemplateBlock, elements: VueElement[]) {
    if (!template.ast) return;

    const traverse = (node: any) => {
      if (node.type === 1) { // ELEMENT
        const element: VueElement = {
          tag: node.tag,
          startOffset: node.loc.start.offset,
          endOffset: node.loc.end.offset,
          attributes: [],
          loc: {
            start: {
              line: node.loc.start.line,
              column: node.loc.start.column,
              offset: node.loc.start.offset
            },
            end: {
              line: node.loc.end.line,
              column: node.loc.end.column,
              offset: node.loc.end.offset
            }
          }
        };

        // 提取属性
        if (node.props) {
          for (const prop of node.props) {
            if (prop.type === 6) { // ATTRIBUTE
              element.attributes.push({
                name: prop.name,
                value: prop.value?.content,
                startOffset: prop.loc.start.offset,
                endOffset: prop.loc.end.offset,
                loc: {
                  start: {
                    line: prop.loc.start.line,
                    column: prop.loc.start.column,
                    offset: prop.loc.start.offset
                  },
                  end: {
                    line: prop.loc.end.line,
                    column: prop.loc.end.column,
                    offset: prop.loc.end.offset
                  }
                }
              });
            } else if (prop.type === 7) { // DIRECTIVE
              const attrName = prop.arg?.type === 4 ? prop.arg.content : prop.name;
              element.attributes.push({
                name: attrName,
                value: prop.exp?.loc?.source,
                startOffset: prop.loc.start.offset,
                endOffset: prop.loc.end.offset,
                loc: {
                  start: {
                    line: prop.loc.start.line,
                    column: prop.loc.start.column,
                    offset: prop.loc.start.offset
                  },
                  end: {
                    line: prop.loc.end.line,
                    column: prop.loc.end.column,
                    offset: prop.loc.end.offset
                  }
                }
              });
            }
          }
        }

        elements.push(element);

        // 递归处理子节点
        if (node.children) {
          for (const child of node.children) {
            traverse(child);
          }
        }
      }
    };

    traverse(template.ast);
  }

  /**
   * 查找指定位置的元素
   */
  public findElementAtPosition(
    elements: VueElement[],
    offset: number
  ): VueElement | undefined {
    for (const element of elements) {
      if (offset >= element.startOffset && offset <= element.endOffset) {
        return element;
      }
    }
    return undefined;
  }

  /**
   * 查找指定位置的属性
   */
  public findAttributeAtPosition(
    element: VueElement,
    offset: number
  ): VueAttribute | undefined {
    for (const attr of element.attributes) {
      if (offset >= attr.startOffset && offset <= attr.endOffset) {
        return attr;
      }
    }
    return undefined;
  }

  /**
   * 检查位置是否在标签名上
   */
  public isOnTagName(content: string, element: VueElement, offset: number): boolean {
    const tagStartPattern = new RegExp(`<${element.tag}`, 'g');
    const matches = content.matchAll(tagStartPattern);
    
    for (const match of matches) {
      const matchOffset = match.index!;
      const tagNameStart = matchOffset + 1; // Skip '<'
      const tagNameEnd = tagNameStart + element.tag.length;
      
      if (offset >= tagNameStart && offset <= tagNameEnd) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检查位置是否在属性名上
   */
  public isOnAttributeName(
    content: string,
    attribute: VueAttribute,
    offset: number
  ): boolean {
    const attrText = content.substring(attribute.startOffset, attribute.endOffset);
    const equalIndex = attrText.indexOf('=');
    
    if (equalIndex === -1) {
      // 没有值的属性，整个都是属性名
      return true;
    }
    
    const attrNameEnd = attribute.startOffset + equalIndex;
    return offset <= attrNameEnd;
  }

  /**
   * 检查位置是否在属性值上
   */
  public isOnAttributeValue(
    content: string,
    attribute: VueAttribute,
    offset: number
  ): boolean {
    const attrText = content.substring(attribute.startOffset, attribute.endOffset);
    const equalIndex = attrText.indexOf('=');
    
    if (equalIndex === -1) {
      return false;
    }
    
    const attrValueStart = attribute.startOffset + equalIndex + 1;
    return offset >= attrValueStart;
  }
}
