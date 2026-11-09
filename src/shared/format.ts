import type { Language } from './types'

const pad = (n: number): string => String(n).padStart(2, '0')
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LOCALES: Record<Language, string> = { de: 'de-DE', en: 'en-GB' }

/** Laufzeit als HH:MM:SS. */
export function clock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/** Dauer als H:MM, ganze Minuten abgerundet. */
export function hm(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000)
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`
}

export function moneyText(value: number, lang: Language): string {
  return new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

/** Hundertstel-Stunden als "12,50" oder "12.50". */
export function hoursText(hundredths: number, lang: Language): string {
  return moneyText(hundredths / 100, lang)
}

export function euro(cents: number, lang: Language): string {
  return new Intl.NumberFormat(LOCALES[lang], { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export function numberText(value: number, lang: Language): string {
  return value.toLocaleString(LOCALES[lang])
}

export function formatDate(timestamp: number, lang: Language): string {
  const d = new Date(timestamp)
  return lang === 'de'
    ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
    : `${pad(d.getDate())} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`
}

export function timeText(timestamp: number): string {
  const d = new Date(timestamp)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Wert für input type="datetime-local". */
export function toLocalInput(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
