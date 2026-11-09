// Ersetzt das Popup von input type="datetime-local", weil Chromium dort keinen Bestätigen-Knopf anbietet.
// Das Feld bleibt zum Tippen erhalten, der Kalender kommt aus dem Zeitraum-Picker.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { addMonths, format, startOfDay, startOfMonth } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { DATE_PATTERNS } from '@shared/dates'
import { toLocalInput } from '@shared/format'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button, IconButton } from './button'
import { Month } from './date-range-picker'

const pad = (n: number): string => String(n).padStart(2, '0')

function TimeColumn({
  label,
  count,
  value,
  onPick,
  testId
}: {
  label: string
  count: number
  value: number
  onPick: (value: number) => void
  testId: string
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)

  // Nur beim Öffnen zentrieren, sonst springt die Liste bei jedem Klick.
  useLayoutEffect(() => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (list && item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2
  }, [])

  return (
    <div className="w-14" role="group" aria-label={label}>
      <p className="mb-2 h-8 text-center text-[11px] leading-8 text-ink-3">{label}</p>
      <div ref={listRef} className="thin-scroll relative h-[244px] overflow-y-auto">
        {Array.from({ length: count }, (_, n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === value}
            data-testid={testId}
            onClick={() => onPick(n)}
            className={cn(
              'h-8 w-full rounded-lg text-[13px] tabular-nums outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60',
              n === value ? 'bg-accent font-medium text-accent-ink' : 'text-ink-2 hover:bg-hover'
            )}
          >
            {pad(n)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DateTimeField({
  value,
  onChange,
  label,
  testId
}: {
  /** Format von input type="datetime-local". */
  value: string
  onChange: (value: string) => void
  label: string
  testId: string
}): React.JSX.Element {
  const { m, lang } = useI18n()
  const patterns = DATE_PATTERNS[lang]
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => new Date())
  const [view, setView] = useState(() => startOfMonth(new Date()))
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeAndRefocus = (): void => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const down = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    // Auf window in der Capture-Phase: Radix lauscht auf document und würde sonst den ganzen Dialog schließen.
    const key = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key, true)
    }
  }, [open])

  const toggle = (): void => {
    if (open) return setOpen(false)
    const parsed = new Date(value)
    const start = Number.isNaN(parsed.getTime()) ? new Date() : parsed
    setDraft(start)
    setView(startOfMonth(start))
    setOpen(true)
  }

  const apply = (): void => {
    onChange(toLocalInput(draft.getTime()))
    closeAndRefocus()
  }

  const pickDay = (day: Date): void => {
    setDraft((d) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), d.getHours(), d.getMinutes()))
  }

  const setTime = (hours: number, minutes: number): void => {
    setDraft((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes))
  }

  const day = startOfDay(draft)

  return (
    // Bewusst ohne position: Das Popover richtet sich am Dialog aus und wird so nicht von der scrollenden Liste abgeschnitten.
    <div ref={rootRef} className="min-w-0 flex-1">
      <div className="flex h-10 items-center rounded-xl border border-line bg-raised pl-3 pr-1 transition-colors duration-150 focus-within:border-accent/60 hover:border-line-strong">
        <input
          type="datetime-local"
          aria-label={label}
          data-testid={testId}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <IconButton
          ref={triggerRef}
          label={m.picker.chooseDateTime}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid={`${testId}-open`}
          onClick={toggle}
        >
          <CalendarDays className="size-4" />
        </IconButton>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={m.picker.chooseDateTime}
            data-testid="datetime-popover"
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !(event.target as HTMLElement).closest('[data-enter-applies]')) return
              event.preventDefault()
              apply()
            }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            className="absolute left-1/2 top-1/2 z-50 w-max -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-strong bg-surface p-3 shadow-2xl shadow-black/70"
          >
            <div className="flex gap-3">
              <div className="relative">
                <IconButton
                  label={m.picker.prevMonth}
                  className="absolute left-0 top-0 z-10"
                  onClick={() => setView((v) => addMonths(v, -1))}
                >
                  <ChevronLeft className="size-4" />
                </IconButton>
                <IconButton
                  label={m.picker.nextMonth}
                  className="absolute right-0 top-0 z-10"
                  onClick={() => setView((v) => addMonths(v, 1))}
                >
                  <ChevronRight className="size-4" />
                </IconButton>
                <div data-enter-applies>
                  <Month
                    month={view}
                    range={{ start: day, end: day }}
                    today={startOfDay(new Date())}
                    onPick={pickDay}
                    onHover={() => undefined}
                  />
                </div>
              </div>
              <div className="flex border-l border-line pl-2" data-enter-applies>
                <TimeColumn
                  label={m.picker.hour}
                  count={24}
                  value={draft.getHours()}
                  onPick={(h) => setTime(h, draft.getMinutes())}
                  testId="datetime-hour"
                />
                <TimeColumn
                  label={m.picker.minute}
                  count={60}
                  value={draft.getMinutes()}
                  onPick={(min) => setTime(draft.getHours(), min)}
                  testId="datetime-minute"
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="pl-1 text-[12px] tabular-nums text-ink-3" data-testid="datetime-preview">
                {format(draft, patterns.full, { locale: patterns.locale })}, {pad(draft.getHours())}:{pad(draft.getMinutes())}
              </span>
              <span className="flex gap-2">
                <Button variant="ghost" onClick={closeAndRefocus}>
                  {m.action.cancel}
                </Button>
                <Button variant="primary" data-testid="datetime-apply" onClick={apply}>
                  {m.action.apply}
                </Button>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
