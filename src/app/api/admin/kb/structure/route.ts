import { NextRequest, NextResponse } from 'next/server'
import { openrouter, MODELS } from '@/lib/ai/openrouter'
import { generateText } from 'ai'
import { SUGGESTED_CATEGORIES } from '@/features/knowledge-base/types'
import { z } from 'zod'

const RequestSchema = z.object({
  rawText: z.string().min(10).max(100_000),
  existingCategories: z.array(z.string()).optional().default([]),
})

export interface ProposedEntry {
  tempId: string
  title: string
  content: string
  category: string
  tags: string[]
  isNew: boolean
}

const SYSTEM_PROMPT = `Eres un experto en organización de bases de conocimiento para asistentes virtuales de ventas y consultoría. Tu tarea es estructurar texto extraído de documentos en entradas independientes para una KB.

Categorías predefinidas sugeridas:
- service (Servicio): servicios o productos ofrecidos
- project_case (Caso de Proyecto): casos de éxito, proyectos realizados, portfolio
- capability (Capacidad): habilidades, tecnologías, experiencia del equipo
- faq (FAQ): preguntas frecuentes, políticas, procesos
- pricing (Precios): precios, paquetes, tarifas, condiciones comerciales

Reglas:
1. Divide el contenido en entradas pequeñas y enfocadas (1 tema por entrada)
2. Cada entrada debe tener sentido de forma independiente
3. El título debe ser descriptivo y conciso (máximo 80 caracteres)
4. El contenido debe ser limpio, sin ruido del formato original (sin encabezados de página, números de slide, etc.)
5. Puedes usar una categoría predefinida O proponer una nueva si el contenido no encaja
6. Los tags deben ser palabras clave relevantes para búsqueda (2-5 tags)
7. Si el texto es una lista (ej: Excel con clientes, precios, etc.), agrupa items relacionados en entradas lógicas

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin explicaciones):
{
  "entries": [
    {
      "title": "string",
      "content": "string",
      "category": "string",
      "tags": ["string"]
    }
  ]
}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detail: parsed.error.flatten() }, { status: 400 })
    }

    const { rawText, existingCategories } = parsed.data

    const allCategories = [
      ...SUGGESTED_CATEGORIES.map(c => `${c.value} (${c.label})`),
      ...existingCategories
        .filter(c => !SUGGESTED_CATEGORIES.find(s => s.value === c))
        .map(c => `${c} (personalizada)`),
    ]

    const userPrompt = `Categorías disponibles en esta KB: ${allCategories.join(', ')}

Texto a estructurar:
---
${rawText.slice(0, 80_000)}
---

Genera las entradas KB para este contenido.`

    const { text } = await generateText({
      model: openrouter(MODELS.balanced),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.2,
      maxOutputTokens: 8000,
    })

    let parsed2: { entries: Omit<ProposedEntry, 'tempId' | 'isNew'>[] }
    try {
      const json = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      parsed2 = JSON.parse(json)
    } catch {
      return NextResponse.json({ error: 'El agente no devolvió JSON válido', raw: text }, { status: 502 })
    }

    if (!Array.isArray(parsed2.entries)) {
      return NextResponse.json({ error: 'Respuesta inesperada del agente' }, { status: 502 })
    }

    const entries: ProposedEntry[] = parsed2.entries.map((e, i) => {
      const knownCategory = SUGGESTED_CATEGORIES.find(s => s.value === e.category || s.label === e.category)
      return {
        tempId: `proposed-${i}-${Date.now()}`,
        title: String(e.title ?? '').slice(0, 200),
        content: String(e.content ?? '').slice(0, 10000),
        category: knownCategory ? knownCategory.value : String(e.category ?? 'faq'),
        tags: Array.isArray(e.tags) ? e.tags.map(String).slice(0, 10) : [],
        isNew: !existingCategories.includes(e.category) && !SUGGESTED_CATEGORIES.find(s => s.value === e.category),
      }
    })

    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[KB structure]', err)
    return NextResponse.json({ error: 'Error al estructurar el contenido' }, { status: 500 })
  }
}
