'use client';

import { useActionState, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { abrirAvaliacao } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

export function NovaAvaliacao({
  supervisores,
}: {
  supervisores: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, enviar] = useActionState<EstadoForm, FormData>(abrirAvaliacao, {});

  if (!aberto) {
    return <Button onClick={() => setAberto(true)}>Abrir avaliação</Button>;
  }

  return (
    <form action={enviar} className="bg-card flex flex-col gap-4 rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">
        A avaliação cobre o trimestre da data escolhida. Se já existir uma para esse
        supervisor no mesmo trimestre, você é levado a ela.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="supervisorId" className="mb-2">
            Supervisor
          </Label>
          <Select id="supervisorId" name="supervisorId" required>
            <option value="">Escolha</option>
            {supervisores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="trimestre" className="mb-2">
            Mês de referência
          </Label>
          <Input id="trimestre" name="trimestre" type="month" required />
        </div>
      </div>

      {estado.erro ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg">
          Abrir
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
