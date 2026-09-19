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
import { listarContratos } from './acoes';

export const metadata = { title: 'Contratos — REG-061 Digital' };

export default async function PaginaContratos() {
  await requireRole('coordenador');
  const lista = await listarContratos();

  return (
    <>
      <CabecalhoPagina
        titulo="Contratos"
        descricao={`${lista.length} cadastrados. As colunas seguem o REG-061: cliente, endereço e periodicidade.`}
        acao={
          <Button asChild>
            <Link href="/cadastros/contratos/novo">Novo contrato</Link>
          </Button>
        }
      />

      {lista.length === 0 ? (
        <Vazio>Nenhum contrato cadastrado ainda.</Vazio>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead className="hidden lg:table-cell">Escopo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((contrato) => (
                <TableRow key={contrato.id}>
                  <TableCell className="font-medium">{contrato.nome}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[22rem]">
                    {contrato.endereco}
                    {contrato.cidade ? (
                      <span className="block text-xs">
                        {contrato.cidade}
                        {contrato.uf ? `/${contrato.uf}` : ''}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{contrato.periodicidade}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(contrato.escopo ?? []).map((e) => (
                        <Badge key={e} variant="outline">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {contrato.ativo ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/cadastros/contratos/${contrato.id}`}>Editar</Link>
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
