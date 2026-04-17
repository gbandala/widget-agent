import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openrouter, MODELS } from '@/lib/ai/openrouter'
import { createServiceClient } from '@/lib/supabase/server'
import { requireWidgetToken } from '@/lib/security/widgetTokenValidator'

/** POST /api/widget/summary — Genera y guarda el resumen de interés de una sesión */
export async function POST(req: NextRequest) {
  const auth = await requireWidgetToken(req)
  if (!auth.ok) return auth.response

  try {
    const supabase = await createServiceClient()
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })
    }

    // Cargar mensajes de la sesión
    const { data: messages, error: msgError } = await supabase
      .from('widget_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (msgError || !messages || messages.length < 4) {
      return NextResponse.json({ summary: null, message: 'Conversación muy corta para generar resumen' })
    }

    // Formatear conversación
    const conversation = messages
      .map(m => `${m.role === 'user' ? 'Visitante' : 'Asistente'}: ${m.content}`)
      .join('\n')

    // Generar resumen con el modelo
    const { text: summary } = await generateText({
      model: openrouter(MODELS.fast),
      system: `Eres un analista de ventas. Genera un resumen CONCISO en español del interés del visitante basándote en la conversación.

Incluye exactamente estas secciones:
1. **Servicios consultados**: Lista los servicios o temas que preguntó
2. **Dudas principales**: Las 2-3 preguntas más relevantes
3. **Nivel de interés**: Bajo / Medio / Alto — con breve justificación
4. **Próximo paso sugerido**: Qué acción recomiendas (cita, propuesta, info adicional)

REGLAS IMPORTANTES:
- NO incluyas datos de contacto (email, teléfono, nombre completo)
- NO menciones nombres de clientes ni empresas específicas
- Máximo 200 palabras
- Tono profesional y directo`,
      messages: [
        { role: 'user', content: `Conversación a analizar:\n\n${conversation}` },
      ],
    })

    // Guardar resumen en la sesión
    await supabase
      .from('widget_sessions')
      .update({
        interest_summary: summary,
        last_active: new Date().toISOString(),
      })
      .eq('id', sessionId)

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[summary]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/** GET /api/widget/summary?sessionId=xxx — Obtiene el resumen guardado */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const sessionId = req.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })
    }

    // Cargar sesión y mensajes
    const [sessionResult, messagesResult] = await Promise.all([
      supabase.from('widget_sessions').select('interest_summary').eq('id', sessionId).single(),
      supabase
        .from('widget_messages')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    return NextResponse.json({
      summary: sessionResult.data?.interest_summary ?? null,
      messages: messagesResult.data ?? [],
    })
  } catch (err) {
    console.error('[summary]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
