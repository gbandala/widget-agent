'use client'

import { useState, useEffect } from 'react'

interface WidgetToken {
  id: string
  token: string
  label: string
  allowed_origin: string
  is_active: boolean
  bot_name: string
  bot_avatar_url: string | null
  created_at: string
}

export function WidgetTokenManager() {
  const [tokens, setTokens] = useState<WidgetToken[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ label: '', allowed_origin: '', bot_name: 'Asistente' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/tokens')
    const { tokens } = await res.json()
    setTokens(tokens ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/admin/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setCreating(false)
    setForm({ label: '', allowed_origin: '', bot_name: 'Asistente' })
    load()
  }

  const handleToggle = async (id: string, is_active: boolean) => {
    await fetch('/api/admin/tokens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active }),
    })
    load()
  }

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando tokens...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tokens de Widget</h1>
          <p className="text-sm text-gray-500 mt-1">Un token por landing autorizada</p>
        </div>
        <button onClick={() => setCreating(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Nuevo Token
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="border rounded-xl p-4 bg-white space-y-3">
          <h2 className="font-semibold text-gray-800">Nuevo Token de Landing</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta</label>
              <input required value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2" placeholder="Landing principal" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del Bot</label>
              <input value={form.bot_name} onChange={e => setForm(p => ({ ...p, bot_name: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2" placeholder="Asistente" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL Autorizada *</label>
            <input required type="url" value={form.allowed_origin} onChange={e => setForm(p => ({ ...p, allowed_origin: e.target.value }))}
              className="w-full text-sm border rounded-lg px-3 py-2" placeholder="https://miempresa.com" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Creando...' : 'Crear Token'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {tokens.map(token => (
          <div key={token.id} className={`border rounded-xl p-4 bg-white ${!token.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${token.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="font-semibold text-gray-900">{token.label}</span>
                  <span className="text-xs text-gray-400">Bot: {token.bot_name}</span>
                </div>
                <p className="text-sm text-gray-500">{token.allowed_origin}</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 truncate max-w-[200px]">
                    {token.token}
                  </code>
                  <button onClick={() => handleCopy(token.token)} className="text-xs text-blue-600 hover:underline">
                    {copied === token.token ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggle(token.id, !token.is_active)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${token.is_active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                >
                  {token.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {tokens.length === 0 && !creating && (
          <p className="text-center text-gray-400 py-8">No hay tokens configurados</p>
        )}
      </div>
    </div>
  )
}
