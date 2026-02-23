import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function BloqueadoPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('profiles')
    .select('full_name, blocked_reason, blocked_at')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">

        <div className="text-6xl mb-4">🔒</div>

        <h1 className="text-2xl font-bold text-red-700 mb-2">Cuenta bloqueada</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Hola <strong>{perfil?.full_name}</strong>, tu cuenta ha sido bloqueada temporalmente
          por uso inapropiado de la plataforma.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-red-600 mb-1">Motivo:</p>
          <p className="text-sm text-red-700">{perfil?.blocked_reason ?? 'Uso inapropiado detectado'}</p>
          {perfil?.blocked_at && (
            <p className="text-xs text-red-400 mt-2">
              Bloqueado el: {new Date(perfil.blocked_at).toLocaleString('es-CL')}
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-700">
            Un administrador revisará tu caso y desbloqueará tu cuenta cuando corresponda.
            Si crees que es un error, contacta a tu profesor o coordinador.
          </p>
        </div>

        <p className="text-xs text-gray-400">
          Colegio Providencia — Plataforma Sello Tecnológico
        </p>
      </div>
    </div>
  )
}
