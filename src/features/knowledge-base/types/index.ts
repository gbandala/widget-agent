export type KBCategory = 'service' | 'project_case' | 'capability' | 'faq' | 'pricing'

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
