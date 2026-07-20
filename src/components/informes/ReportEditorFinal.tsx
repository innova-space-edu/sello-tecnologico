'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { calculateChileanGrade, DEFAULT_REPORT_RUBRIC } from '@/lib/project-report-final'
import ReportResourceLibrary, { type ReportResource } from './ReportResourceLibrary'
import ReportSectionCard, { type ReportSection, type SectionComment } from './ReportSectionCard'
import ReportTeamPanel from './ReportTeamPanel'
import ReportRubricPanelFinal from './ReportRubricPanelFinal'

const STAFF_ROLES = ['admin', 'docente', 'coordinador', 'utp']
const EDITABLE_STATUSES = ['draft', 'changes_requested']
const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  in_review: 'En revisión',
  changes_requested: 'Cambios solicitados',
  evaluated: 'Evaluado',
  finalized: 'Finalizado',
}
const statusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  changes_requested: 'bg-orange-100 text-orange-700',
  evaluated: 'bg-green-100 text-green-700',
  finalized: 'bg-purple-100 text-purple-700',
}

type Member = {
  id: string
  user_id: string
  member_role: 'leader' | 'editor'
  profiles?: { id: string; full_name?: string | null; email?: string | null } | null
}
type Person = { id: string; full_name?: string | null; email?: string | null }
type Criterion = {
  id: string
  title: string
  description?: string | null
  max_points: number
  student_example?: string | null
  teacher_example?: string | null
  sort_order?: number
}

export default function ReportEditorFinal({ reportId }: { reportId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [userName, setUserName] = useState('')
  const [report, setReport] = useState<any>(null)
  const [sections, setSections] = useState<ReportSection[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [classmates, setClassmates] = useState<Person[]>([])
  const [comments, setComments] = useState<SectionComment[]>([])
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [resources, setResources] = useState<ReportResource[]>([])
  const [activeSectionId, setActiveSectionId] = useState('')
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved')
  const [rubric, setRubric] = useState<any>(null)
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [evaluation, setEvaluation] = useState<any>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [scoreFeedback, setScoreFeedback] = useState<Record<string, string>>({})
  const [generalFeedback, setGeneralFeedback] = useState('')

  const sectionsRef = useRef<ReportSection[]>([])
  const dirtyIdsRef = useRef(new Set<string>())
  const savingRef = useRef(false)
  const titleDirtyRef = useRef(false)
  const reportRef = useRef<any>(null)

  useEffect(() => { sectionsRef.current = sections }, [sections])
  useEffect(() => { reportRef.current = report }, [report])

  const isStaff = STAFF_ROLES.includes(role)
  const isLeader = report?.created_by === userId
  const isMember = members.some(member => member.user_id === userId)
  const canEdit = !isStaff && Boolean(report) && EDITABLE_STATUSES.includes(report.status) && (isLeader || isMember)

  const refreshMembers = async (currentReport = report) => {
    if (!currentReport?.id) return
    const { data } = await supabase
      .from('project_report_members')
      .select('id, user_id, member_role, profiles!project_report_members_user_id_fkey(id, full_name, email)')
      .eq('report_id', currentReport.id)
      .order('created_at')
    setMembers((data ?? []) as unknown as Member[])
  }

  const refreshComments = async () => {
    const { data } = await supabase
      .from('project_report_comments')
      .select('id, report_id, section_id, body, status, created_at, profiles!project_report_comments_author_id_fkey(full_name, role)')
      .eq('report_id', reportId)
      .order('created_at')
    setComments((data ?? []) as unknown as SectionComment[])
  }

  const loadRubric = async (courseId?: string | null) => {
    if (!courseId) return
    const { data: rubricRow } = await supabase
      .from('project_report_rubrics')
      .select('*')
      .eq('course_id', courseId)
      .eq('published', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setRubric(rubricRow ?? null)
    if (!rubricRow) { setCriteria([]); return }
    const { data: criteriaRows } = await supabase
      .from('project_report_rubric_criteria')
      .select('*')
      .eq('rubric_id', rubricRow.id)
      .order('sort_order')
    setCriteria((criteriaRows ?? []) as Criterion[])
  }

  const loadEvaluation = async () => {
    const { data: evaluationRow } = await supabase
      .from('project_report_evaluations')
      .select('*')
      .eq('report_id', reportId)
      .maybeSingle()
    setEvaluation(evaluationRow ?? null)
    setGeneralFeedback(evaluationRow?.general_feedback ?? '')
    if (!evaluationRow) { setScores({}); setScoreFeedback({}); return }
    const { data: scoreRows } = await supabase
      .from('project_report_scores')
      .select('criterion_id, score, feedback')
      .eq('evaluation_id', evaluationRow.id)
    const nextScores: Record<string, number> = {}
    const nextFeedback: Record<string, string> = {}
    for (const row of scoreRows ?? []) {
      nextScores[row.criterion_id] = Number(row.score ?? 0)
      nextFeedback[row.criterion_id] = row.feedback ?? ''
    }
    setScores(nextScores)
    setScoreFeedback(nextFeedback)
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Debes iniciar sesión para abrir el informe.'); setLoading(false); return }
      const [{ data: profile }, { data: reportRow }] = await Promise.all([
        supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
        supabase.from('project_reports').select('*, projects(id, title, description), courses(id, name)').eq('id', reportId).single(),
      ])
      if (!active) return
      if (!reportRow) { setError('No se encontró el informe o no tienes acceso.'); setLoading(false); return }
      setUserId(user.id)
      setRole(profile?.role ?? '')
      setUserName(profile?.full_name ?? user.email ?? 'Usuario')
      setReport(reportRow)

      const [{ data: sectionRows }, { data: courseMemberRows }, resourceResponse] = await Promise.all([
        supabase.from('project_report_sections').select('*').eq('report_id', reportId).order('sort_order'),
        reportRow.course_id ? supabase.from('course_members').select('user_id').eq('course_id', reportRow.course_id) : Promise.resolve({ data: [] as any[] }),
        fetch(`/api/informes/${reportId}/resources`).then(response => response.ok ? response.json() : { resources: [] }).catch(() => ({ resources: [] })),
      ])
      const nextSections = (sectionRows ?? []) as ReportSection[]
      setSections(nextSections)
      setActiveSectionId(nextSections[0]?.id ?? '')
      setResources(resourceResponse.resources ?? [])

      const ids = (courseMemberRows ?? []).map((row: any) => row.user_id)
      if (ids.length) {
        const { data: people } = await supabase.from('profiles').select('id, full_name, email').in('id', ids).order('full_name')
        setClassmates((people ?? []) as Person[])
      }

      await Promise.all([refreshMembers(reportRow), refreshComments(), loadRubric(reportRow.course_id), loadEvaluation()])
      setLoading(false)
    }
    load()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, supabase])

  const saveDirty = async () => {
    if (!userId || savingRef.current || (!dirtyIdsRef.current.size && !titleDirtyRef.current)) return
    savingRef.current = true
    setSaveState('saving')
    const ids = Array.from(dirtyIdsRef.current)
    try {
      for (const id of ids) {
        const section = sectionsRef.current.find(item => item.id === id)
        if (!section) continue
        const { error: sectionError } = await supabase
          .from('project_report_sections')
          .update({ title: section.title, content: section.content, updated_by: userId, updated_at: new Date().toISOString() })
          .eq('id', section.id)
        if (sectionError) throw sectionError
        dirtyIdsRef.current.delete(id)
      }
      if (titleDirtyRef.current && reportRef.current) {
        const { error: titleError } = await supabase
          .from('project_reports')
          .update({ title: reportRef.current.title, updated_at: new Date().toISOString() })
          .eq('id', reportId)
        if (titleError) throw titleError
        titleDirtyRef.current = false
      }
      setSaveState('saved')
    } catch (err: any) {
      setSaveState('error')
      setError(err?.message ?? 'No fue posible guardar los cambios.')
    } finally {
      savingRef.current = false
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => { void saveDirty() }, 5000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reportId])

  useEffect(() => {
    if (!userId || !reportId) return
    const channel = supabase.channel(`report-live-${reportId}`, { config: { presence: { key: userId } } })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>
        setOnlineUserIds(Array.from(new Set(Object.values(state).flat().map(item => item.user_id).filter(Boolean) as string[])))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_report_sections', filter: `report_id=eq.${reportId}` }, payload => {
        const incoming = payload.new as ReportSection
        setSections(prev => prev.some(row => row.id === incoming.id) ? prev : [...prev, incoming].sort((a, b) => a.sort_order - b.sort_order))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'project_report_sections', filter: `report_id=eq.${reportId}` }, payload => {
        const incoming = payload.new as ReportSection
        if (!dirtyIdsRef.current.has(incoming.id)) setSections(prev => prev.map(row => row.id === incoming.id ? incoming : row))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'project_report_sections', filter: `report_id=eq.${reportId}` }, payload => {
        const removed = payload.old as { id?: string }
        setSections(prev => prev.filter(row => row.id !== removed.id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_report_comments', filter: `report_id=eq.${reportId}` }, () => { void refreshComments() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_report_members', filter: `report_id=eq.${reportId}` }, () => { void refreshMembers(reportRef.current) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'project_reports', filter: `id=eq.${reportId}` }, payload => {
        setReport((current: any) => ({ ...current, ...(payload.new as any) }))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await channel.track({ user_id: userId, name: userName, online_at: new Date().toISOString() })
      })
    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, supabase, userId, userName])

  const updateSection = (id: string, patch: Partial<ReportSection>) => {
    if (!canEdit) return
    setSections(prev => prev.map(section => section.id === id ? { ...section, ...patch } : section))
    dirtyIdsRef.current.add(id)
    setSaveState('dirty')
  }

  const insertResource = (resource: ReportResource) => {
    if (!canEdit || !activeSectionId) return
    const section = sectionsRef.current.find(item => item.id === activeSectionId)
    if (!section) return
    const existing = Array.isArray(section.content?.resources) ? section.content.resources : []
    const importedText = typeof resource.metadata?.text === 'string' ? resource.metadata.text.trim() : ''
    const currentText = String(section.content?.text ?? '')
    updateSection(section.id, {
      content: {
        ...section.content,
        text: importedText && !currentText.includes(importedText) ? `${currentText}${currentText ? '\n\n' : ''}${importedText}` : currentText,
        resources: [...existing, resource],
      },
    })
    setMessage(`Se agregó “${resource.title}” a la sección activa.`)
  }

  const addSection = async (sectionType: 'title' | 'text' | 'table' | 'resources') => {
    if (!canEdit) return
    const content = sectionType === 'table'
      ? { text: '', table: [['Columna 1', 'Columna 2'], ['', '']] }
      : sectionType === 'resources' ? { text: '', resources: [] } : { text: '' }
    const title = sectionType === 'title'
      ? 'Nuevo título'
      : sectionType === 'table'
        ? 'Nueva tabla o cuadro'
        : sectionType === 'resources'
          ? 'Imágenes, videos y otros recursos'
          : 'Nueva sección de texto'
    const { data, error: insertError } = await supabase.from('project_report_sections').insert({
      report_id: reportId,
      section_type: sectionType,
      title,
      content,
      student_example: sectionType === 'table' ? 'Ejemplo: organiza indicadores, resultados o comparaciones en filas y columnas.' : 'Escribe la información con tus propias palabras y respáldala con evidencias.',
      teacher_example: sectionType === 'table' ? 'Revisar claridad de encabezados, datos y análisis asociado.' : 'Revisar claridad, coherencia y uso de evidencias.',
      sort_order: sectionsRef.current.length,
      created_by: userId,
      updated_by: userId,
    }).select('*').single()
    if (insertError || !data) { setError(insertError?.message ?? 'No se pudo agregar la sección.'); return }
    setSections(prev => prev.some(section => section.id === data.id) ? prev : [...prev, data as ReportSection].sort((a, b) => a.sort_order - b.sort_order))
    setActiveSectionId(data.id)
  }

  const moveSection = async (id: string, direction: -1 | 1) => {
    if (!canEdit) return
    const currentIndex = sectionsRef.current.findIndex(section => section.id === id)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sectionsRef.current.length) return
    const next = [...sectionsRef.current]
    const [moved] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, moved)
    const reordered = next.map((section, index) => ({ ...section, sort_order: index }))
    setSections(reordered)
    sectionsRef.current = reordered
    const updates = reordered.map(section => supabase.from('project_report_sections').update({ sort_order: section.sort_order, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', section.id))
    const results = await Promise.all(updates)
    const moveError = results.find(result => result.error)?.error
    if (moveError) setError(moveError.message)
  }

  const removeSection = async (id: string) => {
    if (!canEdit) return
    if (!window.confirm('¿Eliminar esta sección del informe?')) return
    const { error: deleteError } = await supabase.from('project_report_sections').delete().eq('id', id)
    if (deleteError) { setError(deleteError.message); return }
    setSections(prev => prev.filter(section => section.id !== id))
    if (activeSectionId === id) setActiveSectionId(sections.find(section => section.id !== id)?.id ?? '')
  }

  const addMember = async (classmateId: string) => {
    if (!isLeader) return
    const { error: memberError } = await supabase.from('project_report_members').insert({ report_id: reportId, user_id: classmateId, member_role: 'editor', added_by: userId })
    if (memberError) { setError(memberError.message); return }
    await refreshMembers(report)
  }

  const removeMember = async (memberId: string) => {
    if (!isLeader) return
    const { error: memberError } = await supabase.from('project_report_members').delete().eq('id', memberId)
    if (memberError) { setError(memberError.message); return }
    await refreshMembers(report)
  }

  const addComment = async (sectionId: string) => {
    const body = commentDrafts[sectionId]?.trim()
    if (!isStaff || !body) return
    const { error: commentError } = await supabase.from('project_report_comments').insert({ report_id: reportId, section_id: sectionId, author_id: userId, body, status: 'open' })
    if (commentError) { setError(commentError.message); return }
    setCommentDrafts(prev => ({ ...prev, [sectionId]: '' }))
    await refreshComments()
  }

  const resolveComment = async (commentId: string) => {
    if (!isStaff) return
    await supabase.from('project_report_comments').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', commentId)
    await refreshComments()
  }

  const reportAction = async (action: string, actionMessage?: string) => {
    setError('')
    if (action === 'submit') {
      while (savingRef.current) await new Promise(resolve => window.setTimeout(resolve, 100))
      await saveDirty()
      if (dirtyIdsRef.current.size || titleDirtyRef.current || savingRef.current) {
        setError('El informe todavía tiene cambios pendientes. Revisa el estado de guardado e intenta enviarlo nuevamente.')
        return
      }
    }
    const response = await fetch(`/api/informes/${reportId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, message: actionMessage }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setError(result.error ?? 'No fue posible actualizar el informe.'); return }
    setReport((current: any) => ({ ...current, status: result.status }))
    setMessage('Estado del informe actualizado y notificaciones enviadas.')
  }

  const createDefaultRubric = async () => {
    if (!isStaff || !report?.course_id) return
    setError('')
    const totalPoints = DEFAULT_REPORT_RUBRIC.reduce((sum, row) => sum + row.max_points, 0)
    const { data: rubricRow, error: rubricError } = await supabase.from('project_report_rubrics').insert({
      course_id: report.course_id,
      created_by: userId,
      title: `Rúbrica de informe de proyecto — ${report.courses?.name ?? 'Curso'}`,
      description: 'Rúbrica compartida con el curso. La nota se calcula en escala 1,0 a 7,0, con 60% de exigencia para obtener 4,0.',
      total_points: totalPoints,
      published: true,
    }).select('*').single()
    if (rubricError || !rubricRow) { setError(rubricError?.message ?? 'No se pudo crear la rúbrica.'); return }
    const rows = DEFAULT_REPORT_RUBRIC.map((criterion, index) => ({ ...criterion, rubric_id: rubricRow.id, sort_order: index }))
    const { data: criteriaRows, error: criteriaError } = await supabase.from('project_report_rubric_criteria').insert(rows).select('*')
    if (criteriaError) { setError(criteriaError.message); return }
    setRubric(rubricRow)
    setCriteria((criteriaRows ?? []) as Criterion[])
    await reportAction('rubric_published')
  }

  const calculateAndSaveGrade = async () => {
    if (!isStaff || !rubric || !criteria.length) return
    if (!['submitted', 'in_review', 'evaluated'].includes(report?.status)) {
      setError('El informe debe estar enviado o en revisión antes de calcular la nota.')
      return
    }
    const total = criteria.reduce((sum, criterion) => sum + Number(criterion.max_points), 0)
    const earned = criteria.reduce((sum, criterion) => sum + Math.min(Math.max(Number(scores[criterion.id] ?? 0), 0), Number(criterion.max_points)), 0)
    const finalGrade = calculateChileanGrade(earned, total, 60)

    const { data: evaluationRow, error: evaluationError } = await supabase.from('project_report_evaluations').upsert({
      report_id: reportId,
      rubric_id: rubric.id,
      evaluator_id: userId,
      total_points: total,
      earned_points: earned,
      final_grade: finalGrade,
      general_feedback: generalFeedback,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'report_id' }).select('*').single()
    if (evaluationError || !evaluationRow) { setError(evaluationError?.message ?? 'No se pudo guardar la evaluación.'); return }

    const scoreRows = criteria.map(criterion => ({
      evaluation_id: evaluationRow.id,
      criterion_id: criterion.id,
      score: Math.min(Math.max(Number(scores[criterion.id] ?? 0), 0), Number(criterion.max_points)),
      feedback: scoreFeedback[criterion.id]?.trim() || null,
    }))
    const { error: scoreError } = await supabase.from('project_report_scores').upsert(scoreRows, { onConflict: 'evaluation_id,criterion_id' })
    if (scoreError) { setError(scoreError.message); return }
    setEvaluation(evaluationRow)
    await reportAction('evaluated', `El informe ${report.title} obtuvo ${earned.toFixed(1)} de ${total.toFixed(1)} puntos y nota ${finalGrade.toFixed(1)}.`)
    setMessage(`Evaluación guardada: ${earned.toFixed(1)}/${total.toFixed(1)} puntos, nota ${finalGrade.toFixed(1)}.`)
  }

  if (loading) return <div className="rounded-xl bg-white p-12 text-center text-gray-400">Cargando informe colaborativo…</div>
  if (error && !report) return <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">⚠️ {error}</div>

  const activeSection = sections.find(section => section.id === activeSectionId)
  const saveText = saveState === 'saving' ? 'Guardando…' : saveState === 'dirty' ? 'Cambios pendientes' : saveState === 'error' ? 'Error al guardar' : 'Guardado'

  return <div className="space-y-5">
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">⚠️ {error}</div>}
    {message && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">✅ {message}</div>}

    <header className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/informes" className="text-sm font-semibold text-blue-600 hover:underline">← Volver a Informes</Link>
          {isLeader && canEdit ? <input value={report.title} onChange={event => { setReport((current: any) => ({ ...current, title: event.target.value })); titleDirtyRef.current = true; setSaveState('dirty') }} className="mt-3 w-full rounded-xl border border-transparent px-2 py-1 text-2xl font-black text-blue-900 hover:border-gray-200 focus:border-blue-300 focus:outline-none" /> : <h1 className="mt-3 text-2xl font-black text-blue-900">{report.title}</h1>}
          <p className="mt-1 text-sm text-gray-500">Proyecto: {report.projects?.title ?? 'Proyecto'} · Curso: {report.courses?.name ?? 'Sin curso'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusColor[report.status] ?? statusColor.draft}`}>{statusLabel[report.status] ?? report.status}</span>
          {canEdit && <button type="button" onClick={() => void saveDirty()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">💾 Guardar ahora</button>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
        <span className={saveState === 'error' ? 'font-bold text-red-600' : saveState === 'saved' ? 'font-bold text-green-700' : 'font-bold text-amber-700'}>● {saveText}</span>
        <span className="text-gray-500">Autoguardado automático cada 5 segundos · {onlineUserIds.length} usuario{onlineUserIds.length === 1 ? '' : 's'} en línea</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {isLeader && EDITABLE_STATUSES.includes(report.status) && <button type="button" onClick={() => void reportAction('submit')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">📤 Enviar al docente</button>}
        {isStaff && report.status === 'submitted' && <button type="button" onClick={() => void reportAction('start_review')} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600">🔎 Comenzar revisión</button>}
        {isStaff && ['submitted', 'in_review', 'evaluated'].includes(report.status) && <button type="button" onClick={() => void reportAction('request_changes')} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600">↩️ Solicitar cambios</button>}
        {isStaff && ['evaluated', 'in_review'].includes(report.status) && <button type="button" onClick={() => void reportAction('finalize')} className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-700">✅ Finalizar informe</button>}
      </div>
    </header>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <main className="min-w-0 space-y-4">
        {canEdit && <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <span className="mr-1 self-center text-sm font-bold text-gray-700">Agregar bloque:</span>
          <button type="button" onClick={() => void addSection('title')} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200">+ Título</button>
          <button type="button" onClick={() => void addSection('text')} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">+ Texto</button>
          <button type="button" onClick={() => void addSection('table')} className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100">+ Tabla</button>
          <button type="button" onClick={() => void addSection('resources')} className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100">+ Recursos</button>
        </div>}

        {sections.map((section, index) => <ReportSectionCard
          key={section.id}
          section={section}
          index={index}
          active={activeSectionId === section.id}
          canEdit={canEdit}
          isStaff={isStaff}
          comments={comments.filter(comment => comment.section_id === section.id)}
          commentValue={commentDrafts[section.id] ?? ''}
          onActivate={() => setActiveSectionId(section.id)}
          onChange={patch => updateSection(section.id, patch)}
          onCommentChange={value => setCommentDrafts(prev => ({ ...prev, [section.id]: value }))}
          onAddComment={() => void addComment(section.id)}
          onResolveComment={commentId => void resolveComment(commentId)}
          onMoveUp={index > 0 ? () => void moveSection(section.id, -1) : undefined}
          onMoveDown={index < sections.length - 1 ? () => void moveSection(section.id, 1) : undefined}
          onRemove={() => void removeSection(section.id)}
        />)}
        {!sections.length && <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-gray-400">El informe todavía no tiene secciones.</div>}
      </main>

      <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
        <details className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm" open>
          <summary className="cursor-pointer font-bold text-blue-900">👥 Integrantes del informe</summary>
          <div className="mt-4"><ReportTeamPanel members={members} classmates={classmates} isLeader={isLeader && canEdit} onlineUserIds={onlineUserIds} onAdd={classmateId => void addMember(classmateId)} onRemove={memberId => void removeMember(memberId)} /></div>
        </details>
        <details className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-bold text-blue-900">📚 Información adicional del proyecto</summary>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">Este contenido es opcional. Selecciona una sección del informe y agrega solo la información que el grupo quiera utilizar.</p>
          <div className="mt-4"><ReportResourceLibrary resources={resources} onInsert={insertResource} /></div>
        </details>
        {activeSection && <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">Sección activa</p>
          <p className="mt-1">{activeSection.title}</p>
          <p className="mt-2 text-xs text-blue-700">Los recursos elegidos en la biblioteca se agregarán aquí.</p>
        </section>}
        <ReportRubricPanelFinal
          rubric={rubric}
          criteria={criteria}
          isStaff={isStaff}
          scores={scores}
          feedback={scoreFeedback}
          generalFeedback={generalFeedback}
          finalGrade={evaluation?.final_grade}
          earnedPoints={evaluation?.earned_points}
          onScoreChange={(criterionId, value) => setScores(prev => ({ ...prev, [criterionId]: value }))}
          onFeedbackChange={(criterionId, value) => setScoreFeedback(prev => ({ ...prev, [criterionId]: value }))}
          onGeneralFeedbackChange={setGeneralFeedback}
          onCreateDefault={() => void createDefaultRubric()}
          onCalculate={() => void calculateAndSaveGrade()}
        />
      </aside>
    </div>
  </div>
}
