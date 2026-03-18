import { Suspense } from 'react'
import AceptarInvitacionContent from './AceptarInvitacionContent'

export default function AceptarInvitacionPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-400 animate-pulse text-sm">Cargando invitación...</p>
      </div>
    }>
      <AceptarInvitacionContent />
    </Suspense>
  )
}
