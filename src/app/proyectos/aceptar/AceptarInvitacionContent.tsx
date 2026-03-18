'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

export default function AceptarInvitacionContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const invId = searchParams.get('inv')

  const [inv, setInv] = useState<any>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'aceptando' | 'aceptada' | 'error' | 'sin-inv'>('cargando')
  const [errorMsg, setErrorMsg] = useState('')
  const [proyectoCreado, setProyectoCreado] = useState<string | null>(null)

  useEffect(() => {
    if (!invId) { setEstado('sin-inv'); return }
    supabase
      .from('project_invitations')
      .select('*, projects(title, description, metodologia, tipo_proyecto, start_date, end_date), courses(name), profiles!project_invitations_enviado_por_fkey(full_name)')
      .eq('id', invId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setEstado('sin-inv'); return }
        setInv(data)
        setEstado(data.estado === 'aceptada' ? 'aceptada' : 'listo')
        if (data.estado === 'aceptada') setProyectoCreado(data.copia_proyecto_id)
      })
  }, [invId])

  const handleAceptar = async () => {
    setEstado('aceptando')
    const res = await fetch('/api/aceptar-invitacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitacionId: invId }),
    })
    const data = await res.json()
    if (data.ok) {
      setProyectoCreado(data.proyectoId)
      setEstado('aceptada')
    } else {
      setErrorMsg(data.error ?? 'Error al aceptar')
      setEstado('error')
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center">
        <div className="w-full max-w-md">

          {estado === 'cargando' && (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <p className="text-gray-400 animate-pulse text-sm">Cargando invitación...</p>
            </div>
          )}

          {estado === 'sin-inv' && (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-lg font-bold text-gray-700 mb-2">Invitación no encontrada</h2>
              <p className="text-sm text-gray-400 mb-5">El enlace puede haber expirado o ser incorrecto.</p>
              <Link href="/proyectos"
                className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
                Ver mis proyectos
              </Link>
            </div>
          )}

          {(estado === 'listo' || estado === 'aceptando') && inv && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-blue-600 px-6 py-5 text-white">
                <p className="text-xs opacity-75 mb-1">Invitación de proyecto</p>
                <h2 className="text-xl font-bold">{inv.projects?.title}</h2>
                <p className="text-sm opacity-80 mt-1">Curso: {inv.courses?.name}</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                  <span className="font-semibold">{inv.profiles?.full_name ?? 'Tu docente'}</span> te invita a participar en este proyecto.
                </div>

                {inv.projects?.description && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{inv.projects.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {inv.projects?.metodologia && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-0.5">Metodología</p>
                      <p className="font-medium text-gray-700 text-xs">{inv.projects.metodologia}</p>
                    </div>
                  )}
                  {inv.projects?.start_date && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-0.5">Fechas</p>
                      <p className="font-medium text-gray-700 text-xs">{inv.projects.start_date} → {inv.projects.end_date ?? '—'}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 space-y-2">
                  <button onClick={handleAceptar} disabled={estado === 'aceptando'}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm">
                    {estado === 'aceptando' ? 'Creando tu proyecto...' : '✅ Aceptar y crear mi proyecto'}
                  </button>
                  <Link href="/proyectos"
                    className="block text-center w-full border border-gray-300 text-gray-500 text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    Ahora no
                  </Link>
                </div>
              </div>
            </div>
          )}

          {estado === 'aceptada' && (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-lg font-bold text-green-700 mb-2">¡Proyecto creado!</h2>
              <p className="text-sm text-gray-500 mb-6">Tu copia del proyecto fue creada y está lista para completar.</p>
              <Link href={proyectoCreado ? `/proyectos/${proyectoCreado}` : '/proyectos'}
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm text-center">
                📂 Ir a mi proyecto
              </Link>
            </div>
          )}

          {estado === 'error' && (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-sm text-red-600 font-medium mb-4">{errorMsg}</p>
              <button onClick={() => setEstado('listo')}
                className="border border-gray-300 text-gray-600 text-sm px-5 py-2.5 rounded-xl hover:bg-gray-50">
                Reintentar
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
