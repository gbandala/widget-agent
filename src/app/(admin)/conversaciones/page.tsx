import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  browsing:       { label: 'Explorando',      color: 'bg-gray-100 text-gray-600' },
  interested:     { label: 'Interesado',      color: 'bg-blue-100 text-blue-700' },
  lead_captured:  { label: 'Lead capturado',  color: 'bg-green-100 text-green-700' },
  booked:         { label: 'Cita agendada',   color: 'bg-purple-100 text-purple-700' },
}

export default async function ConversacionesPage() {
  const supabase = await createServiceClient()

  const { data: sessions } = await supabase
    .from('widget_sessions')
    .select(`
      id, source_url, intent_detected, interest_summary, started_at, last_active,
      widget_leads ( name, email ),
      widget_messages ( count )
    `)
    .order('last_active', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conversaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Últimas 100 sesiones</p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Inicio</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Lead</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Intent</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Resumen</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Msgs</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Origen</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(sessions ?? []).map(s => {
              const lead = Array.isArray(s.widget_leads) ? s.widget_leads[0] : s.widget_leads
              const msgCount = Array.isArray(s.widget_messages) ? s.widget_messages[0]?.count ?? 0 : 0
              const intent = INTENT_LABELS[s.intent_detected ?? 'browsing'] ?? INTENT_LABELS.browsing

              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(s.started_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    {lead ? (
                      <div>
                        <p className="font-medium text-gray-900 text-xs">{lead.name}</p>
                        <p className="text-gray-400 text-xs">{lead.email}</p>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${intent.color}`}>
                      {intent.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {s.interest_summary ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs text-center">{msgCount}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[160px]">
                    {s.source_url ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/conversaciones/${s.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(!sessions || sessions.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin conversaciones</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
