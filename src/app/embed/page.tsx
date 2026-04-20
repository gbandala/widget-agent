import { WidgetLauncher } from '@/features/widget/components/WidgetLauncher'

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
  const { token, botName, welcomeMessage, botAvatarUrl, sourceUrl } = await searchParams

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Token requerido
      </div>
    )
  }

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
