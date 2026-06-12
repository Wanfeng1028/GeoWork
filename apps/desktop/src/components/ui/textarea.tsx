import * as React from 'react'
import { cn } from '../../lib/cn'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-[var(--gw-radius-sm)] border bg-[var(--gw-bg-input)] px-2.5 py-2',
          'text-[13px] leading-relaxed text-[var(--gw-text)] resize-y',
          'transition-[border-color,box-shadow] duration-150',
          'placeholder:text-[var(--gw-text-disabled)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-accent)]/30',
          'disabled:cursor-not-allowed disabled:opacity-45',
          error
            ? 'border-[var(--gw-danger)] focus-visible:ring-[var(--gw-danger)]/30'
            : 'border-[var(--gw-border-soft)] hover:border-[var(--gw-border)] focus-visible:border-[var(--gw-accent)]',
          className,
        )}
        {...props}
      />
    )
  },
)

Textarea.displayName = 'Textarea'

export { Textarea }
