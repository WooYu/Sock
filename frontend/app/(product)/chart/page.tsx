import { ProductShell } from '@/features/navigation/product-shell'
import { ChartPage } from '@/features/chart/chart-page'
import { StockWorkspaceProvider } from '@/features/workspace/stock-workspace-provider'

export default async function ChartRoute({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams
  return <StockWorkspaceProvider initialSymbol={symbol}><ProductShell activeHref="/chart" section="chart"><ChartPage /></ProductShell></StockWorkspaceProvider>
}
