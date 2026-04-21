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
  agent_language: string
  agent_tone: string
  agent_instructions: string | null
  agent_scope: string | null
  agent_use_emojis: boolean
  welcome_message: string | null
  created_at: string
}

type CreateForm = {
  label: string
  allowed_origin: string
  bot_name: string
  agent_language: string
  agent_tone: string
  agent_instructions: string
  agent_scope: string
  agent_use_emojis: boolean
  welcome_message: string
}

const TONE_OPTIONS = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'amigable', label: 'Amigable' },
  { value: 'casual', label: 'Casual' },
  { value: 'tecnico', label: 'Técnico' },
]

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
]

const BLANK_FORM: CreateForm = {
  label: '',
  allowed_origin: '',
  bot_name: 'Asistente',
  agent_language: 'es',
  agent_tone: 'profesional',
  agent_instructions: '',
  agent_scope: '',
  agent_use_emojis: true,
  welcome_message: '',
}

export function WidgetTokenManager() {
  const [tokens, setTokens] = useState<WidgetToken[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateForm>(BLANK_FORM)
  const [editForm, setEditForm] = useState<Partial<WidgetToken>>({})
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
      body: JSON.stringify({
        ...form,
        agent_instructions: form.agent_instructions || null,
        agent_scope: form.agent_scope || null,
        welcome_message: form.welcome_message || null,
        agent_use_emojis: form.agent_use_emojis,
      }),
    })
    setSaving(false)
    setCreating(false)
    setForm(BLANK_FORM)
    load()
  }

  const handleEdit = (token: WidgetToken) => {
    setEditingId(token.id)
    setEditForm({
      label: token.label,
      bot_name: token.bot_name,
      bot_avatar_url: token.bot_avatar_url,
      agent_language: token.agent_language ?? 'es',
      agent_tone: token.agent_tone ?? 'profesional',
      agent_instructions: token.agent_instructions ?? '',
      agent_scope: token.agent_scope ?? '',
      agent_use_emojis: token.agent_use_emojis ?? true,
      welcome_message: token.welcome_message ?? '',
    })
  }

  const handleSaveEdit = async (id: string) => {
    setSaving(true)
    await fetch('/api/admin/tokens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        ...editForm,
        agent_instructions: (editForm.agent_instructions as string) || null,
        agent_scope: (editForm.agent_scope as string) || null,
        agent_use_emojis: editForm.agent_use_emojis ?? true,
        welcome_message: (editForm.welcome_message as string) || null,
      }),
    })
    setSaving(false)
    setEditingId(null)
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
        <form onSubmit={handleCreate} className="border rounded-xl p-5 bg-white space-y-4">
          <h2 className="font-semibold text-gray-800">Nuevo Token de Landing</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta *</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Idioma</label>
              <select value={form.agent_language} onChange={e => setForm(p => ({ ...p, agent_language: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2">
                {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tono</label>
              <select value={form.agent_tone} onChange={e => setForm(p => ({ ...p, agent_tone: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2">
                {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.agent_use_emojis}
              onChange={e => setForm(p => ({ ...p, agent_use_emojis: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Permitir emojis en respuestas</span>
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Misión e instrucciones del agente
              <span className="text-gray-400 font-normal ml-1">(opcional — si se omite usa instrucciones genéricas)</span>
            </label>
            <textarea rows={4} value={form.agent_instructions} onChange={e => setForm(p => ({ ...p, agent_instructions: e.target.value }))}
              className="w-full text-sm border rounded-lg px-3 py-2 font-mono"
              placeholder={`- Responder preguntas sobre los productos de la empresa\n- Capturar contacto cuando el visitante muestre interés\n- Agendar citas de demostración`} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Scope — temas permitidos
              <span className="text-gray-400 font-normal ml-1">(opcional)</span>
            </label>
            <textarea rows={2} value={form.agent_scope} onChange={e => setForm(p => ({ ...p, agent_scope: e.target.value }))}
              className="w-full text-sm border rounded-lg px-3 py-2"
              placeholder="Solo responde preguntas sobre los productos y servicios de la empresa. Si la pregunta es ajena, declina cordialmente." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mensaje de bienvenida
              <span className="text-gray-400 font-normal ml-1">(opcional)</span>
            </label>
            <input value={form.welcome_message} onChange={e => setForm(p => ({ ...p, welcome_message: e.target.value }))}
              className="w-full text-sm border rounded-lg px-3 py-2"
              placeholder="¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?" />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setCreating(false); setForm(BLANK_FORM) }}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Creando...' : 'Crear Token'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {tokens.map(token => (
          <div key={token.id} className={`border rounded-xl bg-white ${!token.is_active ? 'opacity-60' : ''}`}>
            {editingId === token.id ? (
              <div className="p-5 space-y-4">
                <h3 className="font-semibold text-gray-800">Editar token — {token.label}</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta</label>
                    <input value={editForm.label ?? ''} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                      className="w-full text-sm border rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del Bot</label>
                    <input value={editForm.bot_name ?? ''} onChange={e => setEditForm(p => ({ ...p, bot_name: e.target.value }))}
                      className="w-full text-sm border rounded-lg px-3 py-2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL del Avatar</label>
                  <input value={editForm.bot_avatar_url ?? ''} onChange={e => setEditForm(p => ({ ...p, bot_avatar_url: e.target.value || null }))}
                    className="w-full text-sm border rounded-lg px-3 py-2" placeholder="https://..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Idioma</label>
                    <select value={editForm.agent_language ?? 'es'} onChange={e => setEditForm(p => ({ ...p, agent_language: e.target.value }))}
                      className="w-full text-sm border rounded-lg px-3 py-2">
                      {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tono</label>
                    <select value={editForm.agent_tone ?? 'profesional'} onChange={e => setEditForm(p => ({ ...p, agent_tone: e.target.value }))}
                      className="w-full text-sm border rounded-lg px-3 py-2">
                      {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={(editForm.agent_use_emojis as boolean) ?? true}
                    onChange={e => setEditForm(p => ({ ...p, agent_use_emojis: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-gray-700">Permitir emojis en respuestas</span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Misión e instrucciones</label>
                  <textarea rows={5} value={(editForm.agent_instructions as string) ?? ''} onChange={e => setEditForm(p => ({ ...p, agent_instructions: e.target.value }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 font-mono" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Scope — temas permitidos</label>
                  <textarea rows={2} value={(editForm.agent_scope as string) ?? ''} onChange={e => setEditForm(p => ({ ...p, agent_scope: e.target.value }))}
                    className="w-full text-sm border rounded-lg px-3 py-2" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje de bienvenida</label>
                  <input value={(editForm.welcome_message as string) ?? ''} onChange={e => setEditForm(p => ({ ...p, welcome_message: e.target.value }))}
                    className="w-full text-sm border rounded-lg px-3 py-2" />
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button onClick={() => handleSaveEdit(token.id)} disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${token.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-semibold text-gray-900">{token.label}</span>
                      <span className="text-xs text-gray-400">Bot: {token.bot_name}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{token.agent_language ?? 'es'} · {token.agent_tone ?? 'profesional'}</span>
                    </div>
                    <p className="text-sm text-gray-500">{token.allowed_origin}</p>
                    {token.agent_instructions && (
                      <p className="text-xs text-gray-400 mt-1 truncate max-w-lg">{token.agent_instructions.slice(0, 100)}{token.agent_instructions.length > 100 ? '…' : ''}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 truncate max-w-[200px]">
                        {token.token}
                      </code>
                      <button onClick={() => handleCopy(token.token)} className="text-xs text-blue-600 hover:underline">
                        {copied === token.token ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEdit(token)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggle(token.id, !token.is_active)}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${token.is_active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                    >
                      {token.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {tokens.length === 0 && !creating && (
          <p className="text-center text-gray-400 py-8">No hay tokens configurados</p>
        )}
      </div>
    </div>
  )
}
