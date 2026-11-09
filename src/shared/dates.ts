import { de, enGB, type Locale } from 'date-fns/locale'
import type { Language } from './types'

interface DatePatterns {
  locale: Locale
  /** Tag und Monat, ohne Jahr. */
  day: string
  full: string
  long: string
  weekday: string
  dayOfMonth: string
}

/** date-fns ist nur im Renderer gebündelt, deshalb getrennt von i18n.ts. */
export const DATE_PATTERNS: Record<Language, DatePatterns> = {
  de: {
    locale: de,
    day: 'dd.MM.',
    full: 'dd.MM.yyyy',
    long: 'EEEE, d. MMMM yyyy',
    weekday: 'EEEEEE, dd.MM.yyyy',
    dayOfMonth: 'd.'
  },
  en: {
    locale: enGB,
    day: 'dd MMM',
    full: 'dd MMM yyyy',
    long: 'EEEE, d MMMM yyyy',
    weekday: 'EEE, dd MMM yyyy',
    dayOfMonth: 'd'
  }
}
