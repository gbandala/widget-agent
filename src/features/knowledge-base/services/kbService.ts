import { db } from '@/lib/db'
import { generateEmbedding } from './embeddingService'
import type { KBEntry, KBEntryInput, KBSearchResult } from '../types'

export const kbService = {
  /**
   * Busca entradas relevantes en la KB usando similitud vectorial.
   * tokenId: filtra por token + globales (NULL). Si omitido, devuelve todo (admin).
   */
  async search(query: string, limit = 5, threshold = 0.45, tokenId?: string | null): Promise<KBSearchResult[]> {
    const queryEmbedding = await generateEmbedding(query)

    const rows = await db`
      SELECT * FROM search_kb(
        ${queryEmbedding}::vector,
        ${threshold}::float8,
        ${limit}::int,
        ${tokenId ?? null}::uuid
      )
    `

    if (!rows || rows.length === 0) return []

    return rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      content: row.content as string,
      category: row.category as string,
      tags: (row.tags as string[]) ?? [],
      similarity: row.similarity as number,
    }))
  },

  /**
   * Lista entradas de KB. tokenId: filtra por ese token + globales. Omitido = todas.
   */
  async list(tokenId?: string | null): Promise<KBEntry[]> {
    let rows

    if (tokenId !== undefined && tokenId !== null) {
      rows = await db`
        SELECT id, title, content, category, tags, is_active, token_id, created_at, updated_at
        FROM kb_entries
        WHERE token_id = ${tokenId} OR token_id IS NULL
        ORDER BY created_at DESC
      `
    } else {
      rows = await db`
        SELECT id, title, content, category, tags, is_active, token_id, created_at, updated_at
        FROM kb_entries
        ORDER BY created_at DESC
      `
    }

    return rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      content: row.content as string,
      category: row.category as string,
      tags: (row.tags as string[]) ?? [],
      isActive: row.is_active as boolean,
      tokenId: (row.token_id as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }))
  },

  /**
   * Crea una nueva entrada en la KB con su embedding.
   */
  async create(input: KBEntryInput): Promise<KBEntry> {
    const text = `${input.title}\n\n${input.content}`
    const embedding = await generateEmbedding(text)

    const rows = await db`
      INSERT INTO kb_entries ${db({
        title: input.title,
        content: input.content,
        category: input.category,
        tags: input.tags ?? [],
        embedding: JSON.stringify(embedding),
        is_active: true,
        token_id: input.tokenId ?? null,
      })}
      RETURNING *
    `
    const data = rows[0]

    return {
      id: data.id as string,
      title: data.title as string,
      content: data.content as string,
      category: data.category as string,
      tags: (data.tags as string[]) ?? [],
      isActive: data.is_active as boolean,
      tokenId: (data.token_id as string | null) ?? null,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    }
  },

  /**
   * Actualiza una entrada y regenera su embedding si cambió el contenido.
   */
  async update(id: string, input: Partial<KBEntryInput>): Promise<void> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.title !== undefined) updates.title = input.title
    if (input.content !== undefined) updates.content = input.content
    if (input.category !== undefined) updates.category = input.category
    if (input.tags !== undefined) updates.tags = input.tags
    if ('tokenId' in input) updates.token_id = input.tokenId ?? null

    if (input.title || input.content) {
      const existing = await db`SELECT title, content FROM kb_entries WHERE id = ${id} LIMIT 1`
      if (existing[0]) {
        const title = input.title ?? (existing[0].title as string)
        const content = input.content ?? (existing[0].content as string)
        updates.embedding = JSON.stringify(await generateEmbedding(`${title}\n\n${content}`))
      }
    }

    await db`UPDATE kb_entries SET ${db(updates)} WHERE id = ${id}`
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    await db`
      UPDATE kb_entries
      SET is_active = ${isActive}, updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
    `
  },

  async delete(id: string): Promise<void> {
    await db`DELETE FROM kb_entries WHERE id = ${id}`
  },

  formatForContext(results: KBSearchResult[]): string {
    if (results.length === 0) return ''
    return results
      .map(r => `[${r.category.toUpperCase()}] ${r.title}\n${r.content}`)
      .join('\n\n---\n\n')
  },
}
