'use client'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import SelloConsentPanel, { selloChoices } from '@/components/legal/SelloConsentPanel'
import { hasLegacyConsentGrace } from '@/lib/family-consent/transition'

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

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [birthDate, setBirthDate] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [consentExpanded, setConsentExpanded] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [choices, setChoices] = useState<Record<string, boolean>>(selloChoices())
  const isMinor = (date: string) => {
    const d = new Date(date + 'T00:00:00')
    const now = new Date()
    return !date || Number.isNaN(d.getTime()) || d > new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', rut: '', curso: '',
  })

  const detectRole = (email: string): Role =>
    email.trim().toLowerCase().endsWith('@colprovidencia.cl') ? 'docente' : 'estudiante'

  const normalizeRut = (rut: string) =>
    rut.trim().toUpperCase().replace(/\s+/g, '').replace(/\.{2,}/g, '.').replace(/-{2,}/g, '-')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setNotice('')
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(), password: form.password,
    })
    if (loginError) { setError('Correo o contraseña incorrectos'); setLoading(false); return }
    // La cuenta existente mantiene acceso durante la transición.
    const legacyGrace = hasLegacyConsentGrace(loginData.user?.created_at)
    if (!legacyGrace && (!consentExpanded || !acceptedTerms)) {
      await supabase.auth.signOut({scope:'local'})
      setError('Revisa las condiciones de privacidad y confirma su lectura para continuar.')
      setLoading(false); return
    }
    const accountMinor = isMinor(String(loginData.user?.user_metadata?.birth_date || ''))
    if (!legacyGrace) {
      const { error: consentError } = await supabase.rpc('record_sello_privacy_choices', {
      p_policy_version: 'sello-2026-10-v1', p_terms_acknowledged: true,
      p_choices: accountMinor ? Object.fromEntries(Object.keys(choices).map(key => [key,false])) : choices,
    })
    if (consentError) {
      await supabase.auth.signOut({scope:'local'})
      setError('No se pudo guardar el registro de privacidad. El acceso sigue restringido.')
      setLoading(false); return
    }
    }
    if (accountMinor && !legacyGrace) {
      const result = await fetch('/api/family-consent/self/invite',{method:'POST'}).catch(()=>null)
      if (result?.ok) {
        const state = await result.json().catch(() => ({}))
        if (state.status === 'approved') { router.push('/dashboard'); setLoading(false); return }
      } else setNotice('Pendiente: el correo al representante no pudo confirmarse. Contacta a administración.')
      router.push('/autorizacion-pendiente'); setLoading(false); return
    }
    await fetch('/api/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'login', pathname: '/login', metadata: { email: form.email.trim().toLowerCase() } }),
    }).catch(() => {})
    router.push('/dashboard')
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setNotice('')

    const email = form.email.trim().toLowerCase()
    if (!consentExpanded || !acceptedTerms) { setError('Completa el formulario de consentimiento.'); setLoading(false); return }
    const parsedBirth = new Date(birthDate + 'T00:00:00')
    if (!birthDate || Number.isNaN(parsedBirth.getTime()) || parsedBirth > new Date()) {
      setError('Indica una fecha de nacimiento válida.'); setLoading(false); return
    }
    const minor = isMinor(birthDate)
    if (minor && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(guardianEmail.trim())) {
      setError('Debes indicar un correo válido del representante legal.'); setLoading(false); return
    }
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

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name.trim(),
          rut,
          curso: cursoNormalizado,
          role,
          birth_date: birthDate,
          guardian_email: minor ? guardianEmail.trim().toLowerCase() : null,
          sello_terms_version: 'sello-2026-10-v1',
          sello_terms_acknowledged: true,
        },
      },
    })
    if (signUpError) {
      const msg = String(signUpError.message || '')
      setError(msg.includes('User already registered') ? 'Este correo ya está registrado' : 'Error al registrar. Intenta de nuevo.')
      setLoading(false); return
    }
    if (!data.user) {
      setError('No se pudo crear el usuario. Intenta nuevamente.'); setLoading(false); return
    }

    // Completar el perfil desde el servidor. Esto funciona incluso cuando
    // Supabase todavía no entrega una sesión por confirmación de correo.
    const profileResponse = await fetch('/api/register-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.user.id }),
    })
    const profileResult = await profileResponse.json().catch(() => ({}))

    if (!profileResponse.ok) {
      setError(profileResult.error ?? 'La cuenta se creó, pero no se pudo completar el perfil. Solicita ayuda al administrador.')
      setLoading(false); return
    }

    await fetch('/api/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'register', pathname: '/login', metadata: { email, role, curso: cursoNormalizado } }),
    }).catch(() => {})

    if (data.session) {
      const { error: consentError } = await supabase.rpc('record_sello_privacy_choices', {
        p_policy_version: 'sello-2026-10-v1', p_terms_acknowledged: true,
        p_choices: minor ? Object.fromEntries(Object.keys(choices).map(key => [key,false])) : choices,
      })
      if (consentError) { setError('No se pudieron guardar los permisos: vuelve a ingresar tras verificar tu correo.'); setLoading(false); return }
      if (minor) {
        const result = await fetch('/api/family-consent/self/invite',{method:'POST'}).catch(()=>null)
        if (!result?.ok) setNotice('El envío del formulario familiar todavía no se confirmó; la cuenta seguirá restringida.')
        router.push('/autorizacion-pendiente')
      } else router.push('/dashboard')
    } else {
      setMode('login')
      setForm({ email, password: '', full_name: '', rut: '', curso: '' })
      setNotice('✅ Cuenta creada correctamente. Revisa tu correo si debes confirmar el acceso y luego inicia sesión.')
    }
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
            <button key={m} onClick={() => { setMode(m); setError(''); setNotice('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>
              {m === 'login' ? 'Ingresar' : 'Registrarse'}
            </button>
          ))}
        </div>

        <div className="px-8 pb-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
          )}
          {notice && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">{notice}</div>
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
              <p className="text-xs text-gray-600">Las cuentas inscritas hasta el 11 de octubre de 2026 mantienen su acceso durante el plazo de transición, sin completar todavía el nuevo formulario.</p>
              <SelloConsentPanel expanded={consentExpanded} setExpanded={setConsentExpanded}
                terms={acceptedTerms} setTerms={setAcceptedTerms} choices={choices} setChoices={setChoices}
                minor={false} guardianEmail={guardianEmail} setGuardianEmail={setGuardianEmail}/>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento *</label>
                <input type="date" required value={birthDate} onChange={e=>setBirthDate(e.target.value)}
                  className={inputClass} />
              </div>
              <SelloConsentPanel expanded={consentExpanded} setExpanded={setConsentExpanded}
                terms={acceptedTerms} setTerms={setAcceptedTerms} choices={choices} setChoices={setChoices}
                minor={isMinor(birthDate)} guardianEmail={guardianEmail} setGuardianEmail={setGuardianEmail}/>
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
          <div className="mt-4 text-center text-xs leading-5 text-gray-600">
            <p>Estudiantes menores de edad: la institución podrá requerir un formulario familiar con firma electrónica simple y verificación de representación, antes de habilitar las funciones correspondientes.</p>
            <Link href="/proteccion-datos" className="mt-2 inline-block font-semibold text-blue-700 underline">Protección de datos y autorizaciones familiares</Link>
          </div>
          <p className="text-gray-400 text-xs text-center mt-4">Solo usuarios autorizados del Colegio Providencia</p>
        </div>
      </div>
    </div>
  )
}
