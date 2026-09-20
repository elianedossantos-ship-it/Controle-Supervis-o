'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { criarDemanda } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

export function NovaDemanda({
  supervisorId,
  supervisorNome,
  contratos,
  dia,
}: {
  supervisorId: string;
  supervisorNome: string;
  contratos: { id: string; nome: string }[];
  dia: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(formData: FormData) {
    iniciar(async () => {
      const estado: EstadoForm = await criarDemanda({}, formData);
      if (estado.erro) {
        setErro(estado.erro);
        return;
      }
      setErro(null);
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <Button
        variant="outline"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
      >
        Criar demanda para {supervisorNome}
      </Button>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-4 rounded-lg border p-4">
      <input type="hidden" name="supervisorId" value={supervisorId} />

      <div>
        <h2 className="font-semibold">Nova demanda para {supervisorNome}</h2>
        <p className="text-muted-foreground text-sm">
          Aparece no topo do Meu dia dele até ser concluída. Com contrato e data, já cria a
          visita correspondente.
        </p>
      </div>

      <div>
        <Label htmlFor="d-descricao" className="mb-2">
          O que precisa ser feito
        </Label>
        <Textarea id="d-descricao" name="descricao" rows={2} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="d-contrato" className="mb-2">
            Contrato (opcional)
          </Label>
          <Select id="d-contrato" name="contratoId">
            <option value="">Sem contrato</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="d-data" className="mb-2">
            Data alvo (opcional)
          </Label>
          <Input id="d-data" name="dataAlvo" type="date" defaultValue={dia} />
        </div>

        <div>
          <Label htmlFor="d-prioridade" className="mb-2">
            Prioridade
          </Label>
          <Select id="d-prioridade" name="prioridade" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </Select>
        </div>
      </div>

      {erro ? (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar demanda'}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
