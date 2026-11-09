// 21st.dev: micka_design/tabs-base. Gleitende Auswahl plus flüssiger Hover-Hintergrund,
// hier ohne Base-UI-Abhängigkeit als kontrollierte Tab-Leiste.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
}

interface Rect {
  left: number
  width: number
}

const SPRING = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.8 }

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  testId
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
  testId?: string
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [rects, setRects] = useState<Rect[]>([])
  const [hovered, setHovered] = useState<number | null>(null)

  const measure = useCallback(() => {
    setRects(itemRefs.current.slice(0, options.length).map((el) => ({ left: el?.offsetLeft ?? 0, width: el?.offsetWidth ?? 0 })))
  }, [options.length])

  useLayoutEffect(() => {
    measure()
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    void document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [measure])

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = rects[selectedIndex]
  const hover = hovered !== null && hovered !== selectedIndex ? rects[hovered] : undefined

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (selectedIndex + delta + options.length) % options.length
    onChange(options[next].value)
    itemRefs.current[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      data-testid={testId}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHovered(null)}
      className={cn('no-drag relative inline-flex items-center gap-0.5 rounded-xl bg-raised p-1', className)}
    >
      {selected && (
        <motion.div
          className="pointer-events-none absolute bottom-1 top-1 rounded-[9px] border border-line bg-hover"
          initial={false}
          animate={{ left: selected.left, width: selected.width }}
          transition={SPRING}
        />
      )}
      <AnimatePresence>
        {hover && selected && (
          <motion.div
            className="pointer-events-none absolute bottom-1 top-1 rounded-[9px] bg-hover/50"
            initial={{ left: selected.left, width: selected.width, opacity: 0 }}
            animate={{ left: hover.left, width: hover.width, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ ...SPRING, opacity: { duration: 0.08 } }}
          />
        )}
      </AnimatePresence>
      {options.map((option, i) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              itemRefs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            data-testid={testId ? `${testId}-${option.value}` : undefined}
            onClick={() => onChange(option.value)}
            onMouseEnter={() => setHovered(i)}
            className={cn(
              'relative z-10 flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] outline-none transition-colors duration-100',
              'focus-visible:ring-2 focus-visible:ring-accent/60',
              isSelected || hovered === i ? 'text-ink' : 'text-ink-3'
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
