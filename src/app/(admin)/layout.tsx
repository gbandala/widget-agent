import Link from 'next/link'

export const dynamic = 'force-dynamic'

const NAV_ITEMS = [
  { href: '/kb', label: 'Base de Conocimiento' },
  { href: '/tokens', label: 'Tokens de Widget' },
  { href: '/leads', label: 'Leads' },
  { href: '/logs', label: 'Logs de Errores' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="font-bold text-gray-900 text-sm">Widget Agent</h1>
          <p className="text-xs text-gray-400">Panel de Administración</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
            ← Volver al sitio
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 min-h-screen">
        {children}
      </main>
    </div>
  )
}
