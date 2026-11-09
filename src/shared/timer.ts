import { formatDate } from './format'
import { messages } from './i18n'
import type { ActiveTimer, AppData, Language, Project, Segment, Session } from './types'

/** Kürzere Läufe sind Fehlklicks und werden nicht gespeichert. */
export const MIN_SESSION_MS = 1000
/** Ohne Lebenszeichen über diese Dauer gilt die App als abgestürzt oder beendet. */
export const RECOVERY_GRACE_MS = 120_000
/** Mehr passt nicht ruhig in die Kopfzeile des Widgets. */
export const MAX_TIMERS = 5

export function defaultSessionName(projectName: string, timestamp: number, lang: Language): string {
  return `${projectName} - ${formatDate(timestamp, lang)}`
}

export function segmentsMs(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0)
}

export function activeMs(active: ActiveTimer, now: number): number {
  const open = active.openSince === null ? 0 : Math.max(0, now - active.openSince)
  return segmentsMs(active.segments) + open
}

function findProject(data: AppData, id: string | null | undefined): Project | undefined {
  return id ? data.projects.find((p) => p.id === id && !p.archived) : undefined
}

export function timerFor(data: AppData, projectId: string | null | undefined): ActiveTimer | undefined {
  return projectId ? data.timers.find((t) => t.projectId === projectId) : undefined
}

/** Der Timer im Vordergrund, sofern das gewählte Projekt einen hat. */
export function focusedTimer(data: AppData): ActiveTimer | undefined {
  return timerFor(data, data.selectedProjectId)
}

/** Projekte, die noch parallel gestartet werden können. */
export function freeProjects(data: AppData): Project[] {
  return data.projects.filter((p) => !p.archived && !timerFor(data, p.id))
}

function select(data: AppData, projectId: string): AppData {
  return data.selectedProjectId === projectId ? data : { ...data, selectedProjectId: projectId }
}

function replaceTimer(data: AppData, next: ActiveTimer): AppData {
  return { ...data, timers: data.timers.map((t) => (t.projectId === next.projectId ? next : t)) }
}

/** Läuft etwas, darf der Vordergrund nicht auf einem Projekt ohne Timer stehen bleiben. */
export function settleFocus(data: AppData): AppData {
  const last = data.timers.at(-1)
  return !last || focusedTimer(data) ? data : select(data, last.projectId)
}

/** Startet einen neuen Timer oder setzt einen pausierten fort. Der Vordergrund wechselt nur beim Neustart. */
export function start(data: AppData, now: number, projectId?: string): AppData {
  const id = projectId ?? data.selectedProjectId
  const existing = timerFor(data, id)
  if (existing) {
    return existing.status === 'running' ? data : replaceTimer(data, { ...existing, status: 'running', openSince: now })
  }
  const project = findProject(data, id)
  if (!project || data.timers.length >= MAX_TIMERS) return data
  return {
    ...data,
    selectedProjectId: project.id,
    timers: [
      ...data.timers,
      {
        status: 'running',
        projectId: project.id,
        name: defaultSessionName(project.name, now, data.settings.language),
        segments: [],
        openSince: now
      }
    ]
  }
}

function paused(timer: ActiveTimer, at: number): ActiveTimer {
  if (timer.status !== 'running' || timer.openSince === null) return timer
  const end = Math.max(timer.openSince, at)
  const segments = end > timer.openSince ? [...timer.segments, { start: timer.openSince, end }] : timer.segments
  return { ...timer, status: 'paused', segments, openSince: null }
}

export function pause(data: AppData, now: number, projectId?: string): AppData {
  const timer = timerFor(data, projectId ?? data.selectedProjectId)
  return timer?.status === 'running' ? replaceTimer(data, paused(timer, now)) : data
}

export function pauseAll(data: AppData, now: number): AppData {
  if (!data.timers.some((t) => t.status === 'running')) return data
  return { ...data, timers: data.timers.map((t) => paused(t, now)) }
}

export function stop(
  data: AppData,
  now: number,
  makeId: () => string,
  projectId?: string
): { data: AppData; session: Session | null } {
  const id = projectId ?? data.selectedProjectId
  const timer = timerFor(data, id)
  if (!timer) return { data, session: null }
  const finished = paused(timer, now)
  const timers = data.timers.filter((t) => t !== timer)
  // War es der Vordergrund, übernimmt der zuletzt gestartete der übrigen Timer.
  const next = data.selectedProjectId === id ? (timers.at(-1)?.projectId ?? id) : data.selectedProjectId
  const cleared: AppData = { ...data, timers, selectedProjectId: next }
  if (segmentsMs(finished.segments) < MIN_SESSION_MS) return { data: cleared, session: null }
  const session: Session = {
    id: makeId(),
    projectId: finished.projectId,
    name:
      finished.name.trim() ||
      defaultSessionName(projectName(data, finished.projectId), finished.segments[0].start, data.settings.language),
    segments: finished.segments,
    createdAt: now
  }
  return { data: { ...cleared, sessions: [...cleared.sessions, session] }, session }
}

export function stopAll(data: AppData, now: number, makeId: () => string): AppData {
  return data.timers.reduce((current, t) => stop(current, now, makeId, t.projectId).data, data)
}

function projectName(data: AppData, id: string): string {
  return data.projects.find((p) => p.id === id)?.name ?? messages[data.settings.language].common.project
}

/**
 * Projektwechsel in einem Tab: Die laufende Session bleibt beim alten Projekt und wird gespeichert.
 * Lief der Timer, startet sofort eine neue Session im neuen Projekt. Hat das Ziel schon einen Timer,
 * wechselt nur der Vordergrund und kein Timer wird angefasst.
 */
export function switchProject(
  data: AppData,
  now: number,
  projectId: string,
  makeId: () => string,
  fromProjectId?: string
): AppData {
  if (!findProject(data, projectId)) return data
  if (timerFor(data, projectId)) return select(data, projectId)
  const current = timerFor(data, fromProjectId ?? data.selectedProjectId)
  if (!current) return select(data, projectId)
  const wasRunning = current.status === 'running'
  const stopped = stop(data, now, makeId, current.projectId).data
  const selected = { ...stopped, selectedProjectId: projectId }
  return wasRunning ? start(selected, now, projectId) : selected
}

export function renameActive(data: AppData, name: string, projectId?: string): AppData {
  const timer = timerFor(data, projectId ?? data.selectedProjectId)
  return timer ? replaceTimer(data, { ...timer, name }) : data
}

/** Nach Absturz oder Herunterfahren: Zeit endet beim letzten Lebenszeichen, nicht beim Neustart. */
export function recover(data: AppData, now: number): AppData {
  if (now - data.lastSeenAt <= RECOVERY_GRACE_MS) return data
  return pauseAll(data, data.lastSeenAt)
}
