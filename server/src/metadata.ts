import * as fs from 'fs';
import * as path from 'path';
import { extractFromCache, extractFromGithub } from './githubExtractor';

export interface ComponentProp {
  name: string;
  type: string;
  description?: string;
  default?: any;
  required?: boolean;
  options?: string[]; // 枚举值选项
}

export interface ComponentMeta {
  name: string;
  tag: string;
  description?: string;
  props: ComponentProp[];
}

export class NaiveUIMetadataExtractor {
  private componentsMeta: Map<string, ComponentMeta> = new Map();
  private useGithubExtract: boolean = true;
  private initialized: boolean = false;

  constructor(useGithubExtract: boolean = true) {
    this.useGithubExtract = useGithubExtract;
  }

  /**
   * 异步初始化（从 GitHub 提取）
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.extractMetadata();
    this.initialized = true;
  }

  /**
   * 同步初始化（使用缓存或手动元数据）
   */
  public initializeSync(): void {
    if (this.initialized) {
      return;
    }

    // 只使用手动元数据（同步）
    this.loadManualMetadata();
    this.initialized = true;
  }

  private async extractMetadata() {
    // 首先尝试从 GitHub 源码文档提取
    if (this.useGithubExtract) {
      try {
        console.log('Attempting to extract from naive-ui GitHub repository...');
        const githubMetadata = await extractFromGithub();
        
        if (githubMetadata.length > 0) {
          console.log(`Successfully extracted ${githubMetadata.length} components from GitHub`);
          this.loadGithubMetadata(githubMetadata);
          
          // 如果提取的组件少于 20 个，补充手动元数据
          if (githubMetadata.length < 20) {
            console.log('GitHub extraction seems incomplete, supplementing with manual metadata');
            this.supplementManualMetadata();
          }
          return;
        } else {
          console.log('No components extracted from GitHub, falling back to manual metadata');
        }
      } catch (error) {
        console.warn('Failed to extract from GitHub:', error);
        console.log('Falling back to manual metadata');
      }
    }else{
      const githubMetadata = await extractFromCache();
        
      if (githubMetadata.length > 0) {
        console.log(`Successfully extracted ${githubMetadata.length} components from Cache`);
        this.loadGithubMetadata(githubMetadata);
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
      });
    }
  }

  /**
   * 补充手动定义的元数据（当 GitHub 提取不完整时）
   */
  private supplementManualMetadata() {
    const manualComponents = this.getManualMetadata();
    for (const [tag, meta] of manualComponents.entries()) {
      if (!this.componentsMeta.has(tag)) {
        this.componentsMeta.set(tag, meta);
      }
    }
  }

  /**
   * 加载手动定义的元数据（作为回退）
   */
  private loadManualMetadata() {
    console.log('Loading manual metadata as fallback...');
    const manualComponents = this.getManualMetadata();
    this.componentsMeta = manualComponents;
  }

  /**
   * 获取手动定义的组件元数据
   */
  private getManualMetadata(): Map<string, ComponentMeta> {
    const meta = new Map<string, ComponentMeta>();
    
    meta.set('n-button', {
      name: 'NButton',
      tag: 'n-button',
      description: 'Button component for user interactions',
      props: [
        {
          name: 'type',
          type: 'string',
          description: 'Button type',
          options: ['default', 'primary', 'info', 'success', 'warning', 'error'],
          default: 'default'
        },
        {
          name: 'size',
          type: 'string',
          description: 'Button size',
          options: ['tiny', 'small', 'medium', 'large'],
          default: 'medium'
        },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Whether the button is disabled',
          default: false
        },
        {
          name: 'loading',
          type: 'boolean',
          description: 'Whether the button is in loading state',
          default: false
        },
        {
          name: 'ghost',
          type: 'boolean',
          description: 'Whether the button is ghost style',
          default: false
        },
        {
          name: 'text',
          type: 'boolean',
          description: 'Whether the button is text style',
          default: false
        },
        {
          name: 'tag',
          type: 'string',
          description: 'HTML tag for rendering',
          default: 'button'
        },
        {
          name: 'round',
          type: 'boolean',
          description: 'Whether the button is round',
          default: false
        },
        {
          name: 'circle',
          type: 'boolean',
          description: 'Whether the button is circle',
          default: false
        }
      ]
    });

    meta.set('n-input', {
      name: 'NInput',
      tag: 'n-input',
      description: 'Input component for user text input',
      props: [
        {
          name: 'type',
          type: 'string',
          description: 'Input type',
          options: ['text', 'password', 'textarea'],
          default: 'text'
        },
        {
          name: 'size',
          type: 'string',
          description: 'Input size',
          options: ['small', 'medium', 'large'],
          default: 'medium'
        },
        {
          name: 'placeholder',
          type: 'string',
          description: 'Placeholder text'
        },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Whether the input is disabled',
          default: false
        },
        {
          name: 'clearable',
          type: 'boolean',
          description: 'Whether the input is clearable',
          default: false
        },
        {
          name: 'round',
          type: 'boolean',
          description: 'Whether the input has round corners',
          default: false
        },
        {
          name: 'rows',
          type: 'number',
          description: 'Rows of textarea',
          default: 3
        },
        {
          name: 'autosize',
          type: 'boolean | object',
          description: 'Auto resize textarea height'
        }
      ]
    });

    meta.set('n-select', {
      name: 'NSelect',
      tag: 'n-select',
      description: 'Select component for choosing from options',
      props: [
        {
          name: 'options',
          type: 'Array',
          description: 'Select options'
        },
        {
          name: 'size',
          type: 'string',
          description: 'Select size',
          options: ['small', 'medium', 'large'],
          default: 'medium'
        },
        {
          name: 'multiple',
          type: 'boolean',
          description: 'Whether multiple selection is allowed',
          default: false
        },
        {
          name: 'disabled',
          type: 'boolean',
          description: 'Whether the select is disabled',
          default: false
        },
        {
          name: 'clearable',
          type: 'boolean',
          description: 'Whether the select is clearable',
          default: false
        },
        {
          name: 'filterable',
          type: 'boolean',
          description: 'Whether the select is filterable',
          default: false
        },
        {
          name: 'placeholder',
          type: 'string',
          description: 'Placeholder text'
        }
      ]
    });

    meta.set('n-card', {
      name: 'NCard',
      tag: 'n-card',
      description: 'Card component for content container',
      props: [
        {
          name: 'title',
          type: 'string',
          description: 'Card title'
        },
        {
          name: 'size',
          type: 'string',
          description: 'Card size',
          options: ['small', 'medium', 'large', 'huge'],
          default: 'medium'
        },
        {
          name: 'bordered',
          type: 'boolean',
          description: 'Whether the card has border',
          default: true
        },
        {
          name: 'hoverable',
          type: 'boolean',
          description: 'Whether the card is hoverable',
          default: false
        },
        {
          name: 'embedded',
          type: 'boolean',
          description: 'Whether the card is embedded',
          default: false
        }
      ]
    });

    meta.set('n-modal', {
      name: 'NModal',
      tag: 'n-modal',
      description: 'Modal dialog component',
      props: [
        {
          name: 'show',
          type: 'boolean',
          description: 'Whether to show modal',
          default: false
        },
        {
          name: 'preset',
          type: 'string',
          description: 'Modal preset style',
          options: ['dialog', 'card'],
          default: 'dialog'
        },
        {
          name: 'title',
          type: 'string',
          description: 'Modal title'
        },
        {
          name: 'closable',
          type: 'boolean',
          description: 'Whether the modal is closable',
          default: true
        },
        {
          name: 'mask-closable',
          type: 'boolean',
          description: 'Whether clicking mask can close modal',
          default: true
        }
      ]
    });

    meta.set('n-table', {
      name: 'NTable',
      tag: 'n-table',
      description: 'Table component for displaying data',
      props: [
        {
          name: 'columns',
          type: 'Array',
          description: 'Table columns configuration'
        },
        {
          name: 'data',
          type: 'Array',
          description: 'Table data source'
        },
        {
          name: 'bordered',
          type: 'boolean',
          description: 'Whether the table has border',
          default: true
        },
        {
          name: 'striped',
          type: 'boolean',
          description: 'Whether the table is striped',
          default: false
        },
        {
          name: 'size',
          type: 'string',
          description: 'Table size',
          options: ['small', 'medium', 'large'],
          default: 'medium'
        }
      ]
    });

    meta.set('n-form', {
      name: 'NForm',
      tag: 'n-form',
      description: 'Form component for data collection and validation',
      props: [
        {
          name: 'model',
          type: 'Object',
          description: 'Form data object'
        },
        {
          name: 'rules',
          type: 'Object',
          description: 'Form validation rules'
        },
        {
          name: 'inline',
          type: 'boolean',
          description: 'Whether the form is inline',
          default: false
        },
        {
          name: 'label-placement',
          type: 'string',
          description: 'Label placement',
          options: ['left', 'top'],
          default: 'top'
        },
        {
          name: 'label-width',
          type: 'string | number',
          description: 'Label width'
        },
        {
          name: 'size',
          type: 'string',
          description: 'Form size',
          options: ['small', 'medium', 'large'],
          default: 'medium'
        }
      ]
    });

    meta.set('n-space', {
      name: 'NSpace',
      tag: 'n-space',
      description: 'Space component for setting element spacing',
      props: [
        {
          name: 'vertical',
          type: 'boolean',
          description: 'Whether to arrange vertically',
          default: false
        },
        {
          name: 'size',
          type: 'string | number | Array',
          description: 'Space size',
          options: ['small', 'medium', 'large']
        },
        {
          name: 'align',
          type: 'string',
          description: 'Alignment',
          options: ['start', 'center', 'end', 'baseline', 'stretch']
        },
        {
          name: 'justify',
          type: 'string',
          description: 'Justify content',
          options: ['start', 'end', 'center', 'space-around', 'space-between']
        }
      ]
    });

    return meta;
  }

  public getComponentMeta(tagName: string): ComponentMeta | undefined {
    return this.componentsMeta.get(tagName.toLowerCase());
  }

  public getAllComponents(): ComponentMeta[] {
    return Array.from(this.componentsMeta.values());
  }

  public getComponentNames(): string[] {
    return Array.from(this.componentsMeta.keys());
  }
}
