import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    'X-Title': 'Widget Agent',
  },
})

export const MODELS = {
  fast: 'anthropic/claude-haiku-4-5',
  balanced: 'anthropic/claude-sonnet-4-6',
  powerful: 'anthropic/claude-opus-4-6',
  embeddings: 'openai/text-embedding-3-small',
  whisper: 'openai/whisper-1',
} as const

export type ModelKey = keyof typeof MODELS
