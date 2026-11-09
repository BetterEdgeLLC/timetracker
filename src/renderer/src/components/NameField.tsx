import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Inline-Feld: speichert bei Enter oder beim Verlassen, Esc verwirft, leer stellt den alten Wert her. */
export function NameField({
  value,
  onCommit,
  label,
  className,
  testId
}: {
  value: string
  onCommit: (name: string) => void
  label: string
  className?: string
  testId?: string
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  const discard = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  const commit = (): void => {
    focused.current = false
    if (discard.current) {
      discard.current = false
      setDraft(value)
      return
    }
    const trimmed = draft.trim()
    if (!trimmed) {
      setDraft(value)
      return
    }
    if (trimmed !== value) onCommit(trimmed)
  }

  return (
    <input
      value={draft}
      aria-label={label}
      title={draft}
      spellCheck={false}
      data-testid={testId}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        focused.current = true
        e.target.select()
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          discard.current = true
          e.currentTarget.blur()
        }
      }}
      className={cn(
        'min-w-0 rounded-lg border border-transparent bg-transparent px-2 outline-none transition-colors duration-150 hover:bg-hover/60 focus:border-accent/60 focus:bg-raised',
        className
      )}
    />
  )
}
