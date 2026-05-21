import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TZ = 'America/Mexico_City'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

const INTENT_LABELS: Record<string, string> = {
  browsing: 'Explorando',
  interested: 'Interesado',
  lead_captured: 'Lead capturado',
  booked: 'Cita agendada',
}

export default async function ConversacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServiceClient()

  const [{ data: session }, { data: messages }] = await Promise.all([
    supabase
      .from('widget_sessions')
      .select(`*, widget_leads ( * ), appointments ( start_time, meet_link, status )`)
      .eq('id', id)
      .single(),
    supabase
      .from('widget_messages')
      .select('id, role, content, created_at')
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!session) notFound()

  const lead = Array.isArray(session.widget_leads) ? session.widget_leads[0] : session.widget_leads
  const appointment = Array.isArray(session.appointments) ? session.appointments[0] : session.appointments

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/conversaciones" className="text-sm text-gray-400 hover:text-gray-600">
          ← Conversaciones
        </Link>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border p-5 mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Inicio</p>
          <p className="text-gray-700">{fmtDate(session.started_at)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Última actividad</p>
          <p className="text-gray-700">{fmtDate(session.last_active)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Intent</p>
          <p className="text-gray-700">{INTENT_LABELS[session.intent_detected ?? 'browsing']}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Origen</p>
          <p className="text-gray-500 truncate">{session.source_url ?? '—'}</p>
        </div>
        {session.interest_summary && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-0.5">Resumen de interés</p>
            <p className="text-gray-700">{session.interest_summary}</p>
          </div>
        )}
      </div>

      {/* Lead info */}
      {lead && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm">
          <p className="text-xs font-medium text-green-700 mb-2">Lead capturado</p>
          <div className="grid grid-cols-2 gap-2 text-green-900">
            <div><span className="text-green-600">Nombre: </span>{lead.name}</div>
            <div><span className="text-green-600">Email: </span>{lead.email}</div>
            {lead.company && <div><span className="text-green-600">Empresa: </span>{lead.company}</div>}
            {lead.phone && <div><span className="text-green-600">Teléfono: </span>{lead.phone}</div>}
          </div>
        </div>
      )}

      {/* Appointment info */}
      {appointment && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 text-sm">
          <p className="text-xs font-medium text-purple-700 mb-2">Cita agendada</p>
          <div className="text-purple-900 space-y-1">
            <p>{fmtDate(appointment.start_time)} — {appointment.status}</p>
            {appointment.meet_link && (
              <a href={appointment.meet_link} target="_blank" rel="noopener noreferrer"
                className="text-purple-600 hover:underline text-xs">{appointment.meet_link}</a>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {(messages ?? []).map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : msg.role === 'tool'
                  ? 'bg-gray-100 text-gray-500 italic text-xs rounded-bl-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                {fmtTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}
        {(!messages || messages.length === 0) && (
          <p className="text-center text-gray-400 py-8">Sin mensajes registrados</p>
        )}
      </div>
    </div>
  )
}
