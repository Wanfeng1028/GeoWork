import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/cn'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-[var(--gw-z-popover)] w-72 overflow-hidden',
        'rounded-[var(--gw-radius-md)] border border-[var(--gw-border)] bg-[var(--gw-bg-popover)]',
        'shadow-[var(--gw-shadow-lg)]',
        'data-[state=open]:animate-[gw-scale-in_150ms_var(--gw-ease-out)]',
        'data-[state=closed]:animate-[gw-fade-out_100ms_ease-in]',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = 'PopoverContent'

export { Popover, PopoverTrigger, PopoverContent }
