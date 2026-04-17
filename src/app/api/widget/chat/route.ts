import { NextRequest, NextResponse } from 'next/server'
import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from 'ai'
import { openrouter, MODELS } from '@/lib/ai/openrouter'
import { z } from 'zod'
import { kbService } from '@/features/knowledge-base/services/kbService'
import { readLanding, formatLandingForContext } from '@/lib/landing-reader/landingReader'
import { checkScope, SCOPE_DECLINE_MESSAGE } from '@/lib/security/scopeGuard'
import { checkPromptInjection, INJECTION_BLOCKED_MESSAGE } from '@/lib/security/promptGuard'
import { filterPII } from '@/lib/security/piiFilter'
import { checkRateLimit } from '@/lib/security/rateLimiter'
import { createServiceClient } from '@/lib/supabase/server'

// ---- Token validation cache (60s TTL) ----
type TokenCacheEntry = {
  data: { id: string; is_active: boolean; allowed_origin: string; bot_name: string | null; bot_avatar_url: string | null }
  expiresAt: number
}
const tokenCache = new Map<string, TokenCacheEntry>()
const TOKEN_CACHE_TTL = 60_000

// ---- Error response helpers ----
const FRIENDLY_ERRORS: Record<string, string> = {
  api_error: 'En este momento tenemos dificultades técnicas. Por favor intenta de nuevo en unos minutos o escríbenos directamente.',
  quota_exceeded: 'Nuestro asistente está muy ocupado en este momento. Por favor intenta más tarde.',
  connection_error: 'Parece que hay problemas de conexión. Verifica tu internet e intenta de nuevo.',
  rate_limit: 'Has enviado muchos mensajes en poco tiempo. Por favor espera un momento.',
  auth_error: 'Este widget no está configurado correctamente. Contacta al administrador.',
}

function errorResponse(type: string, retryable = true) {
  return NextResponse.json({
    error: true,
    errorType: type,
    message: FRIENDLY_ERRORS[type] ?? FRIENDLY_ERRORS.api_error,
    retryable,
  })
}

async function logError(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  type: string,
  tokenId: string | null,
  sessionId: string | null,
  message: string,
  sourceUrl: string,
  ipHash: string
) {
  try {
    await supabase.from('widget_error_logs').insert({
      error_type: type,
      token_id: tokenId,
      session_id: sessionId,
      message: message.slice(0, 500),
      source_url: sourceUrl,
      ip_hash: ipHash,
    })
  } catch { /* log errors silently */ }
}

// ---- Validate widget token (with 60s cache) ----
async function validateToken(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  token: string,
  origin: string
) {
  const cacheKey = `${token}:${origin}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const { data, error } = await supabase
    .from('widget_tokens')
    .select('id, is_active, allowed_origin, bot_name, bot_avatar_url')
    .eq('token', token)
    .single()

  if (error || !data) return null
  if (!data.is_active) return null
  if (data.allowed_origin !== origin && data.allowed_origin !== '*') return null

  tokenCache.set(cacheKey, { data, expiresAt: Date.now() + TOKEN_CACHE_TTL })
  return data
}

// ---- System prompt builder ----
function buildSystemPrompt(
  botName: string,
  kbContext: string,
  landingContext: string
): string {
  return `Eres ${botName}, el asistente virtual de consultoría tecnológica de la empresa.

TU MISIÓN:
- Responder preguntas sobre servicios, proyectos y capacidades del equipo de manera clara y accesible
- Detectar interés genuino del visitante y capturar sus datos de contacto cuando lo muestren
- Agendar citas de consultoría cuando el visitante lo solicite
- Hablar en español, con lenguaje claro y sin jerga técnica innecesaria
- Nunca mencionar nombres de clientes específicos, solo capacidades y tipos de proyectos

SCOPE ESTRICTO:
- Solo responde preguntas relacionadas con los servicios, proyectos y tecnología de la consultoría
- Si la pregunta es completamente ajena, declina cordialmente: "Mi especialidad es ayudarte con consultoría tecnológica. ¿Puedo orientarte en ese sentido?"

REGLAS DE PRIVACIDAD:
- Nunca inventes ni repitas datos de contacto de personas
- No menciones detalles internos del negocio, costos exactos sin antes ofrecer una sesión de descubrimiento
- Los datos que captures del usuario son confidenciales

SEÑALES DE INTERÉS GENUINO (para activar captureContact):
- Preguntas sobre precios, proceso de trabajo, tiempos
- Frases como "me interesa", "quiero empezar", "cómo contratarlos", "quiero una propuesta"
- Segunda o tercera pregunta de seguimiento sobre el mismo servicio

${kbContext ? `\nCONOCIMIENTO DE SERVICIOS:\n${kbContext}` : ''}

${landingContext ? `\n${landingContext}` : ''}

Recuerda: cuando refieras a contenido de la landing, di en qué sección está, por ejemplo: "En la sección de Servicios de la página puedes ver más detalle."`
}

// ---- Main handler ----
export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()

  // Hash IP para logs (no guardamos IP directa)
  const ipRaw = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const ip = ipRaw.split(',')[0].trim()
  const ipHash = Buffer.from(ip).toString('base64').slice(0, 20)

  const origin = req.headers.get('origin') ?? ''
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const anonId = req.headers.get('x-anon-id') ?? ''

  // 1. Rate limit por IP (antes de cualquier DB query)
  const ipLimit = await checkRateLimit(ipHash, 'ip')
  if (!ipLimit.allowed) {
    return errorResponse('rate_limit', true)
  }

  // 2. Validar token
  const tokenData = await validateToken(supabase, token, origin)
  if (!tokenData) {
    await logError(supabase, 'auth_error', null, null, 'Token inválido o inactivo', origin, ipHash)
    return errorResponse('auth_error', false)
  }

  // 3. Rate limit por token
  const tokenLimit = await checkRateLimit(tokenData.id, 'token')
  if (!tokenLimit.allowed) {
    await logError(supabase, 'rate_limit_token', tokenData.id, null, 'Token rate limit exceeded', origin, ipHash)
    return errorResponse('rate_limit', true)
  }

  let body: { messages: UIMessage[]; sessionId?: string; sourceUrl?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse('api_error')
  }

  const { messages, sessionId, sourceUrl = '' } = body
  const lastUserMessage = messages.findLast(m => m.role === 'user')
  const userText = lastUserMessage?.parts?.find(p => p.type === 'text')?.text ?? ''

  // 2. Prompt injection check
  const injectionCheck = checkPromptInjection(userText)
  if (!injectionCheck.safe) {
    await logError(supabase, 'injection_attempt', tokenData.id, sessionId ?? null, userText.slice(0, 200), sourceUrl, ipHash)
    return NextResponse.json({
      type: 'text',
      text: INJECTION_BLOCKED_MESSAGE,
    })
  }

  // 3. Scope check
  const scopeCheck = checkScope(userText)
  if (!scopeCheck.allowed) {
    await logError(supabase, 'scope_violation', tokenData.id, sessionId ?? null, userText.slice(0, 200), sourceUrl, ipHash)
    return NextResponse.json({
      type: 'text',
      text: SCOPE_DECLINE_MESSAGE,
    })
  }

  try {
    // 4. RAG — buscar en KB
    let kbContext = ''
    if (userText.length > 5) {
      const kbResults = await kbService.search(userText)
      kbContext = kbService.formatForContext(kbResults)
    }

    // 5. Leer landing (cache en sesión)
    let landingContext = ''
    if (sourceUrl && sessionId) {
      // Intentar cargar desde caché de la sesión
      const { data: sessionData } = await supabase
        .from('widget_sessions')
        .select('landing_content')
        .eq('id', sessionId)
        .single()

      if (sessionData?.landing_content) {
        landingContext = sessionData.landing_content
      } else {
        const landing = await readLanding(sourceUrl)
        landingContext = formatLandingForContext(landing)
        // Guardar en caché
        await supabase
          .from('widget_sessions')
          .update({ landing_content: landingContext, last_active: new Date().toISOString() })
          .eq('id', sessionId)
      }
    }

    // 6. System prompt
    const systemPrompt = buildSystemPrompt(
      tokenData.bot_name ?? 'Asistente',
      kbContext,
      landingContext
    )

    // 7. Tools disponibles
    const tools = {
      captureContact: tool({
        description: 'Solicita los datos de contacto del visitante cuando muestra interés genuino. SOLO usar cuando el visitante muestre interés claro en los servicios.',
        inputSchema: z.object({
          reason: z.string().describe('Breve razón por la que se solicita el contacto'),
          message: z.string().describe('Mensaje amigable para presentar al usuario antes del formulario'),
        }),
        // Sin execute — requiere confirmación manual del usuario en el frontend
      }),

      getAvailableSlots: tool({
        description: 'Obtiene los horarios disponibles para una cita de consultoría',
        inputSchema: z.object({
          preferredDate: z.string().optional().describe('Fecha preferida en formato YYYY-MM-DD'),
        }),
        execute: async ({ preferredDate }) => {
          // Llamar al endpoint de Google Calendar
          try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/appointments?date=${preferredDate ?? ''}`)
            const data = await res.json()
            return data
          } catch {
            return { slots: [], message: 'No se pudo obtener disponibilidad. Puedes escribirnos directamente.' }
          }
        },
      }),

      bookAppointment: tool({
        description: 'Crea una cita en el calendario una vez que el usuario eligió un horario',
        inputSchema: z.object({
          slotStart: z.string().describe('ISO 8601 inicio del slot elegido'),
          slotEnd: z.string().describe('ISO 8601 fin del slot elegido'),
          notes: z.string().optional().describe('Notas del tema a tratar'),
        }),
        // Sin execute — requiere que el lead ya esté capturado
      }),
    }

    // 8. Stream response
    const result = streamText({
      model: openrouter(MODELS.fast),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      abortSignal: req.signal,
      onFinish: async ({ text }) => {
        // Guardar mensajes en DB
        if (sessionId) {
          const cleanText = filterPII(text)
          await supabase.from('widget_messages').insert([
            {
              session_id: sessionId,
              role: 'user',
              content: userText,
            },
            {
              session_id: sessionId,
              role: 'assistant',
              content: cleanText,
            },
          ])
          await supabase
            .from('widget_sessions')
            .update({ last_active: new Date().toISOString() })
            .eq('id', sessionId)
        }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    const errMessage = String(err)
    const errType = errMessage.includes('quota') || errMessage.includes('429')
      ? 'quota_exceeded'
      : errMessage.includes('timeout') || errMessage.includes('ECONNREFUSED')
        ? 'connection_error'
        : 'api_error'

    await logError(supabase, errType, tokenData.id, sessionId ?? null, errMessage, sourceUrl, ipHash)
    return errorResponse(errType)
  }
}
