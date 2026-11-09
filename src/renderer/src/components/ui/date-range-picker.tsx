// 21st.dev: kuratlielia/date-range-picker. Aufbau mit Preset-Schiene, zwei Monaten und Bereichsmarkierung,
// mit Wochenstart Montag auf die Farben und Sprachen dieser App reduziert.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { DATE_PATTERNS } from '@shared/dates'
import type { Messages } from '@shared/i18n'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button, IconButton } from './button'

export interface DateRange {
  start: Date
  end: Date
}

const WEEK = { weekStartsOn: 1 } as const

function presets(m: Messages): { label: string; range: (today: Date) => DateRange }[] {
  return [
    { label: m.picker.thisWeek, range: (t) => ({ start: startOfWeek(t, WEEK), end: endOfWeek(t, WEEK) }) },
    {
      label: m.picker.lastWeek,
      range: (t) => ({ start: startOfWeek(addWeeks(t, -1), WEEK), end: endOfWeek(addWeeks(t, -1), WEEK) })
    },
    { label: m.picker.thisMonth, range: (t) => ({ start: startOfMonth(t), end: endOfMonth(t) }) },
    {
      label: m.picker.lastMonth,
      range: (t) => ({ start: startOfMonth(addMonths(t, -1)), end: endOfMonth(addMonths(t, -1)) })
    },
    { label: m.picker.last30, range: (t) => ({ start: addDays(t, -29), end: t }) },
    { label: m.picker.thisYear, range: (t) => ({ start: startOfYear(t), end: t }) }
  ]
}

export function Month({
  month,
  range,
  today,
  onPick,
  onHover
}: {
  month: Date
  range: DateRange | null
  today: Date
  onPick: (date: Date) => void
  onHover: (date: Date) => void
}): React.JSX.Element {
  const { m, lang } = useI18n()
  const patterns = DATE_PATTERNS[lang]
  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), WEEK)
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [month])

  return (
    <div className="w-[252px]">
      <p className="mb-2 h-8 text-center text-[13px] font-medium leading-8 text-ink">
        {format(month, 'MMMM yyyy', { locale: patterns.locale })}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] text-ink-3">
        {m.picker.weekdays.map((d) => (
          <span key={d} className="h-7 leading-7">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          if (!isSameMonth(date, month)) return <span key={date.getTime()} className="h-9" />
          const inRange = range && !isBefore(date, range.start) && !isAfter(date, range.end)
          const edge = range && (isSameDay(date, range.start) || isSameDay(date, range.end))
          return (
            <button
              key={date.getTime()}
              type="button"
              aria-label={format(date, patterns.long, { locale: patterns.locale })}
              aria-pressed={Boolean(inRange)}
              onClick={() => onPick(date)}
              onMouseEnter={() => onHover(date)}
              className={cn(
                'relative h-9 text-[13px] tabular-nums outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-accent/60',
                inRange && 'bg-accent/15 text-ink',
                !inRange && 'rounded-lg text-ink-2 hover:bg-hover',
                edge && 'rounded-lg bg-accent font-medium text-accent-ink',
                isSameDay(date, today) && !edge && 'font-medium text-accent'
              )}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePicker({
  value,
  onChange
}: {
  value: DateRange | null
  onChange: (range: DateRange) => void
}): React.JSX.Element {
  const { m, lang } = useI18n()
  const patterns = DATE_PATTERNS[lang]
  const rangeText = (range: DateRange): string =>
    `${format(range.start, patterns.full, { locale: patterns.locale })} ${m.common.to} ${format(range.end, patterns.full, { locale: patterns.locale })}`
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => startOfMonth(addMonths(value?.end ?? new Date(), -1)))
  const [direction, setDirection] = useState(1)
  const [draft, setDraft] = useState<DateRange | null>(value)
  const [anchor, setAnchor] = useState<Date | null>(null)
  const [hover, setHover] = useState<Date | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const today = startOfDay(new Date())

  useEffect(() => {
    if (!open) return
    const down = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open])

  const toggle = (): void => {
    setDraft(value)
    setAnchor(null)
    setHover(null)
    setView(startOfMonth(addMonths(value?.end ?? today, -1)))
    setOpen((v) => !v)
  }

  const go = (delta: 1 | -1): void => {
    setDirection(delta)
    setView((v) => addMonths(v, delta))
  }

  const pick = (date: Date): void => {
    if (!anchor) {
      setAnchor(date)
      setHover(date)
      return
    }
    setDraft(isBefore(date, anchor) ? { start: date, end: anchor } : { start: anchor, end: date })
    setAnchor(null)
    setHover(null)
  }

  const shown: DateRange | null = anchor
    ? isBefore(hover ?? anchor, anchor)
      ? { start: hover ?? anchor, end: anchor }
      : { start: anchor, end: hover ?? anchor }
    : draft

  const canApply = Boolean(draft) && !anchor

  return (
    <div ref={rootRef} className="relative" onKeyDown={(e) => e.key === 'Escape' && open && setOpen(false)}>
      <Button onClick={toggle} aria-expanded={open} aria-haspopup="dialog" data-testid="date-range-trigger">
        <CalendarDays className="size-4" />
        {value ? rangeText(value) : m.picker.choose}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={m.picker.choose}
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            style={{ transformOrigin: 'top left' }}
            className="absolute left-0 top-full z-50 mt-2 flex rounded-2xl border border-line-strong bg-surface shadow-2xl shadow-black/70"
          >
            <div className="flex w-36 flex-col gap-0.5 border-r border-line p-2">
              {presets(m).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const range = preset.range(today)
                    setDraft(range)
                    setAnchor(null)
                    setHover(null)
                    setView(startOfMonth(addMonths(range.end, -1)))
                  }}
                  className="press h-8 rounded-lg px-2.5 text-left text-[12px] text-ink-2 hover:bg-hover hover:text-ink"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="p-3">
              <div className="relative overflow-hidden" onMouseLeave={() => anchor && setHover(anchor)}>
                <IconButton label={m.picker.prevMonth} className="absolute left-0 top-0 z-10" onClick={() => go(-1)}>
                  <ChevronLeft className="size-4" />
                </IconButton>
                <IconButton label={m.picker.nextMonth} className="absolute right-0 top-0 z-10" onClick={() => go(1)}>
                  <ChevronRight className="size-4" />
                </IconButton>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={view.getTime()}
                    className="flex gap-5"
                    initial={{ opacity: 0, x: direction * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -30 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Month month={view} range={shown} today={today} onPick={pick} onHover={setHover} />
                    <Month month={addMonths(view, 1)} range={shown} today={today} onPick={pick} onHover={setHover} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                <span className="text-[12px] text-ink-3">
                  {anchor ? m.picker.chooseEnd : shown ? rangeText(shown) : m.picker.chooseStart}
                </span>
                <span className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    {m.action.cancel}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!canApply}
                    onClick={() => {
                      if (draft) onChange(draft)
                      setOpen(false)
                    }}
                  >
                    {m.action.apply}
                  </Button>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
