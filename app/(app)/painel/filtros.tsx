'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { Filtros } from './acoes';

/** Filtros numa linha só, acima dos indicadores. */
export function BarraDeFiltros({
  filtros,
  supervisores,
  contratos,
}: {
  filtros: Filtros;
  supervisores: { id: string; nome: string }[];
  contratos: { id: string; nome: string }[];
}) {
  const router = useRouter();

  function aplicar(formData: FormData) {
    const p = new URLSearchParams();
    for (const campo of ['inicio', 'fim', 'supervisor', 'contrato'] as const) {
      const v = String(formData.get(campo) ?? '').trim();
      if (v) p.set(campo, v);
    }
    router.push(`/painel?${p.toString()}`);
  }

  return (
    <form action={aplicar} className="bg-card mb-6 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <Label htmlFor="f-inicio" className="mb-2">
            De
          </Label>
          <Input id="f-inicio" name="inicio" type="date" defaultValue={filtros.periodo.inicio} />
        </div>

        <div>
          <Label htmlFor="f-fim" className="mb-2">
            Até
          </Label>
          <Input id="f-fim" name="fim" type="date" defaultValue={filtros.periodo.fim} />
        </div>

        <div>
          <Label htmlFor="f-supervisor" className="mb-2">
            Supervisor
          </Label>
          <Select id="f-supervisor" name="supervisor" defaultValue={filtros.supervisorId ?? ''}>
            <option value="">Todos</option>
            {supervisores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="f-contrato" className="mb-2">
            Contrato
          </Label>
          <Select id="f-contrato" name="contrato" defaultValue={filtros.contratoId ?? ''}>
            <option value="">Todos</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Aplicar
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/painel')}>
            Limpar
          </Button>
        </div>
      </div>
    </form>
  );
}
