import * as React from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-8 w-full rounded-[var(--gw-radius-sm)] border bg-[var(--gw-bg-input)] px-2.5',
          'text-[13px] leading-none text-[var(--gw-text)]',
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

Input.displayName = 'Input'

export { Input }
