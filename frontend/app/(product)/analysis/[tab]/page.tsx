import { notFound } from 'next/navigation'
import { ProductShell } from '@/features/navigation/product-shell'
import { AnalysisPage } from '@/features/analysis/analysis-page'
import { StockWorkspaceProvider } from '@/features/workspace/stock-workspace-provider'
import type { AnalysisTab } from '@/features/navigation/navigation-config'

const validTabs = new Set<AnalysisTab>(['key-levels', 'patterns', 'future', 'ai'])

export default async function AnalysisRoute({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ symbol?: string }> }) {
  const { tab } = await params
  const { symbol } = await searchParams
  if (!validTabs.has(tab as AnalysisTab)) notFound()
  return <StockWorkspaceProvider initialSymbol={symbol}><ProductShell activeHref={`/analysis/${tab}`} section="analysis"><AnalysisPage tab={tab as AnalysisTab} /></ProductShell></StockWorkspaceProvider>
}
