// 21st.dev: halaska-studio/switch (Spring switch). Der Daumen streckt sich beim Drücken.
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function Switch({
  checked,
  onChange,
  label,
  testId
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  testId?: string
}): React.JSX.Element {
  const [pressed, setPressed] = useState(false)
  const thumb = pressed ? 22 : 18
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className={cn(
        'relative h-[22px] w-10 shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60',
        checked ? 'bg-accent' : 'bg-hover'
      )}
    >
      <span
        className={cn('absolute top-0.5 h-[18px] rounded-full', checked ? 'bg-accent-ink' : 'bg-ink-2')}
        style={{
          width: thumb,
          left: checked ? 40 - thumb - 2 : 2,
          transition: 'left 240ms cubic-bezier(0.34, 1.4, 0.64, 1), width 120ms ease-out, background-color 200ms ease'
        }}
      />
    </button>
  )
}
