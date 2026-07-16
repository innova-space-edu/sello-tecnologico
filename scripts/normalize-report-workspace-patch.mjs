import fs from 'node:fs'

const file = 'src/components/informes/ReportEditorFinal.tsx'
let source = fs.readFileSync(file, 'utf8')

const moveUp = "          onMoveUp={index > 0 ? () => void moveSection(section.id, -1) : undefined}"
const moveDown = "          onMoveDown={index < sections.length - 1 ? () => void moveSection(section.id, 1) : undefined}"
const pair = `${moveUp}\n${moveDown}\n`

while (source.includes(pair + pair)) {
  source = source.replace(pair + pair, pair)
}

const submitGuard = "    if (action === 'submit') {"
const firstGuard = source.indexOf(submitGuard)
if (firstGuard >= 0) {
  const secondGuard = source.indexOf(submitGuard, firstGuard + submitGuard.length)
  if (secondGuard >= 0) {
    throw new Error('El guardado previo al envío quedó duplicado en ReportEditorFinal.tsx')
  }
}

fs.writeFileSync(file, source)
