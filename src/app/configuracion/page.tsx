'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    school_name: 'Colegio Providencia',
    repo_name: 'Sello Tecnológico',
    year_active: '2026',
    logo_url: ''
  })

  // Estado cambio de contraseña
  const [pwForm, setPwForm] = useState({ nueva: '', confirmar: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
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

    if (pwForm.nueva.length < 6) {
      setPwMsg({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' })
      return
    }
    if (pwForm.nueva !== pwForm.confirmar) {
      setPwMsg({ type: 'error', text: 'Las contraseñas no coinciden.' })
      return
    }

    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.nueva })
    setPwLoading(false)

    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'ok', text: '✅ Contraseña actualizada correctamente en Supabase.' })
      setPwForm({ nueva: '', confirmar: '' })
      setTimeout(() => setPwMsg(null), 5000)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Configuración</h1>
          <p className="text-gray-500 mt-1">Personaliza la plataforma del Sello Tecnológico</p>
        </div>

        <div className="max-w-lg space-y-6">

          {/* ── Configuración general ─────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="font-semibold text-blue-900 mb-5 pb-2 border-b">General</h2>
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
                {form.logo_url && (
                  <img src={form.logo_url} alt="Logo preview" className="mt-2 h-12 object-contain rounded" />
                )}
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {loading ? 'Guardando...' : 'Guardar configuración'}
              </button>
              {saved && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 text-center">
                  ✅ Configuración guardada correctamente
                </div>
              )}
            </form>
          </div>

          {/* ── Cambiar contraseña ────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="font-semibold text-blue-900 mb-1 pb-2 border-b">Seguridad</h2>
            <p className="text-xs text-gray-400 mb-5 mt-2">Cambia tu contraseña de acceso. El cambio se aplica directamente en Supabase Auth.</p>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.nueva}
                    onChange={e => setPwForm({ ...pwForm, nueva: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className={inputClass + ' pr-12'}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                    {showPw ? '🙈 Ocultar' : '👁 Ver'}
                  </button>
                </div>

                {/* Indicador de fortaleza */}
                {pwForm.nueva.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map(i => {
                        const strength = Math.min(
                          (pwForm.nueva.length >= 6 ? 1 : 0) +
                          (/[A-Z]/.test(pwForm.nueva) ? 1 : 0) +
                          (/[0-9]/.test(pwForm.nueva) ? 1 : 0) +
                          (/[^A-Za-z0-9]/.test(pwForm.nueva) ? 1 : 0),
                          4
                        )
                        const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']
                        return (
                          <div key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? colors[strength - 1] : 'bg-gray-200'}`} />
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400">
                      {(() => {
                        const s = (pwForm.nueva.length >= 6 ? 1 : 0) + (/[A-Z]/.test(pwForm.nueva) ? 1 : 0) + (/[0-9]/.test(pwForm.nueva) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pwForm.nueva) ? 1 : 0)
                        return ['', 'Débil', 'Regular', 'Buena', 'Muy segura'][s]
                      })()}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.confirmar}
                  onChange={e => setPwForm({ ...pwForm, confirmar: e.target.value })}
                  placeholder="Repite la contraseña"
                  className={inputClass}
                />
                {pwForm.confirmar.length > 0 && pwForm.nueva !== pwForm.confirmar && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
                {pwForm.confirmar.length > 0 && pwForm.nueva === pwForm.confirmar && (
                  <p className="text-xs text-green-600 mt-1">✓ Las contraseñas coinciden</p>
                )}
              </div>

              <button type="submit" disabled={pwLoading || pwForm.nueva.length < 6 || pwForm.nueva !== pwForm.confirmar}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40">
                {pwLoading ? 'Actualizando...' : '🔒 Actualizar contraseña'}
              </button>

              {pwMsg && (
                <div className={`text-sm rounded-lg px-4 py-3 text-center border ${pwMsg.type === 'ok'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {pwMsg.text}
                </div>
              )}
            </form>
          </div>

        </div>
      </main>
    </div>
  )
}
