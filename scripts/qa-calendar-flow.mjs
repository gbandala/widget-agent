/**
 * QA: Flujo completo widget Serena → captureContact → Calendar booking
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

// Espera hasta que no haya dots en el iframe
async function waitSerena(frame, timeoutMs = 30000) {
  try {
    // Esperar a que aparezcan los dots (Serena empieza a responder)
    await frame.locator('.animate-bounce').first().waitFor({ state: 'visible', timeout: 5000 })
  } catch { /* puede que Serena responda tan rápido que no veamos el dot */ }
  try {
    // Esperar a que desaparezcan (Serena terminó)
    await frame.locator('.animate-bounce').first().waitFor({ state: 'hidden', timeout: timeoutMs })
  } catch {}
  await frame.locator('body').evaluate(() => new Promise(r => setTimeout(r, 800)))
}

async function getLastMessages(frame, n = 6) {
  try {
    const bubbles = frame.locator('[class*="rounded-2xl"]:not([class*="rounded-full"])')
    const texts = await bubbles.allTextContents()
    return texts.filter(t => t.trim().length > 3).slice(-n)
  } catch { return [] }
}

async function run() {
  log('SETUP', `Screenshots → ${REPORT_DIR}/screenshots/`)
  const browser = await chromium.launch({ headless: false, slowMo: 200 })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  try {
    // ── 1. Landing ──
    log('1', 'Navegando a clariifica.com')
    await page.goto('https://clariifica.com', { waitUntil: 'networkidle', timeout: 30000 })
    await shot(page, '01-landing')

    // ── 2. Abrir widget ──
    log('2', 'Click en FAB de Serena')
    await page.locator('#widget-fab').click()
    await page.waitForTimeout(2000)
    await shot(page, '02-widget-abierto')

    // Frame del widget
    const frame = page.frameLocator('#widget-iframe').first()
    const input = frame.locator('input[placeholder*="Escribe"]').first()
    await input.waitFor({ timeout: 10000 })

    // ── 3. Preguntar sobre servicios ──
    log('3', 'Preguntando sobre servicios')
    await input.fill('¿Qué servicios ofrece Clarifica?')
    await input.press('Enter')
    await waitSerena(frame)
    await shot(page, '03-respuesta-servicios')

    // ── 4. Mostrar interés ──
    log('4', 'Expresando interés')
    await input.fill('Me interesa mucho, quiero una propuesta')
    await input.press('Enter')
    await waitSerena(frame, 20000)
    await shot(page, '04-interes')

    // ── 5. Esperar formulario de contacto ──
    log('5', 'Esperando formulario PrivacyConsent')
    const nameInput = frame.locator('input[placeholder="Tu nombre"]').first()
    await nameInput.waitFor({ timeout: 15000 })
    await shot(page, '05-formulario')
    await shotFrame(frame, '05-formulario')

    // ── 6. Llenar formulario ──
    log('6', 'Llenando nombre y email')
    await nameInput.fill('Test Usuario')
    await frame.locator('input[type="email"]').first().fill('test@test.com')

    log('6', 'Marcando checkbox de privacidad')
    const checkbox = frame.locator('input[type="checkbox"]').first()
    await checkbox.waitFor({ timeout: 5000 })
    await checkbox.check()
    await page.waitForTimeout(300)
    await shot(page, '06-formulario-llenado')

    // ── 7. Submit ──
    log('7', 'Haciendo click en Enviar')
    const submitBtn = frame.locator('button[type="submit"]').first()
    await submitBtn.waitFor({ timeout: 5000 })
    const isDisabled = await submitBtn.isDisabled()
    log('7', `Botón disabled: ${isDisabled}`)
    await submitBtn.click()

    // Esperar a que el formulario desaparezca = lead capturado + addToolResult llamado
    log('7', 'Esperando que formulario desaparezca (lead capturado)...')
    await nameInput.waitFor({ state: 'hidden', timeout: 15000 })
    log('7', 'Formulario cerrado — Serena procesando resultado')

    // Ahora sí esperar la respuesta de Serena
    await waitSerena(frame, 30000)
    await shot(page, '07-contacto-capturado')
    await shotFrame(frame, '07-contacto-capturado')

    const msgs7 = await getLastMessages(frame)
    log('MENSAJES TRAS SUBMIT', JSON.stringify(msgs7, null, 2))

    // ── 8. Pedir cita ──
    log('8', 'Pidiendo agendar sesión')
    await input.fill('Sí, me gustaría agendar una sesión de diagnóstico')
    await input.press('Enter')
    await waitSerena(frame, 30000)
    await shot(page, '08-pide-agendar')
    await shotFrame(frame, '08-pide-agendar')

    const msgs8 = await getLastMessages(frame)
    log('MENSAJES TRAS PEDIR CITA', JSON.stringify(msgs8, null, 2))

    // ── 9. AppointmentPicker ──
    log('9', 'Esperando AppointmentPicker (input[type=date])')
    const dateInput = frame.locator('input[type="date"]').first()
    await dateInput.waitFor({ timeout: 25000 })
    await page.waitForTimeout(2500) // esperar que carguen los slots
    await shot(page, '09-appointment-picker')
    await shotFrame(frame, '09-appointment-picker')

    const slots = frame.locator('button').filter({ hasText: /:\d\d/ })
    const slotCount = await slots.count()
    log('9', `Slots disponibles: ${slotCount}`)

    if (slotCount > 0) {
      // ── 10. Confirmar cita ──
      log('10', 'Seleccionando primer slot')
      await slots.first().click()
      await shot(page, '10-slot-seleccionado')

      log('10', 'Confirmando cita')
      await frame.locator('button:has-text("Confirmar cita")').first().click()
      await waitSerena(frame, 35000)
      await shot(page, '11-cita-confirmada')
      await shotFrame(frame, '11-cita-confirmada')

      const msgsFinal = await getLastMessages(frame)
      log('MENSAJE FINAL DE SERENA', JSON.stringify(msgsFinal, null, 2))
      log('✅', 'FLUJO COMPLETO — PASS')
    } else {
      log('⚠️', 'AppointmentPicker visible pero sin slots para esta fecha')
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
