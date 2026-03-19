'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [rol, setRol] = useState<string>('')

  // Perfil del usuario
  const [perfil, setPerfil] = useState<{ full_name: string; email: string; apodo: string } | null>(null)
  const [apodo, setApodo] = useState('')
  const [apodoLoading, setApodoLoading] = useState(false)
  const [apodoMsg, setApodoMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // Contraseña
  const [pwForm, setPwForm] = useState({ nueva: '', confirmar: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [showPw, setShowPw] = useState(false)

  // Config general (solo admin)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    school_name: 'Colegio Providencia',
    repo_name: 'Sello Tecnológico',
    year_active: '2026',
    logo_url: ''
  })

  const esAdmin = ['admin', 'coordinador'].includes(rol)
  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      supabase.from('profiles').select('role, full_name, email, apodo').eq('id', user.id).single()
        .then(({ data }) => {
          setRol(data?.role ?? '')
          setPerfil({
            full_name: data?.full_name ?? '',
            email: data?.email ?? user.email ?? '',
            apodo: data?.apodo ?? '',
          })
          setApodo(data?.apodo ?? '')
        })
    })

    supabase.from('settings').select('*').eq('id', 1).single()
      .then(({ data }) => {
        if (data) setForm({
          school_name: data.school_name ?? '',
          repo_name: data.repo_name ?? '',
          year_active: String(data.year_active ?? 2026),
          logo_url: data.logo_url ?? ''
        })
      })
  }, [])

  const handleApodoSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setApodoMsg(null)
    setApodoLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setApodoLoading(false); return }

    const { error } = await supabase.from('profiles').update({ apodo: apodo.trim() || null }).eq('id', user.id)
    setApodoLoading(false)

    if (error) {
      setApodoMsg({ type: 'error', text: 'Error al guardar: ' + error.message })
    } else {
      setApodoMsg({ type: 'ok', text: '✅ Apodo actualizado correctamente.' })
      setPerfil(p => p ? { ...p, apodo: apodo.trim() } : p)
      setTimeout(() => setApodoMsg(null), 4000)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.from('settings').update({
      school_name: form.school_name,
      repo_name: form.repo_name,
      year_active: parseInt(form.year_active),
      logo_url: form.logo_url
    }).eq('id', 1)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (pwForm.nueva.length < 6) { setPwMsg({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' }); return }
    if (pwForm.nueva !== pwForm.confirmar) { setPwMsg({ type: 'error', text: 'Las contraseñas no coinciden.' }); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.nueva })
    setPwLoading(false)
    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'ok', text: '✅ Contraseña actualizada correctamente.' })
      setPwForm({ nueva: '', confirmar: '' })
      setTimeout(() => setPwMsg(null), 5000)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Configuración</h1>
          <p className="text-gray-500 mt-1">Ajustes de tu cuenta y de la plataforma</p>
        </div>

        <div className="max-w-lg space-y-6">

          {/* ── Perfil — nombre e apodo ──────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="font-semibold text-blue-900 mb-1 pb-2 border-b">👤 Mi perfil</h2>
            <p className="text-xs text-gray-400 mb-5 mt-2">
              El nombre y apellido es oficial y no se puede cambiar. El apodo sí puedes editarlo.
            </p>

            {/* Nombre completo — solo lectura */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-500 mb-1">Nombre completo (no editable)</label>
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                <span className="text-lg">🎓</span>
                <span className="text-sm text-gray-700 font-medium">{perfil?.full_name || '—'}</span>
                <span className="ml-auto text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Solo lectura</span>
              </div>
            </div>

            {/* Email — solo lectura */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-500 mb-1">Correo electrónico</label>
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                <span className="text-lg">✉️</span>
                <span className="text-sm text-gray-500">{perfil?.email || '—'}</span>
                <span className="ml-auto text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Solo lectura</span>
              </div>
            </div>

            {/* Apodo — editable */}
            <form onSubmit={handleApodoSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apodo o nombre preferido</label>
                <input
                  value={apodo}
                  onChange={e => setApodo(e.target.value)}
                  placeholder={`Ej: ${(perfil?.full_name ?? '').split(' ')[0] || 'Nickname'}...`}
                  maxLength={30}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Este apodo aparecerá en el chat y en tu perfil. Máx. 30 caracteres.
                </p>
              </div>
              <button type="submit" disabled={apodoLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm">
                {apodoLoading ? 'Guardando...' : '💾 Guardar apodo'}
              </button>
              {apodoMsg && (
                <div className={`text-sm rounded-lg px-4 py-3 text-center border ${apodoMsg.type === 'ok'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {apodoMsg.text}
                </div>
              )}
            </form>
          </div>

          {/* ── Contraseña ────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="font-semibold text-blue-900 mb-1 pb-2 border-b">🔒 Seguridad</h2>
            <p className="text-xs text-gray-400 mb-5 mt-2">
              Cambia tu propia contraseña de acceso. Solo afecta tu cuenta.
            </p>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.nueva}
                    onChange={e => setPwForm({ ...pwForm, nueva: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className={inputClass + ' pr-24'}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                    {showPw ? '🙈 Ocultar' : '👁 Ver'}
                  </button>
                </div>
                {pwForm.nueva.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map(i => {
                        const s = Math.min((pwForm.nueva.length >= 6 ? 1 : 0) + (/[A-Z]/.test(pwForm.nueva) ? 1 : 0) + (/[0-9]/.test(pwForm.nueva) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pwForm.nueva) ? 1 : 0), 4)
                        return <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= s ? ['bg-red-400','bg-orange-400','bg-yellow-400','bg-green-500'][s-1] : 'bg-gray-200'}`} />
                      })}
                    </div>
                    <p className="text-xs text-gray-400">{['','Débil','Regular','Buena','Muy segura'][(pwForm.nueva.length >= 6 ? 1 : 0) + (/[A-Z]/.test(pwForm.nueva) ? 1 : 0) + (/[0-9]/.test(pwForm.nueva) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pwForm.nueva) ? 1 : 0)]}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                <input type={showPw ? 'text' : 'password'} value={pwForm.confirmar}
                  onChange={e => setPwForm({ ...pwForm, confirmar: e.target.value })}
                  placeholder="Repite la contraseña" className={inputClass} />
                {pwForm.confirmar.length > 0 && (
                  <p className={`text-xs mt-1 ${pwForm.nueva === pwForm.confirmar ? 'text-green-600' : 'text-red-500'}`}>
                    {pwForm.nueva === pwForm.confirmar ? '✓ Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                  </p>
                )}
              </div>
              <button type="submit" disabled={pwLoading || pwForm.nueva.length < 6 || pwForm.nueva !== pwForm.confirmar}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40">
                {pwLoading ? 'Actualizando...' : '🔒 Actualizar contraseña'}
              </button>
              {pwMsg && (
                <div className={`text-sm rounded-lg px-4 py-3 text-center border ${pwMsg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {pwMsg.text}
                </div>
              )}
            </form>
          </div>

          {/* ── Config general — SOLO admin/coordinador ───────────────── */}
          {esAdmin && (
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="font-semibold text-blue-900 mb-1 pb-2 border-b">⚙️ Configuración general</h2>
              <p className="text-xs text-gray-400 mb-5 mt-2">Solo administradores y coordinadores pueden editar estos campos.</p>
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del colegio</label>
                  <input value={form.school_name} onChange={e => setForm({ ...form, school_name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del repositorio</label>
                  <input value={form.repo_name} onChange={e => setForm({ ...form, repo_name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Año activo</label>
                  <input value={form.year_active} onChange={e => setForm({ ...form, year_active: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL del logo institucional</label>
                  <input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="https://tu-colegio.cl/logo.png" className={inputClass} />
                  {form.logo_url && <img src={form.logo_url} alt="Logo" className="mt-2 h-12 object-contain rounded" />}
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50">
                  {loading ? 'Guardando...' : 'Guardar configuración'}
                </button>
                {saved && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 text-center">✅ Configuración guardada</div>}
              </form>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
