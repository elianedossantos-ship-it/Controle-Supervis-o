'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatarData, formatarDataHora } from '@/lib/datas';
import {
  ROTULO_RECORRENCIA,
  ROTULO_STATUS,
  STATUS,
  estaVencida,
  type StatusOcorrencia,
} from '@/lib/prazos';
import { marcarOcorrencia, type CelulaPrazo, type DadosPrazos } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

/** Cada situação tem cor e rótulo — a cor nunca carrega o sentido sozinha. */
const ESTILO: Record<StatusOcorrencia, string> = {
  pendente: 'bg-muted text-muted-foreground',
  atendido: 'text-white',
  atendido_atraso: 'text-white',
  nao_atendido: 'text-white',
  nao_aplicavel: 'bg-background text-muted-foreground border-dashed',
};

const FUNDO: Partial<Record<StatusOcorrencia, string>> = {
  atendido: 'var(--prazo-atendido)',
  atendido_atraso: 'var(--prazo-atraso)',
  nao_atendido: 'var(--prazo-nao-atendido)',
};

const SIGLA: Record<StatusOcorrencia, string> = {
  pendente: '–',
  atendido: 'A',
  atendido_atraso: 'At',
  nao_atendido: 'N',
  nao_aplicavel: 'NA',
};

export function GradeDePrazos({
  dados,
  podeMarcar,
}: {
  dados: DadosPrazos;
  podeMarcar: boolean;
}) {
  const router = useRouter();
  /*
   * O rascunho do painel fica aqui, e não dentro dele: chamar uma server action
   * faz o Next re-renderizar a página, e o estado interno do painel se perde.
   * Sem isto, uma recusa do servidor apagava a situação que o coordenador
   * tinha acabado de escolher.
   */
  const [aberta, setAberta] = useState<{
    celula: CelulaPrazo;
    obrigacao: string;
    supervisor: string;
    diaria: boolean;
    rascunho: Rascunho;
  } | null>(null);

  const irPara = (mes: string) => router.push(`/prazos?mes=${mes}`);

  return (
    <div className="prazos">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Input
          type="month"
          value={dados.mes}
          onChange={(e) => e.target.value && irPara(e.target.value)}
          className="h-9 w-auto"
          aria-label="Mês"
        />
        <span className="text-muted-foreground text-sm">
          {dados.diasUteis} dias úteis no mês
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="bg-card sticky left-0 z-10 min-w-[15rem] px-3 py-2 text-left font-medium">
                Obrigação
              </th>
              {dados.supervisores.map((s) => (
                <th key={s.id} className="min-w-[8rem] px-2 py-2 text-center font-medium">
                  {s.nome}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {dados.linhas.map((linha) => (
              <tr key={linha.obrigacao.id} className="border-b last:border-0">
                <td className="bg-card sticky left-0 z-10 px-3 py-2">
                  <p className="font-medium">{linha.obrigacao.nome}</p>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant="secondary">
                      {ROTULO_RECORRENCIA[linha.obrigacao.recorrencia]}
                    </Badge>
                    {linha.obrigacao.automatica ? (
                      <Badge variant="outline">automática</Badge>
                    ) : null}
                    {linha.obrigacao.recorrencia === 'mensal' && linha.obrigacao.diaLimite
                      ? `até o dia ${linha.obrigacao.diaLimite}`
                      : null}
                    {linha.obrigacao.recorrencia === 'semanal' ? 'toda sexta' : null}
                    {linha.obrigacao.recorrencia === 'diaria' ? 'consolidada no mês' : null}
                  </p>
                </td>

                {dados.supervisores.map((s) => {
                  const celulas = linha.porSupervisor[s.id] ?? [];
                  return (
                    <td key={s.id} className="p-1">
                      <div className="flex flex-wrap justify-center gap-1">
                        {celulas.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          celulas.map((c) => {
                            const vencida = estaVencida(c, dados.hoje);
                            return (
                              <button
                                key={c.ocorrenciaId}
                                type="button"
                                onClick={() =>
                                  setAberta({
                                    celula: c,
                                    obrigacao: linha.obrigacao.nome,
                                    supervisor: s.nome,
                                    diaria: linha.obrigacao.recorrencia === 'diaria',
                                    rascunho: {
                                      status: c.status,
                                      dataEntrega: c.dataEntrega ?? '',
                                      diasAtendidos:
                                        c.diasAtendidos === null ? '' : String(c.diasAtendidos),
                                      observacao: c.observacao ?? '',
                                    },
                                  })
                                }
                                title={`${ROTULO_STATUS[c.status]} — prazo ${formatarData(c.prazo)}`}
                                className={cn(
                                  'flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-semibold',
                                  ESTILO[c.status],
                                  vencida ? 'border-2' : '',
                                )}
                                style={{
                                  background: FUNDO[c.status],
                                  borderColor: vencida ? 'var(--prazo-nao-atendido)' : undefined,
                                }}
                              >
                                {SIGLA[c.status]}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STATUS.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn('inline-block size-2.5 rounded-full', ESTILO[s])}
              style={{ background: FUNDO[s] }}
            />
            <strong>{SIGLA[s]}</strong> {ROTULO_STATUS[s].toLowerCase()}
          </span>
        ))}
        <span>borda grossa: prazo vencido</span>
      </div>

      {aberta ? (
        <PainelLateral
          info={aberta}
          podeMarcar={podeMarcar}
          onRascunho={(r) => setAberta((a) => (a ? { ...a, rascunho: r } : a))}
          onFechar={() => setAberta(null)}
          onSalvo={() => {
            setAberta(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

type Rascunho = {
  status: StatusOcorrencia;
  dataEntrega: string;
  diasAtendidos: string;
  observacao: string;
};

function PainelLateral({
  info,
  podeMarcar,
  onRascunho,
  onFechar,
  onSalvo,
}: {
  info: {
    celula: CelulaPrazo;
    obrigacao: string;
    supervisor: string;
    diaria: boolean;
    rascunho: Rascunho;
  };
  podeMarcar: boolean;
  onRascunho: (r: Rascunho) => void;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const { celula, rascunho } = info;
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const mudar = (campo: keyof Rascunho, valor: string) =>
    onRascunho({ ...rascunho, [campo]: valor });

  function enviar(formData: FormData) {
    iniciar(async () => {
      const estado: EstadoForm = await marcarOcorrencia({}, formData);
      if (estado.erro) {
        setErro(estado.erro);
        return;
      }
      onSalvo();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        className="bg-foreground/20 absolute inset-0"
        onClick={onFechar}
      />

      <aside className="bg-background relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l p-6 shadow-lg">
        <div>
          <h2 className="text-lg font-semibold">{info.obrigacao}</h2>
          <p className="text-muted-foreground text-sm">
            {info.supervisor} · competência {formatarData(celula.competencia)} · prazo{' '}
            {formatarData(celula.prazo)}
          </p>
        </div>

        {celula.automatica ? (
          <Alert>
            <AlertDescription>
              Esta obrigação é preenchida pelo sistema, a partir do envio da programação.
              Sobrescrever é exceção e exige justificativa.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Histórico da marcação */}
        <div className="text-muted-foreground rounded-lg border p-3 text-sm">
          <p>
            Situação atual: <strong>{ROTULO_STATUS[celula.status]}</strong>
          </p>
          {celula.dataEntrega ? <p>Entrega em {formatarData(celula.dataEntrega)}</p> : null}
          {celula.diasAtendidos !== null && celula.diasUteis !== null ? (
            <p>
              {celula.diasAtendidos} de {celula.diasUteis} dias úteis
            </p>
          ) : null}
          {celula.observacao ? <p className="mt-1">{celula.observacao}</p> : null}
          {celula.marcadoPorNome && celula.marcadoEm ? (
            <p className="mt-1">
              Marcado por {celula.marcadoPorNome} em{' '}
              {formatarDataHora(new Date(celula.marcadoEm))}
            </p>
          ) : (
            <p className="mt-1">Sem marcação manual.</p>
          )}
        </div>

        {podeMarcar ? (
          <form action={enviar} className="flex flex-col gap-4">
            <input type="hidden" name="ocorrenciaId" value={celula.ocorrenciaId} />

            <div>
              <Label htmlFor="status" className="mb-2">
                Situação
              </Label>
              <Select
                id="status"
                name="status"
                value={rascunho.status}
                onChange={(e) => mudar('status', e.target.value)}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_STATUS[s]}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="dataEntrega" className="mb-2">
                Data de entrega
              </Label>
              <Input
                id="dataEntrega"
                name="dataEntrega"
                type="date"
                value={rascunho.dataEntrega}
                onChange={(e) => mudar('dataEntrega', e.target.value)}
              />
            </div>

            {info.diaria ? (
              <div>
                <Label htmlFor="diasAtendidos" className="mb-2">
                  Dias atendidos
                </Label>
                <Input
                  id="diasAtendidos"
                  name="diasAtendidos"
                  type="number"
                  min={0}
                  value={rascunho.diasAtendidos}
                  onChange={(e) => mudar('diasAtendidos', e.target.value)}
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Consolidado do mês: dias atendidos sobre os dias úteis.
                </p>
              </div>
            ) : null}

            <div>
              <Label htmlFor="observacao" className="mb-2">
                Observação
                {celula.automatica ? ' (obrigatória para sobrescrever)' : ''}
              </Label>
              {/*
                Obrigatório no cliente quando a obrigação é automática: assim a
                recusa acontece antes da ida ao servidor. A checagem no servidor
                continua valendo, para requisição forjada.
              */}
              <Textarea
                id="observacao"
                name="observacao"
                rows={3}
                required={celula.automatica}
                value={rascunho.observacao}
                onChange={(e) => mudar('observacao', e.target.value)}
              />
            </div>

            {erro ? (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" size="lg" className="flex-1" disabled={enviando}>
                {enviando ? 'Salvando…' : 'Salvar marcação'}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={onFechar}>
                Fechar
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" onClick={onFechar}>
            Fechar
          </Button>
        )}
      </aside>
    </div>
  );
}
