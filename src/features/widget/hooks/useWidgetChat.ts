'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useState, useMemo } from 'react'

interface UseWidgetChatOptions {
  token: string
  anonId: string
  sourceUrl: string
}

export function useWidgetChat({ token, anonId, sourceUrl }: UseWidgetChatOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [tokenId, setTokenId] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const initRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)

  // Keep ref in sync so transport body closure always has the latest sessionId
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  // Initialize session once
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function initSession() {
      try {
        const tokenRes = await fetch('/api/admin/tokens/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (!tokenRes.ok) return
        const { tokenId: tid } = await tokenRes.json()
        setTokenId(tid)

        const sessionRes = await fetch('/api/widget/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ anonId, tokenId: tid, sourceUrl }),
        })
        if (!sessionRes.ok) return
        const { session } = await sessionRes.json()
        setSessionId(session.id)
        sessionIdRef.current = session.id
        setSessionReady(true)
      } catch {
        // Silent — chat still works without persisted session
        setSessionReady(true)
      }
    }

    initSession()
  }, [token, anonId, sourceUrl])

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/widget/chat',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-anon-id': anonId,
      Origin: typeof window !== 'undefined' ? window.location.origin : '',
    },
    body: () => ({
      sessionId: sessionIdRef.current,
      sourceUrl,
    }),
  }), [token, anonId, sourceUrl])

  const chat = useChat({
    transport,
    onError: (err) => {
      console.error('[WidgetChat] Error:', err)
    },
  })

  return {
    messages: chat.messages,
    status: chat.status,
    sendMessage: chat.sendMessage,
    addToolResult: chat.addToolResult,
    stop: chat.stop,
    setMessages: chat.setMessages,
    sessionId,
    tokenId,
    sessionReady,
  }
}
