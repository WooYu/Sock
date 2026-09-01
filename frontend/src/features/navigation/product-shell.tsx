'use client'

import { useState } from 'react'
import { AppShell } from './app-shell'
import type { PrimarySection } from './navigation-config'

export function ProductShell({ section, activeHref, children }: { section: PrimarySection; activeHref?: string; children: React.ReactNode }) {
  const [selected, setSelected] = useState(section)
  return <AppShell activeHref={activeHref} section={selected} onSectionChange={setSelected}>{children}</AppShell>
}
