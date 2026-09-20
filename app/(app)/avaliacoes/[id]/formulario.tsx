'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatarData } from '@/lib/datas';
import { ESCALA, encaminhamentoDa, formatarNota } from '@/lib/avaliacao';
import { formatarPercentual } from '@/lib/indicadores';
import {
  adicionarAcao,
  assinarAvaliacao,
  concluirAcao,
  finalizarAvaliacao,
  removerAcao,
  salvarFechamento,
  salvarNota,
  type AvaliacaoCompleta,
} from '../acoes';
import type { EstadoForm } from '@/lib/formulario';

export function FormularioAvaliacao({
  a,
  podeEditar,
  ehDono,
}: {
  a: AvaliacaoCompleta;
  podeEditar: boolean;
  ehDono: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const [passo, setPasso] = useState(0);

  const emRascunho = a.status === 'rascunho';
  const editavel = podeEditar && emRascunho;

  const chamar = (acao: (e: EstadoForm, f: FormData) => Promise<EstadoForm>, f: FormData) =>
    iniciar(async () => {
      const r = await acao({}, f);
      setErro(r.erro ?? null);
      if (!r.erro) router.refresh();
    });

  function mudarNota(criterioId: string, nota: string, comentario: string) {
    const f = new FormData();
    f.set('avaliacaoId', a.id);
    f.set('criterioId', criterioId);
    f.set('nota', nota);
    f.set('comentario', comentario);
    chamar(salvarNota, f);
  }

  const notasDaCompetencia = a.resultado;
  const competencia = a.competencias[passo];
  const ultimoPasso = passo >= a.competencias.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Resultado ao vivo, no topo */}
      <section className="bg-card grid gap-4 rounded-lg border p-5 sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-sm">Nota final</p>
          <p className="text-3xl font-semibold tabular-nums">
            {formatarNota(notasDaCompetencia.notaFinal)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Aproveitamento</p>
          <p className="text-3xl font-semibold tabular-nums">
            {formatarPercentual(notasDaCompetencia.aproveitamento)}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-muted-foreground text-sm">Classificação</p>
          <p className="text-lg font-semibold">{notasDaCompetencia.classificacao ?? '—'}</p>
          {notasDaCompetencia.aproveitamento !== null ? (
            <p className="text-muted-foreground text-sm">
              {encaminhamentoDa(notasDaCompetencia.aproveitamento)}
            </p>
          ) : null}
        </div>

        {notasDaCompetencia.competenciasSemNota.length > 0 ? (
          <p className="text-muted-foreground sm:col-span-4 text-xs">
            Sem nota em: {notasDaCompetencia.competenciasSemNota.join(', ')}. O peso dessas
            competências foi redistribuído entre as demais.
          </p>
        ) : null}
      </section>

      {erro ? (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      {/* Navegação por competência */}
      <nav className="flex flex-wrap gap-2">
        {a.competencias.map((c, i) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={passo === i ? 'default' : 'outline'}
            onClick={() => setPasso(i)}
          >
            {c.ordem}. {c.nome}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={ultimoPasso ? 'default' : 'outline'}
          onClick={() => setPasso(a.competencias.length)}
        >
          Fechamento e PDI
        </Button>
      </nav>

      {competencia ? (
        <section className="bg-card rounded-lg border p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              {competencia.ordem}. {competencia.nome}
            </h2>
            <Badge variant="secondary">peso {Math.round(competencia.peso * 100)}%</Badge>
          </div>

          <div className="flex flex-col gap-5">
            {competencia.criterios.map((k) => (
              <div key={k.id} className="border-b pb-5 last:border-0 last:pb-0">
                <p className="font-medium">
                  {k.codigo} {k.descricao}
                </p>

                {/* Evidência automática: apoia, nunca substitui a nota */}
                {k.apoio ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    No sistema: {k.apoio}.{' '}
                    <span className="italic">É apoio; a nota é do avaliador.</span>
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {ESCALA.map((e) => (
                    <button
                      key={e.nota}
                      type="button"
                      disabled={!editavel || salvando}
                      onClick={() => mudarNota(k.id, String(e.nota), k.comentario ?? '')}
                      title={e.rotulo}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-md border font-semibold',
                        k.nota === e.nota
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:bg-accent',
                        !editavel ? 'cursor-default' : '',
                      )}
                    >
                      {e.nota}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!editavel || salvando}
                    onClick={() => mudarNota(k.id, '', k.comentario ?? '')}
                    className={cn(
                      'h-10 rounded-md border px-3 text-sm',
                      k.nota === null ? 'bg-secondary' : 'hover:bg-accent',
                      !editavel ? 'cursor-default' : '',
                    )}
                  >
                    Não se aplica
                  </button>
                  <span className="text-muted-foreground text-xs">
                    {k.nota === null
                      ? 'sai do denominador da competência'
                      : (ESCALA.find((e) => e.nota === k.nota)?.rotulo ?? '')}
                  </span>
                </div>

                {editavel ? (
                  <Textarea
                    aria-label={`Comentário do critério ${k.codigo}`}
                    className="mt-3"
                    rows={2}
                    placeholder="Comentário (opcional)"
                    defaultValue={k.comentario ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (k.comentario ?? '')) {
                        mudarNota(k.id, k.nota === null ? '' : String(k.nota), e.target.value);
                      }
                    }}
                  />
                ) : k.comentario ? (
                  <p className="text-muted-foreground mt-2 text-sm">{k.comentario}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-6">
          <div className="bg-card rounded-lg border p-5">
            <h2 className="mb-4 font-semibold">Pontos fortes e de atenção</h2>

            {editavel ? (
              <form
                action={(f) => {
                  f.set('avaliacaoId', a.id);
                  chamar(salvarFechamento, f);
                }}
                className="flex flex-col gap-4"
              >
                <div>
                  <Label htmlFor="pontosFortes" className="mb-2">
                    Pontos fortes
                  </Label>
                  <Textarea
                    id="pontosFortes"
                    name="pontosFortes"
                    rows={3}
                    defaultValue={a.pontosFortes ?? ''}
                  />
                </div>
                <div>
                  <Label htmlFor="pontosAtencao" className="mb-2">
                    Pontos de atenção
                  </Label>
                  <Textarea
                    id="pontosAtencao"
                    name="pontosAtencao"
                    rows={3}
                    defaultValue={a.pontosAtencao ?? ''}
                  />
                </div>
                <div>
                  <Button type="submit" disabled={salvando}>
                    Salvar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-sm">
                <p className="mb-2">
                  <span className="font-medium">Pontos fortes:</span>{' '}
                  {a.pontosFortes ?? '—'}
                </p>
                <p>
                  <span className="font-medium">Pontos de atenção:</span>{' '}
                  {a.pontosAtencao ?? '—'}
                </p>
              </div>
            )}
          </div>

          <div className="bg-card rounded-lg border p-5">
            <h2 className="mb-1 font-semibold">Plano de desenvolvimento (PDI)</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              As ações acordadas viram pendência do trimestre seguinte.
            </p>

            {a.acoes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma ação acordada.</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-3">
                {a.acoes.map((acao) => (
                  <li key={acao.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">{acao.acao}</p>
                      <Badge variant={acao.status === 'concluida' ? 'outline' : 'secondary'}>
                        {acao.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {acao.como ? `${acao.como} · ` : ''}
                      {acao.responsavel ? `${acao.responsavel} · ` : ''}
                      {acao.prazo ? `prazo ${formatarData(acao.prazo)}` : 'sem prazo'}
                    </p>

                    <div className="mt-2 flex gap-2">
                      {editavel ? (
                        <form action={removerAcao}>
                          <input type="hidden" name="id" value={acao.id} />
                          <input type="hidden" name="avaliacaoId" value={a.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Remover
                          </Button>
                        </form>
                      ) : null}

                      {podeEditar && !editavel && acao.status === 'aberta' ? (
                        <form action={concluirAcao}>
                          <input type="hidden" name="id" value={acao.id} />
                          <input type="hidden" name="avaliacaoId" value={a.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Marcar como concluída
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {editavel ? (
              <form
                action={(f) => {
                  f.set('avaliacaoId', a.id);
                  chamar(adicionarAcao, f);
                }}
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="sm:col-span-2">
                  <Label htmlFor="acao" className="mb-2">
                    Ação
                  </Label>
                  <Input id="acao" name="acao" required />
                </div>
                <div>
                  <Label htmlFor="como" className="mb-2">
                    Como
                  </Label>
                  <Input id="como" name="como" />
                </div>
                <div>
                  <Label htmlFor="responsavel" className="mb-2">
                    Responsável
                  </Label>
                  <Input id="responsavel" name="responsavel" />
                </div>
                <div>
                  <Label htmlFor="prazo" className="mb-2">
                    Prazo
                  </Label>
                  <Input id="prazo" name="prazo" type="date" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={salvando}>
                    Adicionar ação
                  </Button>
                </div>
              </form>
            ) : null}
          </div>

        </section>
      )}

      {/*
        Fora das abas, de propósito: a ciência é a única ação do supervisor, e
        escondê-la atrás de uma aba fazia com que ele não a encontrasse.
      */}
      <section className="bg-card flex flex-wrap items-center gap-3 rounded-lg border p-5">
        {editavel ? (
          <form
            action={(f) => {
              f.set('avaliacaoId', a.id);
              chamar(finalizarAvaliacao, f);
            }}
          >
            <Button type="submit" size="lg" disabled={salvando}>
              Finalizar avaliação
            </Button>
          </form>
        ) : null}

        {a.status === 'finalizada' && ehDono ? (
          <form
            action={(f) => {
              f.set('avaliacaoId', a.id);
              chamar(assinarAvaliacao, f);
            }}
          >
            <Button type="submit" size="lg">
              Dar ciência
            </Button>
          </form>
        ) : null}

        <p className="text-muted-foreground text-sm">
          {a.status === 'rascunho'
            ? 'Finalizar trava as notas. Ajuste depois disso só por nova avaliação.'
            : a.status === 'finalizada'
              ? ehDono
                ? 'Notas travadas. Confirme a ciência para encerrar.'
                : 'Notas travadas. Aguardando a ciência do supervisor.'
              : 'Avaliação com ciência registrada pelo supervisor.'}
        </p>
      </section>
    </div>
  );
}
