import { requireRole } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { Vazio } from '@/components/vazio';
import { Bloco, FiguraPrincipal } from '@/components/painel/figuras';
import { BarrasRanqueadas } from '@/components/painel/barras';
import { formatarData, formatarDataHora, hojeISO } from '@/lib/datas';
import { formatarDuracao, formatarPercentual, mesCorrente } from '@/lib/indicadores';
import { BarraDeFiltros } from './filtros';
import { NovaDemandaPainel } from './nova-demanda';
import { carregarPainel, type Filtros } from './acoes';

export const metadata = { title: 'Painel — REG-061 Digital' };

type Props = {
  searchParams: Promise<{
    inicio?: string;
    fim?: string;
    supervisor?: string;
    contrato?: string;
  }>;
};

const ehData = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? '');

export default async function PaginaPainel({ searchParams }: Props) {
  await requireRole('coordenador');
  const q = await searchParams;

  // Corte padrão: mês corrente (seção 7).
  const padrao = mesCorrente(hojeISO());
  const filtros: Filtros = {
    periodo: {
      inicio: ehData(q.inicio) ? q.inicio! : padrao.inicio,
      fim: ehData(q.fim) ? q.fim! : padrao.fim,
    },
    supervisorId: q.supervisor || null,
    contratoId: q.contrato || null,
  };

  const d = await carregarPainel(filtros);
  const t = d.totais;

  return (
    <>
      <CabecalhoPagina
        titulo="Painel"
        descricao={`${formatarData(filtros.periodo.inicio)} a ${formatarData(filtros.periodo.fim)}`}
      />

      <BarraDeFiltros
        filtros={filtros}
        supervisores={d.supervisores}
        contratos={d.contratos}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <FiguraPrincipal
          rotulo="Aderência no período"
          valor={formatarPercentual(t.aderencia)}
          apoio={
            t.programadas === 0
              ? 'Nenhuma visita programada no período.'
              : `${t.programadasRealizadas} de ${t.programadas} programadas, mais ${t.extrasRealizadas} extra${t.extrasRealizadas === 1 ? '' : 's'}.`
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Bloco
            rotulo="Visitas realizadas"
            valor={String(t.totalRealizadas)}
            apoio={`${t.previstas} ainda prevista${t.previstas === 1 ? '' : 's'}`}
          />
          <Bloco
            rotulo="Cancelamentos"
            valor={String(t.canceladas)}
            apoio={t.canceladas > 0 ? 'ver motivos abaixo' : 'nenhum no período'}
          />
          <Bloco
            rotulo="Visitas extras"
            valor={String(t.extrasRealizadas)}
            apoio={`${formatarPercentual(t.percentualExtras)} do total realizado`}
          />
          <Bloco
            rotulo="Contratos sem visita"
            valor={String(d.semVisita.length)}
            severidade={d.semVisita.length === 0 ? 'bom' : 'critico'}
            marca={d.semVisita.length === 0 ? 'nenhum contrato sem visita' : 'exige atenção'}
          />
          <Bloco
            rotulo="Fora da periodicidade"
            valor={String(d.periodicidade.fora)}
            severidade={d.periodicidade.fora === 0 ? 'bom' : 'critico'}
            marca={`${d.periodicidade.dentro} dentro do esperado`}
            apoio={
              d.periodicidade.naoAvaliados > 0
                ? `${d.periodicidade.naoAvaliados} sem período suficiente para avaliar`
                : undefined
            }
          />
          <Bloco
            rotulo="Registros sem localização"
            valor={String(d.semLocalizacao.length)}
            severidade={d.semLocalizacao.length === 0 ? 'bom' : 'critico'}
            marca={
              d.semLocalizacao.length === 0
                ? 'todas com GPS'
                : 'visita registrada sem GPS'
            }
          />
        </div>
      </div>

      {/* Prazos e obrigações (seção 8) */}
      <section className="mb-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Bloco
            rotulo="Cumprimento de prazos"
            valor={formatarPercentual(d.prazos.percentual)}
            severidade={
              d.prazos.percentual === null
                ? 'neutro'
                : d.prazos.percentual >= 90
                  ? 'bom'
                  : 'critico'
            }
            marca={`${d.prazos.atendidos} de ${d.prazos.aplicaveis} no prazo`}
            apoio={`${d.prazos.atendidosComAtraso} com atraso, que não contam aqui`}
          />
          <Bloco
            rotulo="Prazos em atraso"
            valor={String(d.prazos.emAtraso)}
            severidade={d.prazos.emAtraso === 0 ? 'bom' : 'critico'}
            marca={
              d.prazos.emAtraso === 0
                ? 'nada vencido'
                : 'vencidos pendentes ou não atendidos'
            }
          />
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h2 className="mb-1 font-semibold">Cumprimento por obrigação</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            &quot;Atendido com atraso&quot; tem coluna própria: entregar a folha no dia 9
            não é o mesmo que não entregar.
          </p>

          {d.prazos.porObrigacao.length === 0 ? (
            <Vazio>Nenhuma ocorrência de prazo no período.</Vazio>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obrigação</TableHead>
                  <TableHead className="text-right">No prazo</TableHead>
                  <TableHead className="text-right">Com atraso</TableHead>
                  <TableHead className="text-right">Não atendidas</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                  <TableHead className="text-right">Cumprimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.prazos.porObrigacao.map((o) => (
                  <TableRow key={o.nome}>
                    <TableCell className="font-medium">{o.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.cumprimento.atendidos}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.cumprimento.atendidosComAtraso}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.cumprimento.naoAtendidos}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.cumprimento.pendentes}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatarPercentual(o.cumprimento.percentual)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Bloco rotulo="Demandas abertas" valor={String(d.demandas.abertas)} />
        <Bloco rotulo="Demandas concluídas" valor={String(d.demandas.concluidas)} />
        <Bloco
          rotulo="Tempo médio até concluir"
          valor={formatarDuracao(d.demandas.horasMediaAteConcluir)}
          apoio="da criação até a conclusão"
        />
      </div>

      {/* Cancelamentos por motivo — o que mais tira o supervisor da rota */}
      <section className="mb-8 grid items-start gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-lg border p-5">
          <h2 className="mb-1 font-semibold">Cancelamentos por motivo</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Ranqueado — mostra o que mais tira o supervisor da rota.
          </p>
          <BarrasRanqueadas
            titulo="Cancelamentos por motivo, ranqueado"
            itens={d.motivos.itens.map((m) => ({
              rotulo: m.descricao,
              valor: m.quantidade,
              percentual: m.percentual,
              detalhe: m.categoria,
            }))}
          />
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h2 className="mb-1 font-semibold">Cancelamentos do período</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            A mesma informação em tabela, visita a visita.
          </p>

          {d.cancelamentos.length === 0 ? (
            <Vazio>Nenhum cancelamento no período.</Vazio>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.cancelamentos.map((c) => (
                  <TableRow key={c.visitaId}>
                    <TableCell className="whitespace-nowrap">{formatarData(c.data)}</TableCell>
                    <TableCell>{c.contratoNome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.supervisorNome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.motivo ?? '—'}
                      {c.motivoOutro ? ` — ${c.motivoOutro}` : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Aderência por supervisor e por contrato */}
      <section className="mb-8 grid items-start gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-lg border p-5">
          <h2 className="mb-4 font-semibold">Aderência por supervisor</h2>
          {d.porSupervisor.length === 0 ? (
            <Vazio>Sem visitas no período.</Vazio>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supervisor</TableHead>
                  <TableHead className="text-right">Programadas</TableHead>
                  <TableHead className="text-right">Realizadas</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Aderência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.porSupervisor.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.programadas}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.programadasRealizadas}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.extrasRealizadas}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatarPercentual(l.aderencia)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h2 className="mb-1 font-semibold">Cumprimento da periodicidade</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Esperado no período conforme a periodicidade do contrato. Os fora vêm primeiro.
          </p>
          {d.periodicidade.detalhe.length === 0 ? (
            <Vazio>Período curto demais para cobrar periodicidade.</Vazio>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Realizadas</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.periodicidade.detalhe.map((c) => (
                  <TableRow key={c.contratoId}>
                    <TableCell className="font-medium">{c.contratoNome}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.periodicidade}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.esperado}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.realizadas}</TableCell>
                    <TableCell>
                      {c.dentro ? (
                        <Badge variant="outline">Dentro</Badge>
                      ) : (
                        <Badge variant="destructive">Fora</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Listas que exigem ação */}
      <section className="mb-8 grid items-start gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-lg border p-5">
          <h2 className="mb-4 font-semibold">Contratos sem visita no período</h2>
          {d.semVisita.length === 0 ? (
            <Vazio>Todo contrato ativo recebeu ao menos uma visita.</Vazio>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Supervisor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.semVisita.map((c) => (
                  <TableRow key={c.contratoId}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.periodicidade}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.supervisorNome ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h2 className="mb-1 font-semibold">Visitas registradas sem localização</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            A visita vale: o GPS pode ter falhado dentro do prédio.
          </p>
          {d.semLocalizacao.length === 0 ? (
            <Vazio>Todas as visitas realizadas têm GPS.</Vazio>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.semLocalizacao.map((v) => (
                  <TableRow key={v.visitaId}>
                    <TableCell className="whitespace-nowrap">{formatarData(v.data)}</TableCell>
                    <TableCell>{v.contratoNome}</TableCell>
                    <TableCell className="text-muted-foreground">{v.supervisorNome}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {v.realizadaEm ? formatarDataHora(new Date(v.realizadaEm)) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="mb-8">
        <NovaDemandaPainel supervisores={d.supervisores} />
      </section>

      <p className="text-muted-foreground text-xs">
        Evolução trimestral e planos de ação entram junto com os módulos das seções 9 e 10.
      </p>
    </>
  );
}
