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
    expect(timer.focusedTimer(data)?.status).toBe('running')
    expect(timer.focusedTimer(data)?.name).toBe('Alpha - 09.11.2026')
  })

  it('benennt neue Sessions in der gewählten Sprache', () => {
    const base = withProjects()
    const english = { ...base, settings: { ...base.settings, language: 'en' as const } }
    expect(timer.focusedTimer(timer.start(english, T0))?.name).toBe('Alpha - 09 Nov 2026')
  })

  it('startet nicht ohne gewähltes Projekt und nicht mit archiviertem Projekt', () => {
    expect(timer.start({ ...withProjects(), selectedProjectId: null }, T0).timers).toEqual([])
    expect(timer.start(withProjects(), T0, 'x').timers).toEqual([])
  })

  it('zählt Pausen nicht mit', () => {
    let data = timer.start(withProjects(), T0)
    data = timer.pause(data, T0 + 10 * MIN)
    data = timer.start(data, T0 + 25 * MIN)
    expect(timer.activeMs(timer.focusedTimer(data)!, T0 + 30 * MIN)).toBe(15 * MIN)
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
    expect(result.data.timers).toEqual([])
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
    expect(timer.focusedTimer(data)?.projectId).toBe('b')
    expect(timer.focusedTimer(data)?.status).toBe('running')
    expect(timer.focusedTimer(data)?.openSince).toBe(T0 + 5 * MIN)
  })

  it('bleibt beim Projektwechsel aus der Pause gestoppt', () => {
    const paused = timer.pause(timer.start(withProjects(), T0), T0 + 5 * MIN)
    const data = timer.switchProject(paused, T0 + 6 * MIN, 'b', makeId)
    expect(data.timers).toEqual([])
    expect(data.selectedProjectId).toBe('b')
    expect(data.sessions).toHaveLength(1)
  })

  it('beendet die Zeit nach einem Absturz beim letzten Lebenszeichen', () => {
    const data = { ...timer.start(withProjects(), T0), lastSeenAt: T0 + 30 * MIN }
    const recovered = timer.recover(data, T0 + 300 * MIN)
    expect(timer.focusedTimer(recovered)?.status).toBe('paused')
    expect(timer.activeMs(timer.focusedTimer(recovered)!, T0 + 300 * MIN)).toBe(30 * MIN)
  })

  it('läuft nach einem kurzen Neustart einfach weiter', () => {
    const data = { ...timer.start(withProjects(), T0), lastSeenAt: T0 + 30 * MIN }
    expect(timer.focusedTimer(timer.recover(data, T0 + 31 * MIN))?.status).toBe('running')
  })
})

describe('Parallele Timer', () => {
  const two = (): AppData => timer.start(timer.start(withProjects(), T0, 'a'), T0 + MIN, 'b')

  it('lässt beide Timer unabhängig voneinander laufen', () => {
    const data = two()
    expect(data.timers.map((t) => t.projectId)).toEqual(['a', 'b'])
    expect(data.selectedProjectId).toBe('b')
    expect(timer.activeMs(timer.timerFor(data, 'a')!, T0 + 10 * MIN)).toBe(10 * MIN)
    expect(timer.activeMs(timer.timerFor(data, 'b')!, T0 + 10 * MIN)).toBe(9 * MIN)
  })

  it('startet pro Projekt keinen zweiten Timer', () => {
    expect(timer.start(two(), T0 + 2 * MIN, 'a').timers).toHaveLength(2)
  })

  it('startet nicht mehr Timer als erlaubt', () => {
    const base = withProjects()
    const projects = Array.from({ length: timer.MAX_TIMERS + 1 }, (_, i) => ({ ...base.projects[0], id: `p${i}` }))
    const data = projects.reduce((d, p) => timer.start(d, T0, p.id), { ...base, projects })
    expect(data.timers).toHaveLength(timer.MAX_TIMERS)
  })

  it('pausiert und benennt nur den gemeinten Timer', () => {
    let data = timer.pause(two(), T0 + 5 * MIN, 'a')
    data = timer.renameActive(data, 'Nur Alpha', 'a')
    expect(timer.timerFor(data, 'a')?.status).toBe('paused')
    expect(timer.timerFor(data, 'a')?.name).toBe('Nur Alpha')
    expect(timer.timerFor(data, 'b')?.status).toBe('running')
    expect(timer.timerFor(data, 'b')?.name).toBe('Beta - 09.11.2026')
  })

  it('setzt beim Fortsetzen den Vordergrund nicht um', () => {
    const data = timer.start(timer.pause(two(), T0 + 5 * MIN, 'a'), T0 + 6 * MIN, 'a')
    expect(timer.timerFor(data, 'a')?.status).toBe('running')
    expect(data.selectedProjectId).toBe('b')
  })

  it('speichert beim Stopp nur den gemeinten Timer, die übrigen laufen weiter', () => {
    const { data, session } = timer.stop(two(), T0 + 5 * MIN, makeId, 'a')
    expect(session?.projectId).toBe('a')
    expect(data.timers.map((t) => t.projectId)).toEqual(['b'])
    expect(timer.timerFor(data, 'b')?.status).toBe('running')
    expect(data.selectedProjectId).toBe('b')
  })

  it('gibt den Vordergrund nach dem Stopp an den übrigen Timer', () => {
    expect(timer.stop(two(), T0 + 5 * MIN, makeId, 'b').data.selectedProjectId).toBe('a')
  })

  it('wechselt auf einen Tab mit Timer, ohne etwas zu stoppen', () => {
    const data = timer.switchProject(two(), T0 + 5 * MIN, 'a', makeId, 'b')
    expect(data.selectedProjectId).toBe('a')
    expect(data.timers).toHaveLength(2)
    expect(data.sessions).toHaveLength(0)
  })

  it('ersetzt beim Projektwechsel nur den Timer des eigenen Tabs', () => {
    const base = withProjects()
    const gamma = { id: 'c', name: 'Gamma', colorIndex: 3, hourlyRate: null, archived: false, createdAt: 4 }
    const started = timer.start(timer.start({ ...base, projects: [...base.projects, gamma] }, T0, 'a'), T0 + MIN, 'b')
    const data = timer.switchProject(started, T0 + 5 * MIN, 'c', makeId, 'a')
    expect(data.sessions.map((s) => s.projectId)).toEqual(['a'])
    expect(data.timers.map((t) => t.projectId).sort()).toEqual(['b', 'c'])
    expect(timer.timerFor(data, 'b')?.openSince).toBe(T0 + MIN)
  })

  it('pausiert im Standby alle Timer', () => {
    expect(timer.pauseAll(two(), T0 + 5 * MIN).timers.every((t) => t.status === 'paused')).toBe(true)
  })

  it('beendet beim Absturz alle Timer beim letzten Lebenszeichen', () => {
    const recovered = timer.recover({ ...two(), lastSeenAt: T0 + 30 * MIN }, T0 + 300 * MIN)
    expect(timer.activeMs(timer.timerFor(recovered, 'a')!, T0 + 300 * MIN)).toBe(30 * MIN)
    expect(timer.activeMs(timer.timerFor(recovered, 'b')!, T0 + 300 * MIN)).toBe(29 * MIN)
  })

  it('stoppt alle Timer auf einmal', () => {
    let ids = 0
    const data = timer.stopAll(two(), T0 + 5 * MIN, () => `s${ids++}`)
    expect(data.timers).toEqual([])
    expect(data.sessions.map((s) => s.id)).toEqual(['s0', 's1'])
  })

  it('zeigt als freie Projekte nur solche ohne Timer und ohne Archiv', () => {
    expect(timer.freeProjects(timer.start(withProjects(), T0, 'a')).map((p) => p.id)).toEqual(['b'])
  })

  it('holt den Vordergrund zurück, wenn er auf einem Projekt ohne Timer steht', () => {
    expect(timer.settleFocus({ ...two(), selectedProjectId: null }).selectedProjectId).toBe('b')
  })
})
