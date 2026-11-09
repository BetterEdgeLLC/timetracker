import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrateLegacyData } from '../../src/main/store'

const dir = (): string => mkdtempSync(join(tmpdir(), 'timetracker-'))

describe('Übernahme der alten Zeittracker-Daten', () => {
  it('kopiert die alten Daten und lässt das Original liegen', () => {
    const root = dir()
    const legacy = join(root, 'alt.json')
    const target = join(root, 'neu.json')
    writeFileSync(legacy, '{"alt":true}')
    expect(migrateLegacyData(target, legacy)).toBe(true)
    expect(readFileSync(target, 'utf8')).toBe('{"alt":true}')
    expect(existsSync(legacy)).toBe(true)
  })

  it('überschreibt niemals vorhandene neue Daten', () => {
    const root = dir()
    const legacy = join(root, 'alt.json')
    const target = join(root, 'neu.json')
    writeFileSync(legacy, '{"alt":true}')
    writeFileSync(target, '{"neu":true}')
    expect(migrateLegacyData(target, legacy)).toBe(false)
    expect(readFileSync(target, 'utf8')).toBe('{"neu":true}')
  })

  it('tut nichts, wenn es keine alten Daten gibt', () => {
    const root = dir()
    expect(migrateLegacyData(join(root, 'neu.json'), join(root, 'alt.json'))).toBe(false)
    expect(existsSync(join(root, 'neu.json'))).toBe(false)
  })
})
