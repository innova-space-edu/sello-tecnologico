'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EliminarUsuarioAdmin({
  userId,
  userName,
  userRole,
}: {
  userId: string
  userName: string
  userRole: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'confirmar' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmText, setConfirmText] = useState('')

  // No mostrar el botón si el usuario es admin
  if (userRole === 'admin') {
    return (
      <p className="text-xs text-gray-400 text-center py-2">
        🔒 No se puede eliminar a un administrador
      </p>
    )
  }

  const handleEliminar = async () => {
    if (confirmText !== userName) return
    setStep('loading')
    setErrorMsg('')

    const res = await fetch('/api/admin/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    const data = await res.json()

    if (!res.ok) {
      setStep('error')
      setErrorMsg(data.error ?? 'Error al eliminar el usuario.')
      return
    }

    // Redirigir a la lista de usuarios tras eliminar
    router.push('/usuarios')
    router.refresh()
  }

  return (
    <div>
      {step === 'idle' && (
        <button
          onClick={() => setStep('confirmar')}
          className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-semibold text-sm py-2 rounded-lg transition-colors">
          🗑️ Eliminar usuario
        </button>
      )}

      {step === 'confirmar' && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Acción irreversible</p>
            <p className="text-xs text-red-600">
              Se eliminarán permanentemente la cuenta, proyectos, evidencias y mensajes de{' '}
              <span className="font-bold">{userName}</span>.
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Escribe <span className="font-semibold text-gray-700">{userName}</span> para confirmar
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={userName}
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setStep('idle'); setConfirmText('') }}
              className="flex-1 border border-gray-300 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleEliminar}
              disabled={confirmText !== userName}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-40">
              Eliminar
            </button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400 animate-pulse">Eliminando usuario y sus datos...</p>
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-2">
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 text-center">
            {errorMsg}
          </div>
          <button onClick={() => setStep('idle')}
            className="w-full text-xs text-gray-500 hover:text-gray-700 underline">
            Volver
          </button>
        </div>
      )}
    </div>
  )
}
