'use client'

import { useEffect } from 'react'

type Direction = 'up' | 'down' | 'left' | 'right'

function gridInputs() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('table tbody td input'))
    .filter((input) => !input.disabled && input.offsetParent !== null)
}

function focusCell(input: HTMLInputElement | undefined) {
  if (!input) return
  input.focus({ preventScroll: true })
  input.select()
  input.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function center(input: HTMLInputElement) {
  const rect = input.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function nearestCell(current: HTMLInputElement, direction: Direction) {
  const origin = center(current)
  let best: { input: HTMLInputElement; score: number } | null = null

  for (const candidate of gridInputs()) {
    if (candidate === current) continue
    const point = center(candidate)
    const dx = point.x - origin.x
    const dy = point.y - origin.y

    let primary = 0
    let secondary = 0
    if (direction === 'down') {
      if (dy <= 4) continue
      primary = dy
      secondary = Math.abs(dx)
    } else if (direction === 'up') {
      if (dy >= -4) continue
      primary = -dy
      secondary = Math.abs(dx)
    } else if (direction === 'right') {
      if (dx <= 4) continue
      primary = dx
      secondary = Math.abs(dy)
    } else {
      if (dx >= -4) continue
      primary = -dx
      secondary = Math.abs(dy)
    }

    const score = primary * 1000 + secondary
    if (!best || score < best.score) best = { input: candidate, score }
  }

  return best?.input
}

function canLeaveHorizontally(input: HTMLInputElement, direction: 'left' | 'right') {
  const start = input.selectionStart
  const end = input.selectionEnd
  if (start == null || end == null) return true
  if (start === 0 && end === input.value.length) return true
  if (start !== end) return false
  return direction === 'left' ? start === 0 : end === input.value.length
}

function activeGridCell() {
  return document.querySelector<HTMLInputElement>('table tbody td.ring-2 input')
    ?? document.querySelector<HTMLInputElement>('table tbody td[class*="ring-blue"] input')
}

function clickSaveButton() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
  const save = buttons.find((button) => button.textContent?.trim() === 'Guardar' && !button.disabled)
  save?.click()
}

export default function PromediosKeyboardNavigation() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement)) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          clickSaveButton()
        }
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        clickSaveButton()
        return
      }

      const formulaBar = target.matches('input[placeholder^="Valor o fórmula"]')
      if (formulaBar) {
        if (event.key === 'Enter') {
          const direction: Direction = event.shiftKey ? 'up' : 'down'
          window.setTimeout(() => {
            const current = activeGridCell()
            if (current) focusCell(nearestCell(current, direction) ?? current)
          }, 0)
        }
        return
      }

      if (!target.closest('table tbody td')) return

      if (event.key === 'Enter') {
        event.preventDefault()
        const next = nearestCell(target, event.shiftKey ? 'up' : 'down')
        focusCell(next ?? target)
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const inputs = gridInputs()
        const index = inputs.indexOf(target)
        if (index < 0) return
        const nextIndex = event.shiftKey
          ? (index - 1 + inputs.length) % inputs.length
          : (index + 1) % inputs.length
        focusCell(inputs[nextIndex])
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        focusCell(nearestCell(target, event.key === 'ArrowUp' ? 'up' : 'down') ?? target)
        return
      }

      if (event.key === 'ArrowLeft' && canLeaveHorizontally(target, 'left')) {
        event.preventDefault()
        focusCell(nearestCell(target, 'left') ?? target)
        return
      }

      if (event.key === 'ArrowRight' && canLeaveHorizontally(target, 'right')) {
        event.preventDefault()
        focusCell(nearestCell(target, 'right') ?? target)
        return
      }

      if (event.key === 'Escape') {
        target.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  return null
}
