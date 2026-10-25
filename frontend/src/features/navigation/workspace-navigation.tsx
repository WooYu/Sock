'use client'

import Link from 'next/link'
import { useState } from 'react'
import { StudioIcon } from '../research/studio-icon'
import { AppDialog } from '../ui/app-dialog'
import { desktopNavigation, moreNavigation, type PrimarySection } from './navigation-config'

export function WorkspaceNavigation({ mobile = false, activeHref, section, onSectionChange }: {
  mobile?: boolean; activeHref?: string; section: PrimarySection; onSectionChange?: (section: PrimarySection) => void;
}) {
  const [open, setOpen] = useState(false)
  const moreActive = section === 'rules' || section === 'settings' || activeHref === '/overview'
  return <>
    <nav className={`sc-workspace-nav ${mobile ? 'is-mobile' : 'is-desktop'}`} aria-label={mobile ? '手机主导航' : '主导航'} data-testid={mobile ? 'mobile-primary-nav' : 'desktop-primary-nav'}>
      {desktopNavigation.map(item => {
        const current = !moreActive && (item.section === section || (item.section === 'chart' && section === 'overview'))
        return <Link key={item.href} className={mobile ? 'min-h-12' : undefined} href={item.href} aria-current={current ? 'page' : undefined} onClick={() => onSectionChange?.(item.section)}><span className="sc-nav-icon" aria-hidden="true"><StudioIcon name={item.icon} size={20} /></span><span>{item.label}</span></Link>
      })}
      <button type="button" className={moreActive ? 'is-current' : undefined} aria-label="更多功能" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><span className="sc-nav-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg></span><span>更多</span></button>
    </nav>
    {open ? <AppDialog title="更多功能" description="研究工具与个人偏好" onClose={() => setOpen(false)} className="sc-navigation-dialog"><nav aria-label="更多工作区" className="sc-destination-list">{moreNavigation.map(item => <Link key={item.href} href={item.href} aria-current={activeHref === item.href ? 'page' : undefined} onClick={() => setOpen(false)}><span><strong>{item.label}</strong><small>{item.description}</small></span><StudioIcon name="chevron" /></Link>)}</nav></AppDialog> : null}
  </>
}
