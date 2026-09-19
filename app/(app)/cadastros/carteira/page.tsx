import { requireRole } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { Vazio } from '@/components/vazio';
import { PainelCarteira } from './painel';
import { listarCarteiras } from './acoes';

export const metadata = { title: 'Carteira — REG-061 Digital' };

export default async function PaginaCarteira() {
  await requireRole('coordenador');
  const { supervisores, vinculos } = await listarCarteiras();

  return (
    <>
      <CabecalhoPagina
        titulo="Carteira"
        descricao="Um contrato tem um supervisor por vez. Mover fecha o vínculo anterior e abre o novo, preservando o histórico."
      />

      {supervisores.length === 0 ? (
        <Vazio>
          Nenhum supervisor ativo. Cadastre um em Supervisores antes de montar as carteiras.
        </Vazio>
      ) : (
        <PainelCarteira supervisores={supervisores} vinculos={vinculos} />
      )}
    </>
  );
}
