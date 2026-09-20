'use client';

import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export function FiltroDePlanos({
  contratos,
  contratoId,
  situacao,
}: {
  contratos: { id: string; nome: string }[];
  contratoId: string;
  situacao: string;
}) {
  const router = useRouter();

  const ir = (campo: string, valor: string) => {
    const p = new URLSearchParams();
    if (campo === 'contrato' ? valor : contratoId) {
      p.set('contrato', campo === 'contrato' ? valor : contratoId);
    }
    const s = campo === 'situacao' ? valor : situacao;
    if (s && s !== 'abertos') p.set('situacao', s);
    router.push(`/planos?${p.toString()}`);
  };

  return (
    <div className="bg-card mb-6 grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="fp-contrato" className="mb-2">
          Contrato
        </Label>
        <Select
          id="fp-contrato"
          value={contratoId}
          onChange={(e) => ir('contrato', e.target.value)}
        >
          <option value="">Todos</option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="fp-situacao" className="mb-2">
          Situação
        </Label>
        <Select
          id="fp-situacao"
          value={situacao}
          onChange={(e) => ir('situacao', e.target.value)}
        >
          <option value="abertos">Abertos e em andamento</option>
          <option value="todos">Todos, incluindo encerrados</option>
        </Select>
      </div>
    </div>
  );
}
