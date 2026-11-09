// 21st.dev / shadcn button, auf die Farben dieser App reduziert.
import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'ghost' | 'outline' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent/90',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink',
  outline: 'border border-line text-ink-2 hover:border-line-strong hover:text-ink',
  danger: 'text-danger hover:bg-danger/10'
}

export function Button({
  variant = 'outline',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'press inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-medium outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'press flex size-8 items-center justify-center rounded-lg text-ink-3 outline-none transition-colors duration-150',
        'hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export const inputClass =
  'h-10 w-full rounded-xl border border-line bg-raised px-3.5 text-[13px] text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 hover:border-line-strong focus:border-accent/60'
