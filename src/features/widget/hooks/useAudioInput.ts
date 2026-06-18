'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type AudioState = 'idle' | 'recording' | 'transcribing' | 'error'

interface UseAudioInputOptions {
  onTranscription: (text: string) => void
  onError?: (message: string) => void
  transcribeUrl?: string
}

function getSupportedMimeType(): string {
  // iOS Safari only supports audio/mp4; Chrome prefers webm
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export function useAudioInput({
  onTranscription,
  onError,
  transcribeUrl = '/api/widget/transcribe',
}: UseAudioInputOptions) {
  const [state, setState] = useState<AudioState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const isSupported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const setError = useCallback((msg: string) => {
    setErrorMessage(msg)
    onError?.(msg)
    setState('error')
    setTimeout(() => { setState('idle'); setErrorMessage(null) }, 4000)
  }, [onError])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Tu navegador no soporta grabación de audio.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Liberar micrófono
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        chunksRef.current = []

        if (blob.size < 1000) {
          setError('Audio muy corto. Mantén presionado y habla.')
          return
        }

        setState('transcribing')

        try {
          const formData = new FormData()
          // Extensión según mimeType para que Whisper la acepte
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
          formData.append('audio', blob, `recording.${ext}`)

          const res = await fetch(transcribeUrl, { method: 'POST', body: formData })
          const data = await res.json()

          if (data.error) {
            setError(data.error)
          } else if (data.text) {
            onTranscription(data.text)
            setState('idle')
          } else {
            setError('No se detectó voz. Intenta de nuevo.')
          }
        } catch {
          setError('No se pudo transcribir. Verifica tu conexión.')
        }
      }

      recorder.start()
      setState('recording')
    } catch (err: unknown) {
      const isDenied = err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      setError(isDenied
        ? 'Permiso de micrófono denegado. Actívalo en tu navegador.'
        : 'No se pudo acceder al micrófono.')
    }
  }, [isSupported, onTranscription, transcribeUrl, setError])

  const toggleRecording = useCallback(() => {
    if (state === 'recording') stopRecording()
    else if (state === 'idle') startRecording()
  }, [state, startRecording, stopRecording])

  // Cleanup: liberar micrófono si el componente se desmonta mientras graba
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return {
    state,
    errorMessage,
    isSupported,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
    toggleRecording,
    startRecording,
    stopRecording,
  }
}
