'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ChartMobileSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = `${useId()}-title`
  const dialogRef = useRef<HTMLElement>(null)
  const dragStart = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const first = dialog ? tabbableControls(dialog)[0] : undefined
    first?.focus()
    return () => previousFocus?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current ? tabbableControls(dialogRef.current) : []
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    dragStart.current = event.clientY
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragStart.current === null) return
    const nextOffset = Math.max(0, event.clientY - dragStart.current)
    dragOffsetRef.current = nextOffset
    setDragOffset(nextOffset)
  }
  const resetDrag = () => {
    dragStart.current = null
    dragOffsetRef.current = 0
    setDragOffset(0)
  }
  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const shouldClose = dragOffsetRef.current >= 72
    try { event.currentTarget.releasePointerCapture?.(event.pointerId) } catch {}
    resetDrag()
    if (shouldClose) onClose()
  }

  return (
    <div className="sc-chart-sheet-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="sc-chart-mobile-sheet" data-testid="chart-mobile-sheet" onKeyDown={handleKeyDown} ref={dialogRef} role="dialog" style={{ transform: `translateY(${dragOffset}px)` }}>
        <button aria-label={`拖动关闭${title}`} className="sc-chart-sheet-handle" onClick={(event) => event.detail === 0 && onClose()} onPointerCancel={resetDrag} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} type="button"><span /></button>
        <header><h2 id={titleId}>{title}</h2><button aria-label={`关闭${title}`} className="sc-chart-sheet-close" onClick={onClose} type="button">×</button></header>
        <div className="sc-chart-sheet-body">{children}</div>
      </section>
    </div>
  )
}

function tabbableControls(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => {
    const style = getComputedStyle(element)
    return element.tabIndex >= 0 && !element.hasAttribute('disabled') && style.display !== 'none' && style.visibility !== 'hidden'
  })
}
