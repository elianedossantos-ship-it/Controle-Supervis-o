import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { FormularioContrato } from '../formulario';
import { atualizarContrato, buscarContrato } from '../acoes';

export const metadata = { title: 'Editar contrato — REG-061 Digital' };

export default async function PaginaEditarContrato({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('coordenador');
  const { id } = await params;

  const encontrado = await buscarContrato(id);
  if (!encontrado) notFound();

  return (
    <>
      <CabecalhoPagina
        titulo={encontrado.contrato.nome}
        descricao={encontrado.contrato.endereco}
      />
      <FormularioContrato
        acao={atualizarContrato}
        contrato={encontrado.contrato}
        contatos={encontrado.contatos}
      />
    </>
  );
}
