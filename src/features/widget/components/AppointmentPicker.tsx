'use client'

import { useState, useEffect } from 'react'
import type { AppointmentSlot } from '@/features/appointments/types'

interface AppointmentPickerProps {
  sessionId: string
  leadId: string
  leadName: string
  leadEmail: string
  onBooked: (meetLink: string, slotLabel: string) => void
  onCancel: () => void
}

export function AppointmentPicker({
  sessionId,
  leadId,
  leadName,
  leadEmail,
  onBooked,
  onCancel,
}: AppointmentPickerProps) {
  const [slots, setSlots] = useState<AppointmentSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [selected, setSelected] = useState<AppointmentSlot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })

  const loadSlots = async (targetDate: string) => {
    setLoading(true)
    setSelected(null)
    try {
      const res = await fetch(`/api/appointments?date=${targetDate}`)
      const { slots: newSlots } = await res.json()
      setSlots(newSlots ?? [])
    } catch {
      setError('No se pudo cargar la disponibilidad')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async load pattern, setState called after await
  useEffect(() => { loadSlots(date) }, [date])

  const handleBook = async () => {
    if (!selected) return
    setBooking(true)
    setError(null)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          leadId,
          slotStart: selected.start,
          slotEnd: selected.end,
          leadName,
          leadEmail,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) throw new Error('Error al crear la cita')
      const { meetLink } = await res.json()
      onBooked(meetLink, selected.label)
    } catch {
      setError('No se pudo agendar la cita. Por favor intenta de nuevo o contáctanos directamente.')
    } finally {
      setBooking(false)
    }
  }

  return (
    <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-gray-800">Selecciona una fecha y horario:</p>

      {/* Date picker */}
      <input
        type="date"
        value={date}
        min={new Date().toISOString().split('T')[0]}
        onChange={e => setDate(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
      />

      {/* Slots */}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-2">Verificando disponibilidad...</p>
      ) : slots.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">
          No hay horarios disponibles para esta fecha. Prueba con otra fecha.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {slots.map(slot => (
            <button
              key={slot.start}
              onClick={() => setSelected(slot)}
              className={`text-xs px-2 py-2 rounded-lg border transition-colors text-left ${
                selected?.start === slot.start
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white border-gray-200 hover:border-green-400 text-gray-700'
              }`}
            >
              {slot.label.split(' · ')[1] ?? slot.label}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <p className="text-xs text-green-700 font-medium">
            Seleccionado: {selected.label}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tema a tratar (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Propuesta para sistema de gestión"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white"
            />
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 text-sm py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleBook}
          disabled={!selected || booking}
          className="flex-1 text-sm py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 hover:bg-green-700"
        >
          {booking ? 'Agendando...' : 'Confirmar cita'}
        </button>
      </div>
    </div>
  )
}
