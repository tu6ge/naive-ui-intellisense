import fs from 'fs'
import path from 'path'
import { NaiveMetaMap } from './types'

let cachedMeta: NaiveMetaMap | null = null

export function loadNaiveMeta(): NaiveMetaMap | null {
  if (cachedMeta) {
    return cachedMeta
  }

  const metaPath = path.resolve(__dirname, '../../naive-ui.json')

  const raw = fs.readFileSync(metaPath, 'utf-8')
  cachedMeta = JSON.parse(raw)

  return cachedMeta
}
