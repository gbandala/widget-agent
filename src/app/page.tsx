import { WidgetLauncher } from '@/features/widget/components/WidgetLauncher'

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Widget Agent</h1>
        <p className="text-lg text-gray-600 mb-8">
          Asistente de consultoría con IA. Haz clic en el botón azul para probarlo.
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { title: 'Base de Conocimiento', desc: 'Gestiona servicios y FAQs', href: '/kb' },
            { title: 'Tokens de Landing', desc: 'Controla qué sitios pueden usar el widget', href: '/tokens' },
            { title: 'Leads y Logs', desc: 'Analítica y errores', href: '/leads' },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-left"
            >
              <p className="font-semibold text-gray-800">{item.title}</p>
              <p className="text-gray-400 text-xs mt-1">{item.desc}</p>
            </a>
          ))}
        </div>
      </div>

      <WidgetLauncher
        token={process.env.NEXT_PUBLIC_DEMO_WIDGET_TOKEN ?? 'CONFIGURE_TOKEN_IN_ENV'}
        botName="Sofia"
        welcomeMessage="¡Hola! Soy Sofia, tu asistente de consultoría tecnológica. ¿En qué puedo ayudarte hoy?"
      />
    </main>
  )
}
