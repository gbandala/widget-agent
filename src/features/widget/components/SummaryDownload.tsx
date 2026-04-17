'use client'

import { useState } from 'react'

interface SummaryDownloadProps {
  sessionId: string
  token: string
  botName?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export function SummaryDownload({ sessionId, token, botName = 'Asistente' }: SummaryDownloadProps) {
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      // 1. Generar resumen si no existe
      setGenerating(true)
      await fetch('/api/widget/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      })
      setGenerating(false)

      // 2. Obtener resumen y mensajes
      const res = await fetch(`/api/widget/summary?sessionId=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const { summary, messages } = await res.json() as {
        summary: string | null
        messages: Message[]
      }

      // 3. Generar HTML para imprimir como PDF
      const date = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric',
      })

      const cleanSummary = summary
        ? summary
            .replace(/#{1,6}\s*/g, '')       // quitar # ## ###
            .replace(/\*\*(.*?)\*\*/g, '$1') // quitar **negrita**
            .replace(/\*(.*?)\*/g, '$1')     // quitar *cursiva*
            .replace(/^\s*[-*]\s+/gm, '• ')  // convertir listas a bullets simples
            .trim()
        : ''

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Resumen de Consulta — ${date}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 680px; margin: 48px auto; color: #1a1a1a; line-height: 1.7; }
    h1 { color: #2563eb; font-size: 1.4rem; margin-bottom: 4px; }
    .meta { color: #6b7280; font-size: 0.85rem; margin-bottom: 32px; }
    .content { font-size: 0.95rem; color: #374151; white-space: pre-wrap; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; }
    @media print { body { margin: 24px; } }
  </style>
</head>
<body>
  <h1>Resumen de tu Consulta</h1>
  <p class="meta">Generado el ${date} · ${escapeHtml(botName)}</p>

  ${cleanSummary ? `<div class="content">${escapeHtml(cleanSummary)}</div>` : '<p style="color:#6b7280">No se generó resumen para esta sesión.</p>'}

  <div class="footer">
    Este documento es un resumen de tu consulta con nuestro asistente virtual.
    Para más información, contáctanos directamente.
  </div>
</body>
</html>`

      // 4. Abrir en nueva ventana para imprimir/guardar como PDF
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        setTimeout(() => win.print(), 500)
      }
    } catch (err) {
      console.error('Error generando resumen:', err)
      alert('No se pudo generar el resumen. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
      setGenerating(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="w-full text-xs py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
    >
      {loading ? (
        <>
          <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
          {generating ? 'Generando resumen...' : 'Preparando descarga...'}
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Descargar resumen de consulta
        </>
      )}
    </button>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
