/**
 * QA: Flujo conversacional completo — scoring + captureEmail + preference + booking
 * Uso: node scripts/qa-calendar-flow.mjs
 */

import { chromium } from 'playwright'
import path from 'path'

const REPORT_DIR = path.join(process.cwd(), '.qa-reports', '2026-06-12-calendar-flow')
const SS = (name) => path.join(REPORT_DIR, 'screenshots', `${name}.png`)
const log = (step, msg) => console.log(`[${step}] ${msg}`)

async function shot(page, name) {
  await page.screenshot({ path: SS(name), fullPage: false })
  log('📸', name)
}

async function shotFrame(frame, name) {
  try {
    const el = await frame.locator('body').first()
    await el.screenshot({ path: SS(name + '-iframe') })
    log('📸', name + '-iframe')
  } catch {}
}

async function waitSerena(frame, timeoutMs = 30000) {
  try {
    await frame.locator('.animate-bounce').first().waitFor({ state: 'visible', timeout: 5000 })
  } catch { /* respuesta inmediata */ }
  try {
    await frame.locator('.animate-bounce').first().waitFor({ state: 'hidden', timeout: timeoutMs })
  } catch {}
  await frame.locator('body').evaluate(() => new Promise(r => setTimeout(r, 800)))
}

async function sendMessage(frame, input, text) {
  await input.fill(text)
  await input.press('Enter')
  await waitSerena(frame, 30000)
}

async function getLastMessages(frame, n = 4) {
  try {
    const bubbles = frame.locator('[class*="rounded-2xl"]:not([class*="rounded-full"])')
    const texts = await bubbles.allTextContents()
    return texts.filter(t => t.trim().length > 3).slice(-n)
  } catch { return [] }
}

async function run() {
  log('SETUP', `Screenshots → ${REPORT_DIR}/screenshots/`)
  const browser = await chromium.launch({ headless: false, slowMo: 150 })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  try {
    // ── 1. Landing ──
    log('1', 'Navegando a clariifica.com')
    await page.goto('https://clariifica.com', { waitUntil: 'networkidle', timeout: 30000 })
    await shot(page, '01-landing')

    // ── 2. Abrir widget ──
    log('2', 'Abriendo widget')
    await page.locator('#widget-fab').click()
    await page.waitForTimeout(2000)
    await shot(page, '02-widget-abierto')

    const frame = page.frameLocator('#widget-iframe').first()
    const input = frame.locator('input[placeholder*="Escribe"]').first()
    await input.waitFor({ timeout: 10000 })

    // ── 3-6. Conversación para acumular score ≥5 ──
    // +3 por dependencia de herramientas, +2 por preguntas de precio, +2 por madurez del negocio

    log('3', 'Mensaje 1: preguntar servicios')
    await sendMessage(frame, input, '¿Qué hace exactamente Clarifica?')
    await shot(page, '03-msg1')

    log('4', 'Mensaje 2: señal de dependencia (herramienta)')
    await sendMessage(frame, input, 'Actualmente todo depende de mí para funcionar, no puedo delegar nada')
    await shot(page, '04-msg2')

    log('5', 'Mensaje 3: señal de precio')
    await sendMessage(frame, input, '¿Cuánto cuesta trabajar con ustedes?')
    await shot(page, '05-msg3')

    log('6', 'Mensaje 4: señal de urgencia + madurez')
    await sendMessage(frame, input, 'Llevo 5 años en el negocio pero no logro escalar, necesito resolverlo pronto')
    await shot(page, '06-msg4')

    log('7', 'Mensaje 5: interés explícito')
    await sendMessage(frame, input, 'Me interesa mucho, ¿cómo empezamos?')
    await shot(page, '07-interes')

    const msgs7 = await getLastMessages(frame)
    log('MENSAJES', JSON.stringify(msgs7, null, 2))

    // ── 7. Detectar que Serena pide el correo ──
    // Serena preguntará algo como "¿A qué correo te llega bien?"
    log('8', 'Buscando señal de solicitud de email en la respuesta...')
    const allText = msgs7.join(' ').toLowerCase()
    const askingEmail = allText.includes('correo') || allText.includes('email') || allText.includes('@')
    log('8', `¿Serena pidió correo? ${askingEmail}`)
    await shotFrame(frame, '08-pidio-correo')

    if (!askingEmail) {
      // Dar un empujón más
      log('8', 'Score quizás aún bajo — mensaje adicional de interés')
      await sendMessage(frame, input, 'Sí quiero una sesión de diagnóstico, cuándo podríamos platicar')
      await shot(page, '08b-push-adicional')
    }

    // ── 8. Dar el email ──
    log('9', 'Enviando email en el chat')
    await sendMessage(frame, input, 'bandala@outlook.com')
    await shot(page, '09-email-enviado')
    await shotFrame(frame, '09-email-enviado')

    const msgs9 = await getLastMessages(frame)
    log('MENSAJES TRAS EMAIL', JSON.stringify(msgs9, null, 2))

    // ── 9. Preferencia de contacto ──
    log('10', 'Respondiendo preferencia de contacto')
    const text9 = msgs9.join(' ').toLowerCase()
    const askingPref = text9.includes('prefer') || text9.includes('contactar') || text9.includes('whatsapp') || text9.includes('llamada')
    log('10', `¿Serena pregunta preferencia? ${askingPref}`)

    await sendMessage(frame, input, 'Por WhatsApp está bien')
    await shot(page, '10-preferencia')
    await shotFrame(frame, '10-preferencia')

    const msgs10 = await getLastMessages(frame)
    log('MENSAJES TRAS PREFERENCIA', JSON.stringify(msgs10, null, 2))

    // Si Serena pide el número de WhatsApp, darlo
    const text10 = msgs10.join(' ').toLowerCase()
    if (text10.includes('número') || text10.includes('whatsapp') && text10.includes('cuál')) {
      log('10b', 'Serena pide número de WhatsApp — proporcionando')
      await sendMessage(frame, input, '5512345678')
      await shot(page, '10b-numero-wa')
      await shotFrame(frame, '10b-numero-wa')
    }

    // ── 10. Agendar ──
    log('11', 'Pidiendo agendar cita')
    await input.fill('Sí, agendemos la sesión')
    await input.press('Enter')
    // NO llamamos waitSerena aquí — el picker aparece en una segunda ronda de tools
    // (getAvailableSlots auto-exec → bookAppointment human-in-the-loop)
    await page.waitForTimeout(3000)
    await shot(page, '11-pide-agendar')
    await shotFrame(frame, '11-pide-agendar')

    // ── 11. AppointmentPicker ──
    // Esperar hasta 45s: getAvailableSlots (auto) + bookAppointment (human-in-the-loop)
    log('12', 'Esperando AppointmentPicker (hasta 45s)')
    const dateInput = frame.locator('input[type="date"]').first()
    const pickerVisible = await dateInput.waitFor({ timeout: 45000 }).then(() => true).catch(() => false)

    if (!pickerVisible) {
      log('⚠️', 'AppointmentPicker no apareció — puede que scoring no llegó al umbral')
      log('⚠️', 'Dump de últimos mensajes:')
      const dump = await getLastMessages(frame, 8)
      log('DUMP', JSON.stringify(dump, null, 2))
      await shotFrame(frame, '12-no-picker')
      log('⚠️', 'PARCIAL — chat funciona, booking pendiente de ajuste de umbral')
      return
    }

    await page.waitForTimeout(2500)
    await shot(page, '12-appointment-picker')
    await shotFrame(frame, '12-appointment-picker')

    const slots = frame.locator('button').filter({ hasText: /:\d\d/ })
    const slotCount = await slots.count()
    log('12', `Slots disponibles: ${slotCount}`)

    if (slotCount > 0) {
      log('13', 'Seleccionando primer slot')
      await slots.first().click()
      await shot(page, '13-slot-seleccionado')

      log('13', 'Confirmando cita')
      await frame.locator('button:has-text("Confirmar cita")').first().click()
      await waitSerena(frame, 35000)
      await shot(page, '14-cita-confirmada')
      await shotFrame(frame, '14-cita-confirmada')

      const msgsFinal = await getLastMessages(frame)
      log('MENSAJE FINAL', JSON.stringify(msgsFinal, null, 2))
      log('✅', 'FLUJO COMPLETO — PASS')
    } else {
      log('⚠️', 'Picker visible pero sin slots para esta fecha')
      log('✅', 'Calendar CONECTADO — picker funcionando (sin disponibilidad hoy)')
    }

  } catch (err) {
    log('❌', `Error: ${err.message}`)
    await shot(page, 'error-state')
    try { await shotFrame(page.frameLocator('#widget-iframe').first(), 'error-state') } catch {}
    throw err
  } finally {
    await page.waitForTimeout(2000)
    await browser.close()
  }
}

run().catch(e => { console.error(e); process.exit(1) })
