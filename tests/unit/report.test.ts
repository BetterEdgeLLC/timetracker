import { describe, expect, it } from 'vitest'
import { csvCell, csvStyleFor, exportFileName, sessionRows, sessionsCsv, tableCsv, tableRows, toTsv, tsvCell } from '../../src/shared/csv'
import { formatDate, hm, hoursText } from '../../src/shared/format'
import { initialLanguage, messages } from '../../src/shared/i18n'
import { resolvePeriod } from '../../src/shared/period'
import {
  amountCents,
  billableHundredths,
  buildChart,
  buildRows,
  filterSessions,
  sumRows
} from '../../src/shared/report'
import type { Project, Rounding, Session } from '../../src/shared/types'

const MIN = 60_000
const NONE: Rounding = { minutes: 0, mode: 'nearest' }
const SEMI = { separator: ';', decimal: ',' }
const at = (m: number, d: number, h = 9): number => new Date(2026, m - 1, d, h).getTime()

const alpha: Project = { id: 'a', name: 'Alpha', colorIndex: 0, hourlyRate: 80, archived: false, createdAt: 1 }
const beta: Project = { id: 'b', name: 'Beta', colorIndex: 1, hourlyRate: null, archived: false, createdAt: 2 }

function session(id: string, projectId: string, start: number, minutes: number): Session {
  return { id, projectId, name: `S ${id}`, createdAt: start, segments: [{ start, end: start + minutes * MIN }] }
}

const sessions = [
  session('1', 'a', at(11, 2), 90),
  session('2', 'a', at(11, 3), 30),
  session('3', 'b', at(11, 3, 14), 60),
  session('4', 'a', at(10, 31, 23), 180)
]

describe('Abrechnung', () => {
  it('rechnet Hundertstel-Stunden ohne Rundung genau', () => {
    expect(billableHundredths(90 * MIN, NONE)).toBe(150)
    expect(amountCents(150, 80)).toBe(12000)
  })

  it('rundet auf 15 Minuten kaufmännisch und aufwärts', () => {
    expect(billableHundredths(37 * MIN, { minutes: 15, mode: 'nearest' })).toBe(50)
    expect(billableHundredths(38 * MIN, { minutes: 15, mode: 'nearest' })).toBe(75)
    expect(billableHundredths(31 * MIN, { minutes: 15, mode: 'up' })).toBe(75)
  })

  it('ergibt ohne Stundensatz keinen Betrag', () => {
    expect(amountCents(150, null)).toBe(0)
  })
})

describe('Auswertung', () => {
  const november = { start: at(11, 1, 0), end: at(12, 1, 0), projectIds: null }

  it('ordnet eine Session über Monatsgrenze dem Starttag zu', () => {
    const late = [session('x', 'a', at(10, 31, 23), 180)]
    expect(filterSessions(late, november)).toHaveLength(0)
  })

  it('filtert nach Projekten', () => {
    expect(filterSessions(sessions, { ...november, projectIds: ['b'] }).map((s) => s.id)).toEqual(['3'])
  })

  it('summiert pro Projekt mit Betrag', () => {
    const rows = buildRows(filterSessions(sessions, november), [alpha, beta], NONE, 'project', 'de')
    expect(rows.map((r) => [r.project?.name, r.hundredths, r.cents])).toEqual([
      ['Alpha', 200, 16000],
      ['Beta', 100, 0]
    ])
    expect(sumRows(rows)).toEqual({ sessions: 3, ms: 180 * MIN, hundredths: 300, cents: 16000 })
  })

  it('liefert in jeder Gruppierung dieselbe Gesamtsumme', () => {
    const list = filterSessions(sessions, november)
    const round: Rounding = { minutes: 15, mode: 'up' }
    const sums = (['project', 'month', 'week', 'day', 'session'] as const).map((g) =>
      sumRows(buildRows(list, [alpha, beta], round, g, 'de'))
    )
    for (const sum of sums) expect(sum).toEqual(sums[0])
  })

  it('baut für einen Monat einen Balken pro Tag', () => {
    const chart = buildChart(sessions, [alpha, beta], () => '#fff', november.start, november.end, 'de')
    expect(chart.buckets).toHaveLength(30)
    expect(chart.buckets[2].total).toBe(90 * MIN)
    expect(chart.series.map((s) => s.name)).toEqual(['Alpha', 'Beta'])
  })

  it('faltet ab neun Projekten die kleinsten zu Weitere', () => {
    const projects = Array.from({ length: 9 }, (_, i): Project => ({ ...alpha, id: `p${i}`, name: `P${i}`, createdAt: i }))
    const list = projects.map((p, i) => session(`s${i}`, p.id, at(11, 2), 10 + i))
    const chart = buildChart(list, projects, () => '#fff', november.start, november.end, 'de')
    expect(chart.series).toHaveLength(8)
    expect(chart.series.at(-1)?.name).toBe('Weitere')
    expect(chart.buckets[1].total).toBe(list.length * 10 * MIN + 36 * MIN)
  })

  it('kennt Montag als Wochenbeginn', () => {
    const range = resolvePeriod('week', new Date(2026, 10, 15), null, null, Date.now(), 'de')
    expect(new Date(range.start).getDate()).toBe(9)
    expect(range.label).toBe('KW 46, 09.11. bis 15.11.2026')
  })

  it('beschriftet Zeiträume auf Englisch', () => {
    const week = resolvePeriod('week', new Date(2026, 10, 15), null, null, Date.now(), 'en')
    expect(week.label).toBe('Wk 46, 09 Nov to 15 Nov 2026')
    expect(resolvePeriod('month', new Date(2026, 2, 15), null, null, Date.now(), 'en').label).toBe('March 2026')
  })
})

describe('Zwischenablage', () => {
  it('trennt Spalten mit Tabs und Zeilen mit CRLF, ohne Umbruch am Ende', () => {
    expect(toTsv([['a', 'b'], ['1', '2']])).toBe('a\tb\r\n1\t2')
  })

  it('hält Tabs und Zeilenumbrüche aus Namen aus der Tabellenstruktur heraus', () => {
    expect(tsvCell('Teil\t1\r\nTeil 2')).toBe('Teil 1 Teil 2')
  })

  it('entschärft Formeln auch hinter führendem Leerraum', () => {
    expect(tsvCell('=SUMME(A1)')).toBe("'=SUMME(A1)")
    expect(tsvCell('\t@cmd')).toBe("'@cmd")
  })

  it('maskiert ein führendes Anführungszeichen, damit Excel keine Zeilen zusammenzieht', () => {
    expect(tsvCell('"Kunde" Workshop')).toBe('"""Kunde"" Workshop"')
    expect(tsvCell('Kunde "A"')).toBe('Kunde "A"')
  })

  it('kopiert dieselben Zeilen wie der CSV-Export, nur mit Tabs', () => {
    const rows = buildRows(sessions, [alpha, beta], NONE, 'project', 'de')
    expect(toTsv(tableRows(rows, 'project', 'de', SEMI)) + '\r\n').toBe(
      tableCsv(rows, 'project', 'de', SEMI).replaceAll(';', '\t')
    )
    expect(toTsv(sessionRows(sessions, [alpha, beta], NONE, 'de', SEMI)) + '\r\n').toBe(
      sessionsCsv(sessions, [alpha, beta], NONE, 'de', SEMI).replaceAll(';', '\t')
    )
  })

  it('nimmt bei Projektauswahl nur deren Sessions in Zeilen und Summe auf', () => {
    const picked = sessions.filter((s) => s.projectId === 'b')
    const lines = tableRows(buildRows(picked, [alpha, beta], NONE, 'project', 'de'), 'project', 'de', SEMI)
    expect(lines).toHaveLength(3)
    expect(lines[1][0]).toBe('Beta')
    expect(lines[2]).toEqual(['Gesamt', '1', '1:00', '1,00', '', '0,00'])
  })
})

describe('Formate und CSV', () => {
  it('formatiert je nach Sprache', () => {
    expect(hoursText(1250, 'de')).toBe('12,50')
    expect(hoursText(1250, 'en')).toBe('12.50')
    expect(formatDate(at(11, 9), 'de')).toBe('09.11.2026')
    expect(formatDate(at(11, 9), 'en')).toBe('09 Nov 2026')
    expect(hm(75 * MIN)).toBe('1:15')
  })

  it('schützt vor Formel-Injektion und maskiert Trennzeichen', () => {
    expect(csvCell('=SUMME(A1)', ';')).toBe("'=SUMME(A1)")
    expect(csvCell('a;b', ';')).toBe('"a;b"')
    expect(csvCell('a,b', ',')).toBe('"a,b"')
    expect(csvCell('a,b', ';')).toBe('a,b')
    expect(csvCell('sag "hi"', ';')).toBe('"sag ""hi"""')
  })

  it('richtet das CSV-Format nach der Windows-Region', () => {
    expect(csvStyleFor('de-DE')).toEqual(SEMI)
    expect(csvStyleFor('en-US')).toEqual({ separator: ',', decimal: '.' })
  })

  it('schreibt englische Überschriften unabhängig vom Trennzeichen', () => {
    const list = filterSessions(sessions, { start: at(11, 1, 0), end: at(12, 1, 0), projectIds: null })
    const rows = buildRows(list, [alpha, beta], NONE, 'project', 'en')
    expect(tableCsv(rows, 'project', 'en', SEMI).split('\r\n')[0]).toBe(
      'Project;Sessions;Tracked (h:mm);Billable (h);Hourly rate (EUR);Net amount (EUR)'
    )
    const lines = tableCsv(rows, 'project', 'en', { separator: ',', decimal: '.' }).split('\r\n')
    expect(lines[1]).toBe('Alpha,2,2:00,2.00,80.00,160.00')
    expect(lines[3]).toBe('Total,3,3:00,3.00,,160.00')
  })

  it('wählt beim ersten Start die Sprache aus dem System', () => {
    expect(initialLanguage('de-AT')).toBe('de')
    expect(initialLanguage('en-US')).toBe('en')
    expect(initialLanguage('fr-FR')).toBe('en')
  })

  it('hat in beiden Sprachen dieselben Texte, keiner ist leer', () => {
    const paths = (value: unknown, prefix = ''): string[] =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.entries(value).flatMap(([k, v]) => paths(v, `${prefix}${k}.`))
        : [prefix]
    expect(paths(messages.en)).toEqual(paths(messages.de))
    const values = (value: unknown): unknown[] =>
      typeof value === 'object' && value !== null ? Object.values(value).flatMap(values) : [value]
    expect(values(messages.en).filter((v) => v === '')).toEqual([])
  })

  it('schreibt die Projektsumme mit Gesamtzeile', () => {
    const list = filterSessions(sessions, { start: at(11, 1, 0), end: at(12, 1, 0), projectIds: null })
    const lines = tableCsv(buildRows(list, [alpha, beta], NONE, 'project', 'de'), 'project', 'de', SEMI).split('\r\n')
    expect(lines[0]).toBe('Projekt;Sessions;Erfasst (h:mm);Abrechenbar (h);Stundensatz (EUR);Betrag netto (EUR)')
    expect(lines[1]).toBe('Alpha;2;2:00;2,00;80,00;160,00')
    expect(lines[2]).toBe('Beta;1;1:00;1,00;;0,00')
    expect(lines[3]).toBe('Gesamt;3;3:00;3,00;;160,00')
  })

  it('schreibt Session-Details mit Pause', () => {
    const paused: Session = {
      id: 'p',
      projectId: 'a',
      name: 'Workshop',
      createdAt: 0,
      segments: [
        { start: at(11, 2), end: at(11, 2) + 30 * MIN },
        { start: at(11, 2) + 45 * MIN, end: at(11, 2) + 75 * MIN }
      ]
    }
    const line = sessionsCsv([paused], [alpha], NONE, 'de', SEMI).split('\r\n')[1]
    expect(line).toBe('02.11.2026;Alpha;Workshop;09:00;10:15;0:15;1:00;1,00;80,00;80,00')
  })

  it('benennt die Datei nach dem Schema', () => {
    expect(exportFileName('auswertung', 'März 2026', new Date(2026, 10, 9))).toBe(
      '261109_Timetracker_auswertung-maerz-2026_v1.csv'
    )
  })
})
