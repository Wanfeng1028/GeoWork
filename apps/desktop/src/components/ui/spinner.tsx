import { Loader2, type LucideProps } from 'lucide-react'
import { cn } from '../../lib/cn'

interface SpinnerProps extends LucideProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const sizeMap = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin text-[var(--gw-text-tertiary)]', sizeMap[size], className)}
      {...props}
    />
  )
}
