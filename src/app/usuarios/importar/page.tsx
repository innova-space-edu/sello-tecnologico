'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ImportarUsuariosPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [resultado, setResultado] = useState<{ok: number, errores: string[]}>()
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setPreview([])
    setResultado(undefined)

    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    
    if (lines.length < 2) {
      setError('El archivo debe tener encabezados y al menos una fila de datos')
      return
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const required = ['nombre', 'rut', 'correo', 'curso']
    const missing = required.filter(r => !headers.includes(r))
    
    if (missing.length > 0) {
      setError(`Faltan columnas: ${missing.join(', ')}. El archivo debe tener: nombre, rut, correo, curso`)
      return
    }

    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      return {
        full_name: values[headers.indexOf('nombre')] ?? '',
        rut: values[headers.indexOf('rut')] ?? '',
        email: values[headers.indexOf('correo')] ?? '',
        curso: values[headers.indexOf('curso')] ?? '',
      }
    }).filter(r => r.email)

    setPreview(rows)
  }

  const handleImport = async () => {
    if (!preview.length) return
    setLoading(true)
    
    const ok: number[] = []
    const errores: string[] = []

    for (const alumno of preview) {
      const role = alumno.email.endsWith('@colprovidencia.cl') ? 'docente' : 'estudiante'
      
      const { data: authData, error: authError } = await supabase.auth.admin?.createUser?.({
        email: alumno.email,
        password: alumno.rut.replace(/\./g, '').replace('-', ''),
        email_confirm: true,
      }) ?? {}

      if (authError || !authData?.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          email: alumno.email,
          full_name: alumno.full_name,
          rut: alumno.rut,
          curso: alumno.curso,
          role,
        }, { onConflict: 'email' })

        if (profileError) {
          errores.push(`${alumno.email}: ${profileError.message}`)
        } else {
          ok.push(1)
        }
      } else {
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          email: alumno.email,
          full_name: alumno.full_name,
          rut: alumno.rut,
          curso: alumno.curso,
          role,
        })
        ok.push(1)
      }
    }

    await supabase.from('audit_log').insert({
      action: 'importar',
      entity: 'usuario',
      entity_name: `${ok.length} usuarios importados`,
    })

    setResultado({ ok: ok.length, errores })
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-900">Importar alumnos desde Excel</h1>
          <p className="text-gray-500 mt-1">Sube un archivo CSV con la lista de alumnos</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-5">

            {/* Instrucciones */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="font-semibold text-blue-900 mb-2">📋 Formato del archivo</h3>
              <p className="text-sm text-blue-700 mb-3">El archivo CSV debe tener estas columnas en la primera fila:</p>
              <code className="block bg-white rounded-lg p-3 text-xs text-gray-700 border border-blue-200">
                nombre,rut,correo,curso
              </code>
              <p className="text-xs text-blue-600 mt-2">Ejemplo de fila:</p>
              <code className="block bg-white rounded-lg p-3 text-xs text-gray-700 border border-blue-200">
                Juan Pérez,12.345.678-9,jperez@gmail.com,2° Medio B
              </code>
              <p className="text-xs text-blue-500 mt-3">
                💡 La contraseña inicial de cada usuario será su RUT sin puntos ni guión.
                Los correos @colprovidencia.cl se asignan como docentes automáticamente.
              </p>
            </div>

            {/* Subir archivo */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-blue-900 mb-4">Subir archivo CSV</h3>
              <input type="file" accept=".csv,.txt"
                onChange={handleFile}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <p className="text-xs text-gray-400 mt-2">Formatos aceptados: .csv, .txt</p>
              {error && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  ❌ {error}
                </div>
              )}
            </div>

            {/* Resultado */}
            {resultado && (
              <div className={`rounded-xl p-5 border ${resultado.errores.length === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <h3 className="font-semibold mb-2">Resultado de importación</h3>
                <p className="text-sm text-green-700">✅ {resultado.ok} usuarios importados correctamente</p>
                {resultado.errores.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-red-700 font-medium">❌ {resultado.errores.length} errores:</p>
                    <ul className="mt-1 space-y-1">
                      {resultado.errores.map((e, i) => (
                        <li key={i} className="text-xs text-red-600">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button onClick={() => router.push('/usuarios')}
                  className="mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  Ver usuarios →
                </button>
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            {preview.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-semibold text-blue-900">Vista previa ({preview.length} usuarios)</h3>
                  <button onClick={handleImport} disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
                    {loading ? 'Importando...' : '⬆️ Importar todos'}
                  </button>
                </div>
                <div className="overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Nombre</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">RUT</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Correo</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Curso</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">Rol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.map((u, i) => (
                        <tr key={i} className="hover:bg-blue-50">
                          <td className="px-4 py-2 text-gray-800">{u.full_name}</td>
                          <td className="px-4 py-2 text-gray-500">{u.rut}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{u.email}</td>
                          <td className="px-4 py-2 text-gray-500">{u.curso}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.email.endsWith('@colprovidencia.cl') ? 'bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700'}`}>
                              {u.email.endsWith('@colprovidencia.cl') ? 'docente' : 'estudiante'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
