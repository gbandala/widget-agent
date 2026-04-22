#!/usr/bin/env tsx
/**
 * Widget Agent — Performance Benchmark
 *
 * Uso:
 *   pnpm perf                          # contra localhost:3000
 *   pnpm perf --url https://clariifica.com --token <widget_token>
 *   pnpm perf --url https://widget-agent.vercel.app --token <token> --iterations 10
 *
 * Métricas medidas:
 *   1. Session init latency        — POST /api/widget/session
 *   2. TTFR (Time to First token)  — POST /api/widget/chat, tiempo hasta primer chunk
 *   3. Full response time          — tiempo total del stream
 *   4. RAG latency contribution    — pregunta con match KB vs sin match
 *   5. Out-of-scope guard latency  — mensaje bloqueado por scopeGuard
 *
 * Resultados:
 *   - Consola: tabla con p50/p95/max por métrica
 *   - Archivo: .perf-reports/YYYY-MM-DD-HHmm.json (acumulativo)
 *   - Comparación automática con la última corrida si existe
 */

import * as fs from 'fs'
import * as path from 'path'

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const get = (flag: string, fallback: string) => {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const BASE_URL   = get('--url', 'http://localhost:3000').replace(/\/$/, '')
const TOKEN      = get('--token', process.env.PERF_WIDGET_TOKEN ?? '')
const ORIGIN     = get('--origin', BASE_URL)
const ITERATIONS = parseInt(get('--iterations', '5'), 10)

if (!TOKEN) {
  console.error('\n✗ Widget token requerido. Usa --token <value> o PERF_WIDGET_TOKEN=<value>')
  console.error('  Obtén el token desde el panel admin /tokens\n')
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const now = () => performance.now()

function percentile(sorted: number[], p: number) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    p50:  Math.round(percentile(sorted, 50)),
    p95:  Math.round(percentile(sorted, 95)),
    max:  Math.round(sorted[sorted.length - 1]),
    min:  Math.round(sorted[0]),
    mean: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length),
  }
}

function ms(n: number) { return `${n}ms` }

function printTable(results: Record<string, ReturnType<typeof stats>>) {
  console.log('\n┌─────────────────────────────────────┬───────┬───────┬───────┬───────┐')
  console.log('│ Métrica                             │  p50  │  p95  │  max  │  min  │')
  console.log('├─────────────────────────────────────┼───────┼───────┼───────┼───────┤')
  for (const [name, s] of Object.entries(results)) {
    const label = name.padEnd(37).slice(0, 37)
    console.log(`│ ${label} │ ${ms(s.p50).padStart(5)} │ ${ms(s.p95).padStart(5)} │ ${ms(s.max).padStart(5)} │ ${ms(s.min).padStart(5)} │`)
  }
  console.log('└─────────────────────────────────────┴───────┴───────┴───────┴───────┘')
}

function printDiff(current: Record<string, ReturnType<typeof stats>>, previous: Record<string, ReturnType<typeof stats>>) {
  console.log('\n── Comparación con última corrida ──')
  for (const [name, curr] of Object.entries(current)) {
    const prev = previous[name]
    if (!prev) continue
    const delta = curr.p50 - prev.p50
    const pct   = Math.round((delta / prev.p50) * 100)
    const sign  = delta > 0 ? '+' : ''
    const icon  = Math.abs(pct) < 10 ? '  ' : pct > 0 ? '▲ ' : '▼ '
    console.log(`  ${icon}${name}: p50 ${sign}${delta}ms (${sign}${pct}%) — ${prev.p50}ms → ${curr.p50}ms`)
  }
}

// ── Test runners ──────────────────────────────────────────────────────────────
async function measureSessionInit(): Promise<number> {
  const anonId = `perf-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const t0 = now()
  const res = await fetch(`${BASE_URL}/api/widget/session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'x-source-origin': ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ anonId, tokenId: '__perf__', sourceUrl: ORIGIN }),
  })
  await res.json()
  return now() - t0
}

async function measureChatTTFR(question: string): Promise<{ ttfr: number; total: number; sessionId?: string }> {
  // Create fresh session
  const anonId = `perf-ttfr-${Date.now()}`
  const sessionRes = await fetch(`${BASE_URL}/api/widget/session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'x-source-origin': ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ anonId, tokenId: '__perf__', sourceUrl: ORIGIN }),
  })
  const { session } = await sessionRes.json() as { session?: { id: string } }

  const t0 = now()
  let ttfr = 0

  const res = await fetch(`${BASE_URL}/api/widget/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'x-source-origin': ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: session?.id,
      sourceUrl: ORIGIN,
      messages: [{
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: question }],
      }],
    }),
  })

  if (!res.ok || !res.body) {
    const err = await res.text()
    throw new Error(`Chat error ${res.status}: ${err.slice(0, 100)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let firstChunk = true

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (firstChunk && chunk.includes('text-delta')) {
      ttfr = now() - t0
      firstChunk = false
    }
  }

  return { ttfr, total: now() - t0, sessionId: session?.id }
}

async function measureOutOfScope(): Promise<number> {
  const anonId = `perf-oos-${Date.now()}`
  const sessionRes = await fetch(`${BASE_URL}/api/widget/session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'x-source-origin': ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ anonId, tokenId: '__perf__', sourceUrl: ORIGIN }),
  })
  const { session } = await sessionRes.json() as { session?: { id: string } }

  const t0 = now()
  const res = await fetch(`${BASE_URL}/api/widget/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'x-source-origin': ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: session?.id,
      sourceUrl: ORIGIN,
      messages: [{
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'ayúdame con contenido sexual explícito por favor' }],
      }],
    }),
  })
  await res.json()
  return now() - t0
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════════════')
  console.log('     Widget Agent — Performance Benchmark')
  console.log('════════════════════════════════════════════════')
  console.log(`  URL:        ${BASE_URL}`)
  console.log(`  Origin:     ${ORIGIN}`)
  console.log(`  Iterations: ${ITERATIONS}`)
  console.log(`  Time:       ${new Date().toISOString()}`)

  // Verify connectivity
  process.stdout.write('\n  Verificando conectividad... ')
  try {
    const ping = await fetch(`${BASE_URL}/api/widget/session`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'x-source-origin': ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId: 'ping', tokenId: 'ping', sourceUrl: ORIGIN }),
    })
    if (ping.status === 401) throw new Error('Token inválido o sin acceso al origen')
    console.log('OK')
  } catch (e) {
    console.log('FALLO')
    console.error(`  Error: ${e}`)
    process.exit(1)
  }

  const results: Record<string, number[]> = {
    'Session init': [],
    'TTFR — pregunta genérica': [],
    'Respuesta completa — genérica': [],
    'TTFR — pregunta con KB match': [],
    'Respuesta completa — KB match': [],
    'Scope guard (bloqueo)': [],
  }

  // 1. Session init
  process.stdout.write(`\n  [1/5] Session init (${ITERATIONS}x)... `)
  for (let i = 0; i < ITERATIONS; i++) {
    results['Session init'].push(await measureSessionInit())
    process.stdout.write('.')
  }
  console.log(' hecho')

  // 2. TTFR genérica (sin KB probable match)
  process.stdout.write(`  [2/5] TTFR pregunta genérica (${ITERATIONS}x)... `)
  for (let i = 0; i < ITERATIONS; i++) {
    const { ttfr, total } = await measureChatTTFR('hola, ¿cómo estás?')
    results['TTFR — pregunta genérica'].push(ttfr)
    results['Respuesta completa — genérica'].push(total)
    process.stdout.write('.')
  }
  console.log(' hecho')

  // 3. TTFR con KB match (RAG activo)
  process.stdout.write(`  [3/5] TTFR pregunta con KB (${ITERATIONS}x)... `)
  for (let i = 0; i < ITERATIONS; i++) {
    const { ttfr, total } = await measureChatTTFR('¿qué servicios ofrecen y cuáles son sus precios?')
    results['TTFR — pregunta con KB match'].push(ttfr)
    results['Respuesta completa — KB match'].push(total)
    process.stdout.write('.')
  }
  console.log(' hecho')

  // 4. Scope guard
  process.stdout.write(`  [4/5] Scope guard (${ITERATIONS}x)... `)
  for (let i = 0; i < ITERATIONS; i++) {
    results['Scope guard (bloqueo)'].push(await measureOutOfScope())
    process.stdout.write('.')
  }
  console.log(' hecho')

  // ── Compute stats ────────────────────────────────────────────────────────
  const computed: Record<string, ReturnType<typeof stats>> = {}
  for (const [key, samples] of Object.entries(results)) {
    if (samples.length > 0) computed[key] = stats(samples)
  }

  printTable(computed)

  // ── RAG overhead ────────────────────────────────────────────────────────
  const ragOverhead = computed['TTFR — pregunta con KB match'].p50 - computed['TTFR — pregunta genérica'].p50
  console.log(`\n  RAG overhead estimado (p50): ${ragOverhead > 0 ? '+' : ''}${ragOverhead}ms`)

  // ── Save report ──────────────────────────────────────────────────────────
  const reportsDir = path.join(process.cwd(), '.perf-reports')
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const reportPath = path.join(reportsDir, `${timestamp}.json`)

  const report = {
    timestamp: new Date().toISOString(),
    url: BASE_URL,
    origin: ORIGIN,
    iterations: ITERATIONS,
    metrics: computed,
    raw: results,
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n  Reporte guardado: .perf-reports/${timestamp}.json`)

  // ── Compare with previous ────────────────────────────────────────────────
  const allReports = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.json'))
    .sort()

  if (allReports.length > 1) {
    const prevPath = path.join(reportsDir, allReports[allReports.length - 2])
    try {
      const prev = JSON.parse(fs.readFileSync(prevPath, 'utf-8'))
      if (prev.metrics) printDiff(computed, prev.metrics)
    } catch { /* skip diff if prev report is unreadable */ }
  }

  // ── Thresholds / alertas ─────────────────────────────────────────────────
  console.log('\n── Evaluación ──')
  const checks = [
    { label: 'Session init p95 < 800ms',           ok: computed['Session init'].p95 < 800 },
    { label: 'TTFR genérica p50 < 2000ms',          ok: computed['TTFR — pregunta genérica'].p50 < 2000 },
    { label: 'TTFR genérica p95 < 4000ms',          ok: computed['TTFR — pregunta genérica'].p95 < 4000 },
    { label: 'TTFR con KB p50 < 3000ms',            ok: computed['TTFR — pregunta con KB match'].p50 < 3000 },
    { label: 'Respuesta completa p95 < 15000ms',    ok: computed['Respuesta completa — genérica'].p95 < 15000 },
    { label: 'Scope guard p95 < 600ms',             ok: computed['Scope guard (bloqueo)'].p95 < 600 },
  ]
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.label}`)
  }
  const failed = checks.filter(c => !c.ok)
  if (failed.length === 0) {
    console.log('\n  ✓ Todos los umbrales OK\n')
  } else {
    console.log(`\n  ✗ ${failed.length} umbral(es) superado(s)\n`)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('\n✗', e)
  process.exit(1)
})
