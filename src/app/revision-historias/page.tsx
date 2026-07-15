import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ReviewStoriesClient from './ReviewStoriesClient'

export default async function ReviewStoriesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!['admin','docente','coordinador','utp'].includes(profile?.role ?? '')) redirect('/dashboard')

  return <ReviewStoriesClient />
}
