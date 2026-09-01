import { ProductShell } from '@/features/navigation/product-shell'
import { LiveOverviewPage } from '@/features/overview/live-overview-page'
import { StockWorkspaceProvider } from '@/features/workspace/stock-workspace-provider'

export default async function Home({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams
  return <StockWorkspaceProvider initialSymbol={symbol ?? '600519'}><ProductShell activeHref="/overview" section="overview"><LiveOverviewPage /></ProductShell></StockWorkspaceProvider>
}
