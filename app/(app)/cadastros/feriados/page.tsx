import { requireRole } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { formatarData, hojeISO } from '@/lib/datas';
import { ROTULO_ABRANGENCIA, type Abrangencia } from '@/lib/feriados';
import { FormularioFeriado } from './formulario';
import { excluirFeriado, listarFeriados } from './acoes';

export const metadata = { title: 'Feriados — REG-061 Digital' };

export default async function PaginaFeriados() {
  await requireRole('coordenador');

  const lista = await listarFeriados();
  const hoje = hojeISO();

  return (
    <>
      <CabecalhoPagina
        titulo="Feriados"
        descricao="Dia com feriado não recebe programação e sai marcado com F no REG-061."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {lista.length === 0 ? (
            <Vazio>Nenhum feriado cadastrado.</Vazio>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Abrangência</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((f) => (
                    <TableRow key={f.id} className={f.data < hoje ? 'opacity-60' : undefined}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatarData(f.data)}
                      </TableCell>
                      <TableCell>{f.descricao}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ROTULO_ABRANGENCIA[f.abrangencia as Abrangencia]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.municipio ? `${f.municipio}/${f.uf}` : (f.uf ?? '—')}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={excluirFeriado}>
                          <input type="hidden" name="id" value={f.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Excluir
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Novo feriado</CardTitle>
            <CardDescription>Nacional, estadual ou municipal.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioFeriado />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
