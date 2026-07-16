import fs from 'node:fs'
const file = 'src/components/Sidebar.tsx'
let text = fs.readFileSync(file, 'utf8')
const pages = "  { href: '/vitrinas', label: 'Páginas', icon: '🌐' },"
const surveys = "  { href: '/encuestas', label: 'Encuestas', icon: '🗳️' },"
if (!text.includes(pages) || !text.includes(surveys)) throw new Error('No se encontraron Páginas o Encuestas')
text = text.replace(pages + '\n', '').replace(surveys, surveys + '\n' + pages)
fs.writeFileSync(file, text)
