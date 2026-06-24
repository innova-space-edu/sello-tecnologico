import Sidebar from '@/components/Sidebar'
import SeguimientoForm from '@/components/seguimientos/SeguimientoForm'
import SeguimientoEstudianteForm from '@/components/seguimientos/SeguimientoEstudianteForm'
import Link from 'next/link'

type Props = {
  searchParams?: Promise<{ modo?: string }>
}

export default async function NuevoSeguimientoPage({ searchParams }: Props) {
  const params = await searchParams
  const modo = params?.modo === 'student' ? 'student' : 'teacher'
  const esEstudiante = modo === 'student'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
        <div className="mb-6">
          <Link href="/seguimientos" className="text-blue-600 text-sm hover:underline">← Volver a Seguimiento</Link>
          <div className="flex flex-wrap items-center gap-2 mt-2 mb-2">
            <h1 className="text-2xl font-bold text-blue-900">
              {esEstudiante ? 'Nuevo seguimiento de estudiante' : 'Nueva sesión de seguimiento docente'}
            </h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${esEstudiante ? 'bg-sky-100 text-sky-700' : 'bg-blue-100 text-blue-700'}`}>
              {esEstudiante ? 'Modalidad estudiante' : 'Modalidad docente'}
            </span>
          </div>
          <p className="text-gray-500 mt-1">
            {esEstudiante
              ? 'Registra el avance de tu equipo. El docente podrá revisar, editar y retroalimentar esta ficha.'
              : 'Evalúa el avance del proyecto y deja retroalimentación visible para los estudiantes seleccionados.'}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/seguimientos/nuevo?modo=teacher" className={`px-3 py-2 rounded-lg text-sm font-semibold border ${!esEstudiante ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-100'}`}>
              Seguimiento docente
            </Link>
            <Link href="/seguimientos/nuevo?modo=student" className={`px-3 py-2 rounded-lg text-sm font-semibold border ${esEstudiante ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-700 border-sky-100'}`}>
              Seguimiento estudiante
            </Link>
          </div>
        </div>
        <div className="max-w-6xl">
          {esEstudiante ? <SeguimientoEstudianteForm /> : <SeguimientoForm />}
        </div>
      </main>
    </div>
  )
}
