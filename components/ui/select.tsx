import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * <select> nativo, e não o do Radix: assim o campo entra no FormData sem JS e,
 * no celular, abre o seletor do próprio sistema — que é o que o supervisor
 * espera ao preencher em pé, com uma mão.
 */
function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'border-input flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Select };
