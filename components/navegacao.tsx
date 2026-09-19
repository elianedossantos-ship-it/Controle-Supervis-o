'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVEGACAO } from '@/lib/navegacao';
import { papelAtende, type Papel } from '@/lib/papeis';
import { cn } from '@/lib/utils';

type Props = {
  papel: Papel;
  orientacao: 'horizontal' | 'vertical';
};

export function BarraNavegacao({ papel, orientacao }: Props) {
  const caminho = usePathname();

  const grupos = NAVEGACAO.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) => papelAtende(papel, item.exige)),
  })).filter((grupo) => grupo.itens.length > 0);

  if (orientacao === 'horizontal') {
    return (
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Navegação">
        {grupos.flatMap((grupo) =>
          grupo.itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={caminho === item.href ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap',
                caminho === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {item.rotulo}
            </Link>
          )),
        )}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-4 px-2 py-4" aria-label="Navegação">
      {grupos.map((grupo, i) => (
        <div key={grupo.titulo ?? i} className="flex flex-col gap-1">
          {grupo.titulo ? (
            <p className="text-muted-foreground px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              {grupo.titulo}
            </p>
          ) : null}

          {grupo.itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={caminho === item.href ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium',
                caminho === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {item.rotulo}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
