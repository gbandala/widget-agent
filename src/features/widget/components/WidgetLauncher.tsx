'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import type { UIMessage } from 'ai'
import { useWidgetChat } from '../hooks/useWidgetChat'
import { ChatBubble } from './ChatBubble'
import { PrivacyConsent } from './PrivacyConsent'
import { AppointmentPicker } from './AppointmentPicker'
import { AudioInput } from './AudioInput'
import { SummaryDownload } from './SummaryDownload'
import type { LeadData } from '../types'

interface WidgetLauncherProps {
  token: string
  botName?: string
  botAvatarUrl?: string
  primaryColor?: string
  welcomeMessage?: string
}

function generateAnonId(): string {
  const key = 'widget_anon_id'
  if (typeof sessionStorage === 'undefined') return crypto.randomUUID()
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

type PendingToolPart = { type: string; toolCallId: string; state: string }

// In AI SDK v6, tool parts have type `tool-{toolName}` and properties directly on the part.
// A "pending" tool call is one that has been called (input-available) but not yet resolved.
function findPendingTool(messages: UIMessage[], toolType: string): PendingToolPart | null {
  for (const msg of [...messages].reverse()) {
    for (const part of msg.parts ?? []) {
      if (part.type !== toolType) continue
      const p = part as PendingToolPart
      if (p.state === 'input-available' || p.state === 'input-streaming') {
        return p
      }
    }
  }
  return null
}

export function WidgetLauncher({
  token,
  botName = 'Asistente',
  botAvatarUrl,
  welcomeMessage = '¡Hola! Soy tu asistente de consultoría. ¿En qué puedo ayudarte hoy?',
}: WidgetLauncherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [anonId] = useState(() => generateAnonId())
  const [sourceUrl] = useState(() => typeof window !== 'undefined' ? window.location.href : '')
  const [leadData, setLeadData] = useState<{ id: string; name: string; email: string } | null>(null)
  const [dismissedToolCalls, setDismissedToolCalls] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, status, sendMessage, addToolResult, sessionId, sessionReady } = useWidgetChat({
    token,
    anonId,
    sourceUrl,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Detect pending tool calls (no-execute tools waiting for client confirmation)
  const pendingCaptureContact = findPendingTool(messages, 'tool-captureContact')
  const pendingBookAppointment = findPendingTool(messages, 'tool-bookAppointment')

  const showConsentForm =
    !!pendingCaptureContact &&
    !dismissedToolCalls.has(pendingCaptureContact.toolCallId) &&
    !leadData

  const showAppointmentForm =
    !!pendingBookAppointment &&
    !dismissedToolCalls.has(pendingBookAppointment.toolCallId) &&
    !!leadData &&
    !!sessionId

  const hasEnoughMessages = messages.filter(m => m.role === 'user').length >= 2

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showConsentForm, showAppointmentForm])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput('')
    sendMessage({ text })
  }

  const handleLeadSubmit = async (data: LeadData) => {
    if (!pendingCaptureContact) return
    const res = await fetch('/api/widget/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, sessionId }),
    })
    if (!res.ok) throw new Error('Error guardando lead')
    const { leadId } = await res.json()
    setLeadData({ id: leadId, name: data.name, email: data.email })
    addToolResult({
      tool: 'captureContact',
      toolCallId: pendingCaptureContact.toolCallId,
      output: { success: true, name: data.name, email: data.email, leadId },
    })
  }

  const handleConsentCancel = () => {
    if (!pendingCaptureContact) return
    dismissTool(pendingCaptureContact.toolCallId)
    addToolResult({
      tool: 'captureContact',
      toolCallId: pendingCaptureContact.toolCallId,
      output: { success: false, reason: 'user_declined' },
    })
  }

  const handleBooked = (meetLink: string, slotLabel: string) => {
    if (!pendingBookAppointment) return
    addToolResult({
      tool: 'bookAppointment',
      toolCallId: pendingBookAppointment.toolCallId,
      output: { success: true, meetLink, slotLabel },
    })
  }

  const handleAppointmentCancel = () => {
    if (!pendingBookAppointment) return
    dismissTool(pendingBookAppointment.toolCallId)
    addToolResult({
      tool: 'bookAppointment',
      toolCallId: pendingBookAppointment.toolCallId,
      output: { success: false, reason: 'user_cancelled' },
    })
  }

  const dismissTool = (toolCallId: string) => {
    setDismissedToolCalls(prev => new Set([...prev, toolCallId]))
  }

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col"
          style={{ height: '560px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                {botAvatarUrl ? (
                  <img src={botAvatarUrl} alt={botName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-bold">{botName[0]}</span>
                )}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{botName}</p>
                <p className="text-blue-100 text-xs">Consultoría · En línea</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors text-xl leading-none ml-2"
              aria-label="Cerrar chat"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{botName[0]}</span>
                </div>
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gray-100 text-gray-800 text-sm">
                  {welcomeMessage}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <ChatBubble
                key={msg.id}
                message={msg}
                botName={botName}
                botAvatarUrl={botAvatarUrl}
              />
            ))}

            {/* Inline tool UIs */}
            {showConsentForm && (
              <PrivacyConsent
                message="Para enviarte información personalizada y dar seguimiento, necesito algunos datos:"
                onSubmit={handleLeadSubmit}
                onCancel={handleConsentCancel}
              />
            )}

            {showAppointmentForm && sessionId && leadData && (
              <AppointmentPicker
                sessionId={sessionId}
                leadId={leadData.id}
                leadName={leadData.name}
                leadEmail={leadData.email}
                onBooked={handleBooked}
                onCancel={handleAppointmentCancel}
              />
            )}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{botName[0]}</span>
                </div>
                <div className="px-4 py-2.5 bg-gray-100 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Summary download (shown once there are enough messages) */}
          {sessionId && hasEnoughMessages && (
            <div className="px-3 pt-2 flex-shrink-0">
              <SummaryDownload sessionId={sessionId} botName={botName} />
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 flex-shrink-0">
            <div className="flex gap-2">
              <AudioInput
                onTranscription={(text) => {
                  setInput(text)
                }}
                disabled={isLoading || !sessionReady}
              />
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Escribe tu pregunta..."
                disabled={isLoading || !sessionReady}
                className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !sessionReady}
                className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition-colors flex-shrink-0"
                aria-label="Enviar"
              >
                <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Tus datos están protegidos · Impulsado por IA
            </p>
          </form>
        </div>
      )}

      {/* FAB Launcher Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center hover:scale-105 active:scale-95"
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat de consultoría'}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    </>
  )
}
