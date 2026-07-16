import fs from 'node:fs'

const file = 'src/components/informes/ReportEditorFinal.tsx'
let source = fs.readFileSync(file, 'utf8')

const original = `  const calculateAndSaveGrade = async () => {
    if (!isStaff || !rubric || !criteria.length) return`
const replacement = `  const calculateAndSaveGrade = async () => {
    if (!isStaff || !rubric || !criteria.length) return
    if (!['submitted', 'in_review', 'evaluated'].includes(report?.status)) {
      setError('El informe debe estar enviado o en revisión antes de calcular la nota.')
      return
    }`

if (!source.includes(replacement)) {
  if (!source.includes(original)) throw new Error('No se encontró la función de evaluación del informe')
  source = source.replace(original, replacement)
}

fs.writeFileSync(file, source)
