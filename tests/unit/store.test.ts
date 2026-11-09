import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrateLegacyData, Store } from '../../src/main/store'

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

describe('Datenformat bis Version 1.2', () => {
  const base = { version: 1, projects: [], sessions: [], settings: {}, lastSeenAt: 1 }
  const timer = { status: 'running', projectId: 'a', name: 'Alpha', segments: [], openSince: 5 }

  const load = (content: object): Store => {
    const file = join(dir(), 'daten.json')
    writeFileSync(file, JSON.stringify(content))
    return new Store(file)
  }

  it('übernimmt einen laufenden Timer aus dem alten Feld', () => {
    const { data } = load({ ...base, selectedProjectId: 'b', active: timer })
    expect(data.timers).toEqual([timer])
    expect(data.selectedProjectId).toBe('a')
    expect(data).not.toHaveProperty('active')
  })

  it('startet ohne alten Timer leer und behält die Projektwahl', () => {
    const { data } = load({ ...base, selectedProjectId: 'b', active: null })
    expect(data.timers).toEqual([])
    expect(data.selectedProjectId).toBe('b')
  })

  it('lässt neue Daten unverändert', () => {
    const { data } = load({ ...base, selectedProjectId: 'b', timers: [timer, { ...timer, projectId: 'b' }] })
    expect(data.timers).toHaveLength(2)
    expect(data.selectedProjectId).toBe('b')
  })
})
