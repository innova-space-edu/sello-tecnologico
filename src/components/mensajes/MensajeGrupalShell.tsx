'use client'

import EnviarMensajeGrupalModal from './EnviarMensajeGrupalModal'

type Usuario = { id: string; full_name?: string | null; email?: string | null; role?: string | null; curso?: string | null }
type Props = { usuarios: Usuario[]; currentUser: Usuario }

export default function MensajeGrupalShell({ usuarios, currentUser }: Props) {
  const back = '/' + 'men' + 'sajes'
  const goBack = () => { window.location.assign(back) }
  return <EnviarMensajeGrupalModal usuarios={usuarios} currentUser={currentUser} onClose={goBack} onSent={goBack} />
}
