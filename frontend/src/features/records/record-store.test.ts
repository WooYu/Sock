import { beforeEach, describe, expect, test } from 'vitest'
import { addRecord, loadRecords, removeRecord, saveRecords } from './record-store'

type FixtureRecord = { id: string; value: string }

describe('record store', () => {
  beforeEach(() => localStorage.clear())

  test('persists records by namespace and reads them back', () => {
    const record = { id: 'prediction-1', value: '等待回踩' }

    addRecord<FixtureRecord>('predictions', record)

    expect(loadRecords<FixtureRecord>('predictions')).toEqual([record])
    expect(loadRecords<FixtureRecord>('trades')).toEqual([])
  })

  test('replaces a namespace without affecting another namespace', () => {
    saveRecords('reviews', [{ id: 'review-1', value: '完成复盘' }])
    saveRecords('reviews', [{ id: 'review-2', value: '等待复盘' }])

    expect(loadRecords<FixtureRecord>('reviews')).toEqual([{ id: 'review-2', value: '等待复盘' }])
  })

  test('removes only the requested record', () => {
    saveRecords('trades', [{ id: 'trade-1', value: '买入' }, { id: 'trade-2', value: '卖出' }])

    removeRecord<FixtureRecord>('trades', 'trade-1')

    expect(loadRecords<FixtureRecord>('trades')).toEqual([{ id: 'trade-2', value: '卖出' }])
  })
})
