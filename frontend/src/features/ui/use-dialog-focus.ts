'use client'

import { useEffect, useRef, type RefObject } from 'react'

const dialogs: HTMLElement[] = []
let originalOverflow = ''
const controls = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(element => !element.closest('[hidden]') && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden')

/** Keep keyboard focus and scroll inside the topmost open dialog. */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialogs.length) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    dialogs.push(dialog)
    const firstInput = dialog.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')
    ;(firstInput ?? controls(dialog)[0] ?? dialog).focus()
    const keydown = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== dialog || event.defaultPrevented) return
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = controls(dialog), first = items[0], last = items.at(-1)
      if (!first) { event.preventDefault(); dialog.focus(); return }
      if (!dialog.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      const index = dialogs.indexOf(dialog)
      if (index >= 0) dialogs.splice(index, 1)
      if (!dialogs.length) document.body.style.overflow = originalOverflow
      if (previous?.isConnected) previous.focus()
    }
  }, [open, ref])
}
