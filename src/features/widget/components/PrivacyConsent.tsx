'use client'

import { useState, FormEvent } from 'react'
import type { LeadData } from '../types'

interface PrivacyConsentProps {
  message?: string
  onSubmit: (data: LeadData) => Promise<void>
  onCancel: () => void
}

export function PrivacyConsent({ message, onSubmit, onCancel }: PrivacyConsentProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!accepted) {
      setError('Debes aceptar el aviso de privacidad para continuar')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ name, email, company, phone, privacyAccepted: true })
    } catch {
      setError('Error al guardar tus datos. Por favor intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50 p-4 space-y-3">
      {message && (
        <p className="text-sm text-gray-700">{message}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Empresa</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
            placeholder="correo@empresa.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white"
            placeholder="+52 55 0000 0000 (opcional)"
          />
        </div>

        {/* Aviso de privacidad */}
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-700">Aviso de Privacidad</strong><br />
            Tus datos personales serán tratados por nuestra empresa como responsable.
            <strong> Finalidad</strong>: contactarte sobre servicios de consultoría tecnológica.
            <strong> Derechos ARCO</strong>: puedes acceder, rectificar, cancelar u oponerte al tratamiento
            escribiendo a <span className="text-blue-600">privacidad@empresa.com</span>.
            Tus datos se cifran en reposo y no se comparten con terceros sin tu consentimiento.
            Plazo de conservación: 2 años o hasta que solicites su eliminación.
          </p>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-xs text-gray-600">
            He leído y acepto el aviso de privacidad y el tratamiento de mis datos personales
          </span>
        </label>

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-sm py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !accepted}
            className="flex-1 text-sm py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {saving ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}
