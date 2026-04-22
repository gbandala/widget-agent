import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbedding } from './embeddingService'
import type { KBEntry, KBEntryInput, KBSearchResult } from '../types'

export const kbService = {
  /**
   * Busca entradas relevantes en la KB usando similitud vectorial.
   * tokenId: filtra por token + globales (NULL). Si omitido, devuelve todo (admin).
   */
  async search(query: string, limit = 5, threshold = 0.45, tokenId?: string | null): Promise<KBSearchResult[]> {
    const supabase = await createServiceClient()
    const queryEmbedding = await generateEmbedding(query)

    const { data, error } = await supabase.rpc('search_kb', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      p_token_id: tokenId ?? null,
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
   * Lista entradas de KB. tokenId: filtra por ese token + globales. Omitido = todas.
   */
  async list(tokenId?: string | null): Promise<KBEntry[]> {
    const supabase = await createServiceClient()
    let query = supabase
      .from('kb_entries')
      .select('id, title, content, category, tags, is_active, token_id, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (tokenId !== undefined && tokenId !== null) {
      query = query.or(`token_id.eq.${tokenId},token_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw new Error(`KB list error: ${error.message}`)
    return (data ?? []).map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: row.tags ?? [],
      isActive: row.is_active,
      tokenId: row.token_id ?? null,
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
        token_id: input.tokenId ?? null,
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
      tokenId: data.token_id ?? null,
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
      updated_at: new Date().toISOString(),
    }

    if (input.title !== undefined) updates.title = input.title
    if (input.content !== undefined) updates.content = input.content
    if (input.category !== undefined) updates.category = input.category
    if (input.tags !== undefined) updates.tags = input.tags
    if ('tokenId' in input) updates.token_id = input.tokenId ?? null

    if (input.title || input.content) {
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

    const { error } = await supabase.from('kb_entries').update(updates).eq('id', id)
    if (error) throw new Error(`KB update error: ${error.message}`)
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('kb_entries')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(`KB setActive error: ${error.message}`)
  },

  async delete(id: string): Promise<void> {
    const supabase = await createServiceClient()
    const { error } = await supabase.from('kb_entries').delete().eq('id', id)
    if (error) throw new Error(`KB delete error: ${error.message}`)
  },

  formatForContext(results: KBSearchResult[]): string {
    if (results.length === 0) return ''
    return results
      .map(r => `[${r.category.toUpperCase()}] ${r.title}\n${r.content}`)
      .join('\n\n---\n\n')
  },
}
