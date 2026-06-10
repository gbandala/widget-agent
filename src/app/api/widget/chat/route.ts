import { NextRequest, NextResponse } from 'next/server'
import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from 'ai'
import { openrouter, MODELS } from '@/lib/ai/openrouter'
import { z } from 'zod'
import { kbService } from '@/features/knowledge-base/services/kbService'
import { readLanding, formatLandingForContext } from '@/lib/landing-reader/landingReader'
import { checkScope, SCOPE_DECLINE_MESSAGE } from '@/lib/security/scopeGuard'
import { checkPromptInjection, INJECTION_BLOCKED_MESSAGE } from '@/lib/security/promptGuard'
import { checkGibberish, GIBBERISH_RESPONSE } from '@/lib/security/gibberishGuard'
import { filterPII } from '@/lib/security/piiFilter'
import { checkRateLimit, checkMessageVelocity } from '@/lib/security/rateLimiter'
import { db } from '@/lib/db'

// ---- Token validation cache (60s TTL) ----
type TokenCacheEntry = {
  data: {
    id: string
    is_active: boolean
    allowed_origin: string
    bot_name: string | null
    bot_avatar_url: string | null
    agent_language: string | null
    agent_tone: string | null
    agent_instructions: string | null
    agent_scope: string | null
    agent_use_emojis: boolean | null
    welcome_message: string | null
  }
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
  type: string,
  tokenId: string | null,
  sessionId: string | null,
  message: string,
  sourceUrl: string,
  ipHash: string
) {
  try {
    await db`
      INSERT INTO widget_error_logs ${db({
        error_type: type,
        token_id: tokenId,
        session_id: sessionId,
        message: message.slice(0, 500),
        source_url: sourceUrl,
        ip_hash: ipHash,
      })}
    `
  } catch { /* log errors silently */ }
}

const normalizeOrigin = (o: string) => o.replace(/\/+$/, '').toLowerCase()

// ---- Validate widget token (with 60s cache) ----
async function validateToken(
  token: string,
  origin: string
) {
  const cacheKey = `${token}:${normalizeOrigin(origin)}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const rows = await db`
    SELECT id, is_active, allowed_origin, bot_name, bot_avatar_url,
           agent_language, agent_tone, agent_instructions, agent_scope,
           agent_use_emojis, welcome_message
    FROM widget_tokens
    WHERE token = ${token}
    LIMIT 1
  `
  const data = rows[0]
  if (!data) return null
  if (!data.is_active) return null
  if (data.allowed_origin !== '*' &&
      normalizeOrigin(data.allowed_origin as string) !== normalizeOrigin(origin)) return null

  const tokenData = {
    id: data.id as string,
    is_active: data.is_active as boolean,
    allowed_origin: data.allowed_origin as string,
    bot_name: data.bot_name as string | null,
    bot_avatar_url: data.bot_avatar_url as string | null,
    agent_language: data.agent_language as string | null,
    agent_tone: data.agent_tone as string | null,
    agent_instructions: data.agent_instructions as string | null,
    agent_scope: data.agent_scope as string | null,
    agent_use_emojis: data.agent_use_emojis as boolean | null,
    welcome_message: data.welcome_message as string | null,
  }

  tokenCache.set(cacheKey, { data: tokenData, expiresAt: Date.now() + TOKEN_CACHE_TTL })
  return tokenData
}

// ---- System prompt builder ----
function buildSystemPrompt(
  botName: string,
  agentConfig: {
    language: string
    tone: string
    instructions: string | null
    scope: string | null
    useEmojis: boolean
  },
  kbContext: string,
  landingContext: string
): string {
  const toneMap: Record<string, string> = {
    profesional: 'formal y profesional',
    amigable: 'amigable y cercano',
    casual: 'casual y relajado',
    tecnico: 'técnico y preciso',
  }
  const toneLabel = toneMap[agentConfig.tone] ?? agentConfig.tone

  const defaultInstructions = `- Responder preguntas sobre los servicios y capacidades de la empresa de manera clara
- Detectar interés genuino del visitante y capturar sus datos de contacto cuando lo muestren
- Agendar citas cuando el visitante lo solicite`

  const defaultScope = `Responde únicamente preguntas relacionadas con la empresa, sus servicios y capacidades. Si la pregunta es completamente ajena, declina cordialmente.`

  return `Eres ${botName}, el asistente virtual de la empresa.
Idioma de respuesta: ${agentConfig.language === 'es' ? 'español' : agentConfig.language}.
Tono: ${toneLabel}.${agentConfig.useEmojis ? '' : '\nNo uses emojis en ninguna respuesta.'}

ESTILO DE RESPUESTA:
- Sé breve y directo: responde exactamente lo que se preguntó
- Máximo 3-4 líneas por respuesta salvo que el usuario pida más detalle
- Termina con UNA sola pregunta de seguimiento relevante, no múltiples

TU MISIÓN:
${agentConfig.instructions ?? defaultInstructions}

SCOPE:
${agentConfig.scope ?? defaultScope}

PREGUNTAS SIN RESPUESTA:
- Si el usuario hace una pregunta legítima sobre la empresa/servicios pero NO encuentras la respuesta disponible, usa logUnansweredQuestion para registrarla.
- Luego responde: "Esa información no la tengo disponible ahora. La he anotado para que el equipo la responda pronto."
- NO inventes ni especules respuestas.

REGLAS DE PRIVACIDAD:
- Nunca inventes datos de contacto de personas
- Los datos capturados del usuario son confidenciales
- No menciones costos exactos sin antes ofrecer una sesión de descubrimiento

MENSAJES SIN SENTIDO:
- Si el mensaje no tiene sentido o es gibberish (ej: "miau", "gogodada", "xd", sonidos, palabras inventadas), responde únicamente: "¿Tienes alguna pregunta? Con gusto te ayudo." — sin más.

SEÑALES DE INTERÉS GENUINO (activa captureContact):
- Preguntas sobre precios, proceso de trabajo, tiempos
- "me interesa", "quiero empezar", "quiero una propuesta", "cómo los contrato"
- Segunda o tercera pregunta de seguimiento sobre el mismo tema
${kbContext ? `\nCONOCIMIENTO BASE:\n${kbContext}` : ''}
${landingContext ? `\n${landingContext}` : ''}
Cuando refieras a contenido de la página, indica en qué sección está.`
}

// ---- Main handler ----
export async function POST(req: NextRequest) {
  // Hash IP para logs (no guardamos IP directa)
  const ipRaw = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const ip = ipRaw.split(',')[0].trim()
  const ipHash = Buffer.from(ip).toString('base64').slice(0, 20)

  // x-source-origin is set by the widget transport to reflect the real host page
  // (important in iframe/embed mode where Origin is the widget app, not the host site)
  const origin = req.headers.get('x-source-origin') || req.headers.get('origin') || ''
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''

  // 1. Rate limit por IP (antes de cualquier DB query)
  const ipLimit = await checkRateLimit(ipHash, 'ip')
  if (!ipLimit.allowed) {
    return errorResponse('rate_limit', true)
  }

  // 2. Validar token
  const tokenData = await validateToken(token, origin)
  if (!tokenData) {
    await logError('auth_error', null, null, 'Token inválido o inactivo', origin, ipHash)
    return errorResponse('auth_error', false)
  }

  // 3. Rate limit por token
  const tokenLimit = await checkRateLimit(tokenData.id, 'token')
  if (!tokenLimit.allowed) {
    await logError('rate_limit_token', tokenData.id, null, 'Token rate limit exceeded', origin, ipHash)
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

  // 2. Gibberish check (heuristic — no AI call, no token cost)
  const gibberishCheck = checkGibberish(userText)
  if (gibberishCheck.isGibberish) {
    return NextResponse.json({ type: 'text', text: GIBBERISH_RESPONSE })
  }

  // 3. Session velocity check — blocks machine-speed submissions (< 1s between messages)
  if (sessionId) {
    const velocityCheck = checkMessageVelocity(sessionId)
    if (!velocityCheck.allowed) {
      return NextResponse.json({ type: 'text', text: GIBBERISH_RESPONSE })
    }
  }

  // 4. Prompt injection check
  const injectionCheck = checkPromptInjection(userText)
  if (!injectionCheck.safe) {
    await logError('injection_attempt', tokenData.id, sessionId ?? null, userText.slice(0, 200), sourceUrl, ipHash)
    return NextResponse.json({
      type: 'text',
      text: INJECTION_BLOCKED_MESSAGE,
    })
  }

  // 5. Scope check
  const scopeCheck = checkScope(userText)
  if (!scopeCheck.allowed) {
    await logError('scope_violation', tokenData.id, sessionId ?? null, userText.slice(0, 200), sourceUrl, ipHash)
    return NextResponse.json({
      type: 'text',
      text: SCOPE_DECLINE_MESSAGE,
    })
  }

  try {
    // 4. RAG — buscar en KB
    let kbContext = ''
    if (userText.length > 5) {
      const kbResults = await kbService.search(userText, 5, 0.45, tokenData.id)
      kbContext = kbService.formatForContext(kbResults)
    }

    // 5. Leer landing (cache en sesión)
    let landingContext = ''
    if (sourceUrl && sessionId) {
      // Intentar cargar desde caché de la sesión
      const sessionRows = await db`
        SELECT landing_content FROM widget_sessions WHERE id = ${sessionId} LIMIT 1
      `
      const sessionData = sessionRows[0]

      if (sessionData?.landing_content) {
        landingContext = sessionData.landing_content as string
      } else {
        const landing = await readLanding(sourceUrl)
        landingContext = formatLandingForContext(landing)
        // Guardar en caché
        await db`
          UPDATE widget_sessions
          SET landing_content = ${landingContext},
              last_active = ${new Date().toISOString()}
          WHERE id = ${sessionId}
        `
      }
    }

    // 6. System prompt
    const systemPrompt = buildSystemPrompt(
      tokenData.bot_name ?? 'Asistente',
      {
        language: tokenData.agent_language ?? 'es',
        tone: tokenData.agent_tone ?? 'profesional',
        instructions: tokenData.agent_instructions,
        scope: tokenData.agent_scope,
        useEmojis: tokenData.agent_use_emojis ?? true,
      },
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

      logUnansweredQuestion: tool({
        description: 'Registra una pregunta legítima del usuario que no tiene respuesta en la KB ni en la landing. Usar SOLO cuando el usuario pregunta algo real sobre la empresa/servicios pero no hay información disponible.',
        inputSchema: z.object({
          question: z.string().describe('La pregunta del usuario, exacta o parafraseada'),
        }),
        execute: async ({ question }) => {
          try {
            await db`
              INSERT INTO kb_pending_questions ${db({
                question: question.slice(0, 500),
                session_id: sessionId ?? null,
                token_id: tokenData.id,
                source_url: sourceUrl || null,
              })}
            `
          } catch { /* silently ignore */ }
          return { logged: true }
        },
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
          await db`
            INSERT INTO widget_messages ${db([
              { session_id: sessionId, role: 'user', content: userText },
              { session_id: sessionId, role: 'assistant', content: cleanText },
            ])}
          `
          await db`
            UPDATE widget_sessions
            SET last_active = ${new Date().toISOString()}
            WHERE id = ${sessionId}
          `
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

    await logError(errType, tokenData.id, sessionId ?? null, errMessage, sourceUrl, ipHash)
    return errorResponse(errType)
  }
}
