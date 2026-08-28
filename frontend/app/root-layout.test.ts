import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appDirectory = dirname(fileURLToPath(import.meta.url))

describe('Next.js app root', () => {
  it('provides the root layout and global stylesheet beside the routes', () => {
    const layoutPath = resolve(appDirectory, 'layout.tsx')
    const stylesheetPath = resolve(appDirectory, 'globals.css')

    expect(existsSync(layoutPath)).toBe(true)
    expect(existsSync(stylesheetPath)).toBe(true)
    expect(readFileSync(layoutPath, 'utf8')).toContain('import "./globals.css"')
  })
})
