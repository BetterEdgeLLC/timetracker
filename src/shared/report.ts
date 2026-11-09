import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfDay,
  startOfISOWeek,
  startOfMonth
} from 'date-fns'
import { DATE_PATTERNS } from './dates'
import { formatDate } from './format'
import { messages } from './i18n'
import { segmentsMs } from './timer'
import type { Language, Project, Rounding, Session } from './types'

export type GroupBy = 'project' | 'month' | 'week' | 'day' | 'session'
export type Bucket = 'day' | 'week' | 'month'

export interface Filter {
  /** Einschließlich. */
  start: number
  /** Ausschließlich. */
  end: number
  /** null bedeutet: alle Projekte. */
  projectIds: string[] | null
}

export interface ReportRow {
  key: string
  periodLabel: string | null
  sortKey: number
  project: Project | null
  sessionName: string | null
  sessions: number
  ms: number
  hundredths: number
  rate: number | null
  cents: number
}

export interface Totals {
  sessions: number
  ms: number
  hundredths: number
  cents: number
}

export const sessionStart = (s: Session): number => Math.min(...s.segments.map((x) => x.start))
export const sessionEnd = (s: Session): number => Math.max(...s.segments.map((x) => x.end))

/** Abrechenbare Zeit in Hundertstel-Stunden. Hundertstel mal Euro-Satz ergibt direkt Cent. */
export function billableHundredths(ms: number, rounding: Rounding): number {
  let value = ms
  if (rounding.minutes > 0) {
    const step = rounding.minutes * 60_000
    const steps = ms / step
    value = (rounding.mode === 'up' ? Math.ceil(steps) : Math.round(steps)) * step
  }
  return Math.round(value / 36_000)
}

export function amountCents(hundredths: number, rate: number | null): number {
  return rate === null ? 0 : Math.round(hundredths * rate)
}

/** Eine Session zählt immer komplett zu dem Tag, an dem sie gestartet wurde. */
export function filterSessions(sessions: Session[], filter: Filter): Session[] {
  return sessions
    .filter((s) => {
      const start = sessionStart(s)
      return (
        start >= filter.start &&
        start < filter.end &&
        (filter.projectIds === null || filter.projectIds.includes(s.projectId))
      )
    })
    .sort((a, b) => sessionStart(a) - sessionStart(b))
}

function period(
  timestamp: number,
  group: 'month' | 'week' | 'day',
  lang: Language
): { key: string; label: string; sort: number } {
  const date = new Date(timestamp)
  const patterns = DATE_PATTERNS[lang]
  const options = { locale: patterns.locale }
  if (group === 'month') {
    const first = startOfMonth(date)
    return { key: format(first, 'yyyy-MM'), label: format(first, 'MMMM yyyy', options), sort: first.getTime() }
  }
  if (group === 'week') {
    const week = getISOWeek(date)
    const year = getISOWeekYear(date)
    const first = startOfISOWeek(date)
    return { key: `${year}-${week}`, label: `${messages[lang].reports.weekShort} ${week} / ${year}`, sort: first.getTime() }
  }
  const day = startOfDay(date)
  return { key: format(day, 'yyyy-MM-dd'), label: format(day, patterns.weekday, options), sort: day.getTime() }
}

export function buildRows(
  sessions: Session[],
  projects: Project[],
  rounding: Rounding,
  groupBy: GroupBy,
  lang: Language
): ReportRow[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const rows = new Map<string, ReportRow>()

  for (const session of sessions) {
    const project = byId.get(session.projectId) ?? null
    const ms = segmentsMs(session.segments)
    const hundredths = billableHundredths(ms, rounding)
    const startedAt = sessionStart(session)
    const bucket = groupBy === 'project' || groupBy === 'session' ? null : period(startedAt, groupBy, lang)
    const key =
      groupBy === 'session' ? session.id : `${bucket?.key ?? ''}|${session.projectId}`
    const row = rows.get(key) ?? {
      key,
      periodLabel: groupBy === 'session' ? formatDate(startedAt, lang) : (bucket?.label ?? null),
      sortKey: groupBy === 'session' ? startedAt : (bucket?.sort ?? 0),
      project,
      sessionName: groupBy === 'session' ? session.name : null,
      sessions: 0,
      ms: 0,
      hundredths: 0,
      rate: project?.hourlyRate ?? null,
      cents: 0
    }
    row.sessions += 1
    row.ms += ms
    row.hundredths += hundredths
    rows.set(key, row)
  }

  return [...rows.values()]
    .map((row) => ({ ...row, cents: amountCents(row.hundredths, row.rate) }))
    .sort((a, b) =>
      groupBy === 'project'
        ? b.hundredths - a.hundredths
        : a.sortKey - b.sortKey || (a.project?.name ?? '').localeCompare(b.project?.name ?? '', 'de')
    )
}

export function sumRows(rows: ReportRow[]): Totals {
  return rows.reduce(
    (t, r) => ({
      sessions: t.sessions + r.sessions,
      ms: t.ms + r.ms,
      hundredths: t.hundredths + r.hundredths,
      cents: t.cents + r.cents
    }),
    { sessions: 0, ms: 0, hundredths: 0, cents: 0 }
  )
}

export interface ChartSeries {
  id: string
  name: string
  color: string | null
}

export interface ChartBucket {
  key: string
  label: string
  fullLabel: string
  values: Record<string, number>
  total: number
}

export interface ChartData {
  series: ChartSeries[]
  buckets: ChartBucket[]
}

export function chooseBucket(start: number, end: number): Bucket {
  const days = differenceInCalendarDays(new Date(end), new Date(start))
  if (days <= 35) return 'day'
  if (days <= 190) return 'week'
  return 'month'
}

const OTHER_ID = 'weitere'
const MAX_SERIES = 8

function bucketStarts(start: number, end: number, bucket: Bucket): Date[] {
  const interval = { start: new Date(start), end: new Date(end - 1) }
  if (bucket === 'day') return eachDayOfInterval(interval)
  if (bucket === 'week') return eachWeekOfInterval(interval, { weekStartsOn: 1 })
  return eachMonthOfInterval(interval)
}

function bucketKey(date: Date, bucket: Bucket): string {
  if (bucket === 'day') return format(date, 'yyyy-MM-dd')
  if (bucket === 'week') return format(startOfISOWeek(date), 'yyyy-MM-dd')
  return format(date, 'yyyy-MM')
}

function bucketLabels(
  date: Date,
  bucket: Bucket,
  shortRange: boolean,
  lang: Language
): { label: string; fullLabel: string } {
  const patterns = DATE_PATTERNS[lang]
  const m = messages[lang]
  const options = { locale: patterns.locale }
  if (bucket === 'day') {
    return {
      label: shortRange ? format(date, 'EEEEEE', options) : format(date, patterns.dayOfMonth),
      fullLabel: format(date, patterns.long, options)
    }
  }
  if (bucket === 'week') {
    const first = startOfISOWeek(date)
    const week = `${m.reports.weekShort} ${getISOWeek(date)}`
    return {
      label: week,
      fullLabel: `${week}, ${format(first, patterns.day, options)} ${m.common.to} ${format(addDays(first, 6), patterns.full, options)}`
    }
  }
  return { label: format(date, 'MMM', options), fullLabel: format(date, 'MMMM yyyy', options) }
}

export function buildChart(
  sessions: Session[],
  projects: Project[],
  colorOf: (project: Project) => string,
  start: number,
  end: number,
  lang: Language
): ChartData {
  if (end <= start) return { series: [], buckets: [] }
  const bucket = chooseBucket(start, end)
  const totals = new Map<string, number>()
  for (const s of sessions) totals.set(s.projectId, (totals.get(s.projectId) ?? 0) + segmentsMs(s.segments))

  // Über acht Projekte werden die kleinsten zu "Weitere", nie zu einer erfundenen Farbe.
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const kept = new Set(ranked.length > MAX_SERIES ? ranked.slice(0, MAX_SERIES - 1) : ranked)
  const seriesId = (projectId: string): string => (kept.has(projectId) ? projectId : OTHER_ID)

  const series: ChartSeries[] = projects
    .filter((p) => kept.has(p.id))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((p) => ({ id: p.id, name: p.name, color: colorOf(p) }))
  if (ranked.length > kept.size) series.push({ id: OTHER_ID, name: messages[lang].common.other, color: null })

  const starts = bucketStarts(start, end, bucket)
  const shortRange = bucket === 'day' && starts.length <= 7
  const buckets = new Map<string, ChartBucket>(
    starts.map((date) => {
      const key = bucketKey(date, bucket)
      return [key, { key, ...bucketLabels(date, bucket, shortRange, lang), values: {}, total: 0 }]
    })
  )
  for (const session of sessions) {
    const target = buckets.get(bucketKey(new Date(sessionStart(session)), bucket))
    if (!target) continue
    const id = seriesId(session.projectId)
    const ms = segmentsMs(session.segments)
    target.values[id] = (target.values[id] ?? 0) + ms
    target.total += ms
  }
  return { series, buckets: [...buckets.values()] }
}
