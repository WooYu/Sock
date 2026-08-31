import { OverviewPage } from '@/features/overview/overview-page'
import { ProductShell } from '@/features/navigation/product-shell'
import { StockWorkspaceProvider } from '@/features/workspace/stock-workspace-provider'

export default function Home() {
  return <StockWorkspaceProvider><ProductShell section="overview"><OverviewPage /></ProductShell></StockWorkspaceProvider>
}
