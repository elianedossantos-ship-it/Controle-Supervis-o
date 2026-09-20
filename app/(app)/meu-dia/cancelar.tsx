'use client';

import { useActionState, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cancelarVisita } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

type Motivo = { id: string; descricao: string; exigeTexto: boolean };

export function PainelCancelamento({
  visitaId,
  motivos,
  onFechar,
}: {
  visitaId: string;
  motivos: Motivo[];
  onFechar: () => void;
}) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(cancelarVisita, {});
  const [motivoId, setMotivoId] = useState('');

  const escolhido = motivos.find((m) => m.id === motivoId);

  useEffect(() => {
    if (estado.ok) onFechar();
  }, [estado.ok, onFechar]);

  return (
    <form action={enviar} className="bg-muted/40 mt-3 flex flex-col gap-4 rounded-lg border p-4">
      <input type="hidden" name="visitaId" value={visitaId} />

      <div>
        <Label htmlFor={`motivo-${visitaId}`} className="mb-2">
          Motivo do cancelamento
        </Label>
        <Select
          id={`motivo-${visitaId}`}
          name="motivoId"
          value={motivoId}
          onChange={(e) => setMotivoId(e.target.value)}
          required
        >
          <option value="">Escolha o motivo</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.descricao}
            </option>
          ))}
        </Select>
      </div>

      {escolhido?.exigeTexto ? (
        <div>
          <Label htmlFor={`outro-${visitaId}`} className="mb-2">
            O que houve
          </Label>
          <Textarea id={`outro-${visitaId}`} name="motivoOutro" rows={2} required />
        </div>
      ) : null}

      {estado.erro ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="lg" className="flex-1">
          Confirmar cancelamento
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onFechar}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
