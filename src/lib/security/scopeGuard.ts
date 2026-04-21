/**
 * Scope Guard — Bloquea mensajes universalmente fuera de lugar antes de llegar al modelo.
 * Solo cubre contenido que ningún widget legítimo debería procesar.
 * El scope específico del negocio se maneja vía system prompt (agent_scope por token).
 */

const UNIVERSAL_BLOCK_PATTERNS = [
  // Contenido explícito / violento
  /\b(pornografía|contenido sexual explícito|violación)\b/i,
  // Ciberataques directos
  /\b(ddos|ataque de denegación|exploit|payload malicioso|inyección sql)\b/i,
]

export interface ScopeResult {
  allowed: boolean
  reason?: string
}

export function checkScope(message: string): ScopeResult {
  if (message.trim().length < 5) return { allowed: true }

  for (const pattern of UNIVERSAL_BLOCK_PATTERNS) {
    if (pattern.test(message)) {
      return { allowed: false, reason: 'blocked_content' }
    }
  }

  return { allowed: true }
}

export const SCOPE_DECLINE_MESSAGE =
  'Lo siento, no puedo ayudarte con eso. ¿Hay algo más en lo que pueda orientarte?'
