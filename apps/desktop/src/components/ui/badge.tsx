import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-[var(--gw-radius-full)] px-2 py-0.5',
    'text-[11px] font-medium leading-none whitespace-nowrap',
    'transition-colors',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-[var(--gw-bg-active)] text-[var(--gw-text-secondary)]',
        secondary:
          'bg-[var(--gw-bg-hover)] text-[var(--gw-text-secondary)]',
        accent:
          'bg-[var(--gw-accent-soft)] text-[var(--gw-accent)]',
        success:
          'bg-[var(--gw-success-soft)] text-[var(--gw-success)]',
        warning:
          'bg-[var(--gw-warning-soft)] text-[var(--gw-warning)]',
        danger:
          'bg-[var(--gw-danger-soft)] text-[var(--gw-danger)]',
        info:
          'bg-[var(--gw-info-soft)] text-[var(--gw-info)]',
        outline:
          'border border-[var(--gw-border)] bg-transparent text-[var(--gw-text-secondary)]',
        link:
          'bg-transparent text-[var(--gw-accent)] underline-offset-4 hover:underline',
        destructive:
          'bg-[var(--gw-danger)] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
