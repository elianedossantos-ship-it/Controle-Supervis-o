import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { FormularioAvaliacao } from './formulario';
import { carregarAvaliacao } from '../acoes';

export const metadata = { title: 'Avaliação — REG-061 Digital' };

export default async function PaginaAvaliacao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await requireRole('supervisor');
  const { id } = await params;

  const a = await carregarAvaliacao(id);
  if (!a) notFound();

  return (
    <>
      <CabecalhoPagina
        titulo={a.supervisorNome}
        descricao={`${a.rotuloPeriodo} · modelo ${a.versaoModelo} · avaliador ${a.avaliadorNome}`}
        acao={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{a.status}</Badge>
            <Button variant="outline" asChild>
              <a href={`/api/exportar/avaliacao?id=${a.id}`} download>
                Baixar PDF
              </a>
            </Button>
          </div>
        }
      />

      <FormularioAvaliacao
        a={a}
        podeEditar={sessao.papel !== 'supervisor'}
        ehDono={sessao.usuarioId === a.supervisorId}
      />
    </>
  );
}
