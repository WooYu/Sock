import { getAuthorizationHeader, getClientId } from '../records/record-sync'

export const RESEARCH_IDENTITY_EVENT = 'stockcal:identity-change'
export type ResearchIdentity = { scope: string; isCurrent: () => boolean }
const scopes = new Map<string, Promise<string>>()

/** Persist only an opaque identity scope, never an access token. */
export async function getResearchIdentity(): Promise<ResearchIdentity> {
  const client = getClientId(), authorization = getAuthorizationHeader() ?? ''
  const key = client + '|' + authorization
  let pending = scopes.get(key)
  if (!pending) {
    pending = authorization ? (async () => {
      if (crypto.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
        return 'auth:' + [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('')
      }
      // In insecure contexts, keep authenticated receipts session-scoped rather than persisting a token.
      return 'session:' + crypto.randomUUID()
    })() : Promise.resolve('web:' + client)
    if (scopes.size >= 16) scopes.delete(scopes.keys().next().value!)
    scopes.set(key, pending)
  }
  const scope = await pending
  return { scope, isCurrent: () => {
    try { return getClientId() === client && (getAuthorizationHeader() ?? '') === authorization } catch { return false }
  } }
}
