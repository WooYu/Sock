import { ProductShell } from '@/features/navigation/product-shell'
import { OverviewPage } from '@/features/overview/overview-page'
import { StockWorkspaceProvider } from '@/features/workspace/stock-workspace-provider'

export default async function OverviewRoute({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams
  return <StockWorkspaceProvider initialSymbol={symbol}><ProductShell activeHref="/overview" section="overview"><OverviewPage /></ProductShell></StockWorkspaceProvider>
}
