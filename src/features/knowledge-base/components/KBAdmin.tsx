'use client'

import { useState, useEffect } from 'react'
import type { KBEntry, KBCategory } from '../types'

const CATEGORIES: { value: KBCategory; label: string }[] = [
  { value: 'service', label: 'Servicio' },
  { value: 'project_case', label: 'Caso de Proyecto' },
  { value: 'capability', label: 'Capacidad' },
  { value: 'faq', label: 'FAQ' },
  { value: 'pricing', label: 'Precios' },
]

function EntryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<KBEntry>
  onSave: (data: Partial<KBEntry>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [category, setCategory] = useState<KBCategory>(initial?.category ?? 'service')
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      title,
      content,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white border rounded-xl shadow-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Ej: Servicio de Desarrollo Web"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          required
          rows={5}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Descripción completa del servicio/capacidad/FAQ..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as KBCategory)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags (separados por coma)</label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="web, react, saas"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

export function KBAdmin() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/kb')
      const { entries } = await res.json()
      setEntries(entries ?? [])
    } catch {
      setError('Error al cargar la KB')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (data: Partial<KBEntry>) => {
    const res = await fetch('/api/admin/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      setCreating(false)
      load()
    } else {
      setError('Error al crear entrada')
    }
  }

  const handleUpdate = async (id: string, data: Partial<KBEntry>) => {
    const res = await fetch('/api/admin/kb', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })
    if (res.ok) {
      setEditing(null)
      load()
    } else {
      setError('Error al actualizar entrada')
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch('/api/admin/kb', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive }),
    })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada permanentemente?')) return
    await fetch(`/api/admin/kb?id=${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Cargando base de conocimiento...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Conocimiento</h1>
          <p className="text-sm text-gray-500 mt-1">{entries.length} entradas totales</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nueva Entrada
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {creating && (
        <EntryForm
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="space-y-3">
        {entries.map(entry => (
          <div key={entry.id} className={`border rounded-xl p-4 bg-white ${!entry.isActive ? 'opacity-50' : ''}`}>
            {editing === entry.id ? (
              <EntryForm
                initial={entry}
                onSave={data => handleUpdate(entry.id, data)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                        {CATEGORIES.find(c => c.value === entry.category)?.label ?? entry.category}
                      </span>
                      {!entry.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Inactiva</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900">{entry.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{entry.content}</p>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.tags.map(tag => (
                          <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(entry.id, !entry.isActive)}
                      className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50"
                    >
                      {entry.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => setEditing(entry.id)}
                      className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {entries.length === 0 && !creating && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">La KB está vacía</p>
          <p className="text-sm">Crea entradas para que el widget pueda responder preguntas</p>
        </div>
      )}
    </div>
  )
}
