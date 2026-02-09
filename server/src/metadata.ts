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

  public fallbackComponentsDocPath(): { [key: string]: string } {
    return {
      // anchor / breadcrumb
      'anchor-link': 'anchor',
      'breadcrumb-item': 'breadcrumb',

      // avatar / badge / button
      'avatar-group': 'avatar',
      badge: 'badge',
      'button-group': 'button',

      // carousel / checkbox / collapse / steps / radio
      'carousel-item': 'carousel',
      'checkbox-group': 'checkbox',
      'collapse-item': 'collapse',
      radio: 'radio',
      'radio-button': 'radio',
      'radio-group': 'radio',
      step: 'steps',

      // date / descriptions
      'date-picker': 'date-picker',
      'descriptions-item': 'descriptions',

      // dialog / drawer / providers
      'dialog-provider': 'dialog',
      'drawer-content': 'drawer',
      'loading-bar-provider': 'loading-bar',
      'message-provider': 'message',
      'modal-provider': 'modal',
      'notification-provider': 'notification',

      // ellipsis / text
      ellipsis: 'ellipsis',
      'performant-ellipsis': 'ellipsis',
      text: 'typography',

      // float button
      'float-button-group': 'float-button',

      // form (all shared)
      'form-item': 'form',
      'form-item-col': 'form',
      'form-item-gi': 'form',
      'form-item-grid-item': 'form',
      'form-item-row': 'form',

      // grid / row / col / gi
      gi: 'grid',
      'grid-item': 'grid',
      row: 'grid',
      col: 'grid',

      // layout
      layout: 'layout',
      'layout-content': 'layout',
      'layout-footer': 'layout',
      'layout-header': 'layout',
      'layout-sider': 'layout',

      // icon / image
      'icon-wrapper': 'icon',
      'image-group': 'image',
      'image-preview': 'image',

      // input
      'input-group': 'input',
      'input-group-label': 'input',
      'input-otp': 'input',

      // upload
      'upload-dragger': 'upload',
      'upload-file-list': 'upload',
      'upload-trigger': 'upload',

      // infinite / virtual
      'infinite-scroll': 'infinite-scroll',
      'virtual-list': 'virtual-list',

      // list / timeline / thing
      'list-item': 'list',
      'timeline-item': 'timeline',
      thing: 'thing',

      // qr / tooltip
      'qr-code': 'qr-code',
      tooltip: 'tooltip',

      // tabs
      tab: 'tabs',
      'tab-pane': 'tabs',

      // table semantic
      thead: 'table',
      tbody: 'table',
      tr: 'table',
      th: 'table',
      td: 'table',

      // typography / html-like
      a: 'typography',
      blockquote: 'typography',
      h1: 'typography',
      h2: 'typography',
      h3: 'typography',
      h4: 'typography',
      h5: 'typography',
      h6: 'typography',
      hr: 'typography',
      li: 'typography',
      ol: 'typography',
      p: 'typography',
      ul: 'typography',

      // misc
      el: 'element',
      'global-style': 'global-style',
      'legacy-transfer': 'transfer'
    }
  }
}

export interface ComponentProp {
  name: string
  type: string
  description?: string
  default?: any
  required?: boolean
  options?: string[] // 枚举值选项
}

export function generatePropsTable(props: ComponentProp[]): string {
  if (!props || props.length === 0) {
    return ''
  }

  // 定义表头
  const headers = ['名称', '类型', '描述', '默认值', '必填', '选项']
  const headerRow = `| ${headers.join(' | ')} |`
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`

  // 生成表格行
  const rows = props.map((prop) => {
    // 处理名称
    const name = prop.name || ''

    // 处理类型
    const type = prop.type ? `\`${prop.type}\`` : ''

    // 处理描述
    const description = prop.description || ''

    // 处理默认值
    let defaultValue = ''
    if (prop.default !== undefined) {
      if (typeof prop.default === 'string') {
        defaultValue = prop.default.length > 0 ? `\`"${prop.default}"\`` : '`""`'
      } else if (typeof prop.default === 'boolean') {
        defaultValue = prop.default ? '`true`' : '`false`'
      } else if (typeof prop.default === 'number') {
        defaultValue = `\`${prop.default}\``
      } else if (prop.default === null) {
        defaultValue = '`null`'
      } else if (prop.default === undefined) {
        defaultValue = '`undefined`'
      } else {
        defaultValue = `\`${JSON.stringify(prop.default)}\``
      }
    }

    // 处理必填
    const required = prop.required ? '是' : '否'

    // 处理选项
    let options = ''
    if (prop.options && prop.options.length > 0) {
      options = prop.options.map((opt) => `\`${opt}\``).join(', ')
    }

    return `| ${name} | ${type} | ${description} | ${defaultValue} | ${required} | ${options} |`
  })

  // 组合成完整表格
  return [headerRow, separatorRow, ...rows].join('\n')
}
