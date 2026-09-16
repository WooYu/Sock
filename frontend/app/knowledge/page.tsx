import type { Metadata } from 'next'
import { ExperienceWorkbench } from '@/features/knowledge/experience-workbench'

export const metadata: Metadata = {
  title: '经验与原则 · StockCal',
  description: '核对投资经验的原文、解释与适用边界，管理版本并查看历史回测证据。',
}

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams
  return <ExperienceWorkbench initialTab={view === 'backtest' ? 'backtest' : 'library'} />
}
