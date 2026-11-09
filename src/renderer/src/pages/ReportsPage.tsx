import { useMemo, useState } from 'react'
import { endOfMonth, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import { csvStyleFor, exportFileName, sessionRows, sessionsCsv, tableCsv, tableRows, type CsvStyle } from '@shared/csv'
import { euro, hm, hoursText, moneyText } from '@shared/format'
import { resolvePeriod, shiftAnchor, type PeriodMode } from '@shared/period'
import {
  buildChart,
  buildRows,
  filterSessions,
  sessionStart,
  sumRows,
  type GroupBy,
  type ReportRow
} from '@shared/report'
import type { AppData, RoundingMinutes } from '@shared/types'
import { ClipboardExport, type ClipboardKind } from '@/components/ClipboardExport'
import { AnimatedSelect } from '@/components/ui/animated-select'
import { Button, IconButton } from '@/components/ui/button'
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { StackedBarChart } from '@/components/ui/stacked-bar-chart'
import { colorOf, errorText } from '@/lib/app-state'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { roundingOptions } from './SettingsPage'

function Figure({ label, value, testId }: { label: string; value: string; testId: string }): React.JSX.Element {
  return (
    <div className="border-l border-line pl-6">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="mt-1.5 font-mono text-[24px] font-light tabular-nums tracking-tight text-ink" data-testid={testId}>
        {value}
      </p>
    </div>
  )
}

export function ReportsPage({ state }: { state: AppData }): React.JSX.Element {
  const { m, lang } = useI18n()
  const [mode, setMode] = useState<PeriodMode>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [custom, setCustom] = useState<DateRange | null>(null)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [group, setGroup] = useState<GroupBy>('project')
  const { sessions, projects, settings } = state

  const periods: { value: PeriodMode; label: string }[] = [
    { value: 'week', label: m.reports.week },
    { value: 'month', label: m.reports.month },
    { value: 'year', label: m.reports.year },
    { value: 'all', label: m.reports.all },
    { value: 'custom', label: m.reports.custom }
  ]

  const groups: { value: GroupBy; label: string }[] = [
    { value: 'project', label: m.common.project },
    { value: 'month', label: m.reports.month },
    { value: 'week', label: m.reports.week },
    { value: 'day', label: m.reports.day },
    { value: 'session', label: m.reports.session }
  ]

  const periodHeader: Record<GroupBy, string | null> = {
    project: null,
    month: m.reports.month,
    week: m.reports.week,
    day: m.reports.day,
    session: m.reports.date
  }

  const firstAt = useMemo(
    () => (sessions.length ? Math.min(...sessions.map(sessionStart)) : null),
    [sessions]
  )
  const range = resolvePeriod(mode, anchor, custom, firstAt, Date.now(), lang)

  const { inPeriod, filtered, rows, totals, legend, chart } = useMemo(() => {
    const inPeriod = filterSessions(sessions, { start: range.start, end: range.end, projectIds: null })
    const filtered = selected ? inPeriod.filter((s) => selected.includes(s.projectId)) : inPeriod
    const rows = buildRows(filtered, projects, settings.rounding, group, lang)
    return {
      inPeriod,
      filtered,
      rows,
      totals: sumRows(rows),
      legend: buildRows(inPeriod, projects, settings.rounding, 'project', lang),
      chart: buildChart(filtered, projects, colorOf, range.start, range.end, lang)
    }
  }, [sessions, projects, settings.rounding, group, selected, range.start, range.end, lang])

  const legendMax = Math.max(...legend.map((r) => r.ms), 1)
  const canShift = mode === 'week' || mode === 'month' || mode === 'year'

  const chooseMode = (next: PeriodMode): void => {
    if (next === 'custom' && !custom) setCustom({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) })
    setMode(next)
  }

  const toggleProject = (id: string): void => {
    setSelected((current) => {
      if (current === null) return [id]
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      return next.length === 0 ? null : next
    })
  }

  const exportCsv = async (kind: string, build: (style: CsvStyle) => string): Promise<void> => {
    try {
      const style = csvStyleFor(await window.api.getSystemLocale())
      const result = await window.api.saveCsv(exportFileName(kind, range.label, new Date()), build(style))
      if (result.saved) toast.success(m.reports.csvSaved, { description: result.path })
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  const clipboardRows = (kind: ClipboardKind, projectIds: string[], style: CsvStyle): string[][] => {
    const picked = inPeriod.filter((s) => projectIds.includes(s.projectId))
    return kind === 'table'
      ? tableRows(buildRows(picked, projects, settings.rounding, group, lang), group, lang, style)
      : sessionRows(picked, projects, settings.rounding, lang, style)
  }

  const header = periodHeader[group]
  const deleted = m.common.deletedProject

  return (
    <div className="mx-auto max-w-[1120px] px-8 pb-14 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs options={periods} value={mode} onChange={chooseMode} label={m.reports.period} testId="period" />
        <div className="flex items-center gap-2">
          <AnimatedSelect
            className="w-44"
            label={m.settings.roundingLabel}
            placeholder={m.settings.roundingLabel}
            value={String(settings.rounding.minutes)}
            options={roundingOptions(m)}
            onChange={(id) =>
              void window.api.updateSettings({
                rounding: { ...settings.rounding, minutes: Number(id) as RoundingMinutes }
              })
            }
          />
        </div>
      </div>

      <div className="mt-7 flex items-center gap-1">
        <h1 className="mr-2 text-[30px] font-light tracking-tight" data-testid="period-label">
          {range.label}
        </h1>
        {canShift && (
          <>
            <IconButton
              label={m.reports.back}
              data-testid="period-prev"
              onClick={() => setAnchor((a) => shiftAnchor(mode, a, -1))}
            >
              <ChevronLeft className="size-4" />
            </IconButton>
            <IconButton
              label={m.reports.forward}
              data-testid="period-next"
              onClick={() => setAnchor((a) => shiftAnchor(mode, a, 1))}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </>
        )}
        {mode === 'custom' && <DateRangePicker value={custom} onChange={setCustom} />}
      </div>

      <section className="mt-6 flex items-end gap-10" aria-label={m.reports.totals}>
        <div className="pr-4">
          <p className="text-[12px] text-ink-3">{m.reports.tracked}</p>
          <p
            className="mt-1 font-mono text-[64px] font-extralight leading-none tracking-[-0.04em] text-ink"
            data-testid="total-tracked"
          >
            {hm(totals.ms)}
            <span className="ml-1.5 text-[20px] tracking-normal text-ink-3">h</span>
          </p>
        </div>
        <Figure label={m.reports.billable} value={`${hoursText(totals.hundredths, lang)} h`} testId="total-billable" />
        <div className="border-l border-line pl-6">
          <p className="text-[12px] text-ink-3">{m.reports.netAmount}</p>
          <p
            className="mt-1.5 font-mono text-[24px] font-light tabular-nums tracking-tight text-accent"
            data-testid="total-amount"
          >
            {euro(totals.cents, lang)}
          </p>
        </div>
        <Figure label={m.reports.sessions} value={String(totals.sessions)} testId="total-sessions" />
      </section>

      <section className="mt-9 grid grid-cols-[minmax(0,1fr)_280px] gap-10" aria-label={m.reports.overview}>
        <div>
          {inPeriod.length === 0 ? (
            <div className="flex h-[248px] items-center justify-center rounded-2xl border border-dashed border-line text-[13px] text-ink-3">
              {m.reports.nothing}
            </div>
          ) : (
            <StackedBarChart data={chart} chartKey={`${range.start}-${range.end}-${selected?.join() ?? ''}`} />
          )}
        </div>
        <div>
          <div className="flex h-5 items-center justify-between">
            <h2 className="text-[12px] text-ink-3">{m.reports.projects}</h2>
            {selected && (
              <button
                type="button"
                data-testid="legend-reset"
                className="text-[12px] text-ink-3 transition-colors hover:text-ink"
                onClick={() => setSelected(null)}
              >
                {m.reports.showAll}
              </button>
            )}
          </div>
          <ul className="thin-scroll mt-2 max-h-[224px] overflow-y-auto" aria-label={m.reports.projectFilter}>
            {legend.map((row) => {
              const id = row.project?.id ?? row.key
              const on = !selected || selected.includes(id)
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    data-testid="legend-project"
                    onClick={() => toggleProject(id)}
                    className={cn(
                      'press w-full rounded-lg px-2 py-2 text-left outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent/60',
                      !on && 'opacity-40'
                    )}
                  >
                    <span className="flex items-center gap-2 text-[13px]">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: row.project ? colorOf(row.project) : undefined }}
                      />
                      <span className="min-w-0 flex-1 truncate text-ink">{row.project?.name ?? deleted}</span>
                      <span className="font-mono text-[12px] tabular-nums text-ink-2">{hm(row.ms)}</span>
                    </span>
                    <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-raised">
                      <span
                        className="block h-full w-full origin-left rounded-full transition-transform duration-300 ease-out"
                        style={{
                          background: row.project ? colorOf(row.project) : undefined,
                          transform: `scaleX(${row.ms / legendMax})`
                        }}
                      />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className="mt-10" aria-label={m.reports.table}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs options={groups} value={group} onChange={setGroup} label={m.reports.groupBy} testId="group" />
          <div className="flex gap-2">
            <ClipboardExport
              projects={legend.map((row) => ({
                id: row.project?.id ?? row.key.slice(1),
                name: row.project?.name ?? deleted,
                color: row.project ? colorOf(row.project) : undefined,
                ms: row.ms
              }))}
              preselected={selected}
              periodLabel={range.label}
              groupLabel={groups.find((g) => g.value === group)?.label ?? ''}
              build={clipboardRows}
            />
            <Button
              data-testid="export-table"
              disabled={rows.length === 0}
              onClick={() => void exportCsv(m.reports.fileKind, (style) => tableCsv(rows, group, lang, style))}
            >
              <Download className="size-4" />
              {m.reports.exportTable}
            </Button>
            <Button
              data-testid="export-sessions"
              disabled={filtered.length === 0}
              onClick={() =>
                void exportCsv('sessions', (style) => sessionsCsv(filtered, projects, settings.rounding, lang, style))
              }
            >
              <Download className="size-4" />
              {m.reports.exportSessions}
            </Button>
          </div>
        </div>

        {rows.length > 0 && (
          <table className="mt-4 w-full border-collapse text-[13px]" data-testid="report-table">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-3">
                {header && <th className="py-2 font-normal">{header}</th>}
                <th className="py-2 font-normal">{m.common.project}</th>
                <th className="py-2 font-normal">{group === 'session' ? m.reports.session : m.reports.sessions}</th>
                <th className="py-2 text-right font-normal">{m.reports.tracked}</th>
                <th className="py-2 text-right font-normal">{m.reports.billable}</th>
                <th className="py-2 text-right font-normal">{m.reports.rate}</th>
                <th className="py-2 text-right font-normal">{m.reports.amount}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: ReportRow) => (
                <tr key={row.key} className="h-11 border-b border-line/60 transition-colors duration-100 hover:bg-surface">
                  {header && <td className="whitespace-nowrap pr-4 capitalize text-ink-2">{row.periodLabel}</td>}
                  <td className="pr-4">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: row.project ? colorOf(row.project) : undefined }}
                      />
                      {row.project?.name ?? deleted}
                    </span>
                  </td>
                  <td className="max-w-64 truncate pr-4 text-ink-2">
                    {group === 'session' ? row.sessionName : row.sessions}
                  </td>
                  <td className="text-right font-mono tabular-nums text-ink-2">{hm(row.ms)}</td>
                  <td className="text-right font-mono tabular-nums">{hoursText(row.hundredths, lang)}</td>
                  <td className="text-right font-mono tabular-nums text-ink-3">
                    {row.rate === null ? m.projects.noRate : moneyText(row.rate, lang)}
                  </td>
                  <td className="text-right font-mono tabular-nums">{euro(row.cents, lang)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="h-12 font-medium">
                {header && <td />}
                <td>{m.reports.total}</td>
                <td className="text-ink-2">{group === 'session' ? '' : totals.sessions}</td>
                <td className="text-right font-mono tabular-nums text-ink-2">{hm(totals.ms)}</td>
                <td className="text-right font-mono tabular-nums">{hoursText(totals.hundredths, lang)}</td>
                <td />
                <td className="text-right font-mono tabular-nums text-accent">{euro(totals.cents, lang)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </div>
  )
}
