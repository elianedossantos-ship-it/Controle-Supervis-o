import { requireRole } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { FormularioContrato } from '../formulario';
import { criarContrato } from '../acoes';

export const metadata = { title: 'Novo contrato — REG-061 Digital' };

export default async function PaginaNovoContrato() {
  await requireRole('coordenador');

  return (
    <>
      <CabecalhoPagina
        titulo="Novo contrato"
        descricao="A unidade do cliente que o supervisor visita."
      />
      <FormularioContrato acao={criarContrato} />
    </>
  );
}
