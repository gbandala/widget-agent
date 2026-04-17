import { getCalendarClient, CALENDAR_ID, DEFAULT_MEETING_DURATION_MINUTES } from '@/lib/google/calendarClient'
import type { AppointmentSlot, CreateAppointmentInput } from '../types'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Obtiene los slots libres del calendario para una fecha dada.
 * Usa FreeBusy API para detectar bloques ocupados.
 */
export async function getAvailableSlots(
  date?: string, // YYYY-MM-DD, default hoy+1
  durationMinutes = DEFAULT_MEETING_DURATION_MINUTES
): Promise<AppointmentSlot[]> {
  const calendar = getCalendarClient()

  // Calcular rango del día solicitado
  const targetDate = date
    ? new Date(date)
    : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d })()

  // Horario laboral: 9am - 6pm
  const startOfDay = new Date(targetDate)
  startOfDay.setHours(9, 0, 0, 0)
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(18, 0, 0, 0)

  // Obtener eventos ocupados
  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      items: [{ id: CALENDAR_ID }],
    },
  })

  const busySlots = freeBusy.data.calendars?.[CALENDAR_ID]?.busy ?? []

  // Generar slots de durationMinutes y filtrar ocupados
  const availableSlots: AppointmentSlot[] = []
  const current = new Date(startOfDay)

  while (current < endOfDay) {
    const slotEnd = new Date(current.getTime() + durationMinutes * 60 * 1000)
    if (slotEnd > endOfDay) break

    // Verificar que el slot no solape con eventos ocupados
    const isBusy = busySlots.some(busy => {
      const busyStart = new Date(busy.start!)
      const busyEnd = new Date(busy.end!)
      return current < busyEnd && slotEnd > busyStart
    })

    if (!isBusy) {
      const label = current.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }) + ' · ' + current.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' – ' + slotEnd.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      })

      availableSlots.push({
        start: current.toISOString(),
        end: slotEnd.toISOString(),
        label: label.charAt(0).toUpperCase() + label.slice(1),
      })
    }

    // Avanzar 30 minutos
    current.setTime(current.getTime() + 30 * 60 * 1000)
  }

  return availableSlots.slice(0, 8) // Máximo 8 opciones
}

/**
 * Crea un evento en Google Calendar con conferencia Meet.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<{
  googleEventId: string
  meetLink: string
}> {
  const calendar = getCalendarClient()

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    conferenceDataVersion: 1,
    requestBody: {
      summary: `Consultoría con ${input.leadName}`,
      description: input.notes ?? 'Sesión de consultoría agendada desde el widget.',
      start: { dateTime: input.startTime, timeZone: 'America/Mexico_City' },
      end: { dateTime: input.endTime, timeZone: 'America/Mexico_City' },
      attendees: [{ email: input.leadEmail, displayName: input.leadName }],
      conferenceData: {
        createRequest: {
          requestId: `widget-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    },
  })

  const googleEventId = event.data.id!
  const meetLink = event.data.conferenceData?.entryPoints?.find(
    e => e.entryPointType === 'video'
  )?.uri ?? ''

  return { googleEventId, meetLink }
}

/**
 * Crea la cita completa: evento en Google + registro en Supabase.
 */
export async function bookAppointment(input: CreateAppointmentInput): Promise<{
  meetLink: string
  googleEventId: string
  appointmentId: string
}> {
  const { googleEventId, meetLink } = await createAppointment(input)

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      session_id: input.sessionId,
      lead_id: input.leadId,
      google_event_id: googleEventId,
      meet_link: meetLink,
      start_time: input.startTime,
      end_time: input.endTime,
      notes: input.notes,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Error guardando cita: ${error.message}`)

  // Actualizar sesión
  await supabase
    .from('widget_sessions')
    .update({
      appointment_id: data.id,
      intent_detected: 'booked',
      last_active: new Date().toISOString(),
    })
    .eq('id', input.sessionId)

  return { meetLink, googleEventId, appointmentId: data.id }
}
