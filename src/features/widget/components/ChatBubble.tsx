'use client'

import type { UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
            // eslint-disable-next-line @next/next/no-img-element
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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline opacity-80 hover:opacity-100">{children}</a>,
              code: ({ children }) => <code className="bg-black/10 px-1 rounded text-xs font-mono">{children}</code>,
            }}
          >
            {text}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}
