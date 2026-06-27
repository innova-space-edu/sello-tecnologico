import AnalizadorEncuesta from '@/components/analisis/AnalizadorEncuesta'
import { AUTOEVALUACION_QUESTIONS, normalizeAutoevaluacionQuestions } from '@/lib/autoevaluacion'

type CourseValue = { id?: string | null; name?: string | null }
type CourseRelation = CourseValue | CourseValue[] | null
type FormatValue = { title?: string | null; questions?: unknown }
type FormatRelation = FormatValue | FormatValue[] | null

type Row = {
  id: string
  student_name: string
  project_name: string
  intervention_place: string
  created_at: string
  answers?: Record<string, unknown> | null
  courses?: CourseRelation
  self_evaluation_formats?: FormatRelation
}

function getCourseName(courses: CourseRelation) {
  if (Array.isArray(courses)) return courses[0]?.name ?? null
  return courses?.name ?? null
}

function getFormat(format: FormatRelation) {
  if (Array.isArray(format)) return format[0] ?? null
  return format ?? null
}

function questionsFor(row: Row) {
  const format = getFormat(row.self_evaluation_formats ?? null)
  const dynamicQuestions = normalizeAutoevaluacionQuestions(format?.questions)
  return dynamicQuestions.length > 0 ? dynamicQuestions : AUTOEVALUACION_QUESTIONS
}

function answersFor(row: Row) {
  return row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers) ? row.answers as Record<string, unknown> : {}
}

function buildQuestionMetrics(rows: Row[]) {
  const map = new Map<string, any>()
  for (const row of rows) {
    const questions = questionsFor(row)
    const answers = answersFor(row)
    for (const question of questions) {
      const key = `${question.id}:${question.prompt}`
      if (!map.has(key)) map.set(key, { id: key, prompt: question.prompt, type: question.type, section: question.section, answered: 0, total: rows.length, values: [] as number[], options: new Map<string, number>(), samples: [] as string[] })
      const metric = map.get(key)
      const value = answers[question.id]
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue
      metric.answered += 1
      if (question.type === 'rating') {
        const numeric = Number(value)
        if (Number.isFinite(numeric)) metric.values.push(numeric)
        for (const option of ['1', '2', '3', '4']) if (!metric.options.has(option)) metric.options.set(option, 0)
        metric.options.set(String(value), (metric.options.get(String(value)) ?? 0) + 1)
      } else if (['checkbox', 'single'].includes(question.type)) {
        const selected = Array.isArray(value) ? value.map(String) : [String(value)]
        const baseOptions = question.options?.length ? question.options : selected
        for (const option of baseOptions) if (!metric.options.has(option)) metric.options.set(option, 0)
        for (const option of selected) metric.options.set(option, (metric.options.get(option) ?? 0) + 1)
      } else {
        metric.samples.push(String(value))
      }
    }
  }
  return Array.from(map.values()).map(metric => ({
    id: metric.id,
    prompt: metric.prompt,
    type: metric.type,
    section: metric.section,
    answered: metric.answered,
    total: metric.total,
    average: metric.values.length > 0 ? metric.values.reduce((total: number, value: number) => total + value, 0) / metric.values.length : null,
    options: Array.from(metric.options.entries()).map(([label, count]) => ({ label, count: count as number, percent: metric.answered > 0 ? ((count as number) / metric.answered) * 100 : 0 })),
    samples: metric.samples.slice(0, 6),
  }))
}

function individualAchievement(row: Row) {
  const questions = questionsFor(row)
  const answers = answersFor(row)
  const ratings = questions.filter(question => question.type === 'rating').map(question => Number(answers[question.id])).filter(Number.isFinite)
  if (ratings.length === 0) return null
  const average = ratings.reduce((total, value) => total + value, 0) / ratings.length
  return (average / 4) * 100
}

export default function AnalizadorAutoevaluacion({ rows }: { rows: Row[] }) {
  const metrics = buildQuestionMetrics(rows)
  const individuals = rows.map(row => ({
    id: row.id,
    name: row.student_name,
    subtitle: `${getCourseName(row.courses ?? null) ?? 'Sin curso'} - ${row.project_name}`,
    achievement: individualAchievement(row),
    scoreLabel: row.intervention_place,
    createdAt: row.created_at,
  }))
  const values = individuals.map(item => item.achievement).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const averageAchievement = values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0

  return <AnalizadorEncuesta title="Analizador de autoevaluacion" subtitle="Lectura grupal e individual de las respuestas filtradas" totalResponses={rows.length} averageAchievement={averageAchievement} questionMetrics={metrics} individuals={individuals} />
}
