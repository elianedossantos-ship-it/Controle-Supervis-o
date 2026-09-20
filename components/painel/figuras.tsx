import { cn } from '@/lib/utils';

/**
 * A figura que o painel abre: um número só, grande. Uma por tela.
 */
export function FiguraPrincipal({
  rotulo,
  valor,
  apoio,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
}) {
  return (
    <div className="bg-card rounded-lg border p-6" data-figura={rotulo}>
      <p className="text-muted-foreground text-sm">{rotulo}</p>
      <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums" data-valor>
        {valor}
      </p>
      {apoio ? <p className="text-muted-foreground mt-2 text-sm">{apoio}</p> : null}
    </div>
  );
}

export type Severidade = 'neutro' | 'bom' | 'critico';

/**
 * Bloco de número do painel. A cor nunca carrega o significado sozinha: quando
 * há severidade, ela vem junto de um rótulo em texto.
 */
export function Bloco({
  rotulo,
  valor,
  apoio,
  severidade = 'neutro',
  marca,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  severidade?: Severidade;
  marca?: string;
}) {
  return (
    <div className="bg-card viz rounded-lg border p-4" data-bloco={rotulo}>
      <p className="text-muted-foreground text-sm">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" data-valor>
        {valor}
      </p>

      {marca ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className={cn(
              'inline-block size-2 shrink-0 rounded-full',
              severidade === 'neutro' ? 'bg-muted-foreground' : '',
            )}
            style={
              severidade === 'bom'
                ? { background: 'var(--viz-bom)' }
                : severidade === 'critico'
                  ? { background: 'var(--viz-critico)' }
                  : undefined
            }
          />
          <span className="text-muted-foreground">{marca}</span>
        </p>
      ) : null}

      {apoio ? <p className="text-muted-foreground mt-1 text-xs">{apoio}</p> : null}
    </div>
  );
}
