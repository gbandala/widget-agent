import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openrouter, MODELS } from '@/lib/ai/openrouter'
import { db } from '@/lib/db'
import { requireWidgetToken } from '@/lib/security/widgetTokenValidator'

/** POST /api/widget/summary — Genera y guarda el resumen de interés de una sesión */
export async function POST(req: NextRequest) {
  const auth = await requireWidgetToken(req)
  if (!auth.ok) return auth.response

  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })
    }

    // Cargar mensajes de la sesión
    const messages = await db`
      SELECT role, content, created_at
      FROM widget_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
      LIMIT 50
    `

    if (!messages || messages.length < 4) {
      return NextResponse.json({ summary: null, message: 'Conversación muy corta para generar resumen' })
    }

    // Formatear conversación
    const conversation = messages
      .map(m => `${m.role === 'user' ? 'Visitante' : 'Asistente'}: ${m.content}`)
      .join('\n')

    // Generar resumen con el modelo
    const { text: summary } = await generateText({
      model: openrouter(MODELS.fast),
      system: `Genera un resumen breve en español para el visitante sobre los temas que exploró en esta consulta.

El resumen debe:
- Estar redactado en segunda persona ("Exploraste...", "Consultaste...", "Mostraste interés en...")
- Mencionar los servicios o temas que preguntó, de forma clara y amable
- Incluir una sugerencia de siguiente paso (agendar una llamada, solicitar propuesta, etc.)
- Ser máximo 3 párrafos cortos
- NO usar markdown (sin #, **, -, ni símbolos de formato)
- NO incluir análisis internos, niveles de interés ni datos de contacto
- Tono cálido y profesional, orientado al visitante`,
      messages: [
        { role: 'user', content: `Conversación a resumir:\n\n${conversation}` },
      ],
    })

    // Guardar resumen en la sesión
    await db`
      UPDATE widget_sessions
      SET interest_summary = ${summary},
          last_active = ${new Date().toISOString()}
      WHERE id = ${sessionId}
    `

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[summary]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/** GET /api/widget/summary?sessionId=xxx — Obtiene el resumen guardado */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })
    }

    // Cargar sesión y mensajes
    const [sessionRows, messages] = await Promise.all([
      db`SELECT interest_summary FROM widget_sessions WHERE id = ${sessionId} LIMIT 1`,
      db`
        SELECT role, content, created_at
        FROM widget_messages
        WHERE session_id = ${sessionId}
        ORDER BY created_at ASC
        LIMIT 100
      `,
    ])

    return NextResponse.json({
      summary: (sessionRows[0]?.interest_summary as string | null) ?? null,
      messages: messages ?? [],
    })
  } catch (err) {
    console.error('[summary]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
