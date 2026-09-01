import { ProductShell } from '@/features/navigation/product-shell'
import { RulesPage } from '@/features/rules/rules-page'

export default function RulesRoute() {
  return <ProductShell activeHref="/rules" section="rules"><RulesPage /></ProductShell>
}
