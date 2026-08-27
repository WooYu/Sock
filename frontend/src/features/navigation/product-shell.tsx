'use client'

import { useState } from 'react'
import { AppShell } from './app-shell'
import type { PrimarySection } from './navigation-config'

export function ProductShell({ section, children }: { section: PrimarySection; children: React.ReactNode }) {
  const [selected, setSelected] = useState(section)
  return <AppShell section={selected} onSectionChange={setSelected}>{children}</AppShell>
}
