'use client';

import { useActionState, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatarData } from '@/lib/datas';
import { moverContrato } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

type Supervisor = { id: string; nome: string; email: string };

type Vinculo = {
  contratoId: string;
  contratoNome: string;
  endereco: string;
  periodicidade: string;
  contratoAtivo: boolean;
  supervisorId: string | null;
  inicio: string | null;
};

const SEM_SUPERVISOR = 'sem-supervisor';

export function PainelCarteira({
  supervisores,
  vinculos,
}: {
  supervisores: Supervisor[];
  vinculos: Vinculo[];
}) {
  const [estado, mover] = useActionState<EstadoForm, FormData>(moverContrato, {});
  const [selecionado, setSelecionado] = useState<string>(
    supervisores[0]?.id ?? SEM_SUPERVISOR,
  );
  const [busca, setBusca] = useState('');

  const semSupervisor = vinculos.filter((v) => v.supervisorId === null);

  const contar = (id: string) =>
    id === SEM_SUPERVISOR
      ? semSupervisor.length
      : vinculos.filter((v) => v.supervisorId === id).length;

  const daCarteira = vinculos.filter((v) =>
    selecionado === SEM_SUPERVISOR
      ? v.supervisorId === null
      : v.supervisorId === selecionado,
  );

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? daCarteira.filter(
        (v) =>
          v.contratoNome.toLowerCase().includes(termo) ||
          v.endereco.toLowerCase().includes(termo),
      )
    : daCarteira;

  const nomeSelecionado =
    selecionado === SEM_SUPERVISOR
      ? 'Sem supervisor'
      : (supervisores.find((s) => s.id === selecionado)?.nome ?? '');

  return (
    <>
      {estado.erro ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Supervisores à esquerda */}
        <aside className="rounded-lg border">
          <p className="text-muted-foreground border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase">
            Supervisores
          </p>

          <ul className="p-2">
            {supervisores.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelecionado(s.id)}
                  aria-pressed={selecionado === s.id}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm',
                    selecionado === s.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent',
                  )}
                >
                  <span className="truncate font-medium">{s.nome}</span>
                  <span className="text-xs tabular-nums opacity-80">{contar(s.id)}</span>
                </button>
              </li>
            ))}

            <li className="mt-2 border-t pt-2">
              <button
                type="button"
                onClick={() => setSelecionado(SEM_SUPERVISOR)}
                aria-pressed={selecionado === SEM_SUPERVISOR}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm',
                  selecionado === SEM_SUPERVISOR
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                  semSupervisor.length > 0 && selecionado !== SEM_SUPERVISOR
                    ? 'text-destructive'
                    : '',
                )}
              >
                <span className="truncate font-medium">Sem supervisor</span>
                <span className="text-xs tabular-nums opacity-80">
                  {semSupervisor.length}
                </span>
              </button>
            </li>
          </ul>
        </aside>

        {/* Contratos à direita */}
        <section className="rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="font-semibold">{nomeSelecionado}</p>
              <p className="text-muted-foreground text-xs">
                {daCarteira.length} contrato{daCarteira.length === 1 ? '' : 's'}
              </p>
            </div>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou endereço"
              className="h-9 w-full max-w-xs"
              aria-label="Buscar contrato"
            />
          </div>

          {visiveis.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {daCarteira.length === 0
                ? 'Nenhum contrato nesta carteira.'
                : 'Nenhum contrato encontrado para a busca.'}
            </p>
          ) : (
            <ul className="divide-y">
              {visiveis.map((v) => (
                <li
                  key={v.contratoId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="truncate">{v.contratoNome}</span>
                      {!v.contratoAtivo ? (
                        <Badge variant="destructive">Inativo</Badge>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{v.endereco}</p>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{v.periodicidade}</Badge>
                      {v.inicio ? <span>na carteira desde {formatarData(v.inicio)}</span> : null}
                    </p>
                  </div>

                  <form action={mover} className="flex items-center gap-2">
                    <input type="hidden" name="contratoId" value={v.contratoId} />
                    <Select
                      name="supervisorId"
                      defaultValue={v.supervisorId ?? ''}
                      className="h-9 w-48"
                      aria-label={`Supervisor de ${v.contratoNome}`}
                    >
                      <option value="">Sem supervisor</option>
                      {supervisores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="outline" size="sm">
                      Mover
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
