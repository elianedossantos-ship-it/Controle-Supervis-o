'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Campo } from '@/components/campo';
import { BotaoSalvar } from '@/components/botao-salvar';
import { redefinirSenha } from '../acoes';
import type { EstadoForm } from '@/lib/formulario';

export function FormularioSenha({ id }: { id: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(redefinirSenha, {});

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />

      <div>
        <h2 className="text-lg font-semibold">Redefinir senha</h2>
        <p className="text-muted-foreground text-sm">
          A senha atual é substituída na hora. Combine a nova com a pessoa antes.
        </p>
      </div>

      {estado.ok ? (
        <Alert>
          <AlertDescription>Senha redefinida.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="senha" rotulo="Nova senha" obrigatorio erro={estado.erros?.senha}>
          <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
        </Campo>

        <Campo
          id="confirmacao"
          rotulo="Repetir a senha"
          obrigatorio
          erro={estado.erros?.confirmacao}
        >
          <Input
            id="confirmacao"
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            required
          />
        </Campo>
      </div>

      <div>
        <BotaoSalvar>Redefinir senha</BotaoSalvar>
      </div>
    </form>
  );
}
