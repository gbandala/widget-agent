export interface GibberishResult {
  isGibberish: boolean
  reason?: string
}

export function checkGibberish(input: string): GibberishResult {
  const text = input.trim()

  if (text.length < 2) return { isGibberish: true, reason: 'too_short' }

  // No alphabetic characters at all (pure numbers, symbols, emoji)
  if (!/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/u.test(text)) return { isGibberish: true, reason: 'no_alpha' }

  // 5+ consecutive identical characters ("jjjjjj", "aaaaaaa")
  if (/(.)\1{4,}/.test(text)) return { isGibberish: true, reason: 'repeated_char' }

  // Single character dominates > 65% of non-space content ("aaabaa", "jajajaja")
  const chars = text.replace(/\s/g, '')
  if (chars.length >= 5) {
    const freq: Record<string, number> = {}
    for (const c of chars.toLowerCase()) freq[c] = (freq[c] ?? 0) + 1
    const maxFreq = Math.max(...Object.values(freq))
    if (maxFreq / chars.length > 0.65) return { isGibberish: true, reason: 'repetitive' }
  }

  return { isGibberish: false }
}

export const GIBBERISH_RESPONSE =
  '¿Tienes alguna pregunta? Con gusto te ayudo.'
