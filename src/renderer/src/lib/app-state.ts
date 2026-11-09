import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { activeMs, freeProjects, MAX_TIMERS, timerFor } from '@shared/timer'
import { PROJECT_COLORS, type ActiveTimer, type AppData, type Project } from '@shared/types'

export function useAppState(): AppData | null {
  const [state, setState] = useState<AppData | null>(null)
  useEffect(() => {
    let alive = true
    void window.api.getState().then((value) => alive && setState(value))
    const off = window.api.onState(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}

/** Netto-Laufzeit des aktiven Timers, aktualisiert sich nur solange er läuft. */
export function useElapsed(active: ActiveTimer | null): number {
  const [, tick] = useState(0)
  const running = active?.status === 'running'
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(timer)
  }, [running])
  return active ? activeMs(active, Date.now()) : 0
}

export const colorOf = (project: Pick<Project, 'colorIndex'>): string =>
  PROJECT_COLORS[project.colorIndex % PROJECT_COLORS.length]

export const activeProjects = (state: AppData): Project[] => state.projects.filter((p) => !p.archived)

export interface TimerView {
  /** Das Projekt, das die Knöpfe gerade steuern. */
  projectId: string | null
  timer: ActiveTimer | null
  /** Aktive Timer in Startreihenfolge, dazu das gezeigte Projekt, falls es noch keinen hat. */
  tabIds: string[]
  canAdd: boolean
  /** Lokal und unsichtbar für andere Fenster: ein Projekt, das erst noch gestartet wird. */
  setDraft: React.Dispatch<React.SetStateAction<string | null>>
  /** Wahl in der Projektliste: ersetzt den Timer dieses Tabs, nie einen fremden. */
  pick: (projectId: string) => void
  /** Klick auf einen anderen Tab: fasst keinen Timer an. */
  focus: (projectId: string) => void
}

/**
 * Trennt, was gemeinsam ist (Timer, Vordergrund), von dem, was nur dieses Fenster gerade zeigt.
 * So taucht ein noch nicht gestartetes Projekt nicht in anderen Fenstern auf.
 */
export function useTimerView(state: AppData | null): TimerView {
  const [draft, setDraft] = useState<string | null>(null)
  const liveDraft = draft && state?.projects.some((p) => p.id === draft && !p.archived) ? draft : null
  const projectId = liveDraft ?? state?.selectedProjectId ?? null
  const timer = (state && timerFor(state, projectId)) ?? null
  const running = state?.timers.map((t) => t.projectId) ?? []
  const free = state ? freeProjects(state) : []

  const focus = (target: string): void => {
    setDraft(null)
    run(window.api.switchProject(target, projectId ?? undefined))
  }

  const pick = (target: string): void => {
    // Ein noch nicht gestarteter Tab wechselt nur sein Projekt, die laufenden Timer bleiben unberührt.
    if (state && !timer && state.timers.length > 0 && !timerFor(state, target)) setDraft(target)
    else focus(target)
  }

  return {
    projectId,
    timer,
    tabIds: projectId && !timer ? [...running, projectId] : running,
    canAdd: running.length > 0 && running.length < MAX_TIMERS && free.some((p) => p.id !== projectId),
    setDraft,
    pick,
    focus
  }
}

export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** Führt eine IPC-Aktion aus und zeigt Fehler als Toast. */
export function run(action: Promise<unknown>): void {
  action.catch((error: unknown) => toast.error(errorText(error)))
}
