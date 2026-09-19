import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { ROTULO_PAPEL, type Papel } from '@/lib/papeis';
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
import { listarUsuarios } from './acoes';

export const metadata = { title: 'Supervisores — REG-061 Digital' };

export default async function PaginaSupervisores() {
  await requireRole('coordenador');
  const lista = await listarUsuarios();

  return (
    <>
      <CabecalhoPagina
        titulo="Supervisores"
        descricao="Quem acessa o sistema, e com qual papel."
        acao={
          <Button asChild>
            <Link href="/cadastros/supervisores/novo">Novo usuário</Link>
          </Button>
        }
      />

      {lista.length === 0 ? (
        <Vazio>Nenhum usuário cadastrado ainda.</Vazio>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead className="hidden sm:table-cell">WhatsApp</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {u.telefone ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {u.whatsapp ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROTULO_PAPEL[u.papel as Papel]}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.ativo ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/cadastros/supervisores/${u.id}`}>Editar</Link>
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
