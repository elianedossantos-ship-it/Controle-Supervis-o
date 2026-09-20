'use client';

import { useState } from 'react';

export type ItemBarra = {
  rotulo: string;
  valor: number;
  percentual: number;
  detalhe?: string | null;
};

/**
 * Ranking em barras horizontais. Série única, então uma cor só e sem legenda:
 * o título já diz o que a barra mede, e o rótulo de cada linha dá a identidade.
 *
 * Barras com no máximo 24px, ponta arredondada em 4px e base reta, crescendo de
 * uma linha de base única. Sem eixo nem grade: o valor vai direto na ponta.
 */
export function BarrasRanqueadas({
  itens,
  titulo,
  unidade = 'cancelamento',
  rotuloDetalhe = 'categoria',
  vazio,
}: {
  itens: ItemBarra[];
  titulo: string;
  unidade?: string;
  rotuloDetalhe?: string;
  vazio?: string;
}) {
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const maximo = Math.max(...itens.map((i) => i.valor), 1);

  if (itens.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        {vazio ?? 'Nenhum cancelamento no período.'}
      </div>
    );
  }

  return (
    <div className="viz flex flex-col gap-3" role="img" aria-label={titulo}>
      {itens.map((item, i) => (
        <div
          key={item.rotulo}
          className="relative"
          onMouseEnter={() => setEmFoco(i)}
          onMouseLeave={() => setEmFoco(null)}
          onFocus={() => setEmFoco(i)}
          onBlur={() => setEmFoco(null)}
          tabIndex={0}
        >
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-sm">{item.rotulo}</span>
            <span className="text-sm font-semibold tabular-nums">{item.valor}</span>
          </div>

          <div
            className="h-3 w-full overflow-hidden rounded-[4px]"
            style={{ background: 'var(--viz-trilha)' }}
          >
            <div
              className="h-full rounded-r-[4px]"
              style={{
                width: `${Math.max((item.valor / maximo) * 100, 2)}%`,
                background: 'var(--viz-serie)',
              }}
            />
          </div>

          {emFoco === i ? (
            <div className="bg-popover text-popover-foreground absolute top-full left-0 z-20 mt-1 rounded-md border px-3 py-2 text-xs shadow-md">
              <p className="font-medium">{item.rotulo}</p>
              <p className="text-muted-foreground">
                {item.valor} {unidade}
                {item.valor === 1 ? '' : 's'} — {item.percentual.toFixed(1).replace('.', ',')}%
                do total
              </p>
              {item.detalhe ? (
                <p className="text-muted-foreground">
                  {rotuloDetalhe}: {item.detalhe}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
