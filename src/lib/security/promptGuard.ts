/**
 * Prompt Guard — Detecta intentos de inyección de prompts.
 */

const INJECTION_PATTERNS = [
  /ignora\s+(?:(?:tus|las|sus|mis|estas|esas)\s+)?(instrucciones|reglas|directrices)/i,
  /ignore\s+(your\s+)?(instructions|rules|guidelines)/i,
  /olvida\s+lo\s+que\s+te\s+(dijeron|programaron|instruyeron)/i,
  /forget\s+(everything|all)\s+(you\s+)?(were\s+)?(told|programmed)/i,
  /act\s+as\s+(if\s+you\s+are|a|an)\s+(?!assistant|consultant)/i,
  /actúa\s+como\s+(si\s+fueras|un|una)/i,
  /nuevo\s+(rol|papel|personaje|modo)/i,
  /new\s+(role|character|mode|persona)/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /\[system\]/i,
  /<\/?system>/i,
  /prompt\s+injection/i,
  /<<<.*>>>/,
  /you\s+are\s+now\s+/i,
  /ahora\s+eres\s+/i,
  /override\s+(previous|all)\s+(instructions|commands)/i,
]

export interface GuardResult {
  safe: boolean
  reason?: string
}

export function checkPromptInjection(input: string): GuardResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: 'injection_attempt' }
    }
  }
  return { safe: true }
}

export const INJECTION_BLOCKED_MESSAGE =
  'Lo siento, no puedo procesar ese mensaje. ¿Puedo ayudarte con algo sobre nuestros servicios de consultoría?'
