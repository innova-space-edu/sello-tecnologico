import fs from 'node:fs'
const file = 'src/components/Sidebar.tsx'
let text = fs.readFileSync(file, 'utf8')
const pages = "  { href: '/vitrinas', label: 'Páginas', icon: '🌐' },"
const reports = "  { href: '/informes', label: 'Informes', icon: '📘' },"
if (!text.includes(pages)) throw new Error('No se encontró Páginas en el menú')
if (!text.includes(reports)) text = text.replace(pages, pages + '\n' + reports)
fs.writeFileSync(file, text)
