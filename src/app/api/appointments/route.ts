import { NextRequest, NextResponse } from 'next/server'
import {
  getAvailableSlots,
  bookAppointment,
} from '@/features/appointments/services/googleCalendarService'
import { z } from 'zod'

const BookSchema = z.object({
  sessionId: z.string().uuid(),
  leadId: z.string().uuid(),
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
  leadName: z.string().min(1),
  leadEmail: z.string().email(),
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

    const { sessionId, leadId, slotStart, slotEnd, leadName, leadEmail, notes } = parsed.data
    const result = await bookAppointment({
      sessionId,
      leadId,
      startTime: slotStart,
      endTime: slotEnd,
      leadName,
      leadEmail,
      notes,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
