import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Clipboard } from 'lucide-react'
import { toast } from 'sonner'
import { csvStyleFor, toTsv, type CsvStyle } from '@shared/csv'
import { hm } from '@shared/format'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { errorText } from '@/lib/app-state'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type ClipboardKind = 'table' | 'sessions'

export interface ClipboardProject {
  id: string
  name: string
  color?: string
  ms: number
}

/** Lang genug, dass der gezeichnete Haken zu sehen ist, bevor das Popover schließt. */
const CLOSE_AFTER_COPY_MS = 900
/** Ungefähre Höhe des Popovers bei voller Projektliste. */
const POPOVER_HEIGHT = 390

function CheckBox({ state }: { state: boolean | 'mixed' }): React.JSX.Element {
  const on = state !== false
  return (
    <span
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150',
        on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-transparent'
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden>
        <motion.path
          key={state === 'mixed' ? 'mixed' : 'check'}
          d={state === 'mixed' ? 'M6 12h12' : 'M5 12.5l4.5 4.5L19 7.5'}
          initial={false}
          animate={{ pathLength: on ? 1 : 0 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </span>
  )
}

function ProjectRow({
  state,
  onToggle,
  testId,
  className,
  children
}: {
  state: boolean | 'mixed'
  onToggle: () => void
  testId: string
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state}
      data-testid={testId}
      onClick={onToggle}
      className={cn(
        'press flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60',
        className
      )}
    >
      <CheckBox state={state} />
      {children}
    </button>
  )
}

export function ClipboardExport({
  projects,
  preselected,
  periodLabel,
  groupLabel,
  build
}: {
  projects: ClipboardProject[]
  /** Der Projektfilter der Seite, null bedeutet alle. */
  preselected: string[] | null
  periodLabel: string
  groupLabel: string
  build: (kind: ClipboardKind, projectIds: string[], style: CsvStyle) => string[][]
}): React.JSX.Element {
  const { m } = useI18n()
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(true)
  const [kind, setKind] = useState<ClipboardKind>('table')
  // Abgewählte statt gewählte Projekte: Was während des Öffnens neu dazukommt, ist automatisch dabei.
  const [excluded, setExcluded] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = (): void => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
    setCopied(false)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const down = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const key = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      close()
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    []
  )

  const toggleOpen = (): void => {
    if (open) return close()
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setOpenUp(rect.top >= POPOVER_HEIGHT || rect.top > window.innerHeight - rect.bottom)
    const notPicked = preselected ? projects.filter((p) => !preselected.includes(p.id)).map((p) => p.id) : []
    // Ein Filter auf Projekte ohne Zeit in diesem Zeitraum darf nicht zu einer leeren Auswahl führen.
    setExcluded(notPicked.length === projects.length ? [] : notPicked)
    setOpen(true)
  }

  const picked = projects.filter((p) => !excluded.includes(p.id))
  const allState: boolean | 'mixed' = picked.length === projects.length ? true : picked.length === 0 ? false : 'mixed'

  const toggleAll = (): void => setExcluded(allState === true ? projects.map((p) => p.id) : [])
  const toggleProject = (id: string): void =>
    setExcluded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const copy = async (): Promise<void> => {
    if (copied || picked.length === 0) return
    try {
      const style = csvStyleFor(await window.api.getSystemLocale())
      await window.api.copyText(toTsv(build(kind, picked.map((p) => p.id), style)))
      setCopied(true)
      toast.success(m.reports.copiedToast, {
        description: `${m.reports.copyCount(picked.length, projects.length)}, ${periodLabel}`
      })
      closeTimer.current = setTimeout(close, CLOSE_AFTER_COPY_MS)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        data-testid="clipboard-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={projects.length === 0}
        onClick={toggleOpen}
      >
        <Clipboard className="size-4" />
        {m.reports.copy}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={m.reports.copyTitle}
            data-testid="clipboard-popover"
            initial={{ opacity: 0, scale: 0.97, y: openUp ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            style={{ transformOrigin: openUp ? 'bottom right' : 'top right' }}
            className={cn(
              'absolute right-0 z-50 w-[328px] rounded-2xl border border-line-strong bg-surface p-3 shadow-2xl shadow-black/70',
              openUp ? 'bottom-full mb-2' : 'top-full mt-2'
            )}
          >
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 className="text-[13px] font-medium text-ink">{m.reports.copyTitle}</h3>
              <span className="min-w-0 truncate text-[12px] text-ink-3">{periodLabel}</span>
            </div>

            <SegmentedTabs
              className="mt-3 flex w-full [&>button]:flex-1 [&>button]:justify-center"
              options={[
                { value: 'table' as const, label: m.reports.table },
                { value: 'sessions' as const, label: m.reports.sessions }
              ]}
              value={kind}
              onChange={setKind}
              label={m.reports.copyKind}
              testId="clipboard-kind"
            />
            <p className="mt-2 px-1 text-[12px] text-ink-3">
              {kind === 'table' ? m.reports.copyHintTable(groupLabel) : m.reports.copyHintSessions}
            </p>

            <div role="group" aria-label={m.reports.copyProjects} className="mt-3 border-t border-line pt-2">
              <ProjectRow state={allState} onToggle={toggleAll} testId="clipboard-all" className="font-medium text-ink">
                <span className="min-w-0 flex-1 truncate">{m.reports.copyAll}</span>
              </ProjectRow>
              <div className="thin-scroll max-h-[184px] overflow-y-auto">
                {projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    state={!excluded.includes(project.id)}
                    onToggle={() => toggleProject(project.id)}
                    testId="clipboard-project"
                    className="text-ink-2 hover:text-ink"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: project.color }} />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    <span className="font-mono text-[12px] tabular-nums text-ink-3">{hm(project.ms)}</span>
                  </ProjectRow>
                ))}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="min-w-0 truncate pl-1 text-[12px] tabular-nums text-ink-3" data-testid="clipboard-count">
                {picked.length === 0 ? m.reports.copyNone : m.reports.copyCount(picked.length, projects.length)}
              </span>
              <CopyButton
                data-testid="clipboard-copy"
                className="min-w-[112px]"
                copied={copied}
                label={m.reports.copy}
                copiedLabel={m.reports.copied}
                disabled={picked.length === 0}
                onClick={() => void copy()}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
