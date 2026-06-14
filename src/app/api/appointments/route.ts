import { NextRequest, NextResponse } from 'next/server'
import {
  getAvailableSlots,
  bookAppointment,
} from '@/features/appointments/services/googleCalendarService'
import { db } from '@/lib/db'
import { z } from 'zod'

const BookSchema = z.object({
  sessionId: z.string().uuid(),
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
  leadName: z.string().optional().transform(v => v || 'Visitante'),
  leadEmail: z.string().email().optional(),
  notes: z.string().optional(),
})

/** GET /api/appointments?date=YYYY-MM-DD — Slots disponibles */
export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date') ?? undefined
    const slots = await getAvailableSlots(date)
    return NextResponse.json({ slots })
  } catch (err) {
    return NextResponse.json(
      { slots: [], message: 'No se pudo obtener disponibilidad en este momento.' },
      { status: 200 } // 200 para que el widget maneje el mensaje cordial
    )
  }
}

/** POST /api/appointments — Crear cita */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = BookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { sessionId, slotStart, slotEnd, leadName, leadEmail, notes } = parsed.data

    // Resolver lead_id y email desde la sesión (el cliente no es autoritativo en esto)
    const [session] = await db<{ lead_id: string | null }[]>`
      SELECT lead_id FROM widget_sessions WHERE id = ${sessionId}
    `
    const leadId = session?.lead_id
    if (!leadId) {
      return NextResponse.json(
        { error: 'No hay lead asociado a esta sesión. Completa el formulario primero.' },
        { status: 422 }
      )
    }

    // Obtener email del lead si el cliente no lo envió
    let resolvedEmail = leadEmail
    if (!resolvedEmail) {
      const [lead] = await db<{ email: string }[]>`
        SELECT email FROM widget_leads WHERE id = ${leadId}
      `
      resolvedEmail = lead?.email
    }
    if (!resolvedEmail) {
      return NextResponse.json({ error: 'Email del lead no encontrado' }, { status: 422 })
    }

    const result = await bookAppointment({
      sessionId,
      leadId,
      startTime: slotStart,
      endTime: slotEnd,
      leadName,
      leadEmail: resolvedEmail,
      notes,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
