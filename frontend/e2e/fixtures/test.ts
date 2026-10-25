import { test as base, expect } from '@playwright/test'

/** Exercise local UI against explicit fixtures without uploading test data to shared accounts. */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    if (process.env.SCENARIO_REAL_RESEARCH !== 'true') {
      await page.route('**/api/**', route => {
        const request = route.request()
        if (new URL(request.url()).pathname.startsWith('/api/sync/')) {
          return route.fulfill({ json: { nextCursor: 0, changes: [], applied: true, cursor: 0 } })
        }
        if (!['GET', 'HEAD'].includes(request.method())) {
          return route.fulfill({ status: 503, json: { message: 'Browser test: explicit fixture required for writes' } })
        }
        return route.continue()
      })
    }
    await runTest(page)
  },
})
export { expect }
export type { Page } from '@playwright/test'
