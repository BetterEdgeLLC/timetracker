// 21st.dev: ruixen.ui/toolbar-dock. Eine Tooltip-Schiene gleitet über die Knöpfe,
// Clip-Path und Position laufen auf denselben Federn. Einklapp-Logik entfernt, das macht hier das Widget.
import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface ToolbarDockItem {
  id: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
  active?: boolean
  onClick?: () => void
}

const SPRING_X = { type: 'spring' as const, stiffness: 650, damping: 44, mass: 0.7 }
const SPRING_CLIP = { type: 'spring' as const, stiffness: 720, damping: 52, mass: 0.7 }
const HIDDEN_CLIP = 'inset(0px 100% 0px 0px round 8px)'

function offsetLeftWithin(el: HTMLElement | null, ancestor: HTMLElement | null): number {
  let x = 0
  let node: HTMLElement | null = el
  while (node && node !== ancestor) {
    x += node.offsetLeft
    node = node.offsetParent as HTMLElement | null
  }
  return x
}

export function ToolbarDock({
  items,
  className
}: {
  items: ToolbarDockItem[]
  className?: string
}): React.JSX.Element {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const railRef = React.useRef<HTMLDivElement>(null)
  const segRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const btnRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const visibleRef = React.useRef(false)
  const appearingRef = React.useRef(true)
  const [visible, setVisible] = React.useState(false)
  const [pos, setPos] = React.useState({ x: 0, clip: HIDDEN_CLIP })

  const reveal = React.useCallback((index: number) => {
    const rail = railRef.current
    const seg = segRefs.current[index]
    const btn = btnRefs.current[index]
    const wrapper = wrapperRef.current
    if (!rail || !seg || !btn || !wrapper) return
    const railWidth = rail.offsetWidth || 1
    const left = (seg.offsetLeft / railWidth) * 100
    const right = ((railWidth - seg.offsetLeft - seg.offsetWidth) / railWidth) * 100
    const segCenter = offsetLeftWithin(seg, wrapper) + seg.offsetWidth / 2
    const btnCenter = offsetLeftWithin(btn, wrapper) + btn.offsetWidth / 2
    appearingRef.current = !visibleRef.current
    visibleRef.current = true
    setVisible(true)
    setPos({ x: btnCenter - segCenter, clip: `inset(0px ${right}% 0px ${left}% round 8px)` })
  }, [])

  const hide = React.useCallback(() => {
    visibleRef.current = false
    setVisible(false)
  }, [])

  const appearing = appearingRef.current

  return (
    <div ref={wrapperRef} className={cn('relative inline-flex items-center', className)}>
      <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2">
        <motion.div
          ref={railRef}
          initial={false}
          animate={{ x: pos.x, clipPath: pos.clip, opacity: visible ? 1 : 0 }}
          transition={{
            opacity: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
            x: appearing ? { duration: 0 } : SPRING_X,
            clipPath: appearing ? { duration: 0 } : SPRING_CLIP
          }}
          className="flex w-max rounded-lg bg-ink text-bg"
        >
          {items.map((item, i) => (
            <div
              key={item.id}
              ref={(el) => {
                segRefs.current[i] = el
              }}
              className="flex h-6 items-center whitespace-nowrap px-2.5 text-[11px] font-medium"
            >
              {item.label}
            </div>
          ))}
        </motion.div>
      </div>

      <div className="flex items-center gap-1" onMouseLeave={hide}>
        {items.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            type="button"
            aria-label={item.label}
            data-testid={`dock-${item.id}`}
            data-active={item.active || undefined}
            disabled={item.disabled}
            onClick={item.onClick}
            onMouseEnter={() => reveal(i)}
            onFocus={() => reveal(i)}
            onBlur={hide}
            className={cn(
              'press flex size-10 items-center justify-center rounded-xl text-ink-2 outline-none transition-colors duration-150',
              'hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60',
              'data-[active]:bg-accent data-[active]:text-accent-ink data-[active]:hover:bg-accent',
              'disabled:pointer-events-none disabled:text-ink-3/40'
            )}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
