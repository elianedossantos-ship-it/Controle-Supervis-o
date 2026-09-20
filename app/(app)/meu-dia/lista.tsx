'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatarDataHora } from '@/lib/datas';
import { PainelRegistro } from './registrar';
import { PainelCancelamento } from './cancelar';
import type { DadosMeuDia, VisitaDoDia } from './acoes';

const ROTULO_ORIGEM: Record<string, string> = {
  programada: 'Programada',
  extra: 'Extra',
  demanda_coordenacao: 'Demanda da coordenação',
};

function linkDoMapa(v: VisitaDoDia): string {
  const partes = [v.endereco, v.cidade, v.uf].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes)}`;
}

export function ListaDeVisitas({
  dados,
  podeAgir,
}: {
  dados: DadosMeuDia;
  podeAgir: boolean;
}) {
  const [painel, setPainel] = useState<{ id: string; tipo: 'registro' | 'cancelar' } | null>(
    null,
  );
  const [detalhes, setDetalhes] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {dados.visitas.map((v) => {
        const aberto = painel?.id === v.id ? painel.tipo : null;
        const principal = v.contatos.find((c) => c.principal) ?? v.contatos[0];

        return (
          <article key={v.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-semibold">{v.contratoNome}</h2>
                <a
                  href={linkDoMapa(v)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground text-sm underline underline-offset-2"
                >
                  {v.endereco}
                  {v.cidade ? `, ${v.cidade}` : ''}
                  {v.uf ? `/${v.uf}` : ''}
                </a>
              </div>

              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">{v.periodicidade}</Badge>
                {v.origem !== 'programada' ? (
                  <Badge variant="outline">{ROTULO_ORIGEM[v.origem] ?? v.origem}</Badge>
                ) : null}
                {v.status === 'realizada' ? <Badge>Realizada</Badge> : null}
                {v.status === 'cancelada' ? (
                  <Badge variant="destructive">Cancelada</Badge>
                ) : null}
              </div>
            </div>

            {principal ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {principal.nome}
                {principal.cargo ? ` — ${principal.cargo}` : ''}
                {principal.telefone ? (
                  <>
                    {' · '}
                    <a
                      href={`tel:${principal.telefone.replace(/\D/g, '')}`}
                      className="underline underline-offset-2"
                    >
                      {principal.telefone}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}

            {v.status === 'realizada' ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Registrada
                {v.realizadaEm ? ` em ${formatarDataHora(new Date(v.realizadaEm))}` : ''}
                {v.temLocalizacao ? '' : ' — sem localização'}.
              </p>
            ) : null}

            {v.status === 'cancelada' ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Cancelada: {v.motivoDescricao}
                {v.motivoOutro ? ` — ${v.motivoOutro}` : ''}
              </p>
            ) : null}

            {v.status === 'prevista' && podeAgir ? (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  size="lg"
                  onClick={() =>
                    setPainel(aberto === 'registro' ? null : { id: v.id, tipo: 'registro' })
                  }
                >
                  Realizada
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() =>
                    setPainel(aberto === 'cancelar' ? null : { id: v.id, tipo: 'cancelar' })
                  }
                >
                  Cancelar
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => setDetalhes(detalhes === v.id ? null : v.id)}
                >
                  Detalhes
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDetalhes(detalhes === v.id ? null : v.id)}
                >
                  Detalhes
                </Button>
              </div>
            )}

            {aberto === 'registro' ? (
              <PainelRegistro visitaId={v.id} onFechar={() => setPainel(null)} />
            ) : null}

            {aberto === 'cancelar' ? (
              <PainelCancelamento
                visitaId={v.id}
                motivos={dados.motivos}
                onFechar={() => setPainel(null)}
              />
            ) : null}

            {detalhes === v.id ? (
              <div className="bg-muted/40 mt-3 rounded-lg border p-4 text-sm">
                {v.observacoes ? (
                  <p className="mb-2">
                    <span className="font-medium">Observações do contrato:</span>{' '}
                    {v.observacoes}
                  </p>
                ) : null}

                {v.observacao ? (
                  <p className="mb-2">
                    <span className="font-medium">Observação da visita:</span> {v.observacao}
                  </p>
                ) : null}

                {v.contatos.length > 0 ? (
                  <div className="mb-2">
                    <p className="font-medium">Contatos</p>
                    <ul className="text-muted-foreground">
                      {v.contatos.map((c, i) => (
                        <li key={i}>
                          {c.nome}
                          {c.cargo ? ` — ${c.cargo}` : ''}
                          {c.telefone ? ` · ${c.telefone}` : ''}
                          {c.principal ? ' (principal)' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground mb-2">Sem contatos cadastrados.</p>
                )}

                {v.fotos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {v.fotos.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt="Evidência da visita"
                          className="h-24 w-24 rounded-md border object-cover"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
