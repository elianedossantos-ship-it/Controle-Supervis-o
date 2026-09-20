'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { somarDias } from '@/lib/semana';
import { supervisoresAtivos } from './acoes';

export function SeletorDeDia({
  dia,
  supervisorId,
  mostraSupervisor,
}: {
  dia: string;
  supervisorId: string;
  mostraSupervisor: boolean;
}) {
  const router = useRouter();
  const [supervisores, setSupervisores] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    if (!mostraSupervisor) return;
    supervisoresAtivos().then(setSupervisores).catch(() => setSupervisores([]));
  }, [mostraSupervisor]);

  const ir = (novoDia: string, novoSupervisor = supervisorId) => {
    const p = new URLSearchParams({ dia: novoDia });
    if (mostraSupervisor) p.set('supervisor', novoSupervisor);
    router.push(`/meu-dia?${p.toString()}`);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => ir(somarDias(dia, -1))}>
        ← Ontem
      </Button>
      <Input
        type="date"
        value={dia}
        onChange={(e) => e.target.value && ir(e.target.value)}
        className="h-9 w-auto"
        aria-label="Dia"
      />
      <Button variant="outline" size="sm" onClick={() => ir(somarDias(dia, 1))}>
        Amanhã →
      </Button>

      {mostraSupervisor && supervisores.length > 0 ? (
        <Select
          aria-label="Supervisor"
          className="h-9 w-56"
          value={supervisorId}
          onChange={(e) => ir(dia, e.target.value)}
        >
          {supervisores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
