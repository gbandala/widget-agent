/**
 * QA WhatsApp CTA — verifica que el email incluya el botón de WA
 *
 * Paso 1 (sin red): valida que el source de emailService.ts tenga todos los elementos WA.
 * Paso 2 (Resend directo): llama sendWelcomeEmail vía tsx y envía 1 email real con pre-diagnóstico.
 *
 * Uso:
 *   node scripts/qa-wa-cta.mjs
 */

import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'

// ── Env ────────────────────────────────────────────────────────────────────────
const envVars = readFileSync('.env.local', 'utf8').split('\n')
for (const line of envVars) {
  const [k, ...v] = line.split('=')
  if (k?.trim() && v.length) process.env[k.trim()] = v.join('=').trim()
}

const TARGET_EMAIL = 'gabriel.bandala@gmail.com'

// ── PASO 1: Validación del source ─────────────────────────────────────────────

const HTML_CHECKS = [
  { label: 'Botón WhatsApp — href',   pattern: 'wa.link/clariifica' },
  { label: 'Botón WhatsApp — color',  pattern: '#25D366' },
  { label: 'Botón WhatsApp — texto',  pattern: 'hablar con el equipo' },
  { label: 'Botón Serena — href',     pattern: 'clariifica.com?chat=open' },
  { label: 'Botón Serena — color',    pattern: '#0891B2' },
  { label: 'Botón Serena — texto',    pattern: 'seguir con Serena' },
  { label: 'Intención WhatsApp',      pattern: 'Estoy listo' },
]

function checkHtml() {
  console.log('\n── PASO 1: Validación HTML (sin red) ───────────────────────────\n')
  const source = readFileSync('src/lib/email/emailService.ts', 'utf8')
  let allPass = true
  for (const check of HTML_CHECKS) {
    const pass = source.includes(check.pattern)
    console.log(`  ${pass ? '✅' : '❌'}  ${check.label}`)
    if (!pass) allPass = false
  }
  console.log(allPass
    ? '\n  ✅  Todos los elementos WA presentes\n'
    : '\n  ❌  Faltan elementos — revisar emailService.ts\n')
  return allPass
}

// ── PASO 2: Envío directo vía tsx ─────────────────────────────────────────────

const SEND_SCRIPT = `
import { sendWelcomeEmail } from './src/lib/email/emailService.js'

async function main() { await sendWelcomeEmail({
  to: '${TARGET_EMAIL}',
  leadName: 'Ana García',
  conversationSummary: 'Despacho contable con 7 años, 12 clientes fijos. Problema principal: todo pasa por la dueña — si no está presente, el despacho se detiene. No puede tomar vacaciones sin que se acumule el trabajo.',
  sessionId: 'qa-wa-cta-test',
  variant: 'A',
  preDiagnostic: {
    zeroDimension: 'temporal',
    zeroDimensionLabel: 'Todo pasa por ti para que el negocio opere',
    dimensionLevels: { financiero: 'medio', temporal: 'bajo', cognitivo: 'medio', relacional: 'medio' },
    top3Risks: [
      'Sin ti, el despacho se paraliza — no hay sistema que opere sin tu presencia',
      'Crecimiento bloqueado: no puedes aceptar más clientes si no tienes horas disponibles',
      'Riesgo de agotamiento: operar al 100% de dependencia personal no es sostenible a largo plazo'
    ],
    transformationIn90Days: [
      'Un sistema que atiende consultas frecuentes sin que tú intervengas',
      'Liberar 6-8 horas semanales delegando procesos documentados',
      'Capacidad de onboardear 2-3 clientes nuevos sin colapsar la operación'
    ],
  },
}) }

main().then(() => console.log('EMAIL_SENT_OK')).catch(e => { console.error(e); process.exit(1) })
`

async function sendTestEmail() {
  console.log(`── PASO 2: Email directo → ${TARGET_EMAIL} ──────────────────────\n`)

  // Escribir script temporal
  writeFileSync('.qa-wa-cta-send.ts', SEND_SCRIPT)

  try {
    const out = execSync('npx tsx .qa-wa-cta-send.ts', {
      env: { ...process.env },
      encoding: 'utf8',
      timeout: 30000,
    })
    const ok = out.includes('EMAIL_SENT_OK')
    if (ok) console.log(`  ✅  Email enviado vía Resend\n`)
    else     console.log(`  ❌  Resend no confirmó envío\n  Output: ${out}\n`)
    return ok
  } catch (e) {
    console.log(`  ❌  Error: ${e.message.slice(0, 300)}\n`)
    return false
  } finally {
    try { execSync('del .qa-wa-cta-send.ts', { shell: 'cmd' }) } catch {}
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║   QA WhatsApp CTA — Widget Serena · Clarifica               ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  const htmlOk    = checkHtml()
  const emailSent = await sendTestEmail()

  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  HTML source:  ${htmlOk    ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Email sent:   ${emailSent ? '✅ PASS' : '❌ FAIL'}`)

  if (emailSent) {
    console.log(`\n  👀  Revisa ${TARGET_EMAIL}`)
    console.log('      Asunto: "Ana García, tu negocio tiene un techo..."')
    console.log('      Al final del email debes ver:')
    console.log('      [💬 Continuar por WhatsApp]   [Agendar diagnóstico →]')
  }
  console.log('══════════════════════════════════════════════════════════════\n')

  process.exit(htmlOk && emailSent ? 0 : 1)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
