'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Campo } from '@/components/campo';
import { BotaoSalvar } from '@/components/botao-salvar';
import { PAPEIS, ROTULO_PAPEL } from '@/lib/papeis';
import type { EstadoForm } from '@/lib/formulario';

type Usuario = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  whatsapp: string | null;
  papel: string;
  ativo: boolean;
};

type Props = {
  acao: (estado: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  usuario?: Usuario;
  /** Papel e situação são do admin; para os demais os campos vão travados. */
  podeGerir: boolean;
};

export function FormularioUsuario({ acao, usuario, podeGerir }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {});
  const c = estado.campos;

  const valor = (campo: keyof Usuario, padrao = '') => {
    const digitado = c?.[campo];
    if (typeof digitado === 'string') return digitado;
    const salvo = usuario?.[campo];
    return typeof salvo === 'string' ? salvo : padrao;
  };

  const ativo = c ? c.ativo === 'on' : (usuario?.ativo ?? true);

  return (
    <form action={enviar} className="flex max-w-2xl flex-col gap-5">
      {usuario ? <input type="hidden" name="id" value={usuario.id} /> : null}

      {estado.erro ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <Campo id="nome" rotulo="Nome" obrigatorio erro={estado.erros?.nome}>
        <Input id="nome" name="nome" defaultValue={valor('nome')} required />
      </Campo>

      <Campo id="email" rotulo="E-mail" obrigatorio erro={estado.erros?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          defaultValue={valor('email')}
          required
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="telefone" rotulo="Telefone" erro={estado.erros?.telefone}>
          <Input id="telefone" name="telefone" inputMode="tel" defaultValue={valor('telefone')} />
        </Campo>

        <Campo id="whatsapp" rotulo="WhatsApp" erro={estado.erros?.whatsapp}>
          <Input id="whatsapp" name="whatsapp" inputMode="tel" defaultValue={valor('whatsapp')} />
        </Campo>
      </div>

      <Campo
        id="papel"
        rotulo="Papel"
        obrigatorio
        erro={estado.erros?.papel}
        dica={podeGerir ? undefined : 'Só o admin altera o papel.'}
      >
        <Select
          id="papel"
          name="papel"
          defaultValue={valor('papel', 'supervisor')}
          disabled={!podeGerir}
          required
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </Select>
        {/* Campo desabilitado não entra no FormData: o valor atual vai junto. */}
        {!podeGerir ? (
          <input type="hidden" name="papel" value={valor('papel', 'supervisor')} />
        ) : null}
      </Campo>

      {!usuario ? (
        <Campo
          id="senha"
          rotulo="Senha inicial"
          obrigatorio
          erro={estado.erros?.senha}
          dica="Ao menos 8 caracteres. O admin pode redefinir depois."
        >
          <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
        </Campo>
      ) : null}

      <div className="flex items-center gap-3">
        <Checkbox id="ativo" name="ativo" defaultChecked={ativo} disabled={!podeGerir} />
        <Label htmlFor="ativo">Usuário ativo</Label>
        {!podeGerir ? <input type="hidden" name="ativo" value={ativo ? 'on' : ''} /> : null}
      </div>
      {!podeGerir ? (
        <p className="text-muted-foreground -mt-3 text-xs">Só o admin inativa um usuário.</p>
      ) : null}

      <div className="flex gap-3">
        <BotaoSalvar />
        <Button type="button" variant="outline" size="lg" asChild>
          <Link href="/cadastros/supervisores">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
