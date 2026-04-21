import { WidgetLauncher } from '@/features/widget/components/WidgetLauncher'
import { createServiceClient } from '@/lib/supabase/server'

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
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('widget_tokens')
      .select('bot_name, bot_avatar_url, welcome_message, is_active')
      .eq('token', token)
      .single()

    if (data?.is_active) {
      dbBotName = data.bot_name ?? 'Asistente'
      dbBotAvatarUrl = data.bot_avatar_url ?? null
      dbWelcomeMessage = data.welcome_message ?? null
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
