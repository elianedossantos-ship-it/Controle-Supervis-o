import { notFound } from 'next/navigation';
import { requireRole, sessaoAtual } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { FormularioUsuario } from '../formulario';
import { FormularioSenha } from './formulario-senha';
import { atualizarUsuario, buscarUsuario } from '../acoes';

export const metadata = { title: 'Editar usuário — REG-061 Digital' };

export default async function PaginaEditarUsuario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('coordenador');
  const { id } = await params;

  const usuario = await buscarUsuario(id);
  if (!usuario) notFound();

  const sessao = await sessaoAtual();
  const ehAdmin = sessao?.papel === 'admin';

  return (
    <>
      <CabecalhoPagina titulo={usuario.nome} descricao={usuario.email} />

      <FormularioUsuario
        acao={atualizarUsuario}
        usuario={usuario}
        podeGerir={ehAdmin}
      />

      {ehAdmin ? (
        <div className="mt-10 max-w-2xl border-t pt-6">
          <FormularioSenha id={usuario.id} />
        </div>
      ) : null}
    </>
  );
}
