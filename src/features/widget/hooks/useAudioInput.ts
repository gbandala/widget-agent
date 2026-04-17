'use client'

import { useState, useRef, useCallback } from 'react'

type AudioState = 'idle' | 'recording' | 'processing' | 'error'

interface UseAudioInputOptions {
  onTranscription: (text: string) => void
  onError?: (message: string) => void
}

export function useAudioInput({ onTranscription, onError }: UseAudioInputOptions) {
  const [state, setState] = useState<AudioState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    setErrorMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        // Detener tracks del micrófono
        stream.getTracks().forEach(t => t.stop())

        setState('processing')
        try {
          const blob = new Blob(chunksRef.current, {
            type: mediaRecorder.mimeType,
          })

          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')

          const res = await fetch('/api/widget/transcribe', {
            method: 'POST',
            body: formData,
          })
          const data = await res.json()

          if (data.error) {
            throw new Error(data.error)
          }
          if (data.text) {
            onTranscription(data.text)
          }
          setState('idle')
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error al procesar el audio'
          setErrorMessage(msg)
          onError?.(msg)
          setState('error')
          setTimeout(() => setState('idle'), 3000)
        }
      }

      mediaRecorder.start()
      setState('recording')
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado. Actívalo en tu navegador.'
          : err.message)
        : 'No se pudo acceder al micrófono'
      setErrorMessage(msg)
      onError?.(msg)
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [onTranscription, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (state === 'recording') {
      stopRecording()
    } else if (state === 'idle') {
      startRecording()
    }
  }, [state, startRecording, stopRecording])

  return {
    state,
    errorMessage,
    isRecording: state === 'recording',
    isProcessing: state === 'processing',
    toggleRecording,
    startRecording,
    stopRecording,
  }
}
