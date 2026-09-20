'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatarData, formatarDataHora } from '@/lib/datas';
import { ESPERADO } from '@/lib/periodicidade';
import { DIAS_CURTOS, rotuloSemana, somarDias } from '@/lib/semana';
import { rotuloDoDia } from '@/lib/feriados-aplicaveis';
import {
  reabrirProgramacao,
  salvarSemana,
  type DadosDaSemana,
  type EstadoProgramacao,
} from './acoes';

type Props = {
  dados: DadosDaSemana;
  supervisores: { id: string; nome: string }[];
  podeReabrir: boolean;
};

const chaveCelula = (contratoId: string, dia: string) => `${contratoId}|${dia}`;

export function Grade({ dados, supervisores, podeReabrir }: Props) {
  const router = useRouter();
  const [estado, salvar] = useActionState<EstadoProgramacao, FormData>(salvarSemana, {});

  const iniciais = useMemo(() => {
    const set = new Set<string>();
    for (const c of dados.contratos) {
      for (const dia of c.marcados) set.add(chaveCelula(c.contratoId, dia));
    }
    return set;
  }, [dados.contratos]);

  const [marcadas, setMarcadas] = useState<Set<string>>(iniciais);

  const enviada = dados.status === 'enviada';

  /*
   * Decisão 13.1: a janela da semana abre na quinta e fecha às 18h da sexta.
   * A coordenação passa por cima em qualquer horário — é ela quem reabre.
   */
  const travada = dados.janela === 'fechada' && !podeReabrir;
  const somenteLeitura = enviada || travada;

  const sujo = useMemo(() => {
    if (marcadas.size !== iniciais.size) return true;
    for (const k of marcadas) if (!iniciais.has(k)) return true;
    return false;
  }, [marcadas, iniciais]);

  function alternar(contratoId: string, dia: string, bloqueado: boolean) {
    if (somenteLeitura || bloqueado) return;
    const k = chaveCelula(contratoId, dia);
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(k)) novo.delete(k);
      else novo.add(k);
      return novo;
    });
  }

  // Realizada e extra são visitas do dia como qualquer outra: entram na conta.
  const fixasPorDia = (dia: string) =>
    dados.contratos.reduce(
      (n, c) =>
        n + (c.realizados.includes(dia) ? 1 : 0) + (c.extras.includes(dia) ? 1 : 0),
      0,
    );

  const porDia = dados.semana.dias.map(
    (dia) => [...marcadas].filter((k) => k.endsWith(`|${dia}`)).length + fixasPorDia(dia),
  );
  const total = porDia.reduce((a, b) => a + b, 0);

  const marcadasDoContrato = (contratoId: string) => {
    const c = dados.contratos.find((x) => x.contratoId === contratoId);
    const fixas = (c?.realizados.length ?? 0) + (c?.extras.length ?? 0);
    return [...marcadas].filter((k) => k.startsWith(`${contratoId}|`)).length + fixas;
  };

  /**
   * O aviso na linha acompanha os cliques. A parte que depende de histórico
   * (quinzenal e mensal) vem do servidor; a contagem da semana é conferida
   * aqui, senão o aviso continuaria vermelho depois de a célula ser marcada.
   */
  function foraDaPeriodicidade(c: (typeof dados.contratos)[number]): boolean {
    const n = marcadasDoContrato(c.contratoId);
    if (c.periodicidade === 'SEMANAL') return n === 0;
    if (c.periodicidade === '2X NA SEMANA') return n < 2;
    return n === 0 && dados.avisos.some((a) => a.contratoId === c.contratoId);
  }

  function irPara(semanaInicio: string) {
    const params = new URLSearchParams({ semana: semanaInicio });
    if (supervisores.length > 0) params.set('supervisor', dados.supervisorId);
    router.push(`/programacao?${params.toString()}`);
  }

  const avisosVisiveis = estado.avisosPendentes ?? null;

  return (
    <>
      {/* Navegação de semana e de supervisor */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => irPara(somarDias(dados.semana.inicio, -7))}>
            ← Semana anterior
          </Button>
          <Button variant="outline" size="sm" onClick={() => irPara(somarDias(dados.semana.inicio, 7))}>
            Próxima semana →
          </Button>
        </div>

        {supervisores.length > 0 ? (
          <Select
            aria-label="Supervisor"
            className="h-9 w-56"
            value={dados.supervisorId}
            onChange={(e) =>
              router.push(
                `/programacao?semana=${dados.semana.inicio}&supervisor=${e.target.value}`,
              )
            }
          >
            {supervisores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {enviada ? (
        <Alert className="mb-6">
          <AlertDescription>
            <p className="font-medium">
              Programação enviada
              {dados.enviadaEm ? ` em ${formatarDataHora(new Date(dados.enviadaEm))}` : ''}.
            </p>
            <p>
              Ela não pode mais ser editada. Daqui em diante o supervisor registra a visita
              como realizada, cancela com motivo ou lança visita extra.
            </p>
            {dados.avisosNoEnvio && dados.avisosNoEnvio.length > 0 ? (
              <p className="mt-2">
                Foi enviada com {dados.avisosNoEnvio.length} contrato
                {dados.avisosNoEnvio.length === 1 ? '' : 's'} fora da periodicidade:{' '}
                {dados.avisosNoEnvio.map((a) => a.contratoNome).join(', ')}.
              </p>
            ) : null}
            {podeReabrir ? (
              <form action={reabrirProgramacao} className="mt-3">
                <input type="hidden" name="supervisorId" value={dados.supervisorId} />
                <input type="hidden" name="semanaInicio" value={dados.semana.inicio} />
                <Button type="submit" size="sm" variant="outline">
                  Reabrir para edição
                </Button>
              </form>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!enviada ? (
        <Alert variant={travada ? 'destructive' : 'default'} className="mb-6">
          <AlertDescription>
            <p className="font-medium">
              {travada ? 'Janela fechada' : 'Prazo desta semana'}
            </p>
            <p>{dados.textoJanela}</p>
            {travada ? (
              <>
                <p className="mt-1">
                  Fale com a coordenação: ela edita e envia esta semana a qualquer hora.
                </p>
                {/* Tela travada sem saída é beco: a semana seguinte ainda é sua. */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => irPara(somarDias(dados.semana.inicio, 7))}
                >
                  Montar a semana seguinte
                </Button>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {estado.erro ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      {estado.enviado ? (
        <Alert className="mb-6">
          <AlertDescription>Programação enviada.</AlertDescription>
        </Alert>
      ) : null}

      {dados.contratos.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Nenhum contrato ativo na carteira deste supervisor. Monte a carteira antes de
          programar a semana.
        </div>
      ) : (
        <form action={salvar}>
          <input type="hidden" name="semanaInicio" value={dados.semana.inicio} />
          <input type="hidden" name="supervisorId" value={dados.supervisorId} />
          {[...marcadas].map((k) => (
            <input key={k} type="hidden" name="celula" value={k} />
          ))}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="bg-card sticky left-0 z-10 min-w-[16rem] px-3 py-2 text-left font-medium">
                    Contrato
                  </th>
                  {dados.semana.dias.map((dia, i) => {
                    const feriado = rotuloDoDia(dados.feriados, dia);
                    return (
                      <th key={dia} className="min-w-[6rem] px-2 py-2 text-center font-medium">
                        <div>{DIAS_CURTOS[i]}</div>
                        <div className="text-muted-foreground text-xs font-normal">
                          {formatarData(dia).slice(0, 5)}
                        </div>
                        {feriado ? (
                          <div className="text-destructive mt-1 text-xs font-normal">
                            {feriado}
                          </div>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {dados.contratos.map((c) => {
                  const temAviso = foraDaPeriodicidade(c);
                  return (
                    <tr key={c.contratoId} className="border-b last:border-0">
                      <td className="bg-card sticky left-0 z-10 px-3 py-2">
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="secondary">{c.periodicidade}</Badge>
                          <span>
                            {c.ultimaRealizada
                              ? `última visita em ${formatarData(c.ultimaRealizada)}`
                              : 'sem visita realizada'}
                          </span>
                        </p>
                        {temAviso ? (
                          <p className="text-destructive text-xs">
                            fora da periodicidade — {ESPERADO[c.periodicidade]}
                          </p>
                        ) : null}
                      </td>

                      {dados.semana.dias.map((dia) => {
                        const bloqueado = c.bloqueados.includes(dia);
                        const realizada = c.realizados.includes(dia);
                        const extra = c.extras.includes(dia);
                        const marcado = marcadas.has(chaveCelula(c.contratoId, dia));

                        // Visita já realizada ou extra não se desprograma pela
                        // montagem da semana: a célula mostra o que houve e fica fixa.
                        const fixa = realizada || extra;
                        const letra = bloqueado
                          ? 'F'
                          : realizada
                            ? 'R'
                            : extra
                              ? 'E'
                              : marcado
                                ? 'P'
                                : '';

                        const explicacao = bloqueado
                          ? 'Feriado: dia não recebe programação'
                          : realizada
                            ? 'Visita já realizada'
                            : extra
                              ? 'Visita extra, lançada no registro diário'
                              : undefined;

                        return (
                          <td key={dia} className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => alternar(c.contratoId, dia, bloqueado || fixa)}
                              disabled={bloqueado || fixa || somenteLeitura}
                              aria-pressed={marcado || fixa}
                              aria-label={`${c.nome} em ${formatarData(dia)}${explicacao ? ` (${explicacao})` : ''}`}
                              title={explicacao}
                              className={cn(
                                'flex h-11 w-full items-center justify-center rounded-md border text-sm font-semibold transition-colors',
                                bloqueado
                                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                  : realizada
                                    ? 'bg-secondary text-secondary-foreground cursor-not-allowed'
                                    : extra
                                      ? 'bg-secondary text-secondary-foreground cursor-not-allowed'
                                      : marcado
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'hover:bg-accent',
                                somenteLeitura && !bloqueado && !fixa ? 'cursor-default' : '',
                              )}
                            >
                              {letra}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-muted/40 border-t">
                  <td className="bg-muted/40 sticky left-0 z-10 px-3 py-2 font-medium">
                    {total} visita{total === 1 ? '' : 's'} na semana
                  </td>
                  {porDia.map((n, i) => (
                    <td key={i} className="px-2 py-2 text-center font-medium tabular-nums">
                      {n}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Avisos de periodicidade */}
          {!enviada && !travada ? (
            <div className="mt-6">
              {avisosVisiveis && avisosVisiveis.length > 0 ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    <p className="font-medium">
                      {avisosVisiveis.length === 1
                        ? '1 contrato fora da periodicidade'
                        : `${avisosVisiveis.length} contratos fora da periodicidade`}
                    </p>
                    <ul className="mt-2 list-inside list-disc">
                      {avisosVisiveis.map((a) => (
                        <li key={a.contratoId}>
                          <span className="font-medium">{a.contratoNome}</span> ({a.periodicidade}) — {a.motivo}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      O rascunho foi salvo. Você pode ajustar a grade ou enviar assim mesmo —
                      a decisão fica registrada.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : dados.avisos.length > 0 && !sujo ? (
                <Alert className="mb-4">
                  <AlertDescription>
                    <p className="font-medium">
                      {dados.avisos.length === 1
                        ? '1 contrato fora da periodicidade'
                        : `${dados.avisos.length} contratos fora da periodicidade`}
                    </p>
                    <ul className="mt-2 list-inside list-disc">
                      {dados.avisos.map((a) => (
                        <li key={a.contratoId}>
                          <span className="font-medium">{a.contratoNome}</span> — {a.motivo}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              {/*
                O valor vai no FormData pelo botão que foi clicado, e não por
                estado do React: estado atualizado no onClick não chega a tempo
                do submit.
              */}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" name="acao" value="rascunho" variant="outline" size="lg">
                  Salvar rascunho
                </Button>

                {avisosVisiveis && avisosVisiveis.length > 0 ? (
                  <Button type="submit" name="acao" value="enviar-confirmado" size="lg">
                    Enviar assim mesmo
                  </Button>
                ) : (
                  <Button type="submit" name="acao" value="enviar" size="lg">
                    Enviar programação
                  </Button>
                )}

                {sujo ? (
                  <span className="text-muted-foreground text-sm">
                    Alterações ainda não salvas.
                  </span>
                ) : estado.salvo && !estado.avisosPendentes ? (
                  <span className="text-muted-foreground text-sm">Rascunho salvo.</span>
                ) : null}
              </div>

              <p className="text-muted-foreground mt-3 text-xs">
                <strong>P</strong> programada · <strong>R</strong> realizada ·{' '}
                <strong>E</strong> extra · <strong>F</strong> feriado. Sábado, domingo e
                feriado não recebem programação. Visita realizada ou extra não se
                desmarca aqui. Enviada, a programação não pode mais ser editada. A semana
                fecha na sexta às 18h.
              </p>
            </div>
          ) : null}
        </form>
      )}

      <p className="text-muted-foreground mt-6 text-xs">
        Semana de {rotuloSemana(dados.semana)}.
      </p>
    </>
  );
}
