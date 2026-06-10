import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const leads = await db`
    SELECT id, name, company, privacy_accepted_at, source_url, created_at, session_id
    FROM widget_leads
    ORDER BY created_at DESC
    LIMIT 100
  `

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leads Capturados</h1>
        <p className="text-sm text-gray-500 mt-1">{leads.length} leads registrados</p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Empresa</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Origen</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Privacidad</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map(lead => (
              <tr key={lead.id as string}>
                <td className="px-4 py-3 font-medium text-gray-900">{lead.name as string}</td>
                <td className="px-4 py-3 text-gray-600">{(lead.company as string | null) ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[180px]">{(lead.source_url as string | null) ?? '—'}</td>
                <td className="px-4 py-3">
                  {lead.privacy_accepted_at ? (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">✓ Aceptado</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(lead.created_at as string).toLocaleString('es-MX')}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin leads registrados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
