import fs from 'node:fs'

const file = 'src/components/informes/ReportEditorFinal.tsx'
let source = fs.readFileSync(file, 'utf8')

source = source.replaceAll('isLeader={isLeader}', 'isLeader={isLeader && canEdit}')

fs.writeFileSync(file, source)
