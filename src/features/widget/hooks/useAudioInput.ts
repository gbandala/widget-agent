'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type AudioState = 'idle' | 'recording' | 'error'

interface UseAudioInputOptions {
  onTranscription: (text: string) => void
  onError?: (message: string) => void
}

// Extend Window type for cross-browser SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

export function useAudioInput({ onTranscription, onError }: UseAudioInputOptions) {
  const [state, setState] = useState<AudioState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const startRecording = useCallback(() => {
    if (!isSupported) {
      const msg = 'Tu navegador no soporta entrada de voz. Usa Chrome o Edge.'
      setErrorMessage(msg)
      onError?.(msg)
      setState('error')
      setTimeout(() => { setState('idle'); setErrorMessage(null) }, 3000)
      return
    }

    setErrorMessage(null)
    const SpeechRecognitionAPI = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'es-MX'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onstart = () => setState('recording')

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) onTranscription(transcript)
    }

    recognition.onerror = (event) => {
      const msg = event.error === 'not-allowed'
        ? 'Permiso de micrófono denegado. Actívalo en tu navegador.'
        : event.error === 'no-speech'
          ? 'No se detectó voz. Intenta de nuevo.'
          : 'Error al procesar el audio.'
      setErrorMessage(msg)
      onError?.(msg)
      setState('error')
      setTimeout(() => { setState('idle'); setErrorMessage(null) }, 3000)
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        setState('idle')
      }
    }

    recognition.start()
  }, [isSupported, onTranscription, onError])

  const toggleRecording = useCallback(() => {
    if (state === 'recording') {
      stopRecording()
    } else if (state === 'idle') {
      startRecording()
    }
  }, [state, startRecording, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.abort() }
  }, [])

  return {
    state,
    errorMessage,
    isSupported,
    isRecording: state === 'recording',
    toggleRecording,
    startRecording,
    stopRecording,
  }
}
