// 21st.dev: saurabh-2607/great-ui-animated-select. Federnde Liste mit gestaffelten Einträgen und
// morphendem Chevron. Für beliebig viele Projekte scrollbar gemacht, Tastatur und Listbox-Rollen ergänzt.
// Based on Great UI by Saurabh Sharma (https://great-ui.com), released under the MIT License.
import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface SelectOption {
  id: string
  label: string
  color?: string
}

function Chevron({ open }: { open: boolean }): React.JSX.Element {
  const spring = { type: 'spring' as const, stiffness: 260, damping: 22 }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-3.5 shrink-0 text-ink-3"
      aria-hidden
    >
      <motion.path initial={false} animate={{ d: open ? 'M 6 6 L 18 18' : 'M 6 10 L 12 16' }} transition={spring} />
      <motion.path initial={false} animate={{ d: open ? 'M 6 18 L 18 6' : 'M 12 16 L 18 10' }} transition={spring} />
    </svg>
  )
}

export function AnimatedSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  className,
  testId,
  triggerIcon
}: {
  options: SelectOption[]
  value: string | null
  onChange: (id: string) => void
  placeholder: string
  label: string
  className?: string
  testId?: string
  /** Macht aus dem Auslöser einen runden Icon-Knopf. Die Liste bekommt dann eine feste Breite. */
  triggerIcon?: React.ReactNode
}): React.JSX.Element {
  const { m } = useI18n()
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    if (!open) return
    const down = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open])

  const choose = (id: string): void => {
    onChange(id)
    setOpen(false)
  }

  const toggle = (): void => {
    setCursor(Math.max(0, options.findIndex((o) => o.id === value)))
    setOpen((v) => !v)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (!open || options.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setCursor((c) => (c + delta + options.length) % options.length)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      choose(options[cursor].id)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        data-testid={testId}
        onClick={toggle}
        className={
          triggerIcon
            ? 'press flex size-7 items-center justify-center rounded-full text-ink-3 outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60'
            : 'press flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-line bg-raised px-3.5 text-[13px] text-ink outline-none transition-colors duration-150 hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent/60'
        }
      >
        {triggerIcon ?? (
          <>
            <span className="flex min-w-0 items-center gap-2.5">
              {selected?.color && (
                <span className="size-2 shrink-0 rounded-full" style={{ background: selected.color }} />
              )}
              <span className={cn('truncate', !selected && 'text-ink-3')}>{selected?.label ?? placeholder}</span>
            </span>
            <Chevron open={open} />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={listId}
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            style={{ transformOrigin: 'top center' }}
            className={cn(
              'absolute left-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-line-strong bg-raised p-1 shadow-2xl shadow-black/60',
              triggerIcon ? 'w-56' : 'right-0'
            )}
          >
            {options.length === 0 && <p className="px-3 py-2 text-[13px] text-ink-3">{m.common.noProjects}</p>}
            {options.map((option, i) => (
              <motion.button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === value}
                data-testid={testId ? `${testId}-option` : undefined}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: Math.min(i * 0.025, 0.15), ease: [0.22, 1, 0.36, 1] }}
                onClick={() => choose(option.id)}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-ink-2 transition-colors duration-100',
                  i === cursor && 'bg-hover text-ink'
                )}
              >
                {option.color && <span className="size-2 shrink-0 rounded-full" style={{ background: option.color }} />}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.id === value && <Check className="size-3.5 shrink-0 text-accent" aria-hidden />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
