'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  intervalo?: number // milisegundos, por defecto 5000
}

export default function AdminAutoRefresh({ intervalo = 5000 }: Props) {
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh() // re-ejecuta el Server Component sin recargar la página
    }, intervalo)

    return () => clearInterval(timer)
  }, [intervalo, router])

  return null // componente invisible
}
