'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Campo } from '@/components/campo';
import { BotaoSalvar } from '@/components/botao-salvar';
import { conferirPlanilha, importar, type Previa, type ResultadoImportacao } from './acoes';

const ROTULO: Record<string, string> = {
  criar: 'Importar',
  ja_existe: 'Já existe',
  ignorar: 'Ignorar',
};

export function PainelImportacao({ supervisores }: { supervisores: { nome: string }[] }) {
  const router = useRouter();
  const [previa, conferir] = useActionState<Previa, FormData>(conferirPlanilha, {});
  const [resultado, gravar] = useActionState<ResultadoImportacao, FormData>(importar, {});
  const [mostrarTudo, setMostrarTudo] = useState(false);

  if (resultado.ok) {
    return (
      <Alert>
        <AlertDescription className="gap-2">
          <p className="font-medium">Importação concluída.</p>
          <p>
            {resultado.criados} contrato{resultado.criados === 1 ? '' : 's'} criado
            {resultado.criados === 1 ? '' : 's'}, {resultado.vinculados} vinculado
            {resultado.vinculados === 1 ? '' : 's'} a uma carteira
            {resultado.pulados ? `, ${resultado.pulados} já existente(s)` : ''}.
          </p>
          <div className="mt-3 flex gap-3">
            <Button size="sm" onClick={() => router.push('/cadastros/contratos')}>
              Ver contratos
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push('/cadastros/carteira')}>
              Ver carteiras
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const itens = previa.itens ?? [];
  const importaveis = itens.filter((i) => i.situacao === 'criar');
  const visiveis = mostrarTudo ? itens : itens.slice(0, 15);

  return (
    <div className="flex flex-col gap-8">
      <form action={conferir} className="flex max-w-xl flex-col gap-5">
        <Campo
          id="arquivo"
          rotulo="Arquivo do REG-061"
          obrigatorio
          erro={previa.erro}
          dica="Formato .xlsx, uma aba por supervisor. Nada é gravado agora: primeiro você confere."
        >
          <Input
            id="arquivo"
            name="arquivo"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="h-auto py-2"
          />
        </Campo>

        <div>
          <BotaoSalvar>Conferir planilha</BotaoSalvar>
        </div>
      </form>

      {previa.avisos && previa.avisos.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium">Leitura da planilha</p>
            <ul className="list-inside list-disc">
              {previa.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {itens.length > 0 && previa.resumo ? (
        <section>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge>{previa.resumo.criar} a importar</Badge>
            {previa.resumo.jaExistem > 0 ? (
              <Badge variant="secondary">{previa.resumo.jaExistem} já existem</Badge>
            ) : null}
            {previa.resumo.ignorar > 0 ? (
              <Badge variant="destructive">{previa.resumo.ignorar} com problema</Badge>
            ) : null}
            {previa.resumo.semSupervisor > 0 ? (
              <Badge variant="outline">{previa.resumo.semSupervisor} sem carteira</Badge>
            ) : null}
          </div>

          {previa.resumo.semSupervisor > 0 ? (
            <Alert className="mb-4">
              <AlertDescription>
                Alguns contratos entram sem supervisor porque o nome da aba não bate com
                nenhum supervisor ativo. Cadastrados hoje:{' '}
                {supervisores.length > 0
                  ? supervisores.map((s) => s.nome).join(', ')
                  : 'nenhum'}
                . Você pode cadastrar o supervisor e importar de novo, ou atribuir depois
                na tela de Carteira.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((item) => (
                  <TableRow
                    key={`${item.aba}-${item.linha}`}
                    className={item.situacao !== 'criar' ? 'opacity-60' : undefined}
                  >
                    <TableCell className="font-medium">{item.cliente}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[18rem]">
                      {item.endereco || '—'}
                    </TableCell>
                    <TableCell>{item.periodicidade || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.supervisorId ? (
                        item.supervisorNome
                      ) : (
                        <span className="text-destructive">
                          {item.supervisorNome ?? '—'} (não cadastrado)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.situacao === 'criar'
                            ? 'default'
                            : item.situacao === 'ja_existe'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {ROTULO[item.situacao]}
                      </Badge>
                      {item.observacao ? (
                        <p className="text-muted-foreground mt-1 text-xs">{item.observacao}</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {itens.length > visiveis.length ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setMostrarTudo(true)}
            >
              Ver as {itens.length} linhas
            </Button>
          ) : null}

          {resultado.erro ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{resultado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <form action={gravar} className="mt-6">
            <input
              type="hidden"
              name="itens"
              value={JSON.stringify(
                importaveis.map((i) => ({
                  cliente: i.cliente,
                  endereco: i.endereco,
                  periodicidade: i.periodicidade,
                  supervisorId: i.supervisorId,
                })),
              )}
            />
            <BotaoSalvar>
              Importar {importaveis.length} contrato{importaveis.length === 1 ? '' : 's'}
            </BotaoSalvar>
            {importaveis.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Nada a importar nesta planilha.
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
