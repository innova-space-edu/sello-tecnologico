'use client'

import { useState } from 'react'

export default function FeedbackEncuesta({ responseId, initialFeedback }: { responseId: string; initialFeedback?: string | null }) {
  const [feedback, setFeedback] = useState(initialFeedback ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    const response = await fetch(`/api/encuestas/respuestas/${responseId}/feedback`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error ?? 'No fue posible guardar la retroalimentación.')
      setSaving(false)
      return
    }
    setSaved(true)
    setSaving(false)
  }

  return <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-3">
    <div className="flex flex-wrap justify-between gap-2 items-center mb-2">
      <p className="text-xs uppercase tracking-wide font-semibold text-blue-600">Retroalimentación docente</p>
      {saved && <span className="text-xs font-semibold text-green-700">Guardada ✓</span>}
    </div>
    <textarea rows={3} value={feedback} onChange={event => { setFeedback(event.target.value); setSaved(false) }} placeholder="Escribe una observación para el estudiante…" className="w-full border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm text-gray-700" />
    {error && <p className="text-xs text-red-600 mt-2">⚠️ {error}</p>}
    <div className="flex justify-end mt-2"><button type="button" onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-2 rounded-lg text-xs font-semibold">{saving ? 'Guardando…' : 'Guardar retroalimentación'}</button></div>
  </div>
}
