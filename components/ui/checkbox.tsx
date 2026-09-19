import * as React from 'react';
import { cn } from '@/lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'border-input accent-primary size-5 shrink-0 rounded-[4px] border shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
