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

export class TypeScriptDefinitionParser {
  private program: ts.Program
  private checker: ts.TypeChecker

  constructor(private naiveUIPath: string) {
    // 创建 TypeScript 程序
    const configPath = ts.findConfigFile(naiveUIPath, ts.sys.fileExists, 'tsconfig.json')

    const configFile = configPath ? ts.readConfigFile(configPath, ts.sys.readFile) : { config: {} }

    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath || naiveUIPath))

    this.program = ts.createProgram({
      rootNames: this.getDefinitionFiles(),
      options: {
        ...parsedConfig.options,
        skipLibCheck: true,
        noEmit: true
      }
    })

    this.checker = this.program.getTypeChecker()
  }

  /**
   * 获取所有组件的定义文件
   */
  private getDefinitionFiles(): string[] {
    const componentsPath = path.join(this.naiveUIPath, 'es', 'components')
    const files: string[] = []

    if (!fs.existsSync(componentsPath)) {
      console.warn(`Components path not found: ${componentsPath}`)
      return files
    }

    const componentDirs = fs
      .readdirSync(componentsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)

    for (const dir of componentDirs) {
      const srcPath = path.join(componentsPath, dir, 'src')
      if (fs.existsSync(srcPath)) {
        const propsFile = path.join(srcPath, `${this.getPropFileName(dir)}.ts`)
        if (fs.existsSync(propsFile)) {
          files.push(propsFile)
        }
      }
    }

    return files
  }

  /**
   * 获取 props 文件名（通常是组件名的大写形式 + Props）
   */
  private getPropFileName(componentDir: string): string {
    // 将 kebab-case 转换为 PascalCase
    const pascalCase = componentDir
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
    return pascalCase + 'Props'
  }

  /**
   * 解析所有组件
   */
  public parseAllComponents(): ComponentMetadata[] {
    const components: ComponentMetadata[] = []
    const sourceFiles = this.program.getSourceFiles().filter((sf) => !sf.isDeclarationFile && sf.fileName.includes('/components/'))

    for (const sourceFile of sourceFiles) {
      const componentMeta = this.parseSourceFile(sourceFile)
      if (componentMeta) {
        components.push(componentMeta)
      }
    }

    return components
  }

  /**
   * 解析单个源文件
   */
  private parseSourceFile(sourceFile: ts.SourceFile): ComponentMetadata | null {
    let componentMeta: ComponentMetadata | null = null

    const visit = (node: ts.Node) => {
      // 查找 interface XXXProps
      if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith('Props')) {
        const componentName = node.name.text.replace(/Props$/, '')
        const tag = this.convertToKebabCase(componentName)

        componentMeta = {
          name: componentName,
          tag: tag,
          description: this.getJsDocComment(node),
          props: this.parsePropsInterface(node)
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return componentMeta
  }

  /**
   * 解析 Props 接口
   */
  private parsePropsInterface(node: ts.InterfaceDeclaration): PropMetadata[] {
    const props: PropMetadata[] = []

    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name) {
        const propName = member.name.getText()
        const propMeta = this.parsePropMember(member)

        if (propMeta) {
          props.push({
            name: propName,
            ...propMeta
          })
        }
      }
    }

    return props
  }

  /**
   * 解析单个属性
   */
  private parsePropMember(member: ts.PropertySignature): Omit<PropMetadata, 'name'> | null {
    if (!member.type) return null

    const type = this.checker.getTypeAtLocation(member.type)
    const typeString = this.getTypeString(member.type)
    const description = this.getJsDocComment(member)
    const required = !member.questionToken
    const defaultValue = this.getDefaultValue(member)
    const options = this.extractEnumOptions(member.type)

    return {
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
      // 处理联合类型
      return typeNode.types.map((t) => this.getTypeString(t)).join(' | ')
    } else if (ts.isLiteralTypeNode(typeNode)) {
      // 处理字面量类型
      return typeNode.literal.getText().replace(/['"]/g, '')
    } else if (ts.isArrayTypeNode(typeNode)) {
      return 'Array'
    } else if (ts.isTypeLiteralNode(typeNode)) {
      return 'Object'
    } else if (ts.isTypeReferenceNode(typeNode)) {
      return typeNode.typeName.getText()
    }

    return typeNode.getText()
  }

  /**
   * 提取枚举选项（从联合类型中）
   */
  private extractEnumOptions(typeNode: ts.TypeNode): string[] {
    const options: string[] = []

    if (ts.isUnionTypeNode(typeNode)) {
      for (const type of typeNode.types) {
        if (ts.isLiteralTypeNode(type)) {
          const text = type.literal.getText().replace(/['"]/g, '')
          if (text !== 'undefined') {
            options.push(text)
          }
        }
      }
    } else if (ts.isLiteralTypeNode(typeNode)) {
      const text = typeNode.literal.getText().replace(/['"]/g, '')
      options.push(text)
    }

    return options
  }

  /**
   * 获取 JSDoc 注释
   */
  private getJsDocComment(node: ts.Node): string | undefined {
    const jsDoc = (node as any).jsDoc
    if (jsDoc && jsDoc.length > 0) {
      const comment = jsDoc[0].comment
      if (typeof comment === 'string') {
        return comment
      } else if (Array.isArray(comment)) {
        return comment.map((c) => c.text).join('')
      }
    }
    return undefined
  }

  /**
   * 获取默认值
   */
  private getDefaultValue(member: ts.PropertySignature): any {
    const jsDoc = this.getJsDocComment(member)
    if (jsDoc) {
      // 尝试从 JSDoc 中提取 @default 标签
      const defaultMatch = jsDoc.match(/@default\s+(.+)/)
      if (defaultMatch) {
        const value = defaultMatch[1].trim()
        // 尝试解析为 JSON
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
   * 将 PascalCase 转换为 kebab-case
   */
  private convertToKebabCase(str: string): string {
    // 移除开头的 N
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
}

/**
 * 从 naive-ui 包中提取组件元数据
 */
export function extractNaiveUIMetadata(naiveUIPath?: string): ComponentMetadata[] {
  // 尝试找到 naive-ui 包的路径
  const packagePath = naiveUIPath || findNaiveUIPackage()

  if (!packagePath) {
    console.warn('naive-ui package not found, using fallback metadata')
    return []
  }

  console.log(`Parsing naive-ui from: ${packagePath}`)

  try {
    const parser = new TypeScriptDefinitionParser(packagePath)
    return parser.parseAllComponents()
  } catch (error) {
    console.error('Error parsing naive-ui definitions:', error)
    return []
  }
}

/**
 * 查找 naive-ui 包的路径
 */
function findNaiveUIPackage(): string | null {
  const possiblePaths = [
    // 在项目的 node_modules 中
    path.join(process.cwd(), 'node_modules', 'naive-ui'),
    // 在服务器的 node_modules 中
    path.join(__dirname, '..', '..', 'node_modules', 'naive-ui'),
    path.join(__dirname, '..', 'node_modules', 'naive-ui'),
    // 全局安装
    path.join(process.env.NODE_PATH || '', 'naive-ui')
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }

  // 尝试使用 require.resolve
  try {
    const resolvedPath = require.resolve('naive-ui')
    return path.dirname(path.dirname(resolvedPath))
  } catch {
    return null
  }
}
