'use client'

import { createPortal } from 'react-dom'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'

const EMOJI_GROUPS = {
  Caras: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🫣','🤭','🫢','🫡','🤫','🫠','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  Gestos: ['👍','👎','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','👏','🙌','🫶','👐','🤲','🙏','✍️','💅','🤳','💪','🦾','🫵','👀','👁️','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴'],
  Corazones: ['❤️','🩷','🧡','💛','💚','💙','🩵','💜','🤎','🖤','🩶','🤍','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💋','💯','💢','💥','💫','💦','💨','🕳️','💬','👁️‍🗨️','🗨️','🗯️','💭','💤'],
  Naturaleza: ['🌱','🌿','☘️','🍀','🎍','🪴','🎋','🍃','🍂','🍁','🌾','🌵','🌲','🌳','🌴','🪵','🌷','🌹','🥀','🪻','🌺','🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌙','⭐','🌟','✨','⚡','🔥','🌈','☀️','⛅','☁️','🌧️','⛈️','🌨️','❄️','☃️','💧','🌊','🌍','🌎','🌏'],
  Animales: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦄','🐝','🪲','🐞','🦋','🐌','🐛','🪱','🐢','🐍','🦎','🐙','🦑','🦀','🐠','🐟','🐬','🐳','🦈','🦭'],
  Comida: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥖','🍞','🥨','🧀','🥚','🍳','🥞','🧇','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥗','🍿','🍰','🎂','🍪','🍩','🍫','🍬','🍭','☕','🧃','🥤'],
  Actividades: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥅','🏒','🏑','🥍','🏏','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🏋️','🤸','⛹️','🤺','🤾','🏊','🚴','🧗','🎯','🎮','🎲','🧩','♟️','🎨','🎭','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🎬','📷'],
  Objetos: ['💡','🚀','🛸','✈️','🚁','🚗','🚌','🚲','🛴','🚦','🧭','⏰','⌛','📱','💻','⌨️','🖥️','🖨️','🖱️','💾','💿','📀','🎥','📺','📻','🎙️','🔋','🔌','🧪','🧬','🔬','🔭','📡','🛠️','🔧','🔨','⚙️','🧲','🧰','📚','📖','📝','✏️','📌','📍','📎','📐','📏','🔒','🔑','🎁','🎉','🎊','🏆','🥇','🥈','🥉','✅','❌','⚠️','❓','❗','♻️'],
} as const

type EmojiGroup = keyof typeof EMOJI_GROUPS

type Props = {
  value: string
  onChange: (value: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  disabled?: boolean
  onOpenChange?: (open: boolean) => void
}

const GROUP_ICONS: Record<EmojiGroup, string> = {
  Caras: '😀',
  Gestos: '👏',
  Corazones: '❤️',
  Naturaleza: '🌱',
  Animales: '🐶',
  Comida: '🍎',
  Actividades: '⚽',
  Objetos: '💡',
}

export default function CommentEmojiPicker({ value, onChange, textareaRef, disabled = false, onOpenChange }: Props) {
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState<EmojiGroup>('Caras')
  const [query, setQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const selectionRef = useRef({ start: 0, end: 0 })

  useEffect(() => setMounted(true), [])

  const allEmojis = useMemo(() => Array.from(new Set(Object.values(EMOJI_GROUPS).flat())), [])
  const visibleEmojis = query.trim() ? allEmojis : [...EMOJI_GROUPS[group]]

  const updatePosition = () => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const width = Math.min(360, window.innerWidth - 24)
    const height = 390
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12)
    const top = rect.bottom + height + 12 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(12, rect.top - height - 8)
    setPosition({ top, left })
  }

  const changeOpen = (next: boolean) => {
    if (next && textareaRef.current) {
      selectionRef.current = {
        start: textareaRef.current.selectionStart ?? value.length,
        end: textareaRef.current.selectionEnd ?? value.length,
      }
      updatePosition()
    }
    setOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (!open) return
    const reposition = () => updatePosition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) changeOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') changeOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [open])

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? selectionRef.current.start ?? value.length
    const end = textarea?.selectionEnd ?? selectionRef.current.end ?? value.length
    const nextValue = `${value.slice(0, start)}${emoji}${value.slice(end)}`
    const nextPosition = start + emoji.length
    onChange(nextValue)
    selectionRef.current = { start: nextPosition, end: nextPosition }
    window.requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(nextPosition, nextPosition)
    })
  }

  const panel = open && mounted ? createPortal(
    <div
      ref={panelRef}
      className="fixed z-[150] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label="Selector de emojis"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2">
          <span aria-hidden="true">🔎</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar emojis"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
        <button type="button" onClick={() => changeOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar emojis">×</button>
      </div>

      {!query.trim() && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 py-2">
          {(Object.keys(EMOJI_GROUPS) as EmojiGroup[]).map(name => (
            <button
              key={name}
              type="button"
              onClick={() => setGroup(name)}
              className={`flex h-9 min-w-9 items-center justify-center rounded-xl text-lg transition ${group === name ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-slate-100'}`}
              title={name}
              aria-label={name}
            >
              {GROUP_ICONS[name]}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto p-3">
        <div className="grid grid-cols-7 gap-1 sm:grid-cols-8">
          {visibleEmojis.map(emoji => (
            <button
              key={emoji}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => insertEmoji(emoji)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-transparent text-2xl transition hover:bg-slate-100 hover:scale-110"
              aria-label={`Agregar ${emoji}`}
              title={`Agregar ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={() => changeOpen(!open)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Agregar emoji al comentario"
        aria-expanded={open}
        title="Agregar emoji"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
          <path d="M9 9h.01M15 9h.01" />
        </svg>
      </button>
      {panel}
    </>
  )
}
