import { format } from 'date-fns'
import { formatDate, hm, timeText } from './format'
import { messages } from './i18n'
import { amountCents, billableHundredths, sessionEnd, sessionStart, sumRows, type GroupBy, type ReportRow } from './report'
import { segmentsMs } from './timer'
import type { Language, Project, Rounding, Session } from './types'

export interface CsvStyle {
  separator: string
  decimal: string
}

/**
 * Excel richtet sich nach der Windows-Region, nicht nach der Sprache der App.
 * Deshalb kommen Trennzeichen und Dezimalzeichen aus dem System, die Überschriften aus der App.
 */
export function csvStyleFor(systemLocale: string): CsvStyle {
  const comma = new Intl.NumberFormat(systemLocale).format(1.5).includes(',')
  return comma ? { separator: ';', decimal: ',' } : { separator: ',', decimal: '.' }
}

/** Formel-Injektion wird entschärft, Trennzeichen werden maskiert. */
export function csvCell(value: string, separator: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  const needsQuotes = safe.includes(separator) || /["\r\n]/.test(safe)
  return needsQuotes ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: string[][], separator: string): string {
  return rows.map((row) => row.map((cell) => csvCell(cell, separator)).join(separator)).join('\r\n') + '\r\n'
}

const decimalText = (value: number, style: CsvStyle): string => value.toFixed(2).replace('.', style.decimal)

export function tableCsv(rows: ReportRow[], groupBy: GroupBy, lang: Language, style: CsvStyle): string {
  const m = messages[lang]
  const periodHeader: Record<GroupBy, string | null> = {
    project: null,
    month: m.reports.month,
    week: m.reports.week,
    day: m.reports.day,
    session: m.reports.date
  }
  const money = (cents: number): string => decimalText(cents / 100, style)
  const first = periodHeader[groupBy]
  const header = [
    ...(first ? [first] : []),
    m.common.project,
    groupBy === 'session' ? m.reports.session : m.reports.sessions,
    m.csv.tracked,
    m.csv.billable,
    m.csv.rate,
    m.csv.amount
  ]
  const body = rows.map((r) => [
    ...(first ? [r.periodLabel ?? ''] : []),
    r.project?.name ?? m.common.deletedProject,
    groupBy === 'session' ? (r.sessionName ?? '') : String(r.sessions),
    hm(r.ms),
    decimalText(r.hundredths / 100, style),
    r.rate === null ? '' : decimalText(r.rate, style),
    money(r.cents)
  ])
  const t = sumRows(rows)
  const footer = [
    ...(first ? [m.reports.total] : []),
    first ? '' : m.reports.total,
    groupBy === 'session' ? '' : String(t.sessions),
    hm(t.ms),
    decimalText(t.hundredths / 100, style),
    '',
    money(t.cents)
  ]
  return toCsv([header, ...body, footer], style.separator)
}

export function sessionsCsv(
  sessions: Session[],
  projects: Project[],
  rounding: Rounding,
  lang: Language,
  style: CsvStyle
): string {
  const m = messages[lang]
  const byId = new Map(projects.map((p) => [p.id, p]))
  const header = [
    m.reports.date,
    m.common.project,
    m.reports.session,
    m.csv.start,
    m.csv.end,
    m.csv.pause,
    m.csv.tracked,
    m.csv.billable,
    m.csv.rate,
    m.csv.amount
  ]
  const body = sessions.map((s) => {
    const project = byId.get(s.projectId)
    const start = sessionStart(s)
    const end = sessionEnd(s)
    const ms = segmentsMs(s.segments)
    const hundredths = billableHundredths(ms, rounding)
    const rate = project?.hourlyRate ?? null
    return [
      lang === 'de' ? formatDate(start, lang) : format(start, 'yyyy-MM-dd'),
      project?.name ?? m.common.deletedProject,
      s.name,
      timeText(start),
      timeText(end),
      hm(end - start - ms),
      hm(ms),
      decimalText(hundredths / 100, style),
      rate === null ? '' : decimalText(rate, style),
      decimalText(amountCents(hundredths, rate) / 100, style)
    ]
  })
  return toCsv([header, ...body], style.separator)
}

/** Dateiname nach dem Schema YYMMDD_Projekt_bezeichnung_v1. */
export function exportFileName(kind: string, periodLabel: string, now: Date): string {
  const stamp = [now.getFullYear() % 100, now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('')
  const slug = `${kind}-${periodLabel}`
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${stamp}_Timetracker_${slug}_v1.csv`
}
