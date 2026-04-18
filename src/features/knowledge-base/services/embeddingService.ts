import { openrouter, MODELS } from '@/lib/ai/openrouter'
import { embed } from 'ai'

/**
 * Genera un embedding vectorial para el texto dado.
 * Usa text-embedding-3-small vía OpenRouter.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openrouter.embeddingModel(MODELS.embeddings),
    value: text.slice(0, 8000), // límite de tokens
  })
  return embedding
}

/**
 * Genera embeddings para múltiples textos en una sola llamada.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results = await Promise.all(texts.map(t => generateEmbedding(t)))
  return results
}
