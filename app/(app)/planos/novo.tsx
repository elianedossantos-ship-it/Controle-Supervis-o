'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  PRIORIDADES,
  ROTULO_PRIORIDADE,
  prazoSugerido,
  textoDoPrazoSugerido,
  type Prioridade,
} from '@/lib/planos';
import { abrirPlano } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

export function NovoPlano({
  contratos,
  hoje,
  contratoFixo,
  visitaId,
  rotuloBotao = 'Abrir plano de ação',
  aoConcluir,
}: {
  contratos: { id: string; nome: string }[];
  hoje: string;
  contratoFixo?: string;
  visitaId?: string;
  rotuloBotao?: string;
  aoConcluir?: () => void;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<Prioridade>('normal');
  const [enviando, iniciar] = useTransition();

  /*
   * O prazo acompanha a prioridade enquanto o usuário não o edita à mão. É
   * derivado, e não sincronizado por efeito: assim não há renderização em
   * cascata a cada troca de prioridade.
   */
  const [prazoEditado, setPrazoEditado] = useState<string | null>(null);
  const prazo = prazoEditado ?? prazoSugerido(prioridade, hoje);

  /*
   * O React limpa o formulário depois de uma server action, inclusive quando
   * ela recusa. Sem isto, o supervisor perde a descrição que acabou de
   * escrever só porque faltava um campo. O rascunho vive aqui, controlado.
   */
  const vazio = { contratoId: '', descricao: '', localSetor: '', responsavel: '' };
  const [rascunho, setRascunho] = useState(vazio);
  const campo = (nome: keyof typeof vazio) => ({
    value: rascunho[nome],
    onChange: (e: { target: { value: string } }) =>
      setRascunho((r) => ({ ...r, [nome]: e.target.value })),
  });

  function enviar(formData: FormData) {
    if (contratoFixo) formData.set('contratoId', contratoFixo);
    if (visitaId) formData.set('visitaId', visitaId);

    iniciar(async () => {
      const r: EstadoForm = await abrirPlano({}, formData);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      setAberto(false);
      setPrazoEditado(null);
      setRascunho(vazio);
      router.refresh();
      aoConcluir?.();
    });
  }

  if (!aberto) {
    return (
      <Button
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
      >
        {rotuloBotao}
      </Button>
    );
  }

  return (
    <form action={enviar} className="bg-card flex flex-col gap-4 rounded-lg border p-4">
      {!contratoFixo ? (
        <div>
          <Label htmlFor="np-contrato" className="mb-2">
            Contrato
          </Label>
          <Select id="np-contrato" name="contratoId" required {...campo('contratoId')}>
            <option value="">Escolha a unidade</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div>
        <Label htmlFor="np-descricao" className="mb-2">
          Qual é o problema
        </Label>
        <Textarea id="np-descricao" name="descricao" rows={2} required {...campo('descricao')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="np-local" className="mb-2">
            Local ou setor
          </Label>
          <Input
            id="np-local"
            name="localSetor"
            placeholder="Ex.: garagem, 3º andar"
            {...campo('localSetor')}
          />
        </div>

        <div>
          <Label htmlFor="np-responsavel" className="mb-2">
            Responsável pela solução
          </Label>
          <Input id="np-responsavel" name="responsavel" {...campo('responsavel')} />
        </div>

        <div>
          <Label htmlFor="np-prioridade" className="mb-2">
            Prioridade
          </Label>
          <Select
            id="np-prioridade"
            name="prioridade"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as Prioridade)}
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PRIORIDADE[p]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="np-prazo" className="mb-2">
            Prazo
          </Label>
          <Input
            id="np-prazo"
            name="prazo"
            type="date"
            value={prazo}
            onChange={(e) => setPrazoEditado(e.target.value)}
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Sugerido pela prioridade: {textoDoPrazoSugerido(prioridade)}. Pode trocar.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="np-foto" className="mb-2">
          Foto do problema
        </Label>
        <Input
          id="np-foto"
          name="foto"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="h-auto py-2"
        />
      </div>

      {erro ? (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? 'Abrindo…' : 'Abrir plano'}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
