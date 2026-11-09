import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  getISOWeek,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
  startOfYear
} from 'date-fns'
import { DATE_PATTERNS } from './dates'
import { messages } from './i18n'
import type { Language } from './types'

export type PeriodMode = 'week' | 'month' | 'year' | 'all' | 'custom'

export interface PeriodRange {
  start: number
  end: number
  label: string
}

export function resolvePeriod(
  mode: PeriodMode,
  anchor: Date,
  custom: { start: Date; end: Date } | null,
  firstSessionAt: number | null,
  now: number,
  lang: Language
): PeriodRange {
  const patterns = DATE_PATTERNS[lang]
  const m = messages[lang]
  const options = { locale: patterns.locale }
  if (mode === 'week') {
    const start = startOfISOWeek(anchor)
    const end = addWeeks(start, 1)
    return {
      start: start.getTime(),
      end: end.getTime(),
      label: `${m.reports.weekShort} ${getISOWeek(start)}, ${format(start, patterns.day, options)} ${m.common.to} ${format(addDays(start, 6), patterns.full, options)}`
    }
  }
  if (mode === 'month') {
    const start = startOfMonth(anchor)
    return {
      start: start.getTime(),
      end: addMonths(start, 1).getTime(),
      label: format(start, 'MMMM yyyy', options)
    }
  }
  if (mode === 'year') {
    const start = startOfYear(anchor)
    return { start: start.getTime(), end: addYears(start, 1).getTime(), label: format(start, 'yyyy') }
  }
  if (mode === 'custom' && custom) {
    return {
      start: startOfDay(custom.start).getTime(),
      end: addDays(startOfDay(custom.end), 1).getTime(),
      label: `${format(custom.start, patterns.full, options)} ${m.common.to} ${format(custom.end, patterns.full, options)}`
    }
  }
  const start = startOfDay(new Date(firstSessionAt ?? now))
  return { start: start.getTime(), end: addDays(startOfDay(new Date(now)), 1).getTime(), label: m.reports.allTime }
}

export function shiftAnchor(mode: PeriodMode, anchor: Date, direction: 1 | -1): Date {
  if (mode === 'week') return addWeeks(anchor, direction)
  if (mode === 'month') return addMonths(anchor, direction)
  if (mode === 'year') return addYears(anchor, direction)
  return anchor
}
