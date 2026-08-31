import { afterEach, describe, expect, it } from 'vitest'
import { getNextOutputMode } from '../../next.config'

describe('Next.js deployment output mode', () => {
  const originalVercel = process.env.VERCEL

  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = originalVercel
  })

  it('uses Vercel native output on Vercel', () => {
    process.env.VERCEL = '1'
    expect(getNextOutputMode()).toBeUndefined()
  })

  it('keeps standalone output outside Vercel for the Docker image', () => {
    delete process.env.VERCEL
    expect(getNextOutputMode()).toBe('standalone')
  })
})
