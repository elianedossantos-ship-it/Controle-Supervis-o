import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { Vazio } from '@/components/vazio';
import { formatarNota, trimestreDe } from '@/lib/avaliacao';
import { formatarPercentual } from '@/lib/indicadores';
import { NovaAvaliacao } from './nova';
import { listarAvaliacoes, supervisoresAvaliaveis } from './acoes';

export const metadata = { title: 'Avaliações — REG-061 Digital' };

const COR_STATUS: Record<string, 'default' | 'secondary' | 'outline'> = {
  rascunho: 'secondary',
  finalizada: 'default',
  assinada: 'outline',
};

export default async function PaginaAvaliacoes() {
  const sessao = await requireRole('supervisor');
  const lista = await listarAvaliacoes();
  const ehCoordenacao = sessao.papel !== 'supervisor';
  const supervisores = ehCoordenacao ? await supervisoresAvaliaveis() : [];

  return (
    <>
      <CabecalhoPagina
        titulo="Avaliações"
        descricao={
          ehCoordenacao
            ? 'Avaliação trimestral de desempenho, quatro por ano.'
            : 'Suas avaliações. O rascunho do avaliador não aparece aqui.'
        }
      />

      {ehCoordenacao ? (
        <div className="mb-6">
          <NovaAvaliacao supervisores={supervisores} />
        </div>
      ) : null}

      {lista.length === 0 ? (
        <Vazio>
          {ehCoordenacao
            ? 'Nenhuma avaliação ainda. Abra a primeira acima.'
            : 'Nenhuma avaliação finalizada até aqui.'}
        </Vazio>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supervisor</TableHead>
                <TableHead>Trimestre</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Nota</TableHead>
                <TableHead className="text-right">Aproveitamento</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.supervisorNome}</TableCell>
                  <TableCell>{trimestreDe(a.periodoInicio).rotulo}</TableCell>
                  <TableCell>
                    <Badge variant={COR_STATUS[a.status] ?? 'secondary'}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarNota(a.notaFinal === null ? null : Number(a.notaFinal))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarPercentual(
                      a.aproveitamento === null ? null : Number(a.aproveitamento),
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.classificacao ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/avaliacoes/${a.id}`}>Abrir</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
