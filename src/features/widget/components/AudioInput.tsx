'use client'

import { useAudioInput } from '../hooks/useAudioInput'

interface AudioInputProps {
  onTranscription: (text: string) => void
  disabled?: boolean
}

export function AudioInput({ onTranscription, disabled }: AudioInputProps) {
  const { state, toggleRecording } = useAudioInput({ onTranscription })

  const isRecording = state === 'recording'
  const isProcessing = state === 'processing'

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={disabled || isProcessing}
      title={isRecording ? 'Detener grabación' : 'Grabar pregunta por voz'}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
        isRecording
          ? 'bg-red-500 text-white animate-pulse'
          : isProcessing
            ? 'bg-gray-100 text-gray-400'
            : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
      } disabled:opacity-50`}
      aria-label={isRecording ? 'Detener grabación' : 'Grabar pregunta por voz'}
    >
      {isProcessing ? (
        <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : isRecording ? (
        /* Stop icon */
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      ) : (
        /* Mic icon */
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )}
    </button>
  )
}
