import { ElDocument } from '@/document'
import { DocumentAttribute } from '@/document'
import { DocumentEvent } from '@/document'
import { DocumentSlot } from '@/document'

export const attributes: DocumentAttribute[] = [
  {
    name: 'href',
    type: 'string',
    default: 'undefined',
    value: '-',
    description: '锚点链接',
    version: ''
  },
  {
    name: 'title',
    type: 'string',
    default: 'undefined',
    value: '-',
    description: '锚点标题',
    version: ''
  }
]

export const events: DocumentEvent[] = []

export const slots: DocumentSlot[] = [
  {
    name: 'title',
    description: '锚点标题',
    version: '2.42.0',
    params: '()'
  }
]

export const document: ElDocument = { attributes, events, slots }

export default document
