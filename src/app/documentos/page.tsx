'use client'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Document, TemplateType } from '@/lib/templates'

const TYPE_META: Record<TemplateType, { label: string; icon: string; color: string }> = {
  proyecto:   { label: 'Proyecto',   icon: '🗂️', color: 'bg-blue-100 text-blue-700' },
  portafolio: { label: 'Portafolio', icon: '📋', color: 'bg-violet-100 text-violet-700' },
  evidencia:  { label: 'Evidencia',  icon: '📎', color: 'bg-green-100 text-green-700' },
}

const STATUS_COLOR: Record<string, string> = {
  borrador:    'bg-gray-100 text-gray-600',
  en_progreso: 'bg-blue-100 text-blue-700',
  'revisión':  'bg-yellow-100 text-yellow-700',
  aprobado:    'bg-green-100 text-green-700',
  cerrado:     'bg-red-100 text-red-600',
}

export default function DocumentosPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [docs, setDocs]     = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState('')
  const [userRole, setUserRole] = useState('')
  const [filtro, setFiltro]     = useState<TemplateType | 'todos'>('todos')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserId(user.id); setUserRole(p?.role ?? 'estudiante')

      const { data: t } = await supabase.from('templates').select('id, name, type').eq('is_active', true).order('type').order('name')
      setTemplates(t ?? [])

      const { data: d } = await supabase.from('documents')
        .select('*, templates(name, type)')
        .order('updated_at', { ascending: false })
      setDocs(d ?? [])
      setLoading(false)
    }
    init()
  }, [])

  const crearDocumento = async (templateId: string, type: TemplateType) => {
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tpl = templates.find(t => t.id === templateId)
    const { data, error } = await supabase.from('documents').insert({
      template_id: templateId, type,
      title: `Nuevo ${tpl?.name ?? type}`,
      status: 'borrador', is_shared: false, created_by: user.id,
    }).select('id').single()
    setCreating(false)
    if (!error && data?.id) router.push(`/documentos/${data.id}`)
  }

  const filtrados = docs.filter(d => filtro === 'todos' || d.templates?.type === filtro)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">📄 Documentos</h1>
            <p className="text-gray-500 mt-1 text-sm">Proyectos, portafolios y evidencias con editor por bloques</p>
          </div>
          {/* Crear nuevo documento */}
          <div className="relative group">
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              + Nuevo documento ▾
            </button>
            <div className="absolute right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-10 min-w-56 hidden group-hover:block">
              {templates.map(t => (
                <button key={t.id} onClick={() => crearDocumento(t.id, t.type)} disabled={creating}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left hover:bg-blue-50 transition-colors">
                  <span>{TYPE_META[t.type as TemplateType]?.icon}</span>
                  <div>
                    <div className="font-medium text-gray-800 text-xs">{t.name}</div>
                    <div className="text-xs text-gray-400">{TYPE_META[t.type as TemplateType]?.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5">
          {(['todos','proyecto','portafolio','evidencia'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filtro === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-blue-50'
              }`}>
              {f === 'todos' ? 'Todos' : TYPE_META[f as TemplateType].label + 's'}
            </button>
          ))}
          <span className="text-xs text-gray-400 self-center ml-auto">{filtrados.length} documentos</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando documentos...</div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📄</div>
            <p className="text-gray-500">No hay documentos aún.</p>
            <p className="text-gray-300 text-sm mt-1">Crea uno usando las plantillas configuradas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtrados.map(d => {
              const type = d.templates?.type as TemplateType ?? 'proyecto'
              const meta = TYPE_META[type]
              return (
                <Link key={d.id} href={`/documentos/${d.id}`}
                  className="bg-white rounded-xl shadow-sm border-2 border-gray-100 hover:border-blue-200 p-5 transition-all hover:shadow-md block">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div className="flex gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[d.status] ?? 'bg-gray-100 text-gray-600'}`}>{d.status}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2 mb-1">{d.title}</h3>
                  <p className="text-xs text-gray-400">{d.templates?.name}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    {d.is_shared && <span className="text-xs text-green-600 font-medium">👥 Compartido</span>}
                    <span className="text-xs text-gray-300 ml-auto">
                      {new Date(d.updated_at).toLocaleDateString('es-CL')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
