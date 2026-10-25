'use client'

import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { StudioIcon } from '../research/studio-icon'
import { useDialogFocus } from './use-dialog-focus'

export function AppDialog({ title, description, onClose, children, footer, className = '', closeLabel }: {
  title: string; description?: string; onClose: () => void; children: ReactNode;
  footer?: ReactNode; className?: string; closeLabel?: string;
}) {
  const id = useId()
  const ref = useRef<HTMLElement>(null)
  useDialogFocus(ref, true, onClose)
  if (typeof document === 'undefined') return null
  return createPortal(<div className="sc-modal-layer" role="presentation" onPointerDown={event => {
    event.stopPropagation()
    if (event.target === event.currentTarget) onClose()
  }} onClick={event => event.stopPropagation()}>
    <section className={`sc-modal ${className}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} tabIndex={-1}>
      <header className="sc-modal-header"><div><h2 id={`${id}-title`}>{title}</h2>{description ? <p id={`${id}-description`}>{description}</p> : null}</div><button type="button" className="sc-icon-button" aria-label={closeLabel ?? `关闭${title}`} onClick={onClose}><StudioIcon name="close" size={20} /></button></header>
      <div className="sc-modal-body">{children}</div>
      {footer ? <footer className="sc-modal-footer">{footer}</footer> : null}
    </section>
  </div>, document.body)
}
