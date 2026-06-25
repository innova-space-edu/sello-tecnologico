'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeletePublicPageButton({ pageId, title }: { pageId: string; title: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la página "${title}"? Esta acción no se puede deshacer.`)) return
    setLoading(true)
    const { error } = await supabase
      .from('project_public_pages')
      .delete()
      .eq('id', pageId)

    if (error) {
      alert('No fue posible eliminar la página: ' + error.message)
      setLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="text-sm bg-red-50 hover:bg-red-100 border border-red-100 text-red-700 px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
    >
      {loading ? 'Eliminando…' : 'Eliminar'}
    </button>
  )
}
