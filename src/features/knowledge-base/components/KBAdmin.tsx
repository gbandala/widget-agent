'use client'

import { useState, useEffect } from 'react'
import type { KBEntry } from '../types'
import { SUGGESTED_CATEGORIES } from '../types'
import { ImportWizard } from './ImportWizard'

interface PendingQuestion {
  id: string
  question: string
  source_url: string | null
  status: 'pending' | 'answered' | 'ignored'
  admin_notes: string | null
  created_at: string
}

interface KBStats {
  entryCount: number
  totalChars: number
}

function EntryForm({
  initial,
  onSave,
  onCancel,
  existingCategories = [],
}: {
  initial?: Partial<KBEntry>
  onSave: (data: Partial<KBEntry>) => void
  onCancel: () => void
  existingCategories?: string[]
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'service')
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))

  const categorySuggestions = [
    ...SUGGESTED_CATEGORIES,
    ...existingCategories
      .filter(c => !SUGGESTED_CATEGORIES.find(s => s.value === c))
      .map(c => ({ value: c, label: c })),
  ]
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
          className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
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
          className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
          placeholder="Descripción completa del servicio/capacidad/FAQ..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <input
            list="kb-category-suggestions"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
            placeholder="Ej: service, faq, ventas..."
          />
          <datalist id="kb-category-suggestions">
            {categorySuggestions.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags (separados por coma)</label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
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

function StorageStats({ stats }: { stats: KBStats }) {
  const vectorBytes = stats.entryCount * 1536 * 4 // float32
  const textBytes = stats.totalChars * 2 // ~2 bytes per char UTF-8 average
  const totalKB = Math.round((vectorBytes + textBytes) / 1024)
  const SUPABASE_FREE_MB = 500

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
        <p className="text-xs text-blue-600 font-medium mb-0.5">Entradas KB</p>
        <p className="text-2xl font-bold text-blue-700">{stats.entryCount}</p>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <p className="text-xs text-gray-500 font-medium mb-0.5">Espacio estimado</p>
        <p className="text-2xl font-bold text-gray-700">
          {totalKB < 1024 ? `${totalKB} KB` : `${(totalKB / 1024).toFixed(1)} MB`}
        </p>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <p className="text-xs text-gray-500 font-medium mb-0.5">Límite free tier</p>
        <p className="text-2xl font-bold text-gray-700">{SUPABASE_FREE_MB} MB</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {((totalKB / 1024 / SUPABASE_FREE_MB) * 100).toFixed(2)}% usado
        </p>
      </div>
    </div>
  )
}

function PendingTab() {
  const [questions, setQuestions] = useState<PendingQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [answerMap, setAnswerMap] = useState<Record<string, string>>({})
  const [working, setWorking] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/kb-pending')
    const { questions: q } = await res.json()
    setQuestions(q ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const pending = questions.filter(q => q.status === 'pending')
  const resolved = questions.filter(q => q.status !== 'pending')

  const resolve = async (id: string, status: 'answered' | 'ignored', notes?: string) => {
    setWorking(id)
    await fetch('/api/admin/kb-pending', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, admin_notes: notes }),
    })
    await load()
    setWorking(null)
  }

  const addToKB = async (q: PendingQuestion) => {
    const answer = answerMap[q.id]?.trim()
    if (!answer) return
    setWorking(q.id)

    await fetch('/api/admin/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: q.question.slice(0, 80),
        content: answer,
        category: 'faq',
        tags: [],
      }),
    })
    await resolve(q.id, 'answered', answer)
  }

  if (loading) return <div className="py-12 text-center text-gray-400">Cargando preguntas...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Preguntas sin respuesta
          {pending.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
              {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          El bot registró estas preguntas porque no encontró información en la KB ni en la landing. Respóndelas para que el bot las sepa en el futuro.
        </p>
      </div>

      {pending.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">Sin preguntas pendientes</p>
          <p className="text-sm">Cuando el bot no pueda responder algo, aparecerá aquí.</p>
        </div>
      )}

      <div className="space-y-3">
        {pending.map(q => (
          <div key={q.id} className="border rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="font-medium text-gray-900">{q.question}</p>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {new Date(q.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            {q.source_url && (
              <p className="text-xs text-gray-400 mb-3 truncate">Desde: {q.source_url}</p>
            )}
            <textarea
              rows={3}
              value={answerMap[q.id] ?? ''}
              onChange={e => setAnswerMap(prev => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Escribe la respuesta para agregar a la KB..."
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => resolve(q.id, 'ignored')}
                disabled={working === q.id}
                className="px-3 py-1.5 text-xs border rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Ignorar
              </button>
              <button
                onClick={() => addToKB(q)}
                disabled={!answerMap[q.id]?.trim() || working === q.id}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {working === q.id ? 'Guardando...' : 'Agregar a KB'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">
            {resolved.length} preguntas resueltas/ignoradas
          </summary>
          <div className="space-y-2 mt-3">
            {resolved.map(q => (
              <div key={q.id} className="border rounded-xl p-3 bg-gray-50 opacity-70">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${q.status === 'answered' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {q.status === 'answered' ? 'Respondida' : 'Ignorada'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(q.created_at).toLocaleDateString('es-MX')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{q.question}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

export function KBAdmin() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'kb' | 'pending' | 'import'>('kb')
  const [stats, setStats] = useState<KBStats>({ entryCount: 0, totalChars: 0 })
  const [pendingCount, setPendingCount] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/kb')
      const { entries: e } = await res.json()
      const list: KBEntry[] = e ?? []
      setEntries(list)
      setStats({
        entryCount: list.length,
        totalChars: list.reduce((acc, x) => acc + (x.content?.length ?? 0), 0),
      })
    } catch {
      setError('Error al cargar la KB')
    } finally {
      setLoading(false)
    }
  }

  const loadPendingCount = async () => {
    const res = await fetch('/api/admin/kb-pending')
    const { questions } = await res.json()
    setPendingCount((questions ?? []).filter((q: PendingQuestion) => q.status === 'pending').length)
  }

  useEffect(() => {
    load()
    loadPendingCount()
  }, [])

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Conocimiento</h1>
          <p className="text-sm text-gray-500 mt-1">{entries.length} entradas totales</p>
        </div>
        {tab === 'kb' && (
          <div className="flex gap-2">
            <button
              onClick={() => setTab('import')}
              className="px-4 py-2 border text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              ↑ Importar archivo
            </button>
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Nueva Entrada
            </button>
          </div>
        )}
      </div>

      {/* Storage stats */}
      <StorageStats stats={stats} />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('kb')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'kb' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Entradas KB
        </button>
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            tab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pendientes
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full leading-none">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('import')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Importar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* KB tab */}
      {tab === 'kb' && (
        <div className="space-y-3">
          {creating && (
            <EntryForm
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              existingCategories={[...new Set(entries.map(e => e.category))]}
            />
          )}

          {entries.map(entry => (
            <div key={entry.id} className={`border rounded-xl p-4 bg-white ${!entry.isActive ? 'opacity-50' : ''}`}>
              {editing === entry.id ? (
                <EntryForm
                  initial={entry}
                  onSave={data => handleUpdate(entry.id, data)}
                  onCancel={() => setEditing(null)}
                  existingCategories={[...new Set(entries.map(e => e.category))]}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                          {SUGGESTED_CATEGORIES.find(c => c.value === entry.category)?.label ?? entry.category}
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

          {entries.length === 0 && !creating && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-2">La KB está vacía</p>
              <p className="text-sm">Crea entradas para que el widget pueda responder preguntas</p>
            </div>
          )}
        </div>
      )}

      {/* Pending tab */}
      {tab === 'pending' && <PendingTab />}

      {/* Import tab */}
      {tab === 'import' && (
        <ImportWizard
          existingCategories={[...new Set(entries.map(e => e.category))]}
          onImported={(count) => {
            setTab('kb')
            load()
            setError(null)
            alert(`${count} entrada${count !== 1 ? 's' : ''} importada${count !== 1 ? 's' : ''} exitosamente`)
          }}
          onClose={() => setTab('kb')}
        />
      )}
    </div>
  )
}
