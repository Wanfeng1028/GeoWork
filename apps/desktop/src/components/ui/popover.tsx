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
        'z-[var(--gw-z-popover)] overflow-hidden',
        'rounded-xl border border-[var(--gw-popup-border,rgba(255,255,255,0.08))]',
        'bg-[var(--gw-popup-bg,#1d1d1a)]',
        'shadow-[0_18px_48px_rgba(0,0,0,0.48)]',
        'data-[state=open]:animate-[gw-slide-up_130ms_var(--gw-ease-out)]',
        'data-[state=closed]:animate-[gw-fade-out_100ms_ease-in]',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = 'PopoverContent'

export { Popover, PopoverTrigger, PopoverContent }
