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

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function responseLabel(total: number) {
  return `${total} respuesta${total === 1 ? '' : 's'}`
}

export default function AnalizadorEncuesta({ title = 'Analizador de encuesta', subtitle, totalResponses, averageAchievement, averageGrade, questionMetrics, individuals }: Props) {
  const answeredQuestions = questionMetrics.filter(metric => (metric.answered ?? 0) > 0 || (metric.options ?? []).some(option => option.count > 0)).length
  const lowAchievement = typeof averageAchievement === 'number' && Number.isFinite(averageAchievement) && averageAchievement > 0 && averageAchievement < 60
  const highAchievement = typeof averageAchievement === 'number' && Number.isFinite(averageAchievement) && averageAchievement >= 80

  return (
    <section className="bg-white rounded-xl shadow-sm p-5 lg:p-6 border border-blue-100 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Análisis automático</p>
          <h2 className="text-xl font-bold text-blue-900 mt-1">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-bold w-fit">{responseLabel(totalResponses)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4"><p className="text-xs text-blue-500 font-semibold uppercase">Respuestas</p><p className="text-2xl font-bold text-blue-900 mt-1">{totalResponses}</p></div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-500 font-semibold uppercase">Ítems con datos</p><p className="text-2xl font-bold text-gray-800 mt-1">{answeredQuestions}</p></div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-500 font-semibold uppercase">Promedio logro</p><p className="text-2xl font-bold text-gray-800 mt-1">{typeof averageAchievement === 'number' && Number.isFinite(averageAchievement) ? `${averageAchievement.toFixed(1)}%` : '—'}</p></div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-500 font-semibold uppercase">Promedio nota</p><p className="text-2xl font-bold text-gray-800 mt-1">{typeof averageGrade === 'number' && Number.isFinite(averageGrade) && averageGrade > 0 ? averageGrade.toFixed(1) : '—'}</p></div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
        {totalResponses === 0 ? 'Todavía no hay datos suficientes para generar un análisis grupal.' : highAchievement ? 'El grupo presenta un desempeño alto. Conviene revisar las respuestas individuales para reconocer buenas prácticas y socializarlas.' : lowAchievement ? 'El grupo presenta un logro bajo el 60%. Conviene reforzar los criterios con menor frecuencia de logro y revisar casos individuales.' : 'El grupo presenta resultados intermedios. Revisa las preguntas con mayor dispersión para planificar retroalimentación o una nueva intervención.'}
      </div>

      {questionMetrics.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-blue-900">📊 Análisis grupal por ítem</h3>
          {questionMetrics.map((metric, index) => (
            <article key={metric.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">{metric.section ?? 'General'} · Ítem {index + 1} · {metric.type}</p>
                  <h4 className="font-semibold text-gray-800 mt-1">{metric.prompt}</h4>
                </div>
                {typeof metric.average === 'number' && Number.isFinite(metric.average) && <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-sm font-bold">Prom. {metric.average.toFixed(1)}</span>}
              </div>

              {(metric.options ?? []).length > 0 && (
                <div className="space-y-2">
                  {(metric.options ?? []).map(option => (
                    <div key={option.label}>
                      <div className="flex justify-between gap-3 text-xs mb-1"><span className="text-gray-600">{option.label}</span><span className="font-semibold text-gray-700">{option.count} · {option.percent.toFixed(1)}%</span></div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${clampPercent(option.percent)}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}

              {(metric.samples ?? []).length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Muestras de respuestas abiertas</p>
                  {(metric.samples ?? []).slice(0, 4).map((sample, sampleIndex) => <p key={sampleIndex} className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 whitespace-pre-wrap">{sample}</p>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {individuals.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-blue-900">👤 Análisis individual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {individuals.map(item => (
              <article key={item.id} className="border border-gray-200 rounded-xl p-4">
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
