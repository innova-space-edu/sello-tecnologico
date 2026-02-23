'use client'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'

const TIME_SLOTS = [
  '8:00 - 8:45',
  '8:45 - 9:30',
  '9:45 - 10:30',
  '10:30 - 11:15',
  '11:30 - 12:15',
  '12:15 - 13:00',
  '13:10 - 13:55',
  '14:40 - 16:10',
]

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
}

function getWeekDates(offset: number) {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatDisplay(d: Date) {
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export default function CalendarioPage() {
  const supabase = createClient()
  const [weekOffset, setWeekOffset] = useState(0)
  const [events, setEvents] = useState<any[]>([])
  const [cursos, setCursos] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', date: '', time_slot: TIME_SLOTS[0],
    course_id: '', color: 'blue'
  })

  const weekDates = getWeekDates(weekOffset)

  const fetchEvents = async () => {
    const start = formatDate(weekDates[0])
    const end = formatDate(weekDates[4])
    const { data } = await supabase
      .from('calendar_events')
      .select('*, courses(name)')
      .gte('date', start)
      .lte('date', end)
    setEvents(data ?? [])
  }

  useEffect(() => {
    fetchEvents()
    supabase.from('courses').select('id, name').then(({ data }) => setCursos(data ?? []))
  }, [weekOffset])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('calendar_events').insert({
      ...form,
      course_id: form.course_id || null,
      created_by: user?.id
    })
    setForm({ title: '', description: '', date: '', time_slot: TIME_SLOTS[0], course_id: '', color: 'blue' })
    setShowForm(false)
    setLoading(false)
    fetchEvents()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return
    await supabase.from('calendar_events').delete().eq('id', id)
    fetchEvents()
  }

  const getEventsFor = (date: Date, slot: string) =>
    events.filter(e => e.date === formatDate(date) && e.time_slot === slot)

  const today = formatDate(new Date())

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 flex-1 p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Calendario Semanal</h1>
            <p className="text-gray-500 mt-0.5 text-sm">
              {formatDisplay(weekDates[0])} — {formatDisplay(weekDates[4])}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition-colors">
              ← Anterior
            </button>
            <button onClick={() => setWeekOffset(0)}
              className="px-3 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm hover:bg-blue-50 transition-colors">
              Hoy
            </button>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition-colors">
              Siguiente →
            </button>
            <button onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
              + Agregar evento
            </button>
          </div>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-4">Nuevo evento</h3>
            <form onSubmit={handleSave} className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Nombre del evento o clase"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                <select value={form.color} onChange={e => setForm({...form, color: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {Object.keys(colorMap).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
                <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bloque horario *</label>
                <select required value={form.time_slot} onChange={e => setForm({...form, time_slot: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Curso</label>
                <select value={form.course_id} onChange={e => setForm({...form, course_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Sin curso</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Descripción opcional..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="col-span-3 flex gap-3">
                <button type="submit" disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-xl text-sm transition-colors disabled:opacity-50">
                  {loading ? 'Guardando...' : '💾 Guardar evento'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="border border-gray-300 text-gray-600 px-6 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Grilla del calendario */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-gray-500 font-medium w-28">Horario</th>
                {weekDates.map((d, i) => (
                  <th key={i} className={`px-3 py-3 text-center font-medium border-l border-gray-200 ${
                    formatDate(d) === today ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                  }`}>
                    <div className="text-xs text-gray-400 font-normal">{DAYS[i]}</div>
                    <div className={`text-lg font-bold ${formatDate(d) === today ? 'text-blue-600' : 'text-gray-800'}`}>
                      {d.getDate()}
                    </div>
                    <div className="text-xs text-gray-400">{d.toLocaleDateString('es-CL', { month: 'short' })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot, si) => (
                <tr key={si} className={`border-b border-gray-100 ${si % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-2 text-xs text-gray-400 font-medium whitespace-nowrap border-r border-gray-200">
                    {slot}
                  </td>
                  {weekDates.map((d, di) => {
                    const slotEvents = getEventsFor(d, slot)
                    const isToday = formatDate(d) === today
                    return (
                      <td key={di} className={`px-2 py-1.5 border-l border-gray-200 align-top ${
                        isToday ? 'bg-blue-50 bg-opacity-30' : ''
                      }`} style={{ minHeight: '48px' }}>
                        {slotEvents.map(ev => (
                          <div key={ev.id}
                            className={`text-xs px-2 py-1.5 rounded-lg border mb-1 cursor-pointer group relative ${colorMap[ev.color] ?? colorMap.blue}`}>
                            <div className="font-semibold truncate pr-4">{ev.title}</div>
                            {ev.courses?.name && (
                              <div className="text-xs opacity-70 truncate">{ev.courses.name}</div>
                            )}
                            <button onClick={() => handleDelete(ev.id)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 text-xs leading-none">
                              ✕
                            </button>
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
