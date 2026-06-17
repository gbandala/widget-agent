import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const VisitSchema = z.object({
  session_id: z.string(),
  page: z.string().max(500),
  referrer: z.string().max(500).optional(),
  sections_seen: z.array(z.object({
    section: z.string(),
    ts: z.number(),
    dwell_ms: z.number().optional(),
  })).optional(),
  ts_start: z.number(),
  ts_end: z.number().optional(),
})

/** POST /api/telemetry/visit — Recibe beacon JS de la landing */
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.TELEMETRY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = VisitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { session_id, page, referrer, sections_seen, ts_start, ts_end } = parsed.data
  const userAgent = req.headers.get('user-agent') ?? null

  try {
    await db`
      INSERT INTO telemetry.t_visit_sessions
        (session_id, page, referrer, sections_seen, ts_start, ts_end, user_agent)
      VALUES (
        ${session_id},
        ${page},
        ${referrer ?? null},
        ${sections_seen ? JSON.stringify(sections_seen) : null},
        ${new Date(ts_start).toISOString()},
        ${ts_end ? new Date(ts_end).toISOString() : null},
        ${userAgent}
      )
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telemetry/visit]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
