'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { lancarVisitaExtra } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

export function VisitaExtra({
  contratos,
  dia,
}: {
  contratos: { id: string; nome: string }[];
  dia: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  /**
   * A ação é chamada direto, e não por useActionState: assim o fechamento do
   * painel acontece no próprio handler, e o formulário volta limpo se o
   * supervisor precisar lançar outra extra em seguida.
   */
  function enviar(formData: FormData) {
    iniciar(async () => {
      const estado: EstadoForm = await lancarVisitaExtra({}, formData);
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
      <div className="bg-background sticky bottom-0 -mx-4 border-t p-4 md:static md:mx-0 md:border-0 md:p-0">
          <Button
          size="lg"
          className="w-full md:w-auto"
          onClick={() => {
            setErro(null);
            setAberto(true);
          }}
        >
          + Visita extra
        </Button>
      </div>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Visita extra</h2>
        <p className="text-muted-foreground text-sm">
          Contrato da sua carteira, mesmo que não estivesse programado na semana.
        </p>
      </div>

      <div>
        <Label htmlFor="extra-contrato" className="mb-2">
          Contrato
        </Label>
        <Select id="extra-contrato" name="contratoId" required>
          <option value="">Escolha o contrato</option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="extra-data" className="mb-2">
          Data
        </Label>
        <Input id="extra-data" name="data" type="date" defaultValue={dia} required />
      </div>

      <div>
        <Label htmlFor="extra-justificativa" className="mb-2">
          Justificativa
        </Label>
        <Textarea id="extra-justificativa" name="justificativa" rows={2} required />
      </div>

      {erro ? (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1" disabled={enviando}>
          {enviando ? 'Lançando…' : 'Lançar visita extra'}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        A visita entra como prevista. Registre a execução com foto, como nas demais.
      </p>
    </form>
  );
}
