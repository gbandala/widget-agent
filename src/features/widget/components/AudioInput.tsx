'use client'

import { useAudioInput } from '../hooks/useAudioInput'

interface AudioInputProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

export function AudioInput({ onTranscription, disabled }: AudioInputProps) {
  const { state, errorMessage, isSupported, toggleRecording } = useAudioInput({ onTranscription })

  if (!isSupported) return null

  const isRecording = state === 'recording'
  const isError = state === 'error'

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled || isError}
        title={isRecording ? 'Detener grabación' : 'Grabar pregunta por voz'}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
          isRecording
            ? 'bg-red-500 text-white animate-pulse'
            : isError
              ? 'bg-orange-100 text-orange-500'
              : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
        } disabled:opacity-50`}
        aria-label={isRecording ? 'Detener grabación' : 'Grabar pregunta por voz'}
      >
        {isRecording ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>
      {errorMessage && (
        <div className="absolute bottom-12 right-0 w-52 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg px-3 py-2 shadow-sm">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
