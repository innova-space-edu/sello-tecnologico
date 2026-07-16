'use client'

type Person = { id: string; full_name?: string | null; email?: string | null }
type Member = { id: string; user_id: string; member_role: 'leader' | 'editor'; profiles?: Person | null }

type Props = {
  members: Member[]
  classmates: Person[]
  isLeader: boolean
  onlineUserIds: string[]
  onAdd: (userId: string) => void
  onRemove: (memberId: string) => void
}

export default function ReportTeamPanel({ members, classmates, isLeader, onlineUserIds, onAdd, onRemove }: Props) {
  const currentIds = new Set(members.map(member => member.user_id))
  const available = classmates.filter(person => !currentIds.has(person.id))

  return <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className="border-b border-gray-100 p-4">
      <h2 className="font-bold text-blue-900">👥 Equipo del informe</h2>
      <p className="mt-1 text-xs text-gray-500">El creador es el jefe. Los compañeros agregados quedan automáticamente como editores y colaboradores.</p>
    </div>
    <div className="space-y-2 p-3">
      {members.map(member => {
        const online = onlineUserIds.includes(member.user_id)
        return <div key={member.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-black text-blue-700">{member.profiles?.full_name?.[0]?.toUpperCase() ?? '?' }{online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-gray-800">{member.profiles?.full_name ?? member.profiles?.email ?? 'Estudiante'}</p><p className="text-xs text-gray-400">{member.member_role === 'leader' ? 'Jefe del grupo' : 'Editor y colaborador'}{online ? ' · En línea' : ''}</p></div>
          {isLeader && member.member_role !== 'leader' && <button type="button" onClick={() => onRemove(member.id)} className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Quitar</button>}
        </div>
      })}
    </div>
    {isLeader && <div className="border-t border-gray-100 p-4">
      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Agregar compañero del curso</label>
      <select defaultValue="" onChange={event => { if (event.target.value) onAdd(event.target.value); event.currentTarget.value = '' }} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
        <option value="">Selecciona un estudiante</option>
        {available.map(person => <option key={person.id} value={person.id}>{person.full_name ?? person.email}</option>)}
      </select>
      {available.length === 0 && <p className="mt-2 text-xs text-gray-400">No quedan compañeros disponibles para agregar.</p>}
    </div>}
  </section>
}
