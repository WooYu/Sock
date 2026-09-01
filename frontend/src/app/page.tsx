import { ProductShell } from '@/features/navigation/product-shell'
import { LiveOverviewPage } from '@/features/overview/live-overview-page'
import { StockWorkspaceProvider } from '@/features/workspace/stock-workspace-provider'

export default function Home() {
  return <StockWorkspaceProvider initialSymbol="600519"><ProductShell activeHref="/overview" section="overview"><LiveOverviewPage /></ProductShell></StockWorkspaceProvider>
}
