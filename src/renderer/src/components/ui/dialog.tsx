// 21st.dev: originui/dialog, auf Radix. Ein- und Ausblenden über CSS-Übergänge in styles.css.
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export function Dialog({
  open,
  onClose,
  title,
  description,
  children
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  const { m } = useI18n()
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-[100] bg-black/70" />
        <DialogPrimitive.Content
          className="dialog-content fixed left-1/2 top-1/2 z-[101] w-[480px] max-w-[calc(100%-3rem)] rounded-2xl border border-line-strong bg-surface p-6 shadow-2xl shadow-black/70 outline-none"
        >
          <DialogPrimitive.Title className="text-[15px] font-medium text-ink">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-[13px] text-ink-3">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          <div className="mt-5">{children}</div>
          <DialogPrimitive.Close
            aria-label={m.action.close}
            className="press absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-ink-3 outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
