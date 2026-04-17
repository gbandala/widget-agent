import * as cheerio from 'cheerio'

// Private/loopback IP patterns that must never be fetched (SSRF prevention)
const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost(:|\/|$)/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/169\.254\./, // AWS metadata
  /^https?:\/\/\[?::1\]?/,  // IPv6 loopback
  /^https?:\/\/0\./,
]

function isSafeUrl(url: string): boolean {
  if (!url.startsWith('https://')) return false
  return !BLOCKED_PATTERNS.some(p => p.test(url))
}

/**
 * Descarga y extrae el contenido textual relevante de una landing page.
 * Retorna un objeto con secciones identificadas y texto plano.
 */
export async function readLanding(url: string): Promise<{ summary: string; sections: string[] }> {
  if (!isSafeUrl(url)) return { summary: '', sections: [] }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Widget Agent Bot)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return { summary: '', sections: [] }

    const html = await res.text()
    const $ = cheerio.load(html)

    // Eliminar elementos no relevantes
    $('script, style, nav, footer, head, noscript, iframe, [aria-hidden="true"]').remove()

    const sections: string[] = []

    // Extraer secciones con headings
    $('section, [id], [data-section]').each((_, el) => {
      const heading = $(el).find('h1, h2, h3').first().text().trim()
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (heading && text.length > 20) {
        sections.push(`[${heading}] ${text.slice(0, 500)}`)
      }
    })

    // Fallback: extraer headings globales si no hay secciones
    if (sections.length === 0) {
      $('h1, h2, h3').each((_, el) => {
        const heading = $(el).text().trim()
        const next = $(el).next().text().trim()
        if (heading) sections.push(`[${heading}] ${next.slice(0, 300)}`)
      })
    }

    // Resumen general: primeros 2000 chars del body limpio
    const summary = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000)

    return { summary, sections: sections.slice(0, 15) }
  } catch {
    return { summary: '', sections: [] }
  }
}

/**
 * Formatea el contenido de la landing para incluir en el contexto del modelo.
 */
export function formatLandingForContext(
  landing: { summary: string; sections: string[] }
): string {
  if (!landing.summary && landing.sections.length === 0) return ''

  const lines = ['=== CONTENIDO DE LA LANDING PAGE ===']
  if (landing.sections.length > 0) {
    lines.push('Secciones identificadas:')
    landing.sections.forEach(s => lines.push(`• ${s}`))
  } else if (landing.summary) {
    lines.push(landing.summary.slice(0, 1500))
  }
  lines.push('=== FIN CONTENIDO LANDING ===')
  return lines.join('\n')
}
