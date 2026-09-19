'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

export function BotaoSalvar({
  children = 'Salvar',
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className={className}>
      {pending ? 'Salvando…' : children}
    </Button>
  );
}
