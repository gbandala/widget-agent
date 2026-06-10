import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ERROR_TYPE_LABELS: Record<string, string> = {
  api_error: 'Error de API',
  quota_exceeded: 'Cuota Agotada',
  connection_error: 'Error de Conexión',
  auth_error: 'Error de Autenticación',
  rate_limit: 'Rate Limit',
  injection_attempt: '⚠️ Inyección Detectada',
  scope_violation: 'Fuera de Scope',
  tool_error: 'Error de Tool',
  stt_error: 'Error de Audio',
  unknown: 'Desconocido',
}

export default async function LogsPage() {
  const logs = await db`
    SELECT *
    FROM widget_error_logs
    ORDER BY created_at DESC
    LIMIT 100
  `

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Logs de Errores</h1>
        <p className="text-sm text-gray-500 mt-1">Últimos 100 eventos</p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Mensaje</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Origen</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map(log => (
              <tr key={log.id as string} className={log.error_type === 'injection_attempt' ? 'bg-red-50' : ''}>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    log.error_type === 'injection_attempt' ? 'bg-red-100 text-red-700' :
                    log.error_type === 'api_error' || log.error_type === 'quota_exceeded' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {ERROR_TYPE_LABELS[log.error_type as string] ?? log.error_type as string}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{(log.message as string | null) ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[200px]">{(log.source_url as string | null) ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(log.created_at as string).toLocaleString('es-MX')}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin registros</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
