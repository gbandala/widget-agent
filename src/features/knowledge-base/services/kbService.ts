import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbedding } from './embeddingService'
import type { KBEntry, KBEntryInput, KBSearchResult } from '../types'

export const kbService = {
  /**
   * Busca entradas relevantes en la KB usando similitud vectorial.
   */
  async search(query: string, limit = 5, threshold = 0.65): Promise<KBSearchResult[]> {
    const supabase = await createServiceClient()
    const queryEmbedding = await generateEmbedding(query)

    const { data, error } = await supabase.rpc('search_kb', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) throw new Error(`KB search error: ${error.message}`)
    if (!data) return []

    return data.map((row: KBSearchResult) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: row.tags ?? [],
      similarity: row.similarity,
    }))
  },

  /**
   * Lista todas las entradas de KB (para panel admin).
   */
  async list(): Promise<KBEntry[]> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('kb_entries')
      .select('id, title, content, category, tags, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw new Error(`KB list error: ${error.message}`)
    return (data ?? []).map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: row.tags ?? [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  /**
   * Crea una nueva entrada en la KB con su embedding.
   */
  async create(input: KBEntryInput): Promise<KBEntry> {
    const supabase = await createServiceClient()
    const text = `${input.title}\n\n${input.content}`
    const embedding = await generateEmbedding(text)

    const { data, error } = await supabase
      .from('kb_entries')
      .insert({
        title: input.title,
        content: input.content,
        category: input.category,
        tags: input.tags ?? [],
        embedding,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw new Error(`KB create error: ${error.message}`)
    return {
      id: data.id,
      title: data.title,
      content: data.content,
      category: data.category,
      tags: data.tags ?? [],
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  /**
   * Actualiza una entrada y regenera su embedding si cambió el contenido.
   */
  async update(id: string, input: Partial<KBEntryInput>): Promise<void> {
    const supabase = await createServiceClient()
    const updates: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    }

    if (input.title || input.content) {
      // Necesitamos el texto completo para regenerar embedding
      const { data: existing } = await supabase
        .from('kb_entries')
        .select('title, content')
        .eq('id', id)
        .single()

      if (existing) {
        const title = input.title ?? existing.title
        const content = input.content ?? existing.content
        updates.embedding = await generateEmbedding(`${title}\n\n${content}`)
      }
    }

    const { error } = await supabase
      .from('kb_entries')
      .update(updates)
      .eq('id', id)

    if (error) throw new Error(`KB update error: ${error.message}`)
  },

  /**
   * Activa o desactiva una entrada.
   */
  async setActive(id: string, isActive: boolean): Promise<void> {
    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('kb_entries')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw new Error(`KB setActive error: ${error.message}`)
  },

  /**
   * Elimina permanentemente una entrada.
   */
  async delete(id: string): Promise<void> {
    const supabase = await createServiceClient()
    const { error } = await supabase.from('kb_entries').delete().eq('id', id)
    if (error) throw new Error(`KB delete error: ${error.message}`)
  },

  /**
   * Formatea los resultados de búsqueda para incluirlos en el contexto del modelo.
   */
  formatForContext(results: KBSearchResult[]): string {
    if (results.length === 0) return ''
    return results
      .map(r => `[${r.category.toUpperCase()}] ${r.title}\n${r.content}`)
      .join('\n\n---\n\n')
  },
}
