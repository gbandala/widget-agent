import Link from 'next/link'
import { db } from '@/lib/db'
import ConversacionesChart from './ConversacionesChart'

export const dynamic = 'force-dynamic'

const TZ = 'America/Mexico_City'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: TZ,
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getWeekLabel(iso: string) {
  const d = new Date(iso)
  // ISO week start (Monday)
  const day = d.getDay() || 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - day + 1)
  return mon.toLocaleDateString('es-MX', { timeZone: TZ, day: '2-digit', month: 'short' })
}

export default async function ConversacionesPage() {
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString()

  const [sessions, chartSessions, chartErrors] = await Promise.all([
    db`
      SELECT
        s.id,
        s.source_url,
        s.interest_summary,
        s.started_at,
        s.last_active,
        l.name  AS lead_name,
        l.email AS lead_email,
        COUNT(m.id)::int AS message_count
      FROM widget_sessions s
      LEFT JOIN widget_leads l ON l.session_id = s.id
      LEFT JOIN widget_messages m ON m.session_id = s.id
      GROUP BY s.id, s.source_url, s.interest_summary, s.started_at, s.last_active, l.name, l.email
      ORDER BY s.last_active DESC
      LIMIT 20
    `,
    db`SELECT started_at FROM widget_sessions WHERE started_at >= ${eightWeeksAgo}`,
    db`SELECT created_at FROM widget_error_logs WHERE created_at >= ${eightWeeksAgo}`,
  ])

  // Build week buckets (last 8 weeks, oldest → newest)
  const weekMap = new Map<string, { label: string; conversations: number; threats: number }>()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000)
    const key = getWeekLabel(d.toISOString())
    if (!weekMap.has(key)) weekMap.set(key, { label: key, conversations: 0, threats: 0 })
  }
  for (const s of chartSessions) {
    const key = getWeekLabel(s.started_at as string)
    const entry = weekMap.get(key)
    if (entry) entry.conversations++
  }
  for (const e of chartErrors) {
    const key = getWeekLabel(e.created_at as string)
    const entry = weekMap.get(key)
    if (entry) entry.threats++
  }
  const weeks = Array.from(weekMap.values())

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conversaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Últimas 20 sesiones</p>
      </div>

      <ConversacionesChart weeks={weeks} />

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Inicio</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Lead</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Resumen</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Msgs</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Origen</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map(s => {
              const hasLead = s.lead_name != null
              const msgCount = (s.message_count as number) ?? 0

              return (
                <tr key={s.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {fmtDate(s.started_at as string)}
                  </td>
                  <td className="px-4 py-3">
                    {hasLead ? (
                      <div>
                        <p className="font-medium text-gray-900 text-xs">{s.lead_name as string}</p>
                        <p className="text-gray-400 text-xs">{s.lead_email as string}</p>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {msgCount >= 2 ? ((s.interest_summary as string | null) ?? '—') : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs text-center">{msgCount}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[160px]">
                    {(s.source_url as string | null) ?? '—'}
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
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin conversaciones</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
