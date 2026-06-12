import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// Intercepta cada request a OpenRouter y añade preferencia de proveedor.
// Razón: por defecto OpenRouter rutea a Amazon Bedrock para claude-haiku, que
// tiene throttling agresivo (~quota_exceeded tras 10+ requests en 2 min).
// Con ignore: ['Amazon Bedrock'] usa el API directo de Anthropic, que tiene
// límites mucho más altos para el mismo modelo.
function openrouterFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  if (options?.body && typeof options.body === 'string') {
    try {
      const body = JSON.parse(options.body)
      body.provider = {
        ignore: ['Amazon Bedrock'],
      }
      options = { ...options, body: JSON.stringify(body) }
    } catch { /* si el body no es JSON lo dejamos pasar sin modificar */ }
  }
  return fetch(url, options)
}

export const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    'X-Title': 'Widget Agent',
  },
  fetch: openrouterFetch,
})

export const MODELS = {
  // Producción actual — Anthropic directo (evita Bedrock con openrouterFetch)
  fast: 'anthropic/claude-haiku-4-5',
  balanced: 'anthropic/claude-sonnet-4-6',
  powerful: 'anthropic/claude-opus-4-6',

  // Alternativas para testing y fallback
  // Activar cambiando el valor de MODELS.fast en el chat route
  // Probados 2026-06-12 — solo minimax disponible como alternativa real
  gemini_flash: 'google/gemini-flash-1.5',               // endpoint correcto (flash-001 no existe en OR)
  nemotron:     'nvidia/llama-3.1-nemotron-70b-instruct:free', // verificar disponibilidad en OR
  mistral:      'mistralai/mistral-small-3.1-24b-instruct', // versión paga (free tier descontinuado)
  minimax:      'minimax/minimax-01',                     // ✅ disponible, 78% score, fallback viable

  // Infraestructura
  embeddings: 'openai/text-embedding-3-small',
  whisper: 'openai/whisper-1',
} as const

export type ModelKey = keyof typeof MODELS
