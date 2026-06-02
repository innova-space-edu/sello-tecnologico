import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // La consulta usa RLS: solo devuelve la foto si el usuario puede ver la sesión.
  const { data: photo, error } = await supabase
    .from('followup_photos')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (error || !photo) {
    return NextResponse.json({ error: 'Fotografía no encontrada o sin autorización' }, { status: 404 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error: signError } = await admin.storage
    .from('seguimiento-fotos')
    .createSignedUrl(photo.storage_path, 60)

  if (signError || !data?.signedUrl) {
    return NextResponse.json({ error: 'No fue posible abrir la fotografía' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
