import { requireRole } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { Vazio } from '@/components/vazio';
import { formatarData, hojeISO } from '@/lib/datas';
import { ListaDeVisitas } from './lista';
import { VisitaExtra } from './extra';
import { NovaDemanda } from './nova-demanda';
import { SeletorDeDia } from './seletor';
import { carregarMeuDia, concluirDemanda, marcarDemandasLidas } from './acoes';

export const metadata = { title: 'Meu dia — REG-061 Digital' };

const COR_PRIORIDADE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  normal: 'secondary',
  alta: 'default',
  urgente: 'destructive',
};

type Props = {
  searchParams: Promise<{ dia?: string; supervisor?: string }>;
};

export default async function PaginaMeuDia({ searchParams }: Props) {
  const sessao = await requireRole('supervisor');
  const { dia, supervisor } = await searchParams;

  const alvo = /^\d{4}-\d{2}-\d{2}$/.test(dia ?? '') ? dia! : hojeISO();
  const dados = await carregarMeuDia(alvo, supervisor ?? null);

  // Abrir o Meu dia conta como leitura da demanda: o painel mede daqui o tempo
  // até a conclusão.
  if (sessao.papel === 'supervisor' && dados.demandas.length > 0) {
    await marcarDemandasLidas(dados.supervisorId);
  }

  // As ações de execução são do supervisor dono do dia. A coordenação
  // acompanha e cria demandas, mas quem registra e cancela é quem foi a campo
  // (seção 4.3: cancelar é "apenas pelo supervisor dono da visita").
  const podeAgir = sessao.usuarioId === dados.supervisorId;
  const ehCoordenacao = sessao.papel !== 'supervisor';
  const abertas = dados.visitas.filter((v) => v.status === 'prevista').length;

  return (
    <>
      <CabecalhoPagina
        titulo="Meu dia"
        descricao={`${formatarData(alvo)} — ${dados.supervisorNome}. ${
          abertas === 0
            ? 'Nenhuma visita em aberto.'
            : `${abertas} visita${abertas === 1 ? '' : 's'} em aberto.`
        }`}
      />

      <SeletorDeDia dia={alvo} supervisorId={dados.supervisorId} mostraSupervisor={ehCoordenacao} />

      {ehCoordenacao && !podeAgir ? (
        <div className="mb-6">
          <NovaDemanda
            supervisorId={dados.supervisorId}
            supervisorNome={dados.supervisorNome}
            contratos={dados.contratosDaCarteira}
            dia={alvo}
          />
        </div>
      ) : null}

      {/* Demandas extras primeiro: é o que a coordenação pediu para hoje. */}
      {dados.demandas.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold tracking-wide uppercase">
            Demandas da coordenação
          </h2>
          <div className="flex flex-col gap-3">
            {dados.demandas.map((d) => (
              <article
                key={d.id}
                className="border-primary/40 bg-primary/5 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{d.descricao}</p>
                  {d.prioridade ? (
                    <Badge variant={COR_PRIORIDADE[d.prioridade] ?? 'secondary'}>
                      {d.prioridade}
                    </Badge>
                  ) : null}
                </div>

                <p className="text-muted-foreground mt-1 text-sm">
                  {d.contratoNome ? `${d.contratoNome} · ` : ''}
                  {d.dataAlvo ? `para ${formatarData(d.dataAlvo)} · ` : ''}
                  de {d.criadaPor}
                </p>

                {podeAgir ? (
                  <form action={concluirDemanda} className="mt-3">
                    <input type="hidden" name="id" value={d.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Marcar como concluída
                    </Button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold tracking-wide uppercase">
          Visitas de {formatarData(alvo)}
        </h2>

        {dados.visitas.length === 0 ? (
          <Vazio>
            Nenhuma visita para este dia. Se precisar ir a uma unidade fora da
            programação, lance uma visita extra.
          </Vazio>
        ) : (
          <ListaDeVisitas dados={dados} podeAgir={podeAgir} />
        )}
      </section>

      {podeAgir ? (
        <VisitaExtra contratos={dados.contratosDaCarteira} dia={alvo} />
      ) : null}
    </>
  );
}
