import { proxyResearch, researchRequest, ResearchRequestError } from '@/lib/api/research-backend-client'
import { legacyStudyImport } from '@/lib/knowledge/note-study-proposals'
import type { NoteBindingInput } from '@/features/scenario/scenario-record-types'
export function GET(request: Request) { return proxyResearch(request, 'scenario-records') }
export function POST(request: Request) {
  return proxyResearch(request, 'scenario-records', 'POST', async body => {
    if (!Array.isArray(body.noteBindings)) return
    for (const binding of body.noteBindings.slice(0, 1000) as NoteBindingInput[]) {
      if (request.signal.aborted) break
      const original = binding ? legacyStudyImport(binding) : null
      if (!original) continue
      try { await researchRequest('/api/v1/note-studies', { method: 'POST', body: JSON.stringify(original), headers: { 'Content-Type': 'application/json' }, signal: request.signal }, request.headers) }
      catch (error) {
        if (error instanceof ResearchRequestError && [401, 403, 409].includes(error.status)) throw error
        if (!(error instanceof ResearchRequestError) || error.status >= 500) break
        // Missing old source evidence remains explicitly unresolved in the frozen forecast.
      }
    }
  })
}
