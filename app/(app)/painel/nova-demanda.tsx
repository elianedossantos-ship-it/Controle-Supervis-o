'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { criarDemanda } from '../meu-dia/acoes';
import { contratosDoSupervisor } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

/** "Daqui também se cria a demanda extra" (seção 5). */
export function NovaDemandaPainel({
  supervisores,
}: {
  supervisores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [enviando, iniciar] = useTransition();

  const [supervisorId, setSupervisorId] = useState(supervisores[0]?.id ?? '');
  const [contratos, setContratos] = useState<{ id: string; nome: string }[]>([]);

  // A lista de contratos segue o supervisor escolhido: a demanda só pode cair
  // em contrato da carteira vigente dele.
  useEffect(() => {
    if (!aberto || !supervisorId) return;
    let vivo = true;
    contratosDoSupervisor(supervisorId)
      .then((lista) => {
        if (vivo) setContratos(lista);
      })
      .catch(() => {
        if (vivo) setContratos([]);
      });
    return () => {
      vivo = false;
    };
  }, [aberto, supervisorId]);

  function enviar(formData: FormData) {
    iniciar(async () => {
      const estado: EstadoForm = await criarDemanda({}, formData);
      if (estado.erro) {
        setErro(estado.erro);
        return;
      }
      setErro(null);
      setPronto(true);
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setErro(null);
            setPronto(false);
            setAberto(true);
          }}
        >
          Criar demanda extra
        </Button>
        {pronto ? (
          <span className="text-muted-foreground text-sm">Demanda criada.</span>
        ) : null}
      </div>
    );
  }

  return (
    <form action={enviar} className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <div>
        <h2 className="font-semibold">Nova demanda extra</h2>
        <p className="text-muted-foreground text-sm">
          Vai para o topo do Meu dia do supervisor até ser concluída. Com contrato e data,
          já cria a visita correspondente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-supervisor" className="mb-2">
            Supervisor
          </Label>
          <Select
            id="p-supervisor"
            name="supervisorId"
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            required
          >
            {supervisores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="p-prioridade" className="mb-2">
            Prioridade
          </Label>
          <Select id="p-prioridade" name="prioridade" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="p-descricao" className="mb-2">
          O que precisa ser feito
        </Label>
        <Textarea id="p-descricao" name="descricao" rows={2} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-contrato" className="mb-2">
            Contrato (opcional)
          </Label>
          <Select id="p-contrato" name="contratoId">
            <option value="">Sem contrato</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="p-data" className="mb-2">
            Data alvo (opcional)
          </Label>
          <Input id="p-data" name="dataAlvo" type="date" />
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
