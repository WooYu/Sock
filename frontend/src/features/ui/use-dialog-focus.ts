'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { lockPageScroll } from './page-scroll-lock'

const dialogs: HTMLElement[] = []
const controls = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])')).filter(element => !element.closest('[hidden], [inert]') && element.tabIndex >= 0 && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden' && (typeof element.checkVisibility !== 'function' || element.checkVisibility()))

/** Keep keyboard focus and scroll inside the topmost open dialog. */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const unlock = lockPageScroll()
    dialogs.push(dialog)
    const firstInput = dialog.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')
    const mobile = window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 900
    ;((mobile ? null : firstInput) ?? controls(dialog)[0] ?? dialog).focus({ preventScroll: true })
    const keydown = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== dialog || event.defaultPrevented) return
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = controls(dialog), first = items[0], last = items.at(-1)
      if (!first) { event.preventDefault(); dialog.focus({ preventScroll: true }); return }
      if (!dialog.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus({ preventScroll: true }) }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus({ preventScroll: true }) }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      const index = dialogs.indexOf(dialog)
      if (index >= 0) dialogs.splice(index, 1)
      unlock()
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [open, ref])
}
