import { describe, expect, it } from 'vitest'
import * as timer from '../../src/shared/timer'
import { emptyData, type AppData } from '../../src/shared/types'

const T0 = new Date(2026, 10, 9, 9, 0, 0).getTime()
const MIN = 60_000
const makeId = (): string => 'neu'

function withProjects(): AppData {
  return {
    ...emptyData(T0),
    selectedProjectId: 'a',
    projects: [
      { id: 'a', name: 'Alpha', colorIndex: 0, hourlyRate: 100, archived: false, createdAt: 1 },
      { id: 'b', name: 'Beta', colorIndex: 1, hourlyRate: null, archived: false, createdAt: 2 },
      { id: 'x', name: 'Alt', colorIndex: 2, hourlyRate: null, archived: true, createdAt: 3 }
    ]
  }
}

describe('Timer', () => {
  it('startet mit dem Standardnamen aus Projekt und Datum', () => {
    const data = timer.start(withProjects(), T0)
    expect(data.active?.status).toBe('running')
    expect(data.active?.name).toBe('Alpha - 09.11.2026')
  })

  it('benennt neue Sessions in der gewählten Sprache', () => {
    const base = withProjects()
    const english = { ...base, settings: { ...base.settings, language: 'en' as const } }
    expect(timer.start(english, T0).active?.name).toBe('Alpha - 09 Nov 2026')
  })

  it('startet nicht ohne gewähltes Projekt und nicht mit archiviertem Projekt', () => {
    expect(timer.start({ ...withProjects(), selectedProjectId: null }, T0).active).toBeNull()
    expect(timer.start(withProjects(), T0, 'x').active).toBeNull()
  })

  it('zählt Pausen nicht mit', () => {
    let data = timer.start(withProjects(), T0)
    data = timer.pause(data, T0 + 10 * MIN)
    data = timer.start(data, T0 + 25 * MIN)
    expect(timer.activeMs(data.active!, T0 + 30 * MIN)).toBe(15 * MIN)
    const { session } = timer.stop(data, T0 + 30 * MIN, makeId)
    expect(session?.segments).toEqual([
      { start: T0, end: T0 + 10 * MIN },
      { start: T0 + 25 * MIN, end: T0 + 30 * MIN }
    ])
  })

  it('verwirft Fehlklicks unter einer Sekunde', () => {
    const data = timer.start(withProjects(), T0)
    const result = timer.stop(data, T0 + 400, makeId)
    expect(result.session).toBeNull()
    expect(result.data.active).toBeNull()
    expect(result.data.sessions).toHaveLength(0)
  })

  it('übernimmt einen geänderten Sessionnamen beim Stopp', () => {
    let data = timer.start(withProjects(), T0)
    data = timer.renameActive(data, 'Kickoff')
    expect(timer.stop(data, T0 + MIN, makeId).session?.name).toBe('Kickoff')
  })

  it('fällt bei leerem Namen auf den Standardnamen zurück', () => {
    let data = timer.start(withProjects(), T0)
    data = timer.renameActive(data, '   ')
    expect(timer.stop(data, T0 + MIN, makeId).session?.name).toBe('Alpha - 09.11.2026')
  })

  it('speichert beim Projektwechsel die alte Session und läuft im neuen Projekt weiter', () => {
    const data = timer.switchProject(timer.start(withProjects(), T0), T0 + 5 * MIN, 'b', makeId)
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].projectId).toBe('a')
    expect(data.active?.projectId).toBe('b')
    expect(data.active?.status).toBe('running')
    expect(data.active?.openSince).toBe(T0 + 5 * MIN)
  })

  it('bleibt beim Projektwechsel aus der Pause gestoppt', () => {
    const paused = timer.pause(timer.start(withProjects(), T0), T0 + 5 * MIN)
    const data = timer.switchProject(paused, T0 + 6 * MIN, 'b', makeId)
    expect(data.active).toBeNull()
    expect(data.selectedProjectId).toBe('b')
    expect(data.sessions).toHaveLength(1)
  })

  it('beendet die Zeit nach einem Absturz beim letzten Lebenszeichen', () => {
    const data = { ...timer.start(withProjects(), T0), lastSeenAt: T0 + 30 * MIN }
    const recovered = timer.recover(data, T0 + 300 * MIN)
    expect(recovered.active?.status).toBe('paused')
    expect(timer.activeMs(recovered.active!, T0 + 300 * MIN)).toBe(30 * MIN)
  })

  it('läuft nach einem kurzen Neustart einfach weiter', () => {
    const data = { ...timer.start(withProjects(), T0), lastSeenAt: T0 + 30 * MIN }
    expect(timer.recover(data, T0 + 31 * MIN).active?.status).toBe('running')
  })
})
