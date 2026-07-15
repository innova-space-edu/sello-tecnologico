'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

type PopoverPosition = {
  left: number
  top: number
  openAbove: boolean
}

export default function ReactionPicker({ counts = {}, selected = null, total = 0, disabled = false, compact = false, inverted = false, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const button = buttonRef.current
      if (!button) return

      const rect = button.getBoundingClientRect()
      const viewportPadding = 8
      const popoverWidth = Math.min(288, window.innerWidth - viewportPadding * 2)
      const estimatedHeight = 176
      const roomBelow = window.innerHeight - rect.bottom
      const openAbove = roomBelow < estimatedHeight + 16 && rect.top > estimatedHeight + 16
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - popoverWidth - viewportPadding),
      )
      const top = openAbove ? rect.top - 8 : rect.bottom + 8

      setPosition({ left, top, openAbove })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const choose = async (emoji: SocialReaction) => {
    setOpen(false)
    await onSelect(emoji)
  }

  const popover = open && position && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Seleccionar reacción"
          className={`fixed z-[140] w-72 max-w-[calc(100vw-1rem)] rounded-2xl border p-3 shadow-2xl ${inverted ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
          style={{
            left: position.left,
            top: position.top,
            transform: position.openAbove ? 'translateY(-100%)' : undefined,
          }}
        >
          <p className={`mb-2 px-1 text-xs font-black ${inverted ? 'text-white/75' : 'text-slate-500'}`}>Elige una reacción</p>
          <div className="grid grid-cols-4 gap-2">
            {SOCIAL_REACTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => choose(emoji)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-2 py-2 text-xl transition hover:-translate-y-0.5 ${selected === emoji ? 'bg-blue-100 ring-2 ring-blue-400' : inverted ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-slate-100'}`}
                aria-label={`Reaccionar con ${emoji}`}
              >
                <span>{emoji}</span>
                <span className={`mt-0.5 text-[10px] font-black ${inverted ? 'text-white/70' : 'text-slate-500'}`}>{counts[emoji] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir reacciones"
        className={`${compact ? 'h-10 min-w-10 px-2' : 'px-3 py-2'} inline-flex items-center justify-center gap-1.5 rounded-full font-black transition disabled:opacity-50 ${inverted ? 'bg-white/15 text-white hover:bg-white/25' : selected ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        <span className="text-lg">{selected ?? '😊'}</span>
        {!compact && <span className="text-xs">Reaccionar</span>}
        {total > 0 && <span className={`text-[11px] ${inverted ? 'text-white/80' : 'text-slate-500'}`}>{total}</span>}
      </button>
      {popover}
    </div>
  )
}
