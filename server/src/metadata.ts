import * as fs from 'fs'
import * as path from 'path'
import { extractFromCache, extractFromGithub } from './githubExtractor'

export interface ComponentProp {
  name: string
  type: string
  description?: string
  default?: any
  required?: boolean
  options?: string[] // 枚举值选项
}

export interface ComponentMeta {
  name: string
  tag: string
  description?: string
  props: ComponentProp[]
}

export class NaiveUIMetadataExtractor {
  private componentsMeta: Map<string, ComponentMeta> = new Map()
  private useGithubExtract: boolean = true
  private initialized: boolean = false

  constructor(useGithubExtract: boolean = true) {
    this.useGithubExtract = useGithubExtract
  }

  /**
   * 异步初始化（从 GitHub 提取）
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.extractMetadata()
    this.initialized = true
  }

  /**
   * 同步初始化（使用缓存或手动元数据）
   */
  public initializeSync(): void {
    if (this.initialized) {
      return
    }

    // 只使用手动元数据（同步）
    this.loadManualMetadata()
    this.initialized = true
  }

  private async extractMetadata() {
    // 首先尝试从 GitHub 源码文档提取
    if (this.useGithubExtract) {
      try {
        console.log('Attempting to extract from naive-ui GitHub repository...')
        const githubMetadata = await extractFromGithub()

        if (githubMetadata.length > 0) {
          console.log(`Successfully extracted ${githubMetadata.length} components from GitHub`)
          this.loadGithubMetadata(githubMetadata)

          // 如果提取的组件少于 20 个，补充手动元数据
          if (githubMetadata.length < 20) {
            console.log('GitHub extraction seems incomplete, supplementing with manual metadata')
            this.supplementManualMetadata()
          }
          return
        } else {
          console.log('No components extracted from GitHub, falling back to manual metadata')
        }
      } catch (error) {
        console.warn('Failed to extract from GitHub:', error)
        console.log('Falling back to manual metadata')
      }
    } else {
      const githubMetadata = await extractFromCache()

      if (githubMetadata.length > 0) {
        console.log(`Successfully extracted ${githubMetadata.length} components from Cache`)
        this.loadGithubMetadata(githubMetadata)
      }
    }
  }

  /**
   * 加载 GitHub 提取的元数据
   */
  private loadGithubMetadata(metadata: any[]) {
    for (const component of metadata) {
      this.componentsMeta.set(component.tag, {
        name: component.name,
        tag: component.tag,
        description: component.description,
        props: component.props.map((prop: any) => ({
          name: prop.name,
          type: prop.type,
          description: prop.description,
          default: prop.default,
          required: prop.required,
          options: prop.options
        }))
      })
    }
  }

  /**
   * 补充手动定义的元数据（当 GitHub 提取不完整时）
   */
  private supplementManualMetadata() {
    const manualComponents = this.getManualMetadata()
    for (const [tag, meta] of manualComponents.entries()) {
      if (!this.componentsMeta.has(tag)) {
        this.componentsMeta.set(tag, meta)
      }
    }
  }

  /**
   * 加载手动定义的元数据（作为回退）
   */
  private loadManualMetadata() {
    console.log('Loading manual metadata as fallback...')
    const manualComponents = this.getManualMetadata()
    this.componentsMeta = manualComponents
  }

  /**
   * 获取手动定义的组件元数据
   */
  private getManualMetadata(): Map<string, ComponentMeta> {
    const meta = new Map<string, ComponentMeta>()

    return meta
  }

  public getComponentMeta(tagName: string): ComponentMeta | undefined {
    return this.componentsMeta.get(tagName.toLowerCase())
  }

  public getAllComponents(): ComponentMeta[] {
    return Array.from(this.componentsMeta.values())
  }

  public getComponentNames(): string[] {
    return Array.from(this.componentsMeta.keys())
  }
}
