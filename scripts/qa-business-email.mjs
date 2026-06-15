/**
 * QA Business Email — 4 casos de conversación post-despliegue
 *
 * Simula 4 conversaciones completas en el widget (via API, no navegador)
 * y verifica que el flujo captureEmail → Resend funcione en producción.
 * Cada caso representa un perfil de dueño de negocio distinto y prueba
 * una combinación diferente de Cero Estratégico + destinatario de Outlook.
 *
 * Uso:
 *   node scripts/qa-business-email.mjs            → prod (widget.clariifica.com)
 *   node scripts/qa-business-email.mjs --local    → localhost:3000
 *
 * Parte del set de QA de negocio post-despliegue (paralelo a qa-security).
 */

import { readFileSync } from 'fs'
import { writeFileSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'

// ── Env ────────────────────────────────────────────────────────────────────────
const envVars = readFileSync('.env.local', 'utf8').split('\n')
for (const line of envVars) {
  const [k, ...v] = line.split('=')
  if (k?.trim() && v.length) process.env[k.trim()] = v.join('=').trim()
}

const LOCAL  = process.argv.includes('--local')
const BASE   = LOCAL ? 'http://localhost:3000' : 'https://widget.clariifica.com'
const TOKEN  = LOCAL
  ? (process.env.NEXT_PUBLIC_DEMO_WIDGET_TOKEN ?? '')
  : (process.env.WIDGET_TOKEN_PROD ?? '')
const ORIGIN = LOCAL ? 'http://localhost:3000' : 'https://clariifica.com'

if (!TOKEN) { console.error('❌  WIDGET_TOKEN_PROD no configurado en .env.local'); process.exit(1) }

// ── Helpers ────────────────────────────────────────────────────────────────────
const DELAY_MS = 2500  // pausa entre turnos para no golpear rate limiter

const sleep = ms => new Promise(r => setTimeout(r, ms))
const log   = (tag, msg) => console.log(`  [${tag}] ${msg}`)

function userMsg(text) {
  return { id: randomUUID(), role: 'user', parts: [{ type: 'text', text }] }
}

function assistantMsg(text) {
  return { id: randomUUID(), role: 'assistant', parts: [{ type: 'text', text }] }
}

/**
 * Envía un turno al chat API y retorna { assistantText, captureEmailFired, captureEmailSuccess, raw }.
 * sessionId se omite deliberadamente — lead se crea con session_id=null (aceptable en QA).
 */
async function sendTurn(messages) {
  const res = await fetch(`${BASE}/api/widget/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      'x-source-origin': ORIGIN,
    },
    body: JSON.stringify({ messages, sourceUrl: ORIGIN }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  // Consumir stream SSE completo
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    raw += decoder.decode(value, { stream: true })
  }

  // Parsear SSE — formato: "data: {...}\n\n"
  let assistantText = ''
  let captureEmailFired   = false
  let captureEmailSuccess = false

  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const event = JSON.parse(line.slice(6))
      if (event.type === 'text-delta' && event.delta) {
        assistantText += event.delta
      } else if (event.type === 'tool-input-available') {
        if (event.toolName === 'captureEmail') captureEmailFired = true
      } else if (event.type === 'tool-output-available') {
        if (captureEmailFired && event.output?.success === true) captureEmailSuccess = true
      }
    } catch { /* skip malformed */ }
  }

  return { assistantText: assistantText.trim(), captureEmailFired, captureEmailSuccess, raw }
}

// ── Perfiles de conversación — 4 industrias ───────────────────────────────────
// Cada perfil se ejecuta 2 veces (una por cada dirección Outlook).
// Score ≥7 en el primer mensaje: dependencia +3, dueño/a +2, precio +2 = 7.

const EMAILS = ['bandala@outlook.com', 'gabriel.bandala@gmail.com']

const PROFILES = [
  // ── Perfil 1: Ana García — Despacho Contable ───────────────────────────────
  // Cero: Temporal — el despacho vive o muere con la contadora presente
  {
    id: 'despacho-contable',
    label: 'Ana García — Despacho Contable',
    name: 'Ana García',
    ceroEsperado: 'temporal',
    intro:
      `Hola, tengo un despacho contable, soy la dueña y llevo 7 años. ` +
      `Tengo 12 clientes fijos pero si yo no estoy el despacho se para — ` +
      `no puedo delegar nada porque los clientes me buscan directamente a mí para todo: ` +
      `declaraciones, dudas, auditorías. Si me voy de vacaciones una semana, vuelvo a un caos. ` +
      `¿Cuánto cuesta trabajar con Clarifica y cómo es el proceso?`,
  },

  // ── Perfil 2: Roberto Mendoza — Comercializadora ───────────────────────────
  // Cero: Financiero — mucho movimiento, margen real casi cero
  {
    id: 'comercializadora',
    label: 'Roberto Mendoza — Comercializadora',
    name: 'Roberto Mendoza',
    ceroEsperado: 'financiero',
    intro:
      `Buenos días, importo artículos promocionales y regalos corporativos desde China, soy el dueño, ` +
      `llevo 3 años con 4 clientes grandes que representan el 90% de mi facturación. ` +
      `El problema es que cerramos pedidos de 500k-1M pero al final de año no queda casi nada — ` +
      `los márgenes se van en tipo de cambio, logística, demoras en aduana y gastos de operación. ` +
      `Trabajo mucho y no avanzo, todo pasa por mí. ¿Qué hace Clarifica y cuánto cuesta?`,
  },

  // ── Perfil 3: Sofía Torres — Consultora de RH ──────────────────────────────
  // Cero: Cognitivo — saturación total, sin espacio para pensar en crecer
  {
    id: 'consultora-rh',
    label: 'Sofía Torres — Consultora de RH',
    name: 'Sofía Torres',
    ceroEsperado: 'cognitivo',
    intro:
      `Hola, soy consultora de recursos humanos independiente, llevo 4 años, soy la dueña de mi práctica. ` +
      `Tengo 6 empresas cliente activas pero estoy saturada al 120% — atiendo proyectos, entrevisto candidatos, ` +
      `doy capacitaciones y también vendo. No tengo ni una hora a la semana para pensar en estrategia ` +
      `porque todo depende de mí para ejecutarse. Ya no puedo más y necesito una salida. ` +
      `¿Cuánto cuesta trabajar con Clarifica?`,
  },

  // ── Perfil 4: Carlos Ruiz — Taller Mecánico ────────────────────────────────
  // Cero: Relacional — sin red activa, los clientes nuevos no llegan solos
  {
    id: 'taller-mecanico',
    label: 'Carlos Ruiz — Taller Mecánico',
    name: 'Carlos Ruiz',
    ceroEsperado: 'relacional',
    intro:
      `Hola, tengo un taller de servicio automotriz, soy el dueño, llevo 6 años y tengo 3 mecánicos. ` +
      `El problema es que no tenemos red de referidos: los clientes que entran son por Google Maps o de paso. ` +
      `No tengo alianzas con agencias de autos ni flotillas empresariales, y sin eso el crecimiento depende ` +
      `del azar. Yo soy el único que hace cotizaciones, atiende garantías y cierra con clientes difíciles. ` +
      `¿Qué hace Clarifica y cuánto cobran?`,
  },
]

// Expandir: 4 perfiles × 2 emails = 8 casos
const CASES = PROFILES.flatMap((p, pi) =>
  EMAILS.map((email, ei) => ({
    id: `${p.id}-${ei + 1}`,
    label: `${p.label} → ${email}`,
    emailDestino: email,
    ceroEsperado: p.ceroEsperado,
    turns: [p.intro, p.name, email],
  }))
)

// ── Runner ─────────────────────────────────────────────────────────────────────
async function runCase(c) {
  const result = {
    id:          c.id,
    label:       c.label,
    emailDestino: c.emailDestino,
    ceroEsperado: c.ceroEsperado,
    turns:       [],
    captureEmailFired:   false,
    captureEmailSuccess: false,
    error: null,
  }

  const messages = []

  try {
    for (let i = 0; i < c.turns.length; i++) {
      const userText = c.turns[i]
      messages.push(userMsg(userText))

      log(`T${i + 1}`, `→ "${userText.slice(0, 60)}..."`)
      await sleep(DELAY_MS)

      const turn = await sendTurn([...messages])

      const turnResult = {
        userText:            userText.slice(0, 80),
        assistantText:       turn.assistantText.slice(0, 120),
        captureEmailFired:   turn.captureEmailFired,
        captureEmailSuccess: turn.captureEmailSuccess,
      }
      result.turns.push(turnResult)

      log(`T${i + 1}`, `← "${turn.assistantText.slice(0, 80)}..."`)

      if (turn.captureEmailFired) {
        log('📧', `captureEmail disparado (success: ${turn.captureEmailSuccess})`)
        result.captureEmailFired   = true
        result.captureEmailSuccess = turn.captureEmailSuccess
        // No continuar — el email fue enviado
        break
      }

      // Agregar respuesta del assistant al historial
      if (turn.assistantText) {
        messages.push(assistantMsg(turn.assistantText))
      }
    }

    if (!result.captureEmailFired) {
      result.error = 'captureEmail no se disparó en ningún turno'
    }
  } catch (err) {
    result.error = err.message
  }

  return result
}

// ── Reporte ────────────────────────────────────────────────────────────────────
function printReport(results) {
  const SEP = '═'.repeat(64)
  console.log('\n' + SEP)
  console.log('  QA BUSINESS EMAIL — REPORTE FINAL')
  console.log('  ' + new Date().toLocaleString('es-MX'))
  console.log(SEP)

  let passed = 0, failed = 0

  for (const r of results) {
    const status = r.captureEmailSuccess ? '✅ PASS' : r.captureEmailFired ? '⚠️  PARCIAL' : '❌ FAIL'
    console.log(`\n${status}  ${r.label}`)
    console.log(`  Destino:  ${r.emailDestino}`)
    console.log(`  Cero esp: ${r.ceroEsperado}`)
    console.log(`  Turnos:   ${r.turns.length}`)

    if (r.error) {
      console.log(`  Error:    ${r.error}`)
      failed++
    } else if (r.captureEmailSuccess) {
      passed++
    } else {
      failed++
    }

    for (const [i, t] of r.turns.entries()) {
      const icon = t.captureEmailFired ? '📧' : '💬'
      console.log(`  ${icon} T${i + 1}: "${t.assistantText.slice(0, 100)}"`)
    }
  }

  console.log('\n' + SEP)
  console.log(`  RESULTADO: ${passed}/${results.length} PASS  |  ${failed} FAIL`)
  console.log(SEP + '\n')

  // Guardar JSON para revisión
  const reportDir = path.join(process.cwd(), '.qa-reports', 'business-email')
  mkdirSync(reportDir, { recursive: true })
  const reportFile = path.join(reportDir, `${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(reportFile, JSON.stringify(results, null, 2))
  console.log(`  Reporte guardado: ${reportFile}\n`)

  return failed === 0
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║   QA Business Email — Widget Serena · Clarifica             ║')
  console.log(`║   Target: ${BASE.padEnd(51)}║`)
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  const results = []

  for (const c of CASES) {
    console.log(`\n── ${c.label} (${c.emailDestino}) ──────────`)
    const result = await runCase(c)
    results.push(result)

    // Pausa entre casos para no saturar rate limiter
    if (c !== CASES[CASES.length - 1]) {
      console.log('  ⏳ Esperando 5s antes del siguiente caso...')
      await sleep(5000)
    }
  }

  const allPass = printReport(results)
  process.exit(allPass ? 0 : 1)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
