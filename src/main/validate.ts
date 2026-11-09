import type { Messages } from '../shared/i18n'
import type { ProjectInput, Segment, SessionInput, Settings } from '../shared/types'

function fail(message: string): never {
  throw new Error(message)
}

type ProjectPatch = Partial<ProjectInput> & { archived?: boolean }

/** Prüft alles, was aus dem Renderer kommt. Fehlermeldungen in der gewählten Sprache. */
export function validators(m: Messages) {
  const text = (value: unknown, field: string, max = 200): string => {
    if (typeof value !== 'string') fail(m.error.missing(field))
    const trimmed = (value as string).trim()
    if (!trimmed) fail(m.error.empty(field))
    if (trimmed.length > max) fail(m.error.tooLong(field))
    return trimmed
  }

  const id = (value: unknown): string => text(value, m.field.id, 64)

  const rate = (value: unknown): number | null => {
    if (value === null) return null
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100_000) {
      fail(m.error.invalidRate)
    }
    return Math.round((value as number) * 100) / 100
  }

  const color = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 7) fail(m.error.invalidColor)
    return value as number
  }

  const segments = (value: unknown): Segment[] => {
    if (!Array.isArray(value) || value.length === 0) fail(m.error.segmentRequired)
    const list = (value as Segment[]).map((s) => {
      if (!Number.isFinite(s?.start) || !Number.isFinite(s?.end) || s.end <= s.start) fail(m.error.segmentOrder)
      return { start: s.start, end: s.end }
    })
    list.sort((a, b) => a.start - b.start)
    list.forEach((s, i) => {
      if (i > 0 && s.start < list[i - 1].end) fail(m.error.segmentOverlap)
    })
    return list
  }

  return {
    id,
    projectInput(value: unknown): ProjectInput {
      const v = value as ProjectInput
      return {
        name: text(v?.name, m.field.projectName, 80),
        hourlyRate: rate(v?.hourlyRate ?? null),
        ...(v?.colorIndex === undefined ? {} : { colorIndex: color(v.colorIndex) })
      }
    },
    projectPatch(value: unknown): ProjectPatch {
      const v = (value ?? {}) as ProjectPatch
      const patch: ProjectPatch = {}
      if (v.name !== undefined) patch.name = text(v.name, m.field.projectName, 80)
      if (v.hourlyRate !== undefined) patch.hourlyRate = rate(v.hourlyRate)
      if (v.colorIndex !== undefined) patch.colorIndex = color(v.colorIndex)
      if (v.archived !== undefined) patch.archived = v.archived === true
      return patch
    },
    sessionInput(value: unknown): SessionInput {
      const v = value as SessionInput
      return { projectId: id(v?.projectId), name: text(v?.name, m.field.sessionName), segments: segments(v?.segments) }
    },
    sessionPatch(value: unknown): Partial<SessionInput> {
      const v = (value ?? {}) as Partial<SessionInput>
      const patch: Partial<SessionInput> = {}
      if (v.projectId !== undefined) patch.projectId = id(v.projectId)
      if (v.name !== undefined) patch.name = text(v.name, m.field.sessionName)
      if (v.segments !== undefined) patch.segments = segments(v.segments)
      return patch
    },
    settingsPatch(value: unknown, current: Settings): Partial<Settings> {
      const v = (value ?? {}) as Partial<Settings>
      const patch: Partial<Settings> = {}
      if (v.language !== undefined) {
        if (v.language !== 'de' && v.language !== 'en') fail(m.error.invalidLanguage)
        patch.language = v.language
      }
      if (typeof v.autostart === 'boolean') patch.autostart = v.autostart
      if (typeof v.widgetEnabled === 'boolean') patch.widgetEnabled = v.widgetEnabled
      if (v.rounding) {
        const minutes = v.rounding.minutes ?? current.rounding.minutes
        const mode = v.rounding.mode ?? current.rounding.mode
        if (![0, 5, 6, 10, 15, 30, 60].includes(minutes)) fail(m.error.invalidRounding)
        if (mode !== 'nearest' && mode !== 'up') fail(m.error.invalidRoundingMode)
        patch.rounding = { minutes, mode }
      }
      return patch
    },
    /** Hält den Dateinamen aus dem Renderer auf einen reinen Dateinamen begrenzt. */
    fileName(value: unknown): string {
      const name = text(value, m.field.fileName, 150).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      return name.toLowerCase().endsWith('.csv') ? name : `${name}.csv`
    }
  }
}
