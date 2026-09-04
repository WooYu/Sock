import { ProductShell } from '@/features/navigation/product-shell'
import { SettingsPage } from '@/features/settings/settings-page'

export default function SettingsRoute() {
  return <ProductShell activeHref="/settings" section="settings" tone="feed"><SettingsPage /></ProductShell>
}
