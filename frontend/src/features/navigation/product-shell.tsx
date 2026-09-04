'use client'

import { useState } from 'react'
import { AppShell } from './app-shell'
import type { PrimarySection, WorkspaceTone } from './navigation-config'

export function ProductShell({ section, activeHref, tone, children }: { section: PrimarySection; activeHref?: string; tone?: WorkspaceTone; children: React.ReactNode }) {
  const [selected, setSelected] = useState(section)
  return <AppShell activeHref={activeHref} section={selected} tone={tone} onSectionChange={setSelected}>{children}</AppShell>
}
