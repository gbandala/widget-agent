import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const questions = await db`
      SELECT id, question, source_url, status, admin_notes, created_at
      FROM kb_pending_questions
      ORDER BY created_at DESC
      LIMIT 100
    `
    return NextResponse.json({ questions })
  } catch (err) {
    console.error('[kb-pending]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, admin_notes } = body

    if (!id || !status) return NextResponse.json({ error: 'id y status requeridos' }, { status: 400 })

    await db`
      UPDATE kb_pending_questions
      SET status = ${status},
          admin_notes = ${admin_notes ?? null},
          resolved_at = ${status !== 'pending' ? new Date().toISOString() : null}
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[kb-pending]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
