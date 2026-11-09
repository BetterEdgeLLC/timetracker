// 21st.dev: motiondotdev/motion-copy-button. Icon-Wechsel mit Blur und gezeichnetem Haken,
// hier als gesteuerter Button in den Farben dieser App. Kopieren passiert beim Aufrufer.
import { AnimatePresence, motion } from 'motion/react'
import { Copy } from 'lucide-react'
import { Button } from './button'

const SWAP = { type: 'spring' as const, stiffness: 260, damping: 18 }
const DRAW = { type: 'spring' as const, stiffness: 300, damping: 25, delay: 0.08 }

export function CopyButton({
  copied,
  label,
  copiedLabel,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  copied: boolean
  label: string
  copiedLabel: string
}): React.JSX.Element {
  return (
    <Button variant="primary" className={className} data-copied={copied || undefined} {...props}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? 'copied' : 'copy'}
          className="flex items-center gap-2"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={SWAP}
        >
          {copied ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden
            >
              <motion.path d="M4 12l5 5L20 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={DRAW} />
            </svg>
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? copiedLabel : label}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
