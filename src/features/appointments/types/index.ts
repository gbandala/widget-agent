export interface AppointmentSlot {
  start: string   // ISO 8601
  end: string     // ISO 8601
  label: string   // "Lunes 21 Abr · 10:00 – 10:30"
}

export interface AppointmentRecord {
  id: string
  sessionId: string
  leadId: string
  googleEventId: string
  meetLink: string
  startTime: string
  endTime: string
  durationMinutes: number
  status: 'confirmed' | 'cancelled' | 'rescheduled' | 'completed'
  notes?: string
  createdAt: string
}

export interface CreateAppointmentInput {
  sessionId: string
  leadId: string
  startTime: string
  endTime: string
  leadName: string
  leadEmail: string
  notes?: string
}
