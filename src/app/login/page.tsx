'use client'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Mode = 'login' | 'register'
type Role = 'admin' | 'coordinador' | 'docente' | 'estudiante'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    rut: '',
    curso: '',
  })

  const detectRole = (email: string): Role => {
    // Regla simple: dominio del colegio => docente, otro => estudiante
    return email.trim().toLowerCase().endsWith('@colprovidencia.cl') ? 'docente' : 'estudiante'
  }

  const normalizeRut = (rut: string) =>
    rut
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      // deja puntos y guion si el usuario los pone, pero elimina duplicados raros
      .replace(/\.{2,}/g, '.')
      .replace(/-{2,}/g, '-')

  const normalizeCurso = (curso: string) => curso.trim()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const email = form.email.trim().toLowerCase()

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password: form.password,
    })

    if (loginError) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    // OK
    router.push('/dashboard')
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const email = form.email.trim().toLowerCase()
    const role = detectRole(email)
    const rut = normalizeRut(form.rut)
    const curso = normalizeCurso(form.curso)

    if (!rut || !form.full_name.trim() || !email || !form.password) {
      setError('Todos los campos obligatorios deben completarse')
      setLoading(false)
      return
    }

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
    })

    if (signUpError) {
      const msg = String(signUpError.message || '')
      setError(
        msg.includes('User already registered')
          ? 'Este correo ya está registrado'
          : 'Error al registrar. Intenta de nuevo.'
      )
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('No se pudo crear el usuario. Intenta nuevamente.')
      setLoading(false)
      return
    }

    // ✅ Lo que pedías: upsert del perfil con info extra
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: form.full_name.trim(),
      rut,
      curso,
      role,
    })

    if (profileError) {
      // Esto suele pasar si falta policy de INSERT/UPSERT en RLS
      setError(
        'La cuenta se creó, pero no se pudo guardar el perfil (RLS/Permisos). ' +
          'Avísame y lo corregimos en Supabase.'
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        {/* Logo y nombre */}
      <div className="text-center p-8 pb-4">
        <img
          src="https://drive.google.com/file/d/1kNPRll5Bzap3zAncT27j4YCAxqxvI2Ir/view?usp=sharing"
          alt="Colegio Providencia"
          className="h-28 w-auto object-contain mx-auto mb-4"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <h1 className="text-2xl font-bold text-blue-900">Colegio Providencia</h1>
        <p className="text-blue-600 font-semibold mt-1">Sello Tecnológico</p>
      </div>

        {/* Tabs */}
        <div className="flex mx-8 mb-6 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => {
              setMode('login')
              setError('')
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Ingresar
          </button>
          <button
            onClick={() => {
              setMode('register')
              setError('')
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'register' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Registrarse
          </button>
        </div>

        <div className="px-8 pb-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="tu@correo.cl"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Juan Pérez González"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
                <input
                  required
                  value={form.rut}
                  onChange={(e) => setForm({ ...form, rut: e.target.value })}
                  placeholder="12.345.678-9"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Curso / Nivel</label>
                <input
                  value={form.curso}
                  onChange={(e) => setForm({ ...form, curso: e.target.value })}
                  placeholder="Ej: 2° Medio B"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="tu@correo.cl"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {form.email && (
                  <p
                    className="text-xs mt-1 font-medium"
                    style={{
                      color: form.email.trim().toLowerCase().endsWith('@colprovidencia.cl') ? '#15803d' : '#2563eb',
                    }}
                  >
                    {form.email.trim().toLowerCase().endsWith('@colprovidencia.cl')
                      ? '✅ Serás registrado como Docente'
                      : '🎓 Serás registrado como Estudiante'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? 'Registrando...' : 'Crear cuenta'}
              </button>
            </form>
          )}

          <p className="text-gray-400 text-xs text-center mt-4">
            Solo usuarios autorizados del Colegio Providencia
          </p>
        </div>
      </div>
    </div>
  )
}
