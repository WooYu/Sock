import type { Metadata } from 'next'
import { ExperienceWorkbench } from '@/features/knowledge/experience-workbench'

export const metadata: Metadata = {
  title: '笔记标签 · StockCal',
  description: '按标签整理笔记、查看原文与修订历史，关联学习样本及回测证据。',
}

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams
  return <ExperienceWorkbench initialTab={view === 'backtest' || view === 'notes' || view === 'samples' ? view : 'notes'} />
}
