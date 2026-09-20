import { requireRole } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { hojeISO } from '@/lib/datas';
import { GradeDePrazos } from './grade';
import { carregarPrazos } from './acoes';

export const metadata = { title: 'Prazos — REG-061 Digital' };

type Props = { searchParams: Promise<{ mes?: string }> };

export default async function PaginaPrazos({ searchParams }: Props) {
  const sessao = await requireRole('supervisor');
  const { mes } = await searchParams;

  const alvo = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? '') ? mes! : hojeISO().slice(0, 7);
  const dados = await carregarPrazos(alvo);
  const ehCoordenacao = sessao.papel !== 'supervisor';

  return (
    <>
      <CabecalhoPagina
        titulo="Prazos"
        descricao={
          ehCoordenacao
            ? 'Obrigações nas linhas, supervisores nas colunas. Clique numa célula para marcar.'
            : 'Suas obrigações do mês. A marcação é da coordenação; aqui é só leitura.'
        }
      />
      <GradeDePrazos dados={dados} podeMarcar={ehCoordenacao} />
    </>
  );
}
