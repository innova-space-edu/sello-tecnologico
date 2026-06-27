type OptionMetric = {
  label: string
  count: number
  percent: number
  score?: number | null
}

type QuestionMetric = {
  id: string
  prompt: string
  type: string
  section?: string | null
  average?: number | null
  answered?: number
  total?: number
  options?: OptionMetric[]
  samples?: string[]
}

type IndividualMetric = {
  id: string
  name: string
  subtitle?: string | null
  achievement?: number | null
  grade?: number | null
  scoreLabel?: string | null
  createdAt?: string | null
}

type Props = {
  title?: string
  subtitle?: string
  totalResponses: number
  averageAchievement?: number | null
  averageGrade?: number | null
  questionMetrics: QuestionMetric[]
  individuals: IndividualMetric[]
}

const palette = ['#2563eb', '#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7']

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function responseLabel(total: number) {
  return `${total} respuesta${total === 1 ? '' : 's'}`
}

function donutBackground(options: OptionMetric[]) {
  if (!options.length) return 'conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)'
  let start = 0
  const segments = options.map((option, index) => {
    const end = start + (clampPercent(option.percent) / 100) * 360
    const segment = `${palette[index % palette.length]} ${start}deg ${end}deg`
    start = end
    return segment
  })
  if (start < 360) segments.push(`#e5e7eb ${start}deg 360deg`)
  return `conic-gradient(${segments.join(', ')})`
}

function SingleDonut({ value, label, caption }: { value: number; label: string; caption?: string }) {
  const percent = clampPercent(value)
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-28 w-28 shrink-0 rounded-full p-1 shadow-inner" style={{ background: `conic-gradient(#2563eb 0deg ${percent * 3.6}deg, #e5e7eb ${percent * 3.6}deg 360deg)` }}>
        <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
          <div><p className="text-xl font-black text-blue-900">{percent.toFixed(0)}%</p><p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p></div>
        </div>
      </div>
      <div><p className="text-sm font-semibold text-gray-800">{caption ?? label}</p><p className="text-xs text-gray-500 mt-1">Lectura radial moderna para visualizar avance y concentración de resultados.</p></div>
    </div>
  )
}

function MultiDonut({ options }: { options: OptionMetric[] }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
      <div className="relative h-36 w-36 shrink-0 rounded-full p-1 shadow-inner" style={{ background: donutBackground(options) }}>
        <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
          <div><p className="text-2xl font-black text-blue-900">{options.reduce((total, option) => total + option.count, 0)}</p><p className="text-[10px] uppercase tracking-wide text-gray-400">selecciones</p></div>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {options.map((option, index) => (
          <div key={option.label} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0"><span className="h-3 w-3 rounded-full shrink-0" style={{ background: palette[index % palette.length] }} /><span className="text-xs font-medium text-gray-700 truncate">{option.label}</span></div>
            <span className="text-xs font-bold text-gray-700 shrink-0">{option.count} · {option.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalizadorEncuesta({ title = 'Analizador de encuesta', subtitle, totalResponses, averageAchievement, averageGrade, questionMetrics, individuals }: Props) {
  const answeredQuestions = questionMetrics.filter(metric => (metric.answered ?? 0) > 0 || (metric.options ?? []).some(option => option.count > 0)).length
  const lowAchievement = typeof averageAchievement === 'number' && Number.isFinite(averageAchievement) && averageAchievement > 0 && averageAchievement < 60
  const highAchievement = typeof averageAchievement === 'number' && Number.isFinite(averageAchievement) && averageAchievement >= 80

  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-sm lg:p-6 space-y-5">
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-100/50 blur-3xl" />
      <div className="absolute bottom-0 left-8 h-32 w-32 rounded-full bg-cyan-100/50 blur-3xl" />
      <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-blue-500 font-semibold">Analizador inteligente</p>
          <h2 className="text-xl font-bold text-blue-950 mt-1">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <span className="bg-blue-950 text-white rounded-full px-3 py-1 text-sm font-bold w-fit shadow-sm">{responseLabel(totalResponses)}</span>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.2fr_2fr] gap-4">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
          <SingleDonut value={typeof averageAchievement === 'number' ? averageAchievement : 0} label="logro" caption="Promedio grupal de logro" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-100 bg-white/90 p-4"><p className="text-xs text-gray-500 font-semibold uppercase">Respuestas</p><p className="text-2xl font-black text-blue-950 mt-1">{totalResponses}</p></div>
          <div className="rounded-2xl border border-gray-100 bg-white/90 p-4"><p className="text-xs text-gray-500 font-semibold uppercase">Ítems con datos</p><p className="text-2xl font-black text-blue-950 mt-1">{answeredQuestions}</p></div>
          <div className="rounded-2xl border border-gray-100 bg-white/90 p-4"><p className="text-xs text-gray-500 font-semibold uppercase">Promedio nota</p><p className="text-2xl font-black text-blue-950 mt-1">{typeof averageGrade === 'number' && Number.isFinite(averageGrade) && averageGrade > 0 ? averageGrade.toFixed(1) : '—'}</p></div>
        </div>
      </div>

      <div className="relative rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-950">
        {totalResponses === 0 ? 'Todavía no hay datos suficientes para generar una lectura grupal.' : highAchievement ? 'Proyección positiva: el grupo muestra alto desempeño. Conviene reconocer buenas prácticas y convertirlas en referentes para el curso.' : lowAchievement ? 'Alerta de intervención: el logro está bajo el 60%. Revisa los ítems críticos y planifica refuerzo focalizado.' : 'Zona de mejora activa: hay resultados intermedios. Observa la dispersión por ítem para tomar decisiones de acompañamiento.'}
      </div>

      {questionMetrics.length > 0 && (
        <div className="relative space-y-4">
          <h3 className="font-bold text-blue-950">◌ Análisis grupal por ítem</h3>
          {questionMetrics.map((metric, index) => (
            <article key={metric.id} className="rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-4">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">{metric.section ?? 'General'} · Ítem {index + 1} · {metric.type}</p>
                  <h4 className="font-semibold text-gray-800 mt-1">{metric.prompt}</h4>
                </div>
                {typeof metric.average === 'number' && Number.isFinite(metric.average) && <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-bold">Prom. {metric.average.toFixed(1)}</span>}
              </div>

              {(metric.options ?? []).length > 0 && <MultiDonut options={metric.options ?? []} />}

              {(metric.samples ?? []).length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Muestras de respuestas abiertas</p>
                  {(metric.samples ?? []).slice(0, 4).map((sample, sampleIndex) => <p key={sampleIndex} className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600 whitespace-pre-wrap">{sample}</p>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {individuals.length > 0 && (
        <div className="relative space-y-3">
          <h3 className="font-bold text-blue-950">◌ Análisis individual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {individuals.map(item => (
              <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h4 className="font-semibold text-gray-800">{item.name}</h4>
                {item.subtitle && <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {item.scoreLabel && <span className="bg-gray-100 text-gray-700 rounded-full px-2.5 py-1 font-semibold">{item.scoreLabel}</span>}
                  {typeof item.achievement === 'number' && Number.isFinite(item.achievement) && <span className="bg-blue-100 text-blue-700 rounded-full px-2.5 py-1 font-semibold">{item.achievement.toFixed(1)}%</span>}
                  {typeof item.grade === 'number' && Number.isFinite(item.grade) && <span className={`rounded-full px-2.5 py-1 font-semibold ${item.grade >= 4 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Nota {item.grade.toFixed(1)}</span>}
                </div>
                {item.createdAt && <p className="text-xs text-gray-400 mt-3">{new Date(item.createdAt).toLocaleString('es-CL')}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
