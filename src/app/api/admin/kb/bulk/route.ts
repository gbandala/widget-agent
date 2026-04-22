import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbeddings } from '@/features/knowledge-base/services/embeddingService'
import { z } from 'zod'

const EntrySchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(10000),
  category: z.string().min(1).max(50),
  tags: z.array(z.string()).optional().default([]),
  tokenId: z.string().uuid().nullable().optional(),
})

const BulkSchema = z.object({
  entries: z.array(EntrySchema).min(1).max(100),
  tokenId: z.string().uuid().nullable().optional(),
})

const EMBED_BATCH = 10

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = BulkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detail: parsed.error.flatten() }, { status: 400 })
    }

    const { entries, tokenId: bulkTokenId } = parsed.data
    const supabase = await createServiceClient()

    // Generate embeddings in batches of EMBED_BATCH
    const texts = entries.map(e => `${e.title}\n\n${e.content}`)
    const allEmbeddings: number[][] = []

    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const batch = texts.slice(i, i + EMBED_BATCH)
      const embeddings = await generateEmbeddings(batch)
      allEmbeddings.push(...embeddings)
    }

    const rows = entries.map((e, i) => ({
      title: e.title,
      content: e.content,
      category: e.category,
      tags: e.tags,
      embedding: allEmbeddings[i],
      is_active: true,
      // Entry-level tokenId overrides bulk-level; both fall back to null (global)
      token_id: e.tokenId ?? bulkTokenId ?? null,
    }))

    const { error } = await supabase.from('kb_entries').insert(rows)

    if (error) {
      console.error('[KB bulk]', error)
      return NextResponse.json({ error: 'Error al guardar entradas', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ imported: rows.length, failed: 0 }, { status: 201 })
  } catch (err) {
    console.error('[KB bulk]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
