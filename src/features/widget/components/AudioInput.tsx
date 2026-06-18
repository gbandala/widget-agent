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
  const isTranscribing = state === 'transcribing'
  const isError = state === 'error'
  const isBusy = isRecording || isTranscribing

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled || isError || isTranscribing}
        title={isRecording ? 'Detener grabación' : isTranscribing ? 'Transcribiendo…' : 'Grabar pregunta por voz'}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
          isRecording
            ? 'bg-red-500 text-white animate-pulse'
            : isTranscribing
              ? 'bg-blue-100 text-blue-500'
              : isError
                ? 'bg-orange-100 text-orange-500'
                : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
        } disabled:opacity-50`}
        aria-label={isRecording ? 'Detener grabación' : 'Grabar pregunta por voz'}
      >
        {isTranscribing ? (
          // Spinner mientras Whisper procesa
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : isBusy ? (
          // Stop icon mientras graba
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          // Mic icon en idle/error
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>
      {errorMessage && (
        <div className="absolute bottom-12 right-0 w-60 max-w-[80vw] bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg px-3 py-2 shadow-sm z-10 whitespace-normal">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
