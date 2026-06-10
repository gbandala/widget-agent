import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWidgetToken } from '@/lib/security/widgetTokenValidator'

/** POST /api/widget/session — Crea o recupera una sesión por anonId */
export async function POST(req: NextRequest) {
  const auth = await requireWidgetToken(req)
  if (!auth.ok) return auth.response

  try {
    const { anonId, tokenId, sourceUrl } = await req.json()

    if (!anonId || !tokenId) {
      return NextResponse.json({ error: 'anonId y tokenId requeridos' }, { status: 400 })
    }

    // Buscar sesión existente activa (últimas 2 horas)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const existing = await db`
      SELECT *
      FROM widget_sessions
      WHERE anon_id = ${anonId}
        AND token_id = ${tokenId}
        AND last_active >= ${twoHoursAgo}
      ORDER BY last_active DESC
      LIMIT 1
    `

    if (existing[0]) {
      return NextResponse.json({ session: existing[0] })
    }

    // Crear nueva sesión
    const rows = await db`
      INSERT INTO widget_sessions ${db({
        anon_id: anonId,
        token_id: tokenId,
        source_url: sourceUrl ?? null,
        intent_detected: 'browsing',
      })}
      RETURNING *
    `

    return NextResponse.json({ session: rows[0] }, { status: 201 })
  } catch (err) {
    console.error('[session]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
