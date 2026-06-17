'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function Page(){
  const supabase = createClient()
  const [ok, setOk] = useState(false)
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setOk(Boolean(data.user))) }, [])
  return <div className="flex min-h-screen bg-gray-50"><Sidebar /><main className="lg:ml-64 flex-1 p-8">Enviar mensaje grupal {ok ? 'ok' : ''}</main></div>
}
