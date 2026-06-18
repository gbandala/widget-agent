import { NextRequest, NextResponse } from 'next/server'

const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']

/** POST /api/widget/transcribe — Transcribe audio a texto usando Whisper */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('audio') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Archivo de audio requerido' }, { status: 400 })
    }

    // Validar tipo MIME (browser puede añadir codecs: audio/webm;codecs=opus)
    if (!ALLOWED_AUDIO_TYPES.some(t => file.type.startsWith(t))) {
      return NextResponse.json(
        { error: 'Formato de audio no soportado. Usa webm, mp4, ogg, wav o mp3.' },
        { status: 400 }
      )
    }

    // Validar tamaño
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'El audio es demasiado largo. Máximo 10 MB.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
    }

    // Enviar a Groq Whisper (soporta multipart/form-data, rápido, OpenAI-compatible)
    const whisperFormData = new FormData()
    whisperFormData.append('file', file)
    whisperFormData.append('model', process.env.WHISPER_MODEL ?? 'whisper-large-v3')
    whisperFormData.append('language', 'es')
    whisperFormData.append('response_format', 'json')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[Transcribe] Whisper error:', err)
      return NextResponse.json(
        { error: 'No se pudo transcribir el audio. Por favor escribe tu pregunta.' },
        { status: 200 } // 200 para manejo cordial en frontend
      )
    }

    const { text } = await response.json()
    return NextResponse.json({ text: text?.trim() ?? '' })
  } catch (err) {
    console.error('[Transcribe] Error:', err)
    return NextResponse.json(
      { error: 'Error al procesar el audio. Por favor escribe tu pregunta.' },
      { status: 200 }
    )
  }
}
