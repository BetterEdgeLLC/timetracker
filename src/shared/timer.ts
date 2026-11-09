import { formatDate } from './format'
import { messages } from './i18n'
import type { ActiveTimer, AppData, Language, Project, Segment, Session } from './types'

/** Kürzere Läufe sind Fehlklicks und werden nicht gespeichert. */
export const MIN_SESSION_MS = 1000
/** Ohne Lebenszeichen über diese Dauer gilt die App als abgestürzt oder beendet. */
export const RECOVERY_GRACE_MS = 120_000

export function defaultSessionName(projectName: string, timestamp: number, lang: Language): string {
  return `${projectName} · ${formatDate(timestamp, lang)}`
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

export function start(data: AppData, now: number, projectId?: string): AppData {
  if (data.active?.status === 'running') return data
  if (data.active?.status === 'paused') {
    return { ...data, active: { ...data.active, status: 'running', openSince: now } }
  }
  const project = findProject(data, projectId ?? data.selectedProjectId)
  if (!project) return data
  return {
    ...data,
    selectedProjectId: project.id,
    active: {
      status: 'running',
      projectId: project.id,
      name: defaultSessionName(project.name, now, data.settings.language),
      segments: [],
      openSince: now
    }
  }
}

export function pause(data: AppData, now: number, at: number = now): AppData {
  const active = data.active
  if (active?.status !== 'running' || active.openSince === null) return data
  const end = Math.max(active.openSince, at)
  const segments = end > active.openSince ? [...active.segments, { start: active.openSince, end }] : active.segments
  return { ...data, active: { ...active, status: 'paused', segments, openSince: null } }
}

export function stop(
  data: AppData,
  now: number,
  makeId: () => string
): { data: AppData; session: Session | null } {
  const paused = pause(data, now)
  const active = paused.active
  if (!active) return { data, session: null }
  const cleared: AppData = { ...paused, active: null }
  if (segmentsMs(active.segments) < MIN_SESSION_MS) return { data: cleared, session: null }
  const session: Session = {
    id: makeId(),
    projectId: active.projectId,
    name:
      active.name.trim() ||
      defaultSessionName(projectName(data, active.projectId), active.segments[0].start, data.settings.language),
    segments: active.segments,
    createdAt: now
  }
  return { data: { ...cleared, sessions: [...cleared.sessions, session] }, session }
}

function projectName(data: AppData, id: string): string {
  return data.projects.find((p) => p.id === id)?.name ?? messages[data.settings.language].common.project
}

/**
 * Projektwechsel: Die laufende Session bleibt beim alten Projekt und wird gespeichert.
 * Lief der Timer, startet sofort eine neue Session im neuen Projekt.
 */
export function switchProject(data: AppData, now: number, projectId: string, makeId: () => string): AppData {
  if (!findProject(data, projectId)) return data
  if (!data.active) return { ...data, selectedProjectId: projectId }
  if (data.active.projectId === projectId) return data
  const wasRunning = data.active.status === 'running'
  const stopped = stop(data, now, makeId).data
  const selected = { ...stopped, selectedProjectId: projectId }
  return wasRunning ? start(selected, now, projectId) : selected
}

export function renameActive(data: AppData, name: string): AppData {
  return data.active ? { ...data, active: { ...data.active, name } } : data
}

/** Nach Absturz oder Herunterfahren: Zeit endet beim letzten Lebenszeichen, nicht beim Neustart. */
export function recover(data: AppData, now: number): AppData {
  const active = data.active
  if (active?.status !== 'running') return data
  if (now - data.lastSeenAt <= RECOVERY_GRACE_MS) return data
  return pause(data, now, data.lastSeenAt)
}
