'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type AudioState = 'idle' | 'recording' | 'error'

interface UseAudioInputOptions {
  onTranscription: (text: string) => void
  onError?: (message: string) => void
}

// Minimal interfaces matching the Web Speech API subset we use
interface SpeechRecognitionResultEvent {
  results: { 0: { transcript: string } }[]
}
interface SpeechRecognitionErrEvent {
  error: string
}
interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: new () => SpeechRecognitionInstance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

export function useAudioInput({ onTranscription, onError }: UseAudioInputOptions) {
  const [state, setState] = useState<AudioState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

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
