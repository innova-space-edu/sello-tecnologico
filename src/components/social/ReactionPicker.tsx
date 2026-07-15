'use client'

import { useEffect, useRef, useState } from 'react'

export const SOCIAL_REACTIONS = ['❤️', '👏', '🔥', '🌱', '💡', '🚀', '😂', '😮'] as const
export type SocialReaction = typeof SOCIAL_REACTIONS[number]

type Props = {
  counts?: Partial<Record<SocialReaction, number>>
  selected?: SocialReaction | null
  total?: number
  disabled?: boolean
  compact?: boolean
  inverted?: boolean
  onSelect: (emoji: SocialReaction) => void | Promise<void>
}

export default function ReactionPicker({ counts = {}, selected = null, total = 0, disabled = false, compact = false, inverted = false, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const choose = async (emoji: SocialReaction) => {
    setOpen(false)
    await onSelect(emoji)
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-label="Abrir reacciones"
        className={`${compact ? 'h-10 min-w-10 px-2' : 'px-3 py-2'} inline-flex items-center justify-center gap-1.5 rounded-full font-black transition disabled:opacity-50 ${inverted ? 'bg-white/15 text-white hover:bg-white/25' : selected ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        <span className="text-lg">{selected ?? '😊'}</span>
        {!compact && <span className="text-xs">Reaccionar</span>}
        {total > 0 && <span className={`text-[11px] ${inverted ? 'text-white/80' : 'text-slate-500'}`}>{total}</span>}
      </button>

      {open && (
        <div className={`absolute z-50 grid w-64 grid-cols-4 gap-2 rounded-2xl border p-2 shadow-2xl ${inverted ? 'bottom-12 left-0 border-white/10 bg-slate-900 text-white' : 'bottom-12 left-0 border-slate-100 bg-white text-slate-900'}`}>
          {SOCIAL_REACTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              disabled={disabled}
              onClick={() => choose(emoji)}
              className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-lg transition ${selected === emoji ? 'bg-blue-100 ring-2 ring-blue-400' : inverted ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
              aria-label={`Reaccionar con ${emoji}`}
            >
              <span>{emoji}</span>
              <span className={`text-[10px] font-black ${inverted ? 'text-white/70' : 'text-slate-500'}`}>{counts[emoji] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
