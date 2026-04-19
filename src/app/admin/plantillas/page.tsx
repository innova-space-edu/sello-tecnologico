'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Template, TemplateType } from '@/lib/templates'

const TYPE_META: Record<TemplateType, { label: string; icon: string; color: string }> = {
  proyecto:   { label: 'Proyecto',   icon: '🗂️', color: 'bg-blue-100 text-blue-700' },
  portafolio: { label: 'Portafolio', icon: '📋', color: 'bg-violet-100 text-violet-700' },
  evidencia:  { label: 'Evidencia',  icon: '📎', color: 'bg-green-100 text-green-700' },
}

export default function PlantillasAdminPage() {
  const supabase  = createClient()
  const router    = useRouter()
  const [plantillas, setPlantillas] = useState<Template[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [filtro, setFiltro]         = useState<TemplateType | 'todos'>('todos')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!['admin','docente','coordinador'].includes(p?.role ?? '')) { router.push('/dashboard'); return }
      await fetchPlantillas()
      setLoading(false)
    }
    init()
  }, [])

  const fetchPlantillas = async () => {
    const { data } = await supabase
      .from('templates')
      .select('*, template_blocks(id)')
      .order('type').order('created_at')
    setPlantillas(data ?? [])
  }

  const crearPlantilla = async (type: TemplateType) => {
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('templates').insert({
      name: `Nueva plantilla de ${TYPE_META[type].label}`,
      type,
      description: '',
      is_default: false,
      is_active: true,
      created_by: user.id,
    }).select('id').single()
    setCreating(false)
    if (!error && data?.id) router.push(`/admin/plantillas/${data.id}`)
  }

  const duplicar = async (t: Template) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Crear copia
    const { data: nueva } = await supabase.from('templates').insert({
      name: `${t.name} (copia)`, type: t.type,
      description: t.description, is_default: false,
      is_active: true, created_by: user.id,
    }).select('id').single()
    if (!nueva?.id) return
    // Copiar bloques
    const { data: bloques } = await supabase
      .from('template_blocks').select('*').eq('template_id', t.id).order('order_index')
    if (bloques?.length) {
      await supabase.from('template_blocks').insert(
        bloques.map(({ id: _id, created_at: _ca, template_id: _ti, ...b }) => ({
          ...b, template_id: nueva.id,
        }))
      )
    }
    fetchPlantillas()
  }

  const toggleActivo = async (t: Template) => {
    await supabase.from('templates').update({ is_active: !t.is_active }).eq('id', t.id)
    fetchPlantillas()
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla? Se perderán todos sus bloques. Los documentos creados con ella no se borran.')) return
    await supabase.from('templates').delete().eq('id', id)
    fetchPlantillas()
  }

  const filtradas = plantillas.filter(p => filtro === 'todos' || p.type === filtro)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">

        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Link href="/admin" className="hover:text-blue-600">Panel Admin</Link>
              <span>›</span>
              <span className="text-gray-600">Plantillas</span>
            </div>
            <h1 className="text-2xl font-bold text-blue-900">🧩 Plantillas editables</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Define la estructura de proyectos, portafolios y evidencias por bloques
            </p>
          </div>
          {/* Crear nuevas */}
          <div className="flex gap-2 flex-wrap">
            {(['proyecto','portafolio','evidencia'] as TemplateType[]).map(t => (
              <button key={t} onClick={() => crearPlantilla(t)} disabled={creating}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
                {TYPE_META[t].icon} Nueva de {TYPE_META[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(['proyecto','portafolio','evidencia'] as TemplateType[]).map(t => (
            <div key={t} className="bg-white rounded-xl shadow-sm p-4 text-center border border-gray-100">
              <div className="text-2xl">{TYPE_META[t].icon}</div>
              <div className="text-xl font-bold text-gray-800 mt-1">
                {plantillas.filter(p => p.type === t && p.is_active).length}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{TYPE_META[t].label}s activas</div>
            </div>
          ))}
        </div>

        {/* Filtro */}
        <div className="flex gap-2 mb-5">
          {(['todos','proyecto','portafolio','evidencia'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filtro === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-blue-50'
              }`}>
              {f === 'todos' ? 'Todas' : TYPE_META[f as TemplateType].label + 's'}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando plantillas...</div>
        ) : filtradas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-3">🧩</div>
            <p className="text-gray-500">No hay plantillas aún. Crea la primera.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtradas.map(t => {
              const meta = TYPE_META[t.type]
              const nBloques = (t as any).template_blocks?.length ?? 0
              return (
                <div key={t.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${
                  t.is_active ? 'border-gray-100 hover:border-blue-200' : 'border-dashed border-gray-200 opacity-60'
                }`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{meta.icon}</span>
                        <div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                            {meta.label}
                          </span>
                          {t.is_default && (
                            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                              Por defecto
                            </span>
                          )}
                        </div>
                      </div>
                      {!t.is_active && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Inactiva</span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-800 mt-3 text-sm leading-tight">{t.name}</h3>
                    {t.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-gray-400">
                        🧱 {nBloques} bloque{nBloques !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(t.created_at).toLocaleDateString('es-CL')}
                      </span>
                    </div>
                  </div>
                  {/* Acciones */}
                  <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 flex items-center gap-1.5 flex-wrap">
                    <Link href={`/admin/plantillas/${t.id}`}
                      className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-blue-200">
                      ✏️ Editar
                    </Link>
                    <button onClick={() => duplicar(t)}
                      className="flex items-center gap-1 text-gray-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border border-gray-200">
                      📋 Duplicar
                    </button>
                    <button onClick={() => toggleActivo(t)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        t.is_active
                          ? 'text-orange-600 border-orange-200 hover:bg-orange-50'
                          : 'text-green-600 border-green-200 hover:bg-green-50'
                      }`}>
                      {t.is_active ? '⏸ Desactivar' : '▶ Activar'}
                    </button>
                    {!t.is_default && (
                      <button onClick={() => eliminar(t.id)}
                        className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border border-red-200 ml-auto">
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
