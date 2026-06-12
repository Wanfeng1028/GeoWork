import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/cn'

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center',
      'rounded-full border-2 border-transparent',
      'transition-[background] duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-accent)]/30',
      'disabled:cursor-not-allowed disabled:opacity-45',
      'data-[state=checked]:bg-[var(--gw-accent)]',
      'data-[state=unchecked]:bg-[var(--gw-bg-active)]',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-[16px] w-[16px] rounded-full',
        'bg-[var(--gw-text)] shadow-sm',
        'transition-transform duration-150',
        'data-[state=checked]:translate-x-[16px]',
        'data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

export { Switch }
