/**
 * PII Filter — Detecta y elimina datos personales sensibles
 * de la salida del modelo antes de enviarlos al cliente.
 */

// Patrones para detectar PII en output del modelo
const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // Emails
  {
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[email protegido]',
  },
  // Tarjetas de crédito — ANTES que teléfonos para evitar que el patrón de
  // teléfono consuma los primeros 8 dígitos de un número de 16.
  {
    pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
    replacement: '[datos protegidos]',
  },
  // Teléfonos MX y genéricos
  {
    pattern: /\b(\+?52\s?)?(\d{2,3}[\s\-]?)?\d{3,4}[\s\-]?\d{4}\b/g,
    replacement: '[teléfono protegido]',
  },
  // CURP (México)
  {
    pattern: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d\b/gi,
    replacement: '[CURP protegido]',
  },
  // RFC (México)
  {
    pattern: /\b[A-Z]{3,4}\d{6}[A-Z\d]{3}\b/gi,
    replacement: '[RFC protegido]',
  },
]

/**
 * Filtra PII de un texto. Seguro para output del modelo.
 */
export function filterPII(text: string): string {
  let result = text
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

/**
 * Detecta si el texto contiene PII sin modificarlo.
 */
export function containsPII(text: string): boolean {
  return PII_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0
    return pattern.test(text)
  })
}
