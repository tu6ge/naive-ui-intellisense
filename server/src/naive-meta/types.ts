export interface NaivePropMeta {
  type: string
  description?: string
  default?: any
  values?: string[]
}

export interface NaiveComponentMeta {
  name: string
  description?: string
  doc?: {
    summary?: string
    since?: string
  }
  props: Record<string, NaivePropMeta>
}

export type NaiveMetaMap = Record<string, NaiveComponentMeta>
