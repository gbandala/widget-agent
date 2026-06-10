import { WidgetLauncher } from '@/features/widget/components/WidgetLauncher'
import { db } from '@/lib/db'

interface EmbedPageProps {
  searchParams: Promise<{
    token?: string
    botName?: string
    welcomeMessage?: string
    botAvatarUrl?: string
    sourceUrl?: string
  }>
}

export default async function EmbedPage({ searchParams }: EmbedPageProps) {
  const params = await searchParams
  const { token, sourceUrl } = params

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Token requerido
      </div>
    )
  }

  // Fetch token config from DB — URL params are optional overrides
  let dbBotName = 'Asistente'
  let dbBotAvatarUrl: string | null = null
  let dbWelcomeMessage: string | null = null

  try {
    const rows = await db`
      SELECT bot_name, bot_avatar_url, welcome_message, is_active
      FROM widget_tokens
      WHERE token = ${token}
      LIMIT 1
    `
    const data = rows[0]

    if (data?.is_active) {
      dbBotName = (data.bot_name as string | null) ?? 'Asistente'
      dbBotAvatarUrl = (data.bot_avatar_url as string | null) ?? null
      dbWelcomeMessage = (data.welcome_message as string | null) ?? null
    }
  } catch { /* use defaults on error */ }

  const botName = params.botName ?? dbBotName
  const botAvatarUrl = params.botAvatarUrl ?? dbBotAvatarUrl ?? undefined
  const welcomeMessage = params.welcomeMessage ?? dbWelcomeMessage ?? undefined

  return (
    <div className="w-screen h-screen overflow-hidden">
      <WidgetLauncher
        token={token}
        botName={botName}
        welcomeMessage={welcomeMessage}
        botAvatarUrl={botAvatarUrl}
        mode="embed"
        initialSourceUrl={sourceUrl}
      />
    </div>
  )
}
