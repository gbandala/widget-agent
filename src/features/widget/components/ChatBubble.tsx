'use client'

import type { UIMessage } from 'ai'

interface ChatBubbleProps {
  message: UIMessage
  botName: string
  botAvatarUrl?: string
}

export function ChatBubble({ message, botName, botAvatarUrl }: ChatBubbleProps) {
  const isUser = message.role === 'user'
  const text = message.parts?.find(p => p.type === 'text')?.text ?? ''

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
          {botAvatarUrl ? (
            <img src={botAvatarUrl} alt={botName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-xs font-bold">{botName[0]}</span>
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        }`}
      >
        {/* Tool invocations */}
        {message.parts?.map((part, i) => {
          if (part.type === 'tool-captureContact' && part.state === 'input-streaming') {
            return (
              <div key={i} className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs">
                Formulario de contacto disponible
              </div>
            )
          }
          return null
        })}

        {/* Text content */}
        {text && (
          <p className="whitespace-pre-wrap">{text}</p>
        )}
      </div>
    </div>
  )
}
