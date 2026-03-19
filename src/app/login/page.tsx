'use client'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'

const CURSOS = [
  '1° Básico A', '1° Básico B',
  '2° Básico A', '2° Básico B',
  '3° Básico A', '3° Básico B',
  '4° Básico A', '4° Básico B',
  '5° Básico A', '5° Básico B',
  '6° Básico A', '6° Básico B',
  '7° Básico A', '7° Básico B',
  '8° Básico A', '8° Básico B',
  '1° Medio A', '1° Medio B',
  '2° Medio A', '2° Medio B',
  '3° Medio A', '3° Medio B',
  '4° Medio A', '4° Medio B',
]

type Mode = 'login' | 'register'
type Role = 'admin' | 'coordinador' | 'docente' | 'estudiante'

// Normaliza el texto del curso a un nombre canónico: "1° Medio A", "4° Medio B", etc.
function parseCurso(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')
  // Detectar patrones como: 1ma, 1mA, 1°mA, primeromedioA, 4MB, etc.
  const match = s.match(/^(\d+|primero|segundo|tercero|cuarto)(°|º|ero|do|ro)?[mb°º]?([abcde])?$/)
  if (!match) return raw.trim()

  const numMap: Record<string, string> = {
    '1': '1°', 'primero': '1°',
    '2': '2°', 'segundo': '2°',
    '3': '3°', 'tercero': '3°',
    '4': '4°', 'cuarto': '4°',
  }
  const num = numMap[match[1]] ?? `${match[1]}°`
  const letra = (match[3] ?? 'A').toUpperCase()
  return `${num} Medio ${letra}`
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', rut: '', curso: '',
  })

  const detectRole = (email: string): Role =>
    email.trim().toLowerCase().endsWith('@colprovidencia.cl') ? 'docente' : 'estudiante'

  const normalizeRut = (rut: string) =>
    rut.trim().toUpperCase().replace(/\s+/g, '').replace(/\.{2,}/g, '.').replace(/-{2,}/g, '-')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(), password: form.password,
    })
    if (loginError) { setError('Correo o contraseña incorrectos'); setLoading(false); return }
    router.push('/dashboard')
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const email = form.email.trim().toLowerCase()
    const role = detectRole(email)
    const rut = normalizeRut(form.rut)
    const cursoRaw = form.curso.trim()
    const cursoNormalizado = role === 'estudiante' && cursoRaw ? cursoRaw : ''

    if (!rut || !form.full_name.trim() || !email || !form.password) {
      setError('Todos los campos obligatorios deben completarse'); setLoading(false); return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres'); setLoading(false); return
    }
    if (role === 'estudiante' && !cursoRaw) {
      setError('Los estudiantes deben indicar su curso (ej: 2° Medio A)'); setLoading(false); return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password: form.password })
    if (signUpError) {
      const msg = String(signUpError.message || '')
      setError(msg.includes('User already registered') ? 'Este correo ya está registrado' : 'Error al registrar. Intenta de nuevo.')
      setLoading(false); return
    }
    if (!data.user) {
      setError('No se pudo crear el usuario. Intenta nuevamente.'); setLoading(false); return
    }

    // Guardar perfil
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id, email, full_name: form.full_name.trim(), rut,
      curso: cursoNormalizado, role,
    })
    if (profileError) {
      setError('La cuenta se creó, pero no se pudo guardar el perfil.'); setLoading(false); return
    }

    // Auto-asignar al curso si es estudiante
    if (role === 'estudiante' && cursoNormalizado) {
      // Buscar si existe el curso por nombre normalizado
      const { data: cursoExistente } = await supabase
        .from('courses').select('id').eq('name', cursoNormalizado).single()

      let courseId = cursoExistente?.id

      // Si no existe, crearlo automáticamente
      if (!courseId) {
        const { data: nuevoCurso } = await supabase
          .from('courses').insert({ name: cursoNormalizado, year: new Date().getFullYear(), area: 'Tecnología' })
          .select('id').single()
        courseId = nuevoCurso?.id
      }

      // Agregar al estudiante como miembro del curso
      if (courseId) {
        await supabase.from('course_members').upsert({
          course_id: courseId, user_id: data.user.id,
        }, { onConflict: 'course_id,user_id' })
      }
    }

    router.push('/dashboard')
    setLoading(false)
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  const isDocente = form.email.trim().toLowerCase().endsWith('@colprovidencia.cl')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="pt-8 pb-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100">
              <Image src="/colegio-logo.jpg" alt="Logo Colegio Providencia" fill sizes="96px"
                className="object-contain p-2" priority />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-blue-900">Colegio Providencia</h1>
          <p className="text-blue-600 font-semibold mt-1">Sello Tecnológico</p>
        </div>

        <div className="flex mx-8 mb-6 bg-gray-100 rounded-xl p-1">
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>
              {m === 'login' ? 'Ingresar' : 'Registrarse'}
            </button>
          ))}
        </div>

        <div className="px-8 pb-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="tu@correo.cl" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••" className={inputClass} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2">
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Juan Pérez González" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
                <input required value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
                  placeholder="12.345.678-9" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="tu@correo.cl" className={inputClass} />
                {form.email && (
                  <p className="text-xs mt-1 font-medium" style={{ color: isDocente ? '#15803d' : '#2563eb' }}>
                    {isDocente ? '✅ Serás registrado como Docente' : '🎓 Serás registrado como Estudiante'}
                  </p>
                )}
              </div>
              {!isDocente && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Curso *</label>
                  <select
                    value={form.curso}
                    onChange={e => setForm({ ...form, curso: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Selecciona tu curso...</option>
                    <optgroup label="Enseñanza Básica">
                      {CURSOS.filter(c => c.includes('Básico')).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Enseñanza Media">
                      {CURSOS.filter(c => c.includes('Medio')).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  </select>
                  {form.curso && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Asignado a: <strong>{form.curso}</strong>
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres" className={inputClass} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2">
                {loading ? 'Registrando...' : 'Crear cuenta'}
              </button>
            </form>
          )}
          <p className="text-gray-400 text-xs text-center mt-4">Solo usuarios autorizados del Colegio Providencia</p>
        </div>
      </div>
    </div>
  )
}
