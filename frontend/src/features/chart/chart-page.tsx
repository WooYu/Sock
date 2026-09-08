'use client'

import { ChartWorkspace } from './chart-workspace'
import { useStockWorkspace } from '../workspace/stock-workspace-provider'

export function ChartPage() {
  const { current, lastSuccessful, status, errorMessage, refresh } = useStockWorkspace()
  const workspace = current ?? lastSuccessful
  return <ChartWorkspace errorMessage={errorMessage} onRetry={() => void refresh()} prediction={workspace?.prediction ?? null} snapshot={workspace?.market ?? null} status={status} />
}
