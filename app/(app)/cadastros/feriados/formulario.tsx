'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Campo } from '@/components/campo';
import { BotaoSalvar } from '@/components/botao-salvar';
import { ABRANGENCIAS, ROTULO_ABRANGENCIA } from '@/lib/feriados';
import { UFS } from '@/lib/uf';
import { criarFeriado } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

export function FormularioFeriado() {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(criarFeriado, {});
  const valor = (campo: string) => {
    const v = estado.campos?.[campo];
    return typeof v === 'string' ? v : '';
  };

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {estado.ok ? (
        <Alert>
          <AlertDescription>Feriado incluído.</AlertDescription>
        </Alert>
      ) : null}

      {estado.erro ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <Campo id="data" rotulo="Data" obrigatorio erro={estado.erros?.data}>
        <Input id="data" name="data" type="date" defaultValue={valor('data')} required />
      </Campo>

      <Campo id="descricao" rotulo="Descrição" obrigatorio erro={estado.erros?.descricao}>
        <Input
          id="descricao"
          name="descricao"
          placeholder="Ex.: Independência"
          defaultValue={valor('descricao')}
          required
        />
      </Campo>

      <Campo id="abrangencia" rotulo="Abrangência" obrigatorio erro={estado.erros?.abrangencia}>
        <Select
          id="abrangencia"
          name="abrangencia"
          defaultValue={valor('abrangencia') || 'nacional'}
          required
        >
          {ABRANGENCIAS.map((a) => (
            <option key={a} value={a}>
              {ROTULO_ABRANGENCIA[a]}
            </option>
          ))}
        </Select>
      </Campo>

      <div className="grid gap-5 sm:grid-cols-[100px_1fr]">
        <Campo id="uf" rotulo="UF" erro={estado.erros?.uf}>
          <Select id="uf" name="uf" defaultValue={valor('uf')}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo id="municipio" rotulo="Município" erro={estado.erros?.municipio}>
          <Input id="municipio" name="municipio" defaultValue={valor('municipio')} />
        </Campo>
      </div>

      <p className="text-muted-foreground -mt-2 text-xs">
        UF e município só são exigidos em feriado estadual ou municipal.
      </p>

      <div>
        <BotaoSalvar>Incluir feriado</BotaoSalvar>
      </div>
    </form>
  );
}
