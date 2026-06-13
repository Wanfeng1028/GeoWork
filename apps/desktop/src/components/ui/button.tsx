import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import { Loader2 } from 'lucide-react'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5',
    'rounded-[var(--gw-radius-sm)]',
    'text-[13px] font-medium leading-none whitespace-nowrap',
    'transition-[background,color,border,transform,opacity,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-accent)]/40',
    'disabled:pointer-events-none disabled:opacity-45',
    'active:scale-[0.98]',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--gw-accent)] text-[var(--gw-bg)] hover:bg-[var(--gw-accent-hover)] active:bg-[var(--gw-accent-active)]',
        secondary:
          'bg-[var(--gw-bg-hover)] text-[var(--gw-text)] hover:bg-[var(--gw-bg-active)]',
        ghost:
          'bg-transparent text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)]',
        outline:
          'border border-[var(--gw-border)] bg-transparent text-[var(--gw-text)] hover:bg-[var(--gw-bg-hover)]',
        danger:
          'bg-[var(--gw-danger-soft)] text-[var(--gw-danger)] hover:bg-[var(--gw-danger)]/20',
        link:
          'bg-transparent text-[var(--gw-accent)] underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-6 px-2 text-[11px]',
        sm: 'h-7 px-2.5 text-[12px]',
        md: 'h-8 px-3',
        lg: 'h-9 px-4 text-[14px]',
        icon: 'h-8 w-8 p-0',
        'icon-sm': 'h-6 w-6 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </Comp>
    )
  },
)

Button.displayName = 'Button'

export { Button, buttonVariants }
