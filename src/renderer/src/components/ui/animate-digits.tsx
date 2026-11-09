// 21st.dev: unlumen/animate-digits. Federwerte für eine ruhigere, edlere Bewegung angepasst.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react'
import { cn } from '@/lib/utils'

interface AnimateDigitsProps {
  value: string
  gap?: number
  className?: string
  digitClassName?: string
  enterY?: number
  enterBlur?: number
}

interface ExitItem {
  id: number
  char: string
}

let nextId = 0
const SPRING = { stiffness: 320, damping: 32 }

function DigitCell({
  char,
  isDigit,
  className,
  enterY,
  enterBlur
}: {
  char: string
  isDigit: boolean
  className?: string
  enterY: number
  enterBlur: number
}): React.JSX.Element {
  const [exitQueue, setExitQueue] = useState<ExitItem[]>([])
  const previous = useRef(char)
  const first = useRef(true)

  const y = useSpring(0, SPRING)
  const opacity = useSpring(1, SPRING)
  const blur = useSpring(0, SPRING)
  const filter = useTransform(blur, (v) => `blur(${Math.max(0, v)}px)`)

  useEffect(() => {
    if (!isDigit) return
    const prev = previous.current
    previous.current = char
    if (first.current) {
      first.current = false
      return
    }
    if (char === prev || !/\d/.test(prev)) return
    const id = nextId++
    setExitQueue((q) => [...q, { id, char: prev }].slice(-2))
    y.jump(enterY)
    opacity.jump(0)
    blur.jump(enterBlur)
    y.set(0)
    opacity.set(1)
    blur.set(0)
  }, [char, isDigit, enterY, enterBlur, y, opacity, blur])

  if (!isDigit) return <span className={className}>{char}</span>

  return (
    <div className={cn('relative grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1', className)}>
      <AnimatePresence>
        {exitQueue.map(({ id, char: exitChar }) => (
          <motion.span
            key={id}
            aria-hidden
            initial={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            animate={{ opacity: 0, filter: `blur(${enterBlur}px)`, y: -enterY }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setExitQueue((q) => q.filter((item) => item.id !== id))}
          >
            {exitChar}
          </motion.span>
        ))}
      </AnimatePresence>
      <motion.span style={{ opacity, filter, y }}>{char}</motion.span>
    </div>
  )
}

export function AnimateDigits({
  value,
  gap = 0,
  className,
  digitClassName,
  enterY = 14,
  enterBlur = 4
}: AnimateDigitsProps): React.JSX.Element {
  return (
    <div className={cn('flex items-center tabular-nums', className)} style={{ gap }} role="timer" aria-label={value}>
      {value.split('').map((char, i) => (
        <DigitCell
          key={i}
          char={char}
          isDigit={/\d/.test(char)}
          className={digitClassName}
          enterY={enterY}
          enterBlur={enterBlur}
        />
      ))}
    </div>
  )
}
