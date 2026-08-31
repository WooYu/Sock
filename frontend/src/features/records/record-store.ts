export type RecordNamespace = 'predictions' | 'trades' | 'reviews' | 'rules' | 'preferences'

const prefix = 'stockcal:'

export function loadRecords<T>(namespace: RecordNamespace): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key(namespace))
    if (!raw) return []
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value as T[] : []
  } catch {
    return []
  }
}

export function saveRecords<T>(namespace: RecordNamespace, records: T[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key(namespace), JSON.stringify(records))
}

export function addRecord<T extends { id: string }>(namespace: RecordNamespace, record: T) {
  saveRecords(namespace, [...loadRecords<T>(namespace), record])
}

export function removeRecord<T extends { id: string }>(namespace: RecordNamespace, id: string) {
  saveRecords(namespace, loadRecords<T>(namespace).filter((record) => record.id !== id))
}

export function createRecordId(prefixValue: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefixValue}-${random}`
}

function key(namespace: RecordNamespace) {
  return `${prefix}${namespace}`
}
