import { requireRole, sessaoAtual } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { FormularioUsuario } from '../formulario';
import { criarUsuario } from '../acoes';

export const metadata = { title: 'Novo usuário — REG-061 Digital' };

export default async function PaginaNovoUsuario() {
  await requireRole('coordenador');
  const sessao = await sessaoAtual();

  return (
    <>
      <CabecalhoPagina titulo="Novo usuário" descricao="Supervisor, coordenador ou admin." />
      <FormularioUsuario acao={criarUsuario} podeGerir={sessao?.papel === 'admin'} />
    </>
  );
}
