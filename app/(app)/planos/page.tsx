import { requireRole } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { Vazio } from '@/components/vazio';
import { CartaoDoPlano } from '@/components/planos/cartao';
import { hojeISO } from '@/lib/datas';
import { estaVencido } from '@/lib/planos';
import { FiltroDePlanos } from './filtros';
import { carregarPlano, contratosParaPlano, listarPlanos } from './acoes';
import { NovoPlano } from './novo';

export const metadata = { title: 'Planos de ação — REG-061 Digital' };

type Props = {
  searchParams: Promise<{ contrato?: string; situacao?: string }>;
};

export default async function PaginaPlanos({ searchParams }: Props) {
  const sessao = await requireRole('supervisor');
  const { contrato, situacao } = await searchParams;

  const apenasAbertos = situacao !== 'todos';
  const resumidos = await listarPlanos({
    contratoId: contrato || null,
    apenasAbertos,
  });

  const completos = (
    await Promise.all(resumidos.map((p) => carregarPlano(p.id)))
  ).filter((p): p is NonNullable<typeof p> => p !== null);

  const contratos = await contratosParaPlano();
  const hoje = hojeISO();
  const vencidos = completos.filter((p) => estaVencido(p, hoje)).length;

  return (
    <>
      <CabecalhoPagina
        titulo="Planos de ação"
        descricao="O plano nasce na visita, mas pertence ao contrato: reaparece na próxima ida à unidade."
        acao={
          <div className="flex items-center gap-2">
            {vencidos > 0 ? (
              <Badge variant="destructive">{vencidos} vencido{vencidos === 1 ? '' : 's'}</Badge>
            ) : null}
            <NovoPlano contratos={contratos} hoje={hoje} />
          </div>
        }
      />

      <FiltroDePlanos
        contratos={contratos}
        contratoId={contrato ?? ''}
        situacao={situacao ?? 'abertos'}
      />

      {completos.length === 0 ? (
        <Vazio>
          {apenasAbertos
            ? 'Nenhum plano aberto. Nada cobrando neste recorte.'
            : 'Nenhum plano neste recorte.'}
        </Vazio>
      ) : (
        <div className="flex flex-col gap-4">
          {completos.map((p) => (
            <CartaoDoPlano
              key={p.id}
              plano={p}
              hoje={hoje}
              ehCoordenacao={sessao.papel !== 'supervisor'}
            />
          ))}
        </div>
      )}
    </>
  );
}
