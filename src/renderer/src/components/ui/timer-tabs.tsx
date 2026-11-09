// 21st.dev: rjcuff2000/expandable-tabs (easeUI, https://easeui.dev, MIT). Der gewählte Tab zeigt seinen
// Namen, eine gemeinsame Pille gleitet mit. Für parallele Timer umgebaut: Punkte in Projektfarbe statt
// Icons, Status am Punkt, Hinweis mit Laufzeit beim Hovern, Klick auf den gewählten Tab öffnet die Liste.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { clock } from '@shared/format'
import type { ActiveTimer } from '@shared/types'
import { useElapsed } from '@/lib/app-state'
import { cn } from '@/lib/utils'

const SPRING_LAYOUT = { type: 'spring' as const, duration: 0.22, bounce: 0 }
const NAV_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End'])

export interface TimerTab {
  id: string
  label: string
  /** Für Screenreader, zum Beispiel "Läuft". */
  statusLabel: string
  color?: string
  timer: ActiveTimer | null
}

function Dot({ tab }: { tab: TimerTab }): React.JSX.Element | null {
  if (!tab.color) return null
  const paused = tab.timer?.status === 'paused'
  return (
    <span
      aria-hidden
      data-status={tab.timer?.status ?? 'idle'}
      className={cn('relative z-10 size-2 shrink-0 rounded-full', paused && 'border-[1.5px]')}
      style={paused ? { borderColor: tab.color } : { background: tab.color }}
    />
  )
}

function HintTime({ timer }: { timer: ActiveTimer }): React.JSX.Element {
  return <span className="shrink-0 font-mono tabular-nums opacity-70">{clock(useElapsed(timer))}</span>
}

export function AddTimerButton({
  label,
  onClick,
  testId
}: {
  label: string
  onClick: () => void
  testId: string
}): React.JSX.Element {
  return (
    <motion.span
      className="flex"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        aria-label={label}
        data-testid={testId}
        onClick={onClick}
        className="press flex size-7 items-center justify-center rounded-full text-ink-3 outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <Plus className="size-3.5" />
      </button>
    </motion.span>
  )
}

export function TimerTabs({
  tabs,
  value,
  onChange,
  onOpenCurrent,
  label,
  testId,
  activeTestId,
  labelMaxWidth
}: {
  tabs: TimerTab[]
  value: string
  onChange: (id: string) => void
  /** Klick auf den schon gewählten Tab. */
  onOpenCurrent?: () => void
  label: string
  testId: string
  activeTestId?: string
  /** Gesetzt zeigt der gewählte Tab seinen Namen, sonst bleiben alle Tabs Punkte. */
  labelMaxWidth?: number
}): React.JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null)
  const hint = hovered !== value ? tabs.find((t) => t.id === hovered) : undefined
  const expand = labelMaxWidth !== undefined

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!NAV_KEYS.has(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
    if (next === index) return
    buttons[next].focus()
    buttons[next].click()
  }

  return (
    <div className="relative min-w-0">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHovered(null)}
        className="flex items-center gap-0.5"
      >
        {tabs.map((tab) => {
          const active = tab.id === value
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${tab.label}, ${tab.statusLabel}`}
              tabIndex={active ? 0 : -1}
              data-testid={active && activeTestId ? activeTestId : testId}
              data-project={tab.label}
              onClick={() => (active ? onOpenCurrent?.() : onChange(tab.id))}
              onMouseEnter={() => setHovered(tab.id)}
              className={cn(
                'press relative flex h-8 min-w-0 shrink-0 items-center rounded-lg px-2 text-[13px] text-ink-2 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60',
                (!active || tabs.length === 1) && 'hover:bg-hover'
              )}
            >
              {active && tabs.length > 1 && (
                <motion.span
                  layoutId="timer-tab-pill"
                  transition={SPRING_LAYOUT}
                  className="absolute inset-0 rounded-lg bg-raised shadow-[inset_0_0_0_1px_var(--color-line)]"
                />
              )}
              <Dot tab={tab} />
              {expand && (
                <motion.span
                  initial={false}
                  animate={{ width: active ? 'auto' : 0, opacity: active ? 1 : 0 }}
                  transition={SPRING_LAYOUT}
                  className="relative z-10 overflow-hidden whitespace-nowrap"
                >
                  <span className={cn('block truncate', tab.color && 'pl-2')} style={{ maxWidth: labelMaxWidth }}>
                    {tab.label}
                  </span>
                </motion.span>
              )}
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {hint && (
          <motion.div
            key="hint"
            role="tooltip"
            data-testid={`${testId}-hint`}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute left-0 top-full z-30 mt-1 flex h-6 max-w-[240px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-ink px-2.5 text-[11px] font-medium text-bg"
          >
            <span className="min-w-0 truncate">{hint.label}</span>
            {hint.timer && <HintTime timer={hint.timer} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
