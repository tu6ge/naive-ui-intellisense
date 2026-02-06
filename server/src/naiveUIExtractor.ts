import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'

export interface PropMetadata {
  name: string
  type: string
  description?: string
  required?: boolean
  default?: any
  options?: string[]
}

export interface ComponentMetadata {
  name: string
  tag: string
  description?: string
  props: PropMetadata[]
}

export class NaiveUIExtractor {
  private naiveUIPath: string

  constructor(naiveUIPath?: string) {
    this.naiveUIPath = naiveUIPath || this.findNaiveUIPath()
  }

  /**
   * 查找 naive-ui 包路径
   */
  private findNaiveUIPath(): string {
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules', 'naive-ui'),
      path.join(__dirname, '..', '..', 'node_modules', 'naive-ui'),
      path.join(__dirname, '..', 'node_modules', 'naive-ui'),
      path.join(__dirname, '..', '..', '..', 'node_modules', 'naive-ui')
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }

    // 尝试使用 require.resolve
    try {
      const pkgPath = require.resolve('naive-ui/package.json')
      return path.dirname(pkgPath)
    } catch (e) {
      throw new Error('naive-ui package not found')
    }
  }

  /**
   * 提取所有组件元数据
   */
  public extractAll(): ComponentMetadata[] {
    const components: ComponentMetadata[] = []

    // 尝试多种方法提取元数据

    // 方法1: 从 volar.d.ts 提取（最可靠）
    const volarComponents = this.extractFromVolar()
    if (volarComponents.length > 0) {
      return volarComponents
    }

    // 方法2: 从 components 目录提取
    const dirComponents = this.extractFromComponentsDir()
    if (dirComponents.length > 0) {
      return dirComponents
    }

    // 方法3: 从主入口文件提取
    const entryComponents = this.extractFromEntry()
    if (entryComponents.length > 0) {
      return entryComponents
    }

    return components
  }

  /**
   * 从 volar.d.ts 提取（Vue 3 组件类型定义）
   */
  private extractFromVolar(): ComponentMetadata[] {
    const volarPath = path.join(this.naiveUIPath, 'volar.d.ts')
    if (!fs.existsSync(volarPath)) {
      return []
    }

    const components: ComponentMetadata[] = []
    const content = fs.readFileSync(volarPath, 'utf-8')

    // 解析 GlobalComponents 接口
    const sourceFile = ts.createSourceFile(volarPath, content, ts.ScriptTarget.Latest, true)

    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === 'GlobalComponents') {
        for (const member of node.members) {
          if (ts.isPropertySignature(member) && member.name) {
            const componentName = member.name.getText()
            if (componentName.startsWith('N')) {
              const tag = this.pascalToKebab(componentName)
              components.push({
                name: componentName,
                tag: tag,
                description: `${componentName} component from Naive UI`,
                props: this.extractPropsFromType(member)
              })
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return components
  }

  /**
   * 从 components 目录提取
   */
  private extractFromComponentsDir(): ComponentMetadata[] {
    const components: ComponentMetadata[] = []
    const esPath = path.join(this.naiveUIPath, 'es')
    const libPath = path.join(this.naiveUIPath, 'lib')

    const componentsPath = fs.existsSync(esPath) ? path.join(esPath, 'components') : fs.existsSync(libPath) ? path.join(libPath, 'components') : null

    if (!componentsPath || !fs.existsSync(componentsPath)) {
      return []
    }

    const dirs = fs
      .readdirSync(componentsPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    for (const dir of dirs) {
      const component = this.extractComponentFromDir(componentsPath, dir)
      if (component) {
        components.push(component)
      }
    }

    return components
  }

  /**
   * 从单个组件目录提取信息
   */
  private extractComponentFromDir(basePath: string, dirName: string): ComponentMetadata | null {
    const componentPath = path.join(basePath, dirName)
    const srcPath = path.join(componentPath, 'src')

    if (!fs.existsSync(srcPath)) {
      return null
    }

    // 查找 props.ts 或类似文件
    const files = fs.readdirSync(srcPath)
    const propsFile = files.find((f) => f.toLowerCase().includes('props') && f.endsWith('.ts'))

    if (!propsFile) {
      return null
    }

    const propsPath = path.join(srcPath, propsFile)
    const content = fs.readFileSync(propsPath, 'utf-8')

    // 解析 props
    const sourceFile = ts.createSourceFile(propsPath, content, ts.ScriptTarget.Latest, true)

    const componentName = this.kebabToPascal(dirName)
    const props = this.extractPropsFromSourceFile(sourceFile)

    return {
      name: componentName,
      tag: `n-${dirName}`,
      description: `${componentName} component from Naive UI`,
      props
    }
  }

  /**
   * 从源文件提取 props
   */
  private extractPropsFromSourceFile(sourceFile: ts.SourceFile): PropMetadata[] {
    const props: PropMetadata[] = []

    const visit = (node: ts.Node) => {
      // 查找 interface XXXProps 或 type XXXProps
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name.text.endsWith('Props')) {
        if (ts.isInterfaceDeclaration(node)) {
          for (const member of node.members) {
            if (ts.isPropertySignature(member) && member.name) {
              const prop = this.extractProp(member)
              if (prop) {
                props.push(prop)
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return props
  }

  /**
   * 从类型提取 props（用于 volar.d.ts）
   */
  private extractPropsFromType(member: ts.PropertySignature): PropMetadata[] {
    const props: PropMetadata[] = []

    if (member.type && ts.isTypeReferenceNode(member.type)) {
      // 这里需要解析类型引用，暂时返回空数组
      // 实际使用中会从对应的 props 文件中提取
    }

    return props
  }

  /**
   * 提取单个 prop
   */
  private extractProp(member: ts.PropertySignature): PropMetadata | null {
    if (!member.name || !member.type) {
      return null
    }

    const name = member.name.getText()
    const typeString = this.getTypeString(member.type)
    const description = this.getJsDocDescription(member)
    const required = !member.questionToken
    const options = this.extractOptions(member.type)
    const defaultValue = this.extractDefaultFromJsDoc(member)

    return {
      name,
      type: typeString,
      description,
      required,
      default: defaultValue,
      options: options.length > 0 ? options : undefined
    }
  }

  /**
   * 获取类型字符串
   */
  private getTypeString(typeNode: ts.TypeNode): string {
    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.map((t) => this.getTypeString(t)).join(' | ')
    } else if (ts.isLiteralTypeNode(typeNode)) {
      const text = typeNode.literal.getText()
      return text.replace(/['"]/g, '')
    } else if (ts.isArrayTypeNode(typeNode)) {
      return 'Array'
    } else if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) {
      return 'boolean'
    } else if (typeNode.kind === ts.SyntaxKind.StringKeyword) {
      return 'string'
    } else if (typeNode.kind === ts.SyntaxKind.NumberKeyword) {
      return 'number'
    } else if (ts.isTypeLiteralNode(typeNode)) {
      return 'Object'
    } else if (ts.isTypeReferenceNode(typeNode)) {
      return typeNode.typeName.getText()
    }

    return typeNode.getText()
  }

  /**
   * 提取枚举选项
   */
  private extractOptions(typeNode: ts.TypeNode): string[] {
    const options: string[] = []

    if (ts.isUnionTypeNode(typeNode)) {
      for (const type of typeNode.types) {
        if (ts.isLiteralTypeNode(type)) {
          const value = type.literal.getText().replace(/['"]/g, '')
          if (value !== 'undefined' && value !== 'null') {
            options.push(value)
          }
        }
      }
    }

    return options
  }

  /**
   * 从 JSDoc 获取描述
   */
  private getJsDocDescription(node: ts.Node): string | undefined {
    const jsDoc = (node as any).jsDoc
    if (jsDoc && jsDoc.length > 0) {
      const comment = jsDoc[0].comment
      if (typeof comment === 'string') {
        return comment
      }
    }
    return undefined
  }

  /**
   * 从 JSDoc 提取默认值
   */
  private extractDefaultFromJsDoc(node: ts.Node): any {
    const description = this.getJsDocDescription(node)
    if (description) {
      const match = description.match(/@default[s]?\s+(.+)/i)
      if (match) {
        const value = match[1].trim()
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
    }
    return undefined
  }

  /**
   * 从主入口提取
   */
  private extractFromEntry(): ComponentMetadata[] {
    // 尝试从 package.json 的 exports 字段找到入口
    const packagePath = path.join(this.naiveUIPath, 'package.json')
    if (!fs.existsSync(packagePath)) {
      return []
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))

    // 这里可以进一步解析主入口文件
    // 暂时返回空数组
    return []
  }

  /**
   * PascalCase 转 kebab-case
   */
  private pascalToKebab(str: string): string {
    if (str.startsWith('N')) {
      str = str.slice(1)
    }
    return (
      'n-' +
      str
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')
    )
  }

  /**
   * kebab-case 转 PascalCase
   */
  private kebabToPascal(str: string): string {
    return (
      'N' +
      str
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    )
  }
}

/**
 * 导出便捷函数
 */
export function extractNaiveUIMetadata(naiveUIPath?: string): ComponentMetadata[] {
  try {
    const extractor = new NaiveUIExtractor(naiveUIPath)
    return extractor.extractAll()
  } catch (error) {
    console.error('Failed to extract naive-ui metadata:', error)
    return []
  }
}
