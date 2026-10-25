'use client'

import { useEffect } from 'react'

/** Fixed dialogs must follow the visible area when a mobile keyboard opens. */
export function VisualViewportProvider() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const style = document.documentElement.style
    const update = () => {
      style.setProperty('--sc-viewport-height', `${viewport.height}px`)
      style.setProperty('--sc-viewport-top', `${viewport.offsetTop}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update, { passive: true })
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      style.removeProperty('--sc-viewport-height')
      style.removeProperty('--sc-viewport-top')
    }
  }, [])
  return null
}
