'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Campo } from '@/components/campo';
import { BotaoSalvar } from '@/components/botao-salvar';
import { PERIODICIDADES } from '@/lib/contratos';
import { UFS } from '@/lib/uf';
import type { EstadoForm } from '@/lib/formulario';

type Contrato = {
  id: string;
  nome: string;
  endereco: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  periodicidade: string;
  escopo: string[] | null;
  observacoes: string | null;
  ativo: boolean;
};

type Contato = {
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  principal: boolean;
};

type Props = {
  acao: (estado: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  contrato?: Contrato;
  contatos?: Contato[];
};

const CONTATO_VAZIO: Contato = {
  nome: '',
  cargo: null,
  telefone: null,
  email: null,
  principal: false,
};

export function FormularioContrato({ acao, contrato, contatos = [] }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {});
  const c = estado.campos;

  // Reconstrói as linhas de contato a partir do que foi enviado, para uma
  // validação recusada não apagar os contatos já digitados.
  const contatosIniciais: Contato[] = c
    ? (c.contato_nome as string[] | undefined)?.map((nome, i) => ({
        nome,
        cargo: (c.contato_cargo as string[])?.[i] ?? null,
        telefone: (c.contato_telefone as string[])?.[i] ?? null,
        email: (c.contato_email as string[])?.[i] ?? null,
        principal: ((c.contato_principal as string[]) ?? []).includes(String(i)),
      })) ?? []
    : contatos;

  const [linhas, setLinhas] = useState<Contato[]>(
    contatosIniciais.length > 0 ? contatosIniciais : [CONTATO_VAZIO],
  );

  const valor = (campo: string, padrao = '') => {
    const digitado = c?.[campo];
    if (typeof digitado === 'string') return digitado;
    return padrao;
  };

  const escopoInicial = c
    ? valor('escopo')
    : (contrato?.escopo ?? []).join(', ');

  const ativo = c ? c.ativo === 'on' : (contrato?.ativo ?? true);

  return (
    <form action={enviar} className="flex max-w-3xl flex-col gap-5">
      {contrato ? <input type="hidden" name="id" value={contrato.id} /> : null}

      {estado.erro ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <Campo id="nome" rotulo="Cliente" obrigatorio erro={estado.erros?.nome}>
        <Input
          id="nome"
          name="nome"
          defaultValue={c ? valor('nome') : (contrato?.nome ?? '')}
          required
        />
      </Campo>

      <Campo id="endereco" rotulo="Endereço" obrigatorio erro={estado.erros?.endereco}>
        <Input
          id="endereco"
          name="endereco"
          defaultValue={c ? valor('endereco') : (contrato?.endereco ?? '')}
          required
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_100px]">
        <Campo id="bairro" rotulo="Bairro" erro={estado.erros?.bairro}>
          <Input
            id="bairro"
            name="bairro"
            defaultValue={c ? valor('bairro') : (contrato?.bairro ?? '')}
          />
        </Campo>

        <Campo id="cidade" rotulo="Cidade" erro={estado.erros?.cidade}>
          <Input
            id="cidade"
            name="cidade"
            defaultValue={c ? valor('cidade') : (contrato?.cidade ?? '')}
          />
        </Campo>

        <Campo id="uf" rotulo="UF" erro={estado.erros?.uf}>
          <Select id="uf" name="uf" defaultValue={c ? valor('uf') : (contrato?.uf ?? '')}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </Campo>
      </div>

      <Campo
        id="periodicidade"
        rotulo="Periodicidade da visita"
        obrigatorio
        erro={estado.erros?.periodicidade}
        dica="Periodicidade gera aviso na montagem da semana, nunca bloqueio."
      >
        <Select
          id="periodicidade"
          name="periodicidade"
          defaultValue={c ? valor('periodicidade') : (contrato?.periodicidade ?? 'SEMANAL')}
          required
        >
          {PERIODICIDADES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo
        id="escopo"
        rotulo="Escopo"
        erro={estado.erros?.escopo}
        dica="Separe por vírgula. Ex.: limpeza, bombeiros, manutenção, recepção"
      >
        <Input id="escopo" name="escopo" defaultValue={escopoInicial} />
      </Campo>

      <Campo
        id="observacoes"
        rotulo="Observações"
        erro={estado.erros?.observacoes}
        dica="Ex.: inclui a manutenção; brigada em outro andar."
      >
        <Textarea
          id="observacoes"
          name="observacoes"
          defaultValue={c ? valor('observacoes') : (contrato?.observacoes ?? '')}
        />
      </Campo>

      <div className="flex items-center gap-3">
        <Checkbox id="ativo" name="ativo" defaultChecked={ativo} />
        <Label htmlFor="ativo">Contrato ativo</Label>
      </div>

      <section className="border-t pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Contatos do cliente</h2>
            <p className="text-muted-foreground text-sm">
              Quem o supervisor procura ao chegar na unidade.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinhas((l) => [...l, { ...CONTATO_VAZIO }])}
          >
            Adicionar contato
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {linhas.map((contato, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id={`contato_nome_${i}`} rotulo="Nome">
                  <Input
                    id={`contato_nome_${i}`}
                    name="contato_nome"
                    defaultValue={contato.nome}
                  />
                </Campo>

                <Campo id={`contato_cargo_${i}`} rotulo="Cargo">
                  <Input
                    id={`contato_cargo_${i}`}
                    name="contato_cargo"
                    defaultValue={contato.cargo ?? ''}
                  />
                </Campo>

                <Campo id={`contato_telefone_${i}`} rotulo="Telefone">
                  <Input
                    id={`contato_telefone_${i}`}
                    name="contato_telefone"
                    inputMode="tel"
                    defaultValue={contato.telefone ?? ''}
                  />
                </Campo>

                <Campo id={`contato_email_${i}`} rotulo="E-mail">
                  <Input
                    id={`contato_email_${i}`}
                    name="contato_email"
                    type="email"
                    autoCapitalize="none"
                    defaultValue={contato.email ?? ''}
                  />
                </Campo>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`contato_principal_${i}`}
                    name="contato_principal"
                    value={String(i)}
                    defaultChecked={contato.principal}
                  />
                  <Label htmlFor={`contato_principal_${i}`}>Contato principal</Label>
                </div>

                {linhas.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLinhas((l) => l.filter((_, j) => j !== i))}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground mt-3 text-xs">
          Bloco sem nome é descartado ao salvar.
        </p>
      </section>

      <div className="flex gap-3">
        <BotaoSalvar />
        <Button type="button" variant="outline" size="lg" asChild>
          <Link href="/cadastros/contratos">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
