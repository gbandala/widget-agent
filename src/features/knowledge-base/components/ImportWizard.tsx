'use client'

import { useState, useRef, useCallback } from 'react'
import { SUGGESTED_CATEGORIES } from '../types'
import type { ProposedEntry } from '@/app/api/admin/kb/structure/route'

type Step = 'upload' | 'processing' | 'review'

interface TokenOption {
  id: string
  label: string
}

interface ImportWizardProps {
  existingCategories: string[]
  tokens?: TokenOption[]
  onImported: (count: number) => void
  onClose: () => void
}

const ACCEPTED = '.pdf,.pptx,.ppt,.docx,.txt,.xlsx,.xls'
const PROCESSING_MESSAGES = [
  'Extrayendo texto del archivo...',
  'Analizando estructura del contenido...',
  'Sugiriendo categorías y etiquetas...',
  'Preparando entradas para revisión...',
]

function CategoryCombobox({
  value,
  onChange,
  existingCategories,
  id,
}: {
  value: string
  onChange: (v: string) => void
  existingCategories: string[]
  id: string
}) {
  const suggestions = [
    ...SUGGESTED_CATEGORIES,
    ...existingCategories
      .filter(c => !SUGGESTED_CATEGORIES.find(s => s.value === c))
      .map(c => ({ value: c, label: c })),
  ]
  return (
    <>
      <input
        list={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1 text-xs text-gray-900 bg-white"
        placeholder="Categoría..."
      />
      <datalist id={id}>
        {suggestions.map(c => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </datalist>
    </>
  )
}

function EntryCard({
  entry,
  selected,
  onToggle,
  onChange,
  existingCategories,
  index,
}: {
  entry: ProposedEntry
  selected: boolean
  onToggle: () => void
  onChange: (updated: ProposedEntry) => void
  existingCategories: string[]
  index: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry)

  const categoryLabel =
    SUGGESTED_CATEGORIES.find(c => c.value === draft.category)?.label ?? draft.category

  const saveEdit = () => {
    onChange(draft)
    setEditing(false)
  }

  const cancelEdit = () => {
    setDraft(entry)
    setEditing(false)
  }

  return (
    <div className={`border rounded-xl p-4 bg-white transition-opacity ${!selected ? 'opacity-40' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-gray-300 accent-blue-600"
        />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm font-semibold text-gray-900 bg-white"
                placeholder="Título..."
              />
              <textarea
                value={draft.content}
                onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                rows={4}
                className="w-full border rounded px-2 py-1 text-sm text-gray-900 bg-white resize-y"
                placeholder="Contenido..."
              />
              <div className="grid grid-cols-2 gap-2">
                <CategoryCombobox
                  id={`cat-${index}`}
                  value={draft.category}
                  onChange={v => setDraft(d => ({ ...d, category: v }))}
                  existingCategories={existingCategories}
                />
                <input
                  value={draft.tags.join(', ')}
                  onChange={e => setDraft(d => ({
                    ...d,
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                  }))}
                  className="w-full border rounded px-2 py-1 text-xs text-gray-900 bg-white"
                  placeholder="Tags separados por coma..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={cancelEdit} className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={saveEdit} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                  {categoryLabel}
                </span>
                {entry.isNew && (
                  <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded">
                    Nueva categoría
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-sm text-gray-900 mb-1">{draft.title}</h4>
              <p className="text-xs text-gray-600 line-clamp-3">{draft.content}</p>
              {draft.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {draft.tags.map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setEditing(true)}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Editar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ImportWizard({ existingCategories, tokens = [], onImported, onClose }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [processingMsg, setProcessingMsg] = useState(PROCESSING_MESSAGES[0])
  const [entries, setEntries] = useState<ProposedEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importTokenId, setImportTokenId] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const msgInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setError(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const startProcessing = async () => {
    if (!file) return
    setStep('processing')
    setError(null)

    let msgIdx = 0
    msgInterval.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROCESSING_MESSAGES.length
      setProcessingMsg(PROCESSING_MESSAGES[msgIdx])
    }, 1800)

    try {
      // Step 1: parse file
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/admin/kb/parse-file', { method: 'POST', body: fd })
      const parseData = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseData.error ?? 'Error al parsear el archivo')

      // Step 2: structure with AI
      const structRes = await fetch('/api/admin/kb/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: parseData.rawText,
          existingCategories,
        }),
      })
      const structData = await structRes.json()
      if (!structRes.ok) throw new Error(structData.error ?? 'Error al estructurar el contenido')

      const proposed: ProposedEntry[] = structData.entries ?? []
      setEntries(proposed)
      setSelected(new Set(proposed.map(e => e.tempId)))
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setStep('upload')
    } finally {
      if (msgInterval.current) clearInterval(msgInterval.current)
    }
  }

  const updateEntry = (tempId: string, updated: ProposedEntry) => {
    setEntries(prev => prev.map(e => e.tempId === tempId ? updated : e))
  }

  const toggleAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(entries.map(e => e.tempId)))
    }
  }

  const handleImport = async () => {
    const toImport = entries.filter(e => selected.has(e.tempId))
    if (toImport.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/admin/kb/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: importTokenId || null,
          entries: toImport.map(e => ({
            title: e.title,
            content: e.content,
            category: e.category,
            tags: e.tags,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al importar')
      onImported(data.imported)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  // Collect all categories for combobox suggestions
  const allCategories = [
    ...existingCategories,
    ...entries.map(e => e.category).filter(c => !existingCategories.includes(c)),
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Importar desde archivo</h2>
          <p className="text-sm text-gray-500">Soporta PDF, PPTX, PPT, DOCX, TXT y XLSX — máx. 5 MB</p>
        </div>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
          ✕ Cancelar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="underline ml-2">Cerrar</button>
        </div>
      )}

      {/* Step 1 — Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div className="text-4xl mb-3">📄</div>
            {file ? (
              <>
                <p className="font-semibold text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                <p className="text-xs text-blue-600 mt-2">Haz clic para cambiar el archivo</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-gray-700">Arrastra tu archivo aquí</p>
                <p className="text-sm text-gray-400 mt-1">o haz clic para seleccionar</p>
                <p className="text-xs text-gray-400 mt-2">PDF · PPTX · PPT · DOCX · TXT · XLSX</p>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={startProcessing}
              disabled={!file}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700"
            >
              Analizar con IA →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Processing */}
      {step === 'processing' && (
        <div className="py-20 text-center space-y-4">
          <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-600">{processingMsg}</p>
          <p className="text-xs text-gray-400">{file?.name}</p>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className="text-xs text-blue-600 hover:underline"
              >
                {selected.size === entries.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              <span className="text-sm text-gray-500">
                {selected.size} de {entries.length} seleccionadas
              </span>
            </div>
            <button
              onClick={() => { setStep('upload'); setEntries([]); setSelected(new Set()) }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← Cargar otro archivo
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {entries.map((entry, i) => (
              <EntryCard
                key={entry.tempId}
                entry={entry}
                selected={selected.has(entry.tempId)}
                onToggle={() => setSelected(prev => {
                  const next = new Set(prev)
                  next.has(entry.tempId) ? next.delete(entry.tempId) : next.add(entry.tempId)
                  return next
                })}
                onChange={updated => updateEntry(entry.tempId, updated)}
                existingCategories={allCategories}
                index={i}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t">
            <div className="flex items-center gap-3">
              {tokens.length > 0 && (
                <select
                  value={importTokenId}
                  onChange={e => setImportTokenId(e.target.value)}
                  className="text-sm border rounded-lg px-3 py-2 text-gray-700 bg-white"
                >
                  <option value="">Global (todos los tokens)</option>
                  {tokens.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              )}
              {selected.size === 0 && (
                <p className="text-sm text-gray-500">Selecciona al menos una entrada</p>
              )}
            </div>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-green-700"
            >
              {importing ? 'Importando...' : `Importar ${selected.size} entrada${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
