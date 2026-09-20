import { requireRole } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { proximaSemana, rotuloSemana, segundaDaSemana } from '@/lib/semana';
import { Grade } from './grade';
import { carregarSemana, supervisoresSelecionaveis } from './acoes';

export const metadata = { title: 'Programação — REG-061 Digital' };

type Props = {
  searchParams: Promise<{ semana?: string; supervisor?: string }>;
};

export default async function PaginaProgramacao({ searchParams }: Props) {
  const sessao = await requireRole('supervisor');
  const { semana, supervisor } = await searchParams;

  // Sem parâmetro, abre na semana seguinte: é ela que o supervisor monta.
  const alvo = /^\d{4}-\d{2}-\d{2}$/.test(semana ?? '')
    ? segundaDaSemana(semana!)
    : proximaSemana().inicio;

  const dados = await carregarSemana(alvo, supervisor ?? null);
  const supervisores = await supervisoresSelecionaveis();

  return (
    <>
      <CabecalhoPagina
        titulo="Programação da semana"
        descricao={`${rotuloSemana(dados.semana)} — ${dados.supervisorNome}. Clique na célula para marcar ou desmarcar a visita.`}
      />
      <Grade
        dados={dados}
        supervisores={supervisores}
        podeReabrir={sessao.papel !== 'supervisor'}
      />
    </>
  );
}
