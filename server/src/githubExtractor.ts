import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { NaiveUIExtractor } from './naiveUIExtractor'
import { Project } from 'ts-morph'
import { NaiveUIMetadataExtractor } from './metadata'

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

/**
 * 从 naive-ui GitHub 仓库文档提取组件元数据
 */
export class NaiveUIGithubExtractor {
  private readonly GITHUB_RAW_URL = 'https://raw.githubusercontent.com/tusen-ai/naive-ui/main'
  private readonly DOCS_PATH = 'src'
  private cache: Map<string, ComponentMetadata> = new Map()
  private cacheDir: string
  private cacheJsonDir: string

  constructor() {
    // 创建缓存目录
    this.cacheDir = path.join(__dirname, '..', 'cache', 'naive-ui-docs')
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
    this.cacheJsonDir = path.join(__dirname, '..', 'cache', 'json')
    if (!fs.existsSync(this.cacheJsonDir)) {
      fs.mkdirSync(this.cacheJsonDir, { recursive: true })
    }
  }

  /**
   * 获取所有组件元数据
   */
  public async extractAll(): Promise<ComponentMetadata[]> {
    try {
      // 获取组件列表
      const components = await this.getComponentList()

      // 并行提取所有组件的元数据
      const results = await Promise.all(components.map((comp) => this.extractComponent(comp)))

      return results.filter((r) => r !== null) as ComponentMetadata[]
    } catch (error) {
      console.error('Failed to extract from GitHub:', error)
      return []
    }
  }

  /**
   * 获取组件列表
   */
  private async getComponentList(): Promise<string[]> {
    let extractor = new NaiveUIExtractor()
    return extractor.extractAll().map((res) => {
      return res.tag.replace(/^n-/, '')
    })
  }

  /**
   * 提取单个组件的元数据
   */
  private async extractComponent(componentName: string): Promise<ComponentMetadata | null> {
    try {
      // 检查缓存
      if (this.cache.has(componentName)) {
        return this.cache.get(componentName)!
      }

      // 从文档中提取
      let docContent = await this.fetchComponentDoc(componentName)
      if (!docContent) {
        const metadata = new NaiveUIMetadataExtractor(true)
        let fallbackPaths = metadata.fallbackComponentsDocPath()

        if (fallbackPaths[componentName]) {
          const fallbackContent = await this.fetchComponentDoc(fallbackPaths[componentName])
          if (fallbackContent) {
            docContent = fallbackContent
          }
        }
      }

      if (!docContent) {
        return null
      }

      const metadata = this.parseDocumentation(componentName, docContent)

      // 缓存结果
      if (metadata) {
        this.cache.set(componentName, metadata)
        this.saveCacheToFile(componentName, metadata)
      }

      return metadata
    } catch (error) {
      console.error(`Failed to extract ${componentName}:`, error)
      return null
    }
  }

  /**
   * 获取组件文档内容
   */
  private async fetchComponentDoc(componentName: string): Promise<string | null> {
    // 先尝试从本地缓存读取
    const cacheFile = path.join(this.cacheDir, `${componentName}.md`)
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile)
      const age = Date.now() - stats.mtimeMs
      // 缓存 24 小时
      if (age < 24 * 60 * 60 * 1000) {
        return fs.readFileSync(cacheFile, 'utf-8')
      }
    }

    // 从 GitHub 获取
    // naive-ui 文档路径: src/{component}/demos/zhCN/index.demo-entry.md
    const docPaths = [
      `${this.DOCS_PATH}/${componentName}/demos/zhCN/index.demo-entry.md`,
      `${this.DOCS_PATH}/${componentName}/demos/enUS/index.demo-entry.md`,
      // API 文档路径
      `${this.DOCS_PATH}/${componentName}/props.md`,
      `${this.DOCS_PATH}/${componentName}/README.md`
    ]

    for (const docPath of docPaths) {
      const content = await this.fetchFromGithub(docPath)
      if (content) {
        // 保存到缓存
        fs.writeFileSync(cacheFile, content, 'utf-8')
        return content
      }
    }

    return null
  }

  /**
   * 从 GitHub 获取文件内容
   */
  private fetchFromGithub(filePath: string): Promise<string | null> {
    return new Promise((resolve) => {
      const url = `${this.GITHUB_RAW_URL}/${filePath}`

      https
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            resolve(null)
            return
          }

          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => resolve(data))
        })
        .on('error', () => {
          resolve(null)
        })
    })
  }

  /**
   * 解析 Markdown 文档提取组件信息
   */
  private parseDocumentation(componentName: string, content: string): ComponentMetadata | null {
    const pascalName = this.kebabToPascal(componentName)
    const tag = `n-${componentName}`

    // 提取组件描述
    const description = this.extractDescription(content)

    // 提取 Props
    const props = this.extractProps(componentName, content)

    if (props.length === 0) {
      // 如果没有找到 props，尝试其他解析方式
      const fallbackProps = this.extractPropsFromTable(content)
      if (fallbackProps.length > 0) {
        return {
          name: pascalName,
          tag,
          description,
          props: fallbackProps
        }
      }
      return null
    }

    return {
      name: pascalName,
      tag,
      description,
      props
    }
  }

  /**
   * 从文档中提取描述
   */
  private extractDescription(content: string): string | undefined {
    // 尝试匹配 markdown 标题后的第一段
    const match = content.match(/^#\s+.+?\n\n(.+?)(?:\n\n|$)/m)
    if (match) {
      return match[1].trim()
    }
    return undefined
  }

  /**
   * 从文档中提取 Props（从 Props 表格）
   */
  private extractProps(componentName: string, content: string): PropMetadata[] {
    const props: PropMetadata[] = []
    let name = componentName.replace(/^(.)/, (match) => match.toUpperCase()).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    // 查找 Props 部分
    const propsSection = this.extractSection(content, `${name} Props`)
    if (!propsSection) {
      return props
    }

    // 解析 markdown 表格
    const tableMatch = propsSection.match(/\|(.+?)\|[\s\S]*?\n\|([-:\s|]+)\n([\s\S]+?)(?:\n\n|$)/)
    const headers_content = propsSection.match(/^\|\s*[^|\n]+\s*(?:\|\s*[^|\n]+\s*)+\|\s*\n^\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/m)
    if (!tableMatch) {
      return props
    }

    function parseTableHeaderRow(headerLine: string): string[] {
      return headerLine
        .trim()
        .replace(/^\||\|$/g, '') // 去掉首尾 |
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
    }

    const headers = parseTableHeaderRow(headers_content?.[0] || '')

    const rows = tableMatch[3].split('\n').filter((line) => line.trim())
    for (const row of rows) {
      const cells = row
        .split(/(?<!\\)\|/)
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => c.replace(/\\\|/g, '|'))
      if (cells.length < 2) continue

      const prop = this.parsePropRow(headers, cells)
      if (prop) {
        props.push(prop)
      }
    }

    return props
  }

  /**
   * 解析 Props 表格的一行
   */
  private parsePropRow(headers: string[], cells: string[]): PropMetadata | null {
    // 通常的表头: Name, Type, Default, Description
    const nameIdx = headers.findIndex((h) => h === '名称')
    const typeIdx = headers.findIndex((h) => h === '类型')
    const defaultIdx = headers.findIndex((h) => h === '默认值')
    const descIdx = headers.findIndex((h) => h === '说明')

    if (nameIdx === -1 || typeIdx === -1) {
      return null
    }

    const name = cells[nameIdx]?.replace(/`/g, '').trim()
    if (!name) return null

    const type = cells[typeIdx]?.replace(/`/g, '').trim()
    const defaultValue = defaultIdx !== -1 ? cells[defaultIdx]?.replace(/`/g, '').trim() : undefined
    const description = descIdx !== -1 ? cells[descIdx]?.trim() : undefined

    // 提取枚举选项
    const options = this.extractOptionsFromType(type)

    return {
      name,
      type: this.normalizeType(type),
      description,
      required: !defaultValue && !type.includes('?'),
      default: this.parseDefaultValue(defaultValue),
      options: options.length > 0 ? options : undefined
    }
  }

  /**
   * 从类型字符串中提取枚举选项
   */
  private extractOptionsFromType(type: string): string[] {
    const options: string[] = []

    // 匹配 'option1' | 'option2' | 'option3' 模式
    const matches = type.matchAll(/'([^']+)'/g)
    for (const match of matches) {
      options.push(match[1])
    }

    // 也匹配 "option1" | "option2" 模式
    if (options.length === 0) {
      const matches2 = type.matchAll(/"([^"]+)"/g)
      for (const match of matches2) {
        options.push(match[1])
      }
    }

    return options
  }

  /**
   * 标准化类型字符串
   */
  private normalizeType(type: string): string {
    // 移除多余的空格和换行
    type = type.replace(/\s+/g, ' ').trim()

    // 简化类型显示
    if (type.includes('|')) {
      // 如果是联合类型，提取基本类型
      if (/'[^']+'/.test(type)) {
        return 'string' // 字符串字面量联合类型
      }
      return type.split('|')[0].trim() // 返回第一个类型
    }

    return type
  }

  /**
   * 解析默认值
   */
  private parseDefaultValue(value?: string): any {
    if (!value || value === '-' || value === 'undefined') {
      return undefined
    }

    // 尝试解析为 JSON
    try {
      return JSON.parse(value)
    } catch {
      // 移除引号
      return value.replace(/^['"]|['"]$/g, '')
    }
  }

  /**
   * 从表格中提取 Props（备用方法）
   */
  private extractPropsFromTable(content: string): PropMetadata[] {
    const props: PropMetadata[] = []

    // 查找所有表格
    const tableRegex = /\|(.+?)\|[\s\S]*?\n\|([-:\s|]+)\n([\s\S]+?)(?:\n\n|$)/g
    const tables = content.matchAll(tableRegex)

    for (const table of tables) {
      const headers = table[1]
        .split('|')
        .map((h) => h.trim())
        .filter(Boolean)

      // 检查是否是 Props 表格
      if (!headers.some((h) => /name|prop/i.test(h))) {
        continue
      }

      const rows = table[3].split('\n').filter((line) => line.trim())
      for (const row of rows) {
        const cells = row
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
        const prop = this.parsePropRow(headers, cells)
        if (prop) {
          props.push(prop)
        }
      }
    }

    return props
  }

  /**
   * 提取文档中的某个部分
   */
  private extractSection(content: string, sectionName: string): string | null {
    // 匹配 ## Props 或 ### Props 等标题
    const regex = new RegExp(String.raw`###\s+${sectionName}\s*\n([\s\S]*?)(?=\n###\s+|\n##\s+|\n#\s+|$)`)
    const match = content.match(regex)
    return match ? match[1] : null
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

  /**
   * 保存缓存到文件
   */
  private saveCacheToFile(componentName: string, metadata: ComponentMetadata): void {
    const cacheFile = path.join(this.cacheJsonDir, `${componentName}.json`)
    fs.writeFileSync(cacheFile, JSON.stringify(metadata, null, 2), 'utf-8')
  }

  /**
   * 从缓存文件加载
   */
  public loadFromCache(): ComponentMetadata[] {
    const components: ComponentMetadata[] = []

    if (!fs.existsSync(this.cacheJsonDir)) {
      return components
    }

    const files = fs.readdirSync(this.cacheJsonDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.cacheJsonDir, file), 'utf-8')
        const metadata = JSON.parse(content) as ComponentMetadata
        components.push(metadata)
        this.cache.set(file.replace('.json', ''), metadata)
      } catch (error) {
        console.error(`Failed to load cache ${file}:`, error)
      }
    }

    return components
  }
}

export function extractFromCache(): Promise<ComponentMetadata[]> {
  const extractor = new NaiveUIGithubExtractor()

  // 先尝试从缓存加载
  const cached = extractor.loadFromCache()
  return Promise.resolve(cached)
}

/**
 * 导出便捷函数
 */
export async function extractFromGithub(): Promise<ComponentMetadata[]> {
  const extractor = new NaiveUIGithubExtractor()

  // 先尝试从缓存加载
  const cached = extractor.loadFromCache()
  if (cached.length > 0) {
    console.log(`Loaded ${cached.length} components from cache`)
    return cached
  }

  // 从 GitHub 提取
  console.log('Fetching from GitHub...')
  const components = await extractor.extractAll()
  console.log(`Extracted ${components.length} components from GitHub`)

  return components
}
