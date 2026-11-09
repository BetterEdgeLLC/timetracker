import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { activeMs } from '@shared/timer'
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

export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** Führt eine IPC-Aktion aus und zeigt Fehler als Toast. */
export function run(action: Promise<unknown>): void {
  action.catch((error: unknown) => toast.error(errorText(error)))
}
