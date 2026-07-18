'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { getSteamTemplate, PHASE_PROMPTS, ROUTE_LABELS, STEAM_PHASES, type SteamRoute } from '@/lib/steam-templates'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Workspace = { id: string; project_id: string; template_slug: string; route_type: SteamRoute; current_phase: number; progress_percent: number; safety_status: string; safety_notes?: string | null }
type PhaseEntry = { id: string; phase_number: number; phase_key: string; status: string; content: Record<string, string>; teacher_feedback?: string | null }
type Evidence = { id: string; title: string; type: string; file_url?: string | null; drive_url?: string | null; steam_phase_key?: string | null; steam_requirement_key?: string | null; steam_version_number?: number | null; created_at: string }
type Journal = { id: string; phase_number: number; work_done: string; problem_found?: string | null; next_step?: string | null; entry_date: string; teacher_comment?: string | null }
type TestRow = { id: string; criterion: string; expected_result?: string | null; obtained_result?: string | null; unit?: string | null; passed?: boolean | null; observation?: string | null; version_number: number }
type ProjectInfo = { id: string; title: string; steam_level?: string | null; courses?: { name?: string | null } | null }

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-500', in_progress: 'bg-blue-100 text-blue-700', submitted: 'bg-amber-100 text-amber-700',
  changes_requested: 'bg-orange-100 text-orange-700', approved: 'bg-emerald-100 text-emerald-700', completed: 'bg-emerald-100 text-emerald-700',
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'No iniciado', in_progress: 'En desarrollo', submitted: 'Enviado', changes_requested: 'Cambios solicitados', approved: 'Aprobado', completed: 'Completado',
}

export default function SteamWorkspacePage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const projectId = params.id
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [entries, setEntries] = useState<PhaseEntry[]>([])
  const [evidences, setEvidences] = useState<Evidence[]>([])
  const [journal, setJournal] = useState<Journal[]>([])
  const [tests, setTests] = useState<TestRow[]>([])
  const [role, setRole] = useState('')
  const [userId, setUserId] = useState('')
  const [selectedPhase, setSelectedPhase] = useState(Number(searchParams.get('phase') || 1))
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [journalForm, setJournalForm] = useState({ work: '', problem: '', next: '' })
  const [testForm, setTestForm] = useState({ criterion: '', expected: '', obtained: '', unit: '', passed: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    const [{ data: projectData }, { data: workspaceData }, { data: profile }] = await Promise.all([
      supabase.from('projects').select('*, courses(name)').eq('id', projectId).single(),
      supabase.from('steam_project_workspaces').select('*').eq('project_id', projectId).single(),
      supabase.from('profiles').select('role').eq('id', user.id).single(),
    ])
    if (!projectData || !workspaceData) { setError('Este proyecto no tiene una ruta STEAM guiada o aún no se ha instalado su migración.'); setLoading(false); return }
    setProject(projectData as ProjectInfo)
    setWorkspace(workspaceData as Workspace)
    setRole(profile?.role ?? '')
    const [{ data: phaseData }, { data: evidenceData }, { data: journalData }, { data: testData }] = await Promise.all([
      supabase.from('steam_phase_entries').select('*').eq('workspace_id', workspaceData.id).order('phase_number'),
      supabase.from('evidences').select('id, title, type, file_url, drive_url, steam_phase_key, steam_requirement_key, steam_version_number, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('steam_journal_entries').select('*').eq('workspace_id', workspaceData.id).order('created_at', { ascending: false }),
      supabase.from('steam_project_tests').select('*').eq('workspace_id', workspaceData.id).order('created_at'),
    ])
    setEntries((phaseData ?? []) as PhaseEntry[])
    setEvidences((evidenceData ?? []) as Evidence[])
    setJournal((journalData ?? []) as Journal[])
    setTests((testData ?? []) as TestRow[])
    const requested = Number(searchParams.get('phase'))
    const targetPhase = Number.isFinite(requested) && requested >= 1 && requested <= 8 ? requested : workspaceData.current_phase
    setSelectedPhase(targetPhase)
    const targetEntry = ((phaseData ?? []) as PhaseEntry[]).find(item => item.phase_number === targetPhase)
    setAnswers(targetEntry?.content ?? {})
    setLoading(false)
  }, [projectId, router, searchParams, supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const entry = entries.find(item => item.phase_number === selectedPhase)
  const phase = STEAM_PHASES.find(item => item.number === selectedPhase) ?? STEAM_PHASES[0]
  const route = (workspace?.route_type ?? 'engineering') as SteamRoute
  const prompts = PHASE_PROMPTS[route]?.[selectedPhase] ?? []
  const template = getSteamTemplate(workspace?.template_slug)
  const requirements = template?.evidence.filter(item => item.phase === selectedPhase) ?? []
  const phaseEvidence = evidences.filter(item => item.steam_phase_key === phase.key)
  const phaseJournal = journal.filter(item => item.phase_number === selectedPhase)
  const isStaff = ['admin', 'docente', 'coordinador', 'utp'].includes(role)

  const selectPhase = (number: number) => {
    setSelectedPhase(number)
    setAnswers(entries.find(item => item.phase_number === number)?.content ?? {})
    router.replace(`/proyectos/${projectId}/steam?phase=${number}`, { scroll: false })
    setMessage('')
  }

  const savePhase = async (complete = false) => {
    if (!entry || !workspace) return
    setSaving(true); setError(''); setMessage('')
    if (complete) {
      const answered = prompts.filter((_, index) => String(answers[`answer_${index}`] ?? '').trim()).length
      const requiredEvidence = requirements.filter(item => item.required)
      const missingEvidence = requiredEvidence.filter(requirement => !phaseEvidence.some(item => item.steam_requirement_key === requirement.key))
      if (answered < Math.min(2, prompts.length)) {
        setError('Responde al menos las dos preguntas principales antes de completar esta fase.'); setSaving(false); return
      }
      if (missingEvidence.length > 0) {
        setError(`Falta evidencia obligatoria: ${missingEvidence.map(item => item.label).join(', ')}.`); setSaving(false); return
      }
      if (selectedPhase === 3 && !String(answers.safety_review ?? '').trim()) {
        setError('Completa la revisión de seguridad, ética y permisos antes de cerrar el diseño.'); setSaving(false); return
      }
      if (selectedPhase === 4 && workspace.safety_status !== 'approved' && workspace.safety_status !== 'not_required') {
        setError('El docente debe aprobar la revisión de seguridad antes de construir o ejecutar el primer prototipo.'); setSaving(false); return
      }
    }

    const nextStatus = complete ? 'completed' : 'in_progress'
    const { error: updateError } = await supabase.from('steam_phase_entries').update({ content: answers, status: nextStatus, updated_at: new Date().toISOString() }).eq('id', entry.id)
    if (updateError) { setError(updateError.message); setSaving(false); return }

    if (complete) {
      const nextPhase = Math.min(8, selectedPhase + 1)
      const completedCount = entries.filter(item => item.status === 'completed' && item.phase_number !== selectedPhase).length + 1
      await supabase.from('steam_project_workspaces').update({ current_phase: nextPhase, progress_percent: Math.round(completedCount / 8 * 100), completed_at: completedCount === 8 ? new Date().toISOString() : null, ...(selectedPhase === 3 ? { safety_status: 'submitted', safety_notes: answers.safety_review } : {}), updated_at: new Date().toISOString() }).eq('id', workspace.id)
      if (selectedPhase < 8) await supabase.from('steam_phase_entries').update({ status: 'in_progress' }).eq('workspace_id', workspace.id).eq('phase_number', nextPhase).eq('status', 'not_started')

      if (selectedPhase === 4 || selectedPhase === 7) {
        const versionNumber = selectedPhase === 4 ? 1 : 2
        await supabase.from('steam_prototype_versions').upsert({ workspace_id: workspace.id, version_number: versionNumber, title: `Versión ${versionNumber}`, summary: answers.answer_0 || answers.answer_1 || `Resultado versión ${versionNumber}`, problems: answers.answer_3 || null, planned_changes: selectedPhase === 7 ? answers.answer_0 || null : null, result_summary: answers.answer_2 || null, created_by: userId }, { onConflict: 'workspace_id,version_number' })
      }
      setMessage(selectedPhase === 8 ? '🏁 Ruta STEAM completada. Ya puedes preparar el informe y la publicación.' : `✅ Fase completada. Ya puedes avanzar a ${STEAM_PHASES[nextPhase - 1].title}.`)
      await load()
      if (selectedPhase < 8) {
        setSelectedPhase(nextPhase)
        setAnswers({})
        router.replace(`/proyectos/${projectId}/steam?phase=${nextPhase}`, { scroll: false })
      }
    } else {
      setMessage('Borrador guardado correctamente.')
      await load()
    }
    setSaving(false)
  }

  const addJournal = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!workspace || !journalForm.work.trim()) return
    const { error: journalError } = await supabase.from('steam_journal_entries').insert({ workspace_id: workspace.id, phase_number: selectedPhase, author_id: userId, work_done: journalForm.work.trim(), problem_found: journalForm.problem.trim() || null, next_step: journalForm.next.trim() || null })
    if (journalError) { setError(journalError.message); return }
    setJournalForm({ work: '', problem: '', next: '' }); setMessage('Entrada de bitácora guardada.'); await load()
  }

  const addTest = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!workspace || !testForm.criterion.trim()) return
    const { error: testError } = await supabase.from('steam_project_tests').insert({ workspace_id: workspace.id, version_number: selectedPhase >= 7 ? 2 : 1, criterion: testForm.criterion.trim(), expected_result: testForm.expected.trim() || null, obtained_result: testForm.obtained.trim() || null, unit: testForm.unit.trim() || null, passed: testForm.passed === '' ? null : testForm.passed === 'yes', created_by: userId })
    if (testError) { setError(testError.message); return }
    setTestForm({ criterion: '', expected: '', obtained: '', unit: '', passed: '' }); setMessage('Prueba registrada.'); await load()
  }

  const reviewPhase = async (status: 'approved' | 'changes_requested') => {
    if (!entry || !isStaff) return
    const feedback = window.prompt(status === 'approved' ? 'Comentario opcional de aprobación:' : 'Explica brevemente qué debe corregir:') ?? ''
    await supabase.from('steam_phase_entries').update({ status, teacher_feedback: feedback || null, reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq('id', entry.id)
    if (selectedPhase === 3 && workspace) {
      await supabase.from('steam_project_workspaces').update({ safety_status: status === 'approved' ? 'approved' : 'changes_requested', safety_notes: feedback || workspace.safety_notes || null, updated_at: new Date().toISOString() }).eq('id', workspace.id)
    }
    setMessage(status === 'approved' ? 'Fase aprobada.' : 'Cambios solicitados.'); await load()
  }

  if (loading) return <div className="min-h-screen bg-slate-50 p-12 text-center text-slate-500">Preparando la ruta STEAM…</div>
  if (error && !workspace) return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="flex-1 p-8 pt-20 lg:ml-64"><div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center"><div className="text-5xl">⚠️</div><h1 className="mt-3 text-xl font-black">No pudimos abrir la ruta</h1><p className="mt-2 text-sm text-red-700">{error}</p><Link href="/proyectos" className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Volver a proyectos</Link></div></main></div>

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 pt-16 lg:ml-64 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 rounded-3xl bg-gradient-to-br from-blue-800 to-violet-800 p-6 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/proyectos" className="text-xs font-bold text-blue-200 hover:underline">← Proyectos</Link><p className="mt-3 text-xs font-black uppercase tracking-widest text-blue-200">{ROUTE_LABELS[route]}</p><h1 className="mt-1 text-2xl font-black">{project?.title}</h1><p className="mt-1 text-sm text-blue-100">{project?.courses?.name ?? project?.steam_level ?? 'Proyecto STEAM'} · {template?.title ?? 'Idea propia'}</p></div><div className="min-w-44 rounded-2xl bg-white/10 p-4 backdrop-blur"><div className="flex justify-between text-xs font-bold"><span>Progreso</span><span>{workspace?.progress_percent ?? 0}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${workspace?.progress_percent ?? 0}%` }} /></div><p className="mt-2 text-xs text-blue-100">Fase {workspace?.current_phase} de 8</p></div></div>
          </header>

          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
              <nav className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                {STEAM_PHASES.map(item => {
                  const phaseEntry = entries.find(row => row.phase_number === item.number)
                  const active = selectedPhase === item.number
                  return <button key={item.key} type="button" onClick={() => selectPhase(item.number)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-50'}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/90 text-lg shadow-sm">{item.icon}</span><span className="min-w-0 flex-1"><span className={`block text-[11px] font-bold ${active ? 'text-blue-100' : 'text-slate-400'}`}>Fase {item.number}</span><span className="block truncate text-sm font-black">{item.title}</span></span><span className={`h-2.5 w-2.5 rounded-full ${phaseEntry?.status === 'completed' || phaseEntry?.status === 'approved' ? 'bg-emerald-400' : phaseEntry?.status === 'in_progress' ? 'bg-blue-300' : phaseEntry?.status === 'changes_requested' ? 'bg-orange-400' : 'bg-slate-200'}`} /></button>
                })}
              </nav>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600"><p className="font-black text-slate-900">📝 Bitácora acumulada</p><p className="mt-1">{journal.length} registros del proceso. Agrega avances breves mientras trabajas.</p></div>
            </aside>

            <section className="min-w-0 space-y-5">
              {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}
              {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">⚠️ {error}</div>}

              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div className="flex gap-3"><span className="text-4xl">{phase.icon}</span><div><p className="text-xs font-black uppercase tracking-widest text-blue-600">Fase {phase.number}</p><h2 className="text-xl font-black text-slate-900">{phase.title}</h2><p className="mt-1 text-sm text-slate-500">{phase.help}</p></div></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${STATUS_STYLES[entry?.status ?? 'not_started']}`}>{STATUS_LABELS[entry?.status ?? 'not_started']}</span></div>
                <div className="space-y-5 p-5 sm:p-6">
                  {template && selectedPhase === 1 && <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900"><strong>Pregunta sugerida:</strong> {template.guidingQuestion}<p className="mt-1 text-xs text-violet-700">Úsala como punto de partida y adáptala a tus recursos e intereses.</p></div>}
                  <div className="space-y-4">{prompts.map((prompt, index) => <label key={prompt} className="block"><span className="text-sm font-bold text-slate-700">{index + 1}. {prompt}</span><textarea value={answers[`answer_${index}`] ?? ''} onChange={event => setAnswers(current => ({ ...current, [`answer_${index}`]: event.target.value }))} rows={index === 2 ? 4 : 3} placeholder="Escribe con tus propias palabras…" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-blue-300" /></label>)}</div>

                  {selectedPhase === 3 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-black text-amber-900">🛡️ Revisión de seguridad y ética</h3><p className="mt-1 text-xs text-amber-800">Describe herramientas, electricidad, sustancias, datos personales, imágenes, permisos y medidas de protección. Si existe riesgo, el docente debe revisar antes de ejecutar.</p><textarea value={answers.safety_review ?? ''} onChange={event => setAnswers(current => ({ ...current, safety_review: event.target.value }))} rows={3} placeholder="Riesgos y medidas de seguridad…" className="mt-3 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300" /></div>}

                  {requirements.length > 0 && <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-blue-950">📎 Evidencias de esta fase</h3><p className="text-xs text-blue-700">El botón ya llevará el proyecto, la fase y la versión correcta.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">{phaseEvidence.length} subida(s)</span></div><div className="mt-3 space-y-2">{requirements.map(requirement => { const uploaded = phaseEvidence.find(item => item.steam_requirement_key === requirement.key); const returnTo = encodeURIComponent(`/proyectos/${projectId}/steam?phase=${selectedPhase}`); return <div key={requirement.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-3"><div><p className="text-sm font-bold text-slate-800">{uploaded ? '✅' : requirement.required ? '🔵' : '⚪'} {requirement.label}</p><p className="text-xs text-slate-400">{requirement.required ? 'Obligatoria' : 'Opcional'}{requirement.version ? ` · versión ${requirement.version}` : ''}</p></div>{uploaded ? <Link href={uploaded.file_url || uploaded.drive_url || `/evidencias/${uploaded.id}`} target={uploaded.file_url || uploaded.drive_url ? '_blank' : undefined} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">Ver evidencia</Link> : <Link href={`/evidencias/nueva?proyecto=${projectId}&steam_phase=${phase.key}&requirement=${requirement.key}&version=${requirement.version ?? ''}&type=${encodeURIComponent(requirement.type)}&title=${encodeURIComponent(requirement.label)}&returnTo=${returnTo}`} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700">+ Subir evidencia</Link>}</div>})}</div></div>}

                  {(selectedPhase === 5 || selectedPhase === 7) && <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4"><h3 className="font-black text-purple-950">🧪 Registro de pruebas</h3><p className="mt-1 text-xs text-purple-700">Convierte “funciona” en datos que se puedan comparar.</p><form onSubmit={addTest} className="mt-3 grid gap-2 md:grid-cols-2"><input required value={testForm.criterion} onChange={event => setTestForm({ ...testForm, criterion: event.target.value })} placeholder="Criterio: resistencia, precisión…" className="rounded-xl border border-purple-100 px-3 py-2 text-sm" /><input value={testForm.expected} onChange={event => setTestForm({ ...testForm, expected: event.target.value })} placeholder="Resultado esperado" className="rounded-xl border border-purple-100 px-3 py-2 text-sm" /><input value={testForm.obtained} onChange={event => setTestForm({ ...testForm, obtained: event.target.value })} placeholder="Resultado obtenido" className="rounded-xl border border-purple-100 px-3 py-2 text-sm" /><div className="flex gap-2"><input value={testForm.unit} onChange={event => setTestForm({ ...testForm, unit: event.target.value })} placeholder="Unidad" className="min-w-0 flex-1 rounded-xl border border-purple-100 px-3 py-2 text-sm" /><select value={testForm.passed} onChange={event => setTestForm({ ...testForm, passed: event.target.value })} className="rounded-xl border border-purple-100 px-3 py-2 text-sm"><option value="">¿Cumplió?</option><option value="yes">Sí</option><option value="no">No</option></select></div><button className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white md:col-span-2">+ Registrar prueba</button></form>{tests.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-purple-500"><th className="pb-2">Versión</th><th className="pb-2">Criterio</th><th className="pb-2">Esperado</th><th className="pb-2">Obtenido</th><th className="pb-2">Resultado</th></tr></thead><tbody className="divide-y divide-purple-100">{tests.map(test => <tr key={test.id}><td className="py-2 font-bold">V{test.version_number}</td><td className="py-2">{test.criterion}</td><td className="py-2">{test.expected_result ?? '—'}</td><td className="py-2">{test.obtained_result ?? '—'} {test.unit}</td><td className="py-2">{test.passed == null ? '—' : test.passed ? '✅' : '❌'}</td></tr>)}</tbody></table></div>}</div>}

                  {selectedPhase === 6 && <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4"><h3 className="font-black text-cyan-950">🌐 Pide ayuda a la comunidad</h3><p className="mt-1 text-sm text-cyan-800">Publica tu primera versión indicando si necesitas ideas, detección de errores, interpretación de resultados o evaluación del diseño.</p><div className="mt-3 flex flex-wrap gap-2"><Link href={`/proyectos/${projectId}/pagina`} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-black text-white">Preparar publicación</Link><Link href={`/proyectos/${projectId}`} className="rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-sm font-black text-cyan-800">Ver comentarios del proyecto</Link></div></div>}

                  {entry?.teacher_feedback && <div className={`rounded-2xl border p-4 ${entry.status === 'changes_requested' ? 'border-orange-200 bg-orange-50 text-orange-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}><p className="text-xs font-black uppercase tracking-wide">Retroalimentación docente</p><p className="mt-1 whitespace-pre-wrap text-sm">{entry.teacher_feedback}</p></div>}

                  <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5"><button type="button" disabled={saving} onClick={() => savePhase(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">{saving ? 'Guardando…' : '💾 Guardar borrador'}</button><div className="flex flex-wrap gap-2">{isStaff && <><button type="button" onClick={() => reviewPhase('changes_requested')} className="rounded-xl border border-orange-200 px-4 py-3 text-sm font-black text-orange-700">Solicitar cambios</button><button type="button" onClick={() => reviewPhase('approved')} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-black text-emerald-700">Aprobar</button></>}<button type="button" disabled={saving || entry?.status === 'completed'} onClick={() => savePhase(true)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300">{selectedPhase === 8 ? '🏁 Finalizar proyecto' : 'Completar y continuar →'}</button></div></div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-black text-slate-900">📝 Bitácora rápida</h2><p className="text-xs text-slate-500">Un registro breve de esta sesión, sin repetir el informe.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{phaseJournal.length}</span></div><form onSubmit={addJournal} className="mt-4 grid gap-3 md:grid-cols-3"><textarea required value={journalForm.work} onChange={event => setJournalForm({ ...journalForm, work: event.target.value })} rows={2} placeholder="¿Qué hicimos hoy? *" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><textarea value={journalForm.problem} onChange={event => setJournalForm({ ...journalForm, problem: event.target.value })} rows={2} placeholder="¿Qué problema encontramos?" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><textarea value={journalForm.next} onChange={event => setJournalForm({ ...journalForm, next: event.target.value })} rows={2} placeholder="¿Qué haremos después?" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white md:col-span-3">Guardar avance de hoy</button></form>{phaseJournal.length > 0 && <div className="mt-4 space-y-2">{phaseJournal.slice(0, 4).map(item => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-3"><strong className="text-slate-800">{new Date(`${item.entry_date}T12:00:00`).toLocaleDateString('es-CL')}</strong><span className="text-xs text-slate-400">Fase {item.phase_number}</span></div><p className="mt-1 text-slate-600">{item.work_done}</p>{item.next_step && <p className="mt-1 text-xs text-blue-700"><strong>Siguiente:</strong> {item.next_step}</p>}{item.teacher_comment && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800"><strong>Docente:</strong> {item.teacher_comment}</p>}</div>)}</div>}</div>

              {selectedPhase === 8 && <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><h2 className="font-black text-emerald-950">📄 Cierre del proyecto</h2><p className="mt-1 text-sm text-emerald-800">Cuando completes la fase final, reutiliza toda la información y las evidencias para preparar el informe y la página pública.</p><div className="mt-4 flex flex-wrap gap-2"><Link href={`/informes/nuevo?project=${projectId}`} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white">Crear informe</Link><Link href={`/proyectos/${projectId}/pagina`} className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-800">Preparar página pública</Link></div></div>}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
