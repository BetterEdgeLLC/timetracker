/** Ein zusammenhängendes Arbeitsstück. Pausen sind die Lücken zwischen Segmenten. */
export interface Segment {
  start: number
  end: number
}

export interface Project {
  id: string
  name: string
  colorIndex: number
  /** Euro pro Stunde, netto. null bedeutet: nicht abrechenbar. */
  hourlyRate: number | null
  archived: boolean
  createdAt: number
}

export interface Session {
  id: string
  projectId: string
  name: string
  segments: Segment[]
  createdAt: number
}

export type RoundingMinutes = 0 | 5 | 6 | 10 | 15 | 30 | 60
export type RoundingMode = 'nearest' | 'up'

export interface Rounding {
  minutes: RoundingMinutes
  mode: RoundingMode
}

export type Language = 'de' | 'en'

export interface Settings {
  language: Language
  autostart: boolean
  widgetEnabled: boolean
  rounding: Rounding
}

export interface ActiveTimer {
  status: 'running' | 'paused'
  projectId: string
  name: string
  /** Abgeschlossene Segmente. */
  segments: Segment[]
  /** Beginn des laufenden Segments, null während einer Pause. */
  openSince: number | null
}

export interface AppData {
  version: 1
  projects: Project[]
  sessions: Session[]
  settings: Settings
  selectedProjectId: string | null
  active: ActiveTimer | null
  lastSeenAt: number
}

export interface ProjectInput {
  name: string
  colorIndex?: number
  hourlyRate: number | null
}

export interface SessionInput {
  projectId: string
  name: string
  segments: Segment[]
}

export type MainPage = 'timer' | 'sessions' | 'reports' | 'projects' | 'settings'

export interface SaveResult {
  saved: boolean
  path?: string
}

export interface TimetrackerApi {
  getState(): Promise<AppData>
  getSystemLocale(): Promise<string>
  onState(listener: (state: AppData) => void): () => void
  onNavigate(listener: (page: MainPage) => void): () => void
  start(projectId?: string): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  switchProject(projectId: string): Promise<void>
  renameActive(name: string): Promise<void>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(id: string, patch: Partial<ProjectInput> & { archived?: boolean }): Promise<void>
  deleteProject(id: string): Promise<void>
  createSession(input: SessionInput): Promise<void>
  updateSession(id: string, patch: Partial<SessionInput>): Promise<void>
  deleteSession(id: string): Promise<void>
  updateSettings(patch: Partial<Settings>): Promise<void>
  saveCsv(defaultName: string, content: string): Promise<SaveResult>
  copyText(content: string): Promise<void>
  openMain(page?: MainPage): Promise<void>
  openDataFolder(): Promise<void>
  widgetIgnoreMouse(ignore: boolean): Promise<void>
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'de',
  autostart: true,
  widgetEnabled: true,
  rounding: { minutes: 0, mode: 'nearest' }
}

export function emptyData(now: number): AppData {
  return {
    version: 1,
    projects: [],
    sessions: [],
    settings: { ...DEFAULT_SETTINGS, rounding: { ...DEFAULT_SETTINGS.rounding } },
    selectedProjectId: null,
    active: null,
    lastSeenAt: now
  }
}

/** Dunkel-Stufen der geprüften Kategorie-Palette, feste Reihenfolge. */
export const PROJECT_COLORS = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767'
] as const
