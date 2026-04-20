export type KBCategory = string

export const SUGGESTED_CATEGORIES = [
  { value: 'service', label: 'Servicio' },
  { value: 'project_case', label: 'Caso de Proyecto' },
  { value: 'capability', label: 'Capacidad' },
  { value: 'faq', label: 'FAQ' },
  { value: 'pricing', label: 'Precios' },
] as const

export interface KBEntry {
  id: string
  title: string
  content: string
  category: KBCategory
  tags: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface KBSearchResult extends Omit<KBEntry, 'isActive' | 'createdAt' | 'updatedAt'> {
  similarity: number
}

export interface KBEntryInput {
  title: string
  content: string
  category: KBCategory
  tags?: string[]
}
