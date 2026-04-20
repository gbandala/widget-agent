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
  const sessionIdRef = useRef<string | null>(null)

  // Keep ref in sync so transport body closure always has the latest sessionId
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  // In embed mode, sourceUrl is the parent page URL (not window.location).
  // We derive the origin from it and send as x-source-origin on every request
  // so token validation works regardless of whether the browser sends Origin.
  const sourceOrigin = useMemo(() => {
    try { return sourceUrl ? new URL(sourceUrl).origin : '' } catch { return '' }
  }, [sourceUrl])

  // Initialize session. Uses cancellation flag so React Strict Mode double-invoke
  // (mount → unmount → remount) doesn't leave a stale init from the first mount.
  useEffect(() => {
    let cancelled = false

    async function initSession() {
      try {
        const tokenRes = await fetch('/api/admin/tokens/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-source-origin': sourceOrigin,
          },
          body: JSON.stringify({ token }),
        })
        if (cancelled || !tokenRes.ok) {
          if (!cancelled) setSessionReady(true) // allow chat even without session
          return
        }
        const { tokenId: tid } = await tokenRes.json()
        if (cancelled) return
        setTokenId(tid)

        const sessionRes = await fetch('/api/widget/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-source-origin': sourceOrigin,
          },
          body: JSON.stringify({ anonId, tokenId: tid, sourceUrl }),
        })
        if (cancelled) return
        if (!sessionRes.ok) { setSessionReady(true); return }
        const { session } = await sessionRes.json()
        if (cancelled) return
        setSessionId(session.id)
        sessionIdRef.current = session.id
        setSessionReady(true)
      } catch {
        if (!cancelled) setSessionReady(true)
      }
    }

    initSession()
    return () => { cancelled = true }
  }, [token, anonId, sourceUrl, sourceOrigin])

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/widget/chat',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-anon-id': anonId,
      'x-source-origin': sourceOrigin,
    },
    body: () => ({
      sessionId: sessionIdRef.current,
      sourceUrl,
    }),
  }), [token, anonId, sourceOrigin, sourceUrl])

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
