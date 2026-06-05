'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type CreateNextFollowupButtonProps = {
  previousFollowupId: string
  subject: string
}

export default function CreateNextFollowupButton({
  previousFollowupId,
  subject,
}: CreateNextFollowupButtonProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [followupDate, setFollowupDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const crearSiguienteSeguimiento = async () => {
    setError('')

    if (!followupDate) {
      setError('Debes seleccionar una fecha para el nuevo seguimiento.')
      return
    }

    const confirmed = window.confirm(
      'Se creará un nuevo seguimiento conectado con esta evaluación. ' +
        'Se copiarán los participantes y criterios, pero los puntajes comenzarán vacíos. ' +
        '¿Deseas continuar?'
    )

    if (!confirmed) return

    setCreating(true)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'create_next_project_followup',
        {
          p_previous_followup_id: previousFollowupId,
          p_followup_date: followupDate,
          p_subject: subject,
        }
      )

      if (rpcError) throw rpcError
      if (!data) {
        throw new Error(
          'Supabase no devolvió el identificador del nuevo seguimiento.'
        )
      }

      router.push(`/seguimientos/${String(data)}/editar`)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible crear el siguiente seguimiento.'
      )
      setCreating(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
      >
        ＋ Crear siguiente seguimiento
      </button>
    )
  }

  return (
    <div className="w-full sm:w-auto bg-green-50 border border-green-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-green-900">
        Crear nueva evaluación del mismo proyecto
      </p>
      <p className="text-xs text-green-700 mt-1 mb-3">
        Los participantes y criterios se copiarán. Los nuevos puntajes,
        observaciones y fotografías comenzarán vacíos.
      </p>

      <label className="block text-xs font-semibold text-green-900 mb-1">
        Fecha del nuevo seguimiento
      </label>
      <input
        type="date"
        value={followupDate}
        onChange={(event) => setFollowupDate(event.target.value)}
        disabled={creating}
        className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700"
      />

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={crearSiguienteSeguimiento}
          disabled={creating}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {creating ? 'Creando...' : 'Confirmar y continuar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError('')
          }}
          disabled={creating}
          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
