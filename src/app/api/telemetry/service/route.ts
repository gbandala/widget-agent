import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Uptime Kuma webhook payload (simplificado)
interface UptimeKumaPayload {
  heartbeat?: {
    status: number   // 1=up, 0=down
    time: string
    msg: string
    duration?: number
    ping?: number
  }
  monitor?: {
    name: string
    url?: string
    type?: string
  }
  msg?: string
}

function resolveStatus(status: number): 'up' | 'down' {
  return status === 1 ? 'up' : 'down'
}

/** POST /api/telemetry/service — Recibe webhooks de Uptime Kuma */
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.TELEMETRY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: UptimeKumaPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const monitor = body.monitor?.name ?? 'unknown'
  const hb = body.heartbeat
  if (!hb) {
    return NextResponse.json({ error: 'No heartbeat in payload' }, { status: 400 })
  }

  const status = resolveStatus(hb.status)
  const latencyMs = hb.ping ?? hb.duration ?? null
  const message = hb.msg ?? body.msg ?? null

  try {
    await db`
      INSERT INTO telemetry.t_service_events
        (ts, monitor, status, latency_ms, message, raw)
      VALUES
        (${hb.time}, ${monitor}, ${status}, ${latencyMs}, ${message}, ${body as never})
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telemetry/service]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
