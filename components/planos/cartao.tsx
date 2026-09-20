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
import { formatarData, formatarDataHora } from '@/lib/datas';
import {
  PRIORIDADES,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_PLANO,
  ROTULO_TIPO,
  estaAberto,
  estaVencido,
  type Prioridade,
  type TipoAtualizacao,
} from '@/lib/planos';
import {
  acompanharPlano,
  cancelarPlano,
  editarPlano,
  reabrirPlano,
  resolverPlano,
  type PlanoCompleto,
} from '@/app/(app)/planos/acoes';
import type { EstadoForm } from '@/lib/formulario';

const COR_PRIORIDADE: Record<Prioridade, 'secondary' | 'default' | 'destructive'> = {
  baixa: 'secondary',
  normal: 'secondary',
  alta: 'default',
  critica: 'destructive',
};

type Painel = 'acompanhar' | 'resolver' | 'cancelar' | 'editar' | 'reabrir' | null;

export function CartaoDoPlano({
  plano,
  hoje,
  ehCoordenacao,
  visitaId,
}: {
  plano: PlanoCompleto;
  hoje: string;
  ehCoordenacao: boolean;
  visitaId?: string;
}) {
  const router = useRouter();
  const [painel, setPainel] = useState<Painel>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const aberto = estaAberto(plano.status);
  const vencido = estaVencido(plano, hoje);
  const podeEncerrar = !plano.exigeCoordenacao || ehCoordenacao;

  const chamar = (acao: (e: EstadoForm, f: FormData) => Promise<EstadoForm>, f: FormData) =>
    iniciar(async () => {
      const r = await acao({}, f);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      setPainel(null);
      router.refresh();
    });

  const enviarCom =
    (acao: (e: EstadoForm, f: FormData) => Promise<EstadoForm>) => (f: FormData) => {
      f.set('planoId', plano.id);
      if (visitaId) f.set('visitaId', visitaId);
      chamar(acao, f);
    };

  return (
    <article
      className={
        vencido ? 'border-destructive rounded-lg border-2 p-4' : 'rounded-lg border p-4'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{plano.descricao}</p>
          <p className="text-muted-foreground text-sm">
            {plano.contratoNome}
            {plano.localSetor ? ` · ${plano.localSetor}` : ''}
            {plano.responsavel ? ` · responsável: ${plano.responsavel}` : ''}
          </p>
          <p className="text-muted-foreground text-xs">
            aberto por {plano.abertoPorNome} em {formatarDataHora(new Date(plano.criadoEm))}
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant={COR_PRIORIDADE[plano.prioridade]}>
            {ROTULO_PRIORIDADE[plano.prioridade]}
          </Badge>
          <Badge variant="outline">{ROTULO_STATUS_PLANO[plano.status]}</Badge>
          {plano.prazo ? (
            <Badge variant={vencido ? 'destructive' : 'secondary'}>
              {vencido ? 'vencido em ' : 'prazo '}
              {formatarData(plano.prazo)}
            </Badge>
          ) : null}
        </div>
      </div>

      {plano.fotos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {plano.fotos.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Foto do plano"
                className="h-20 w-20 rounded-md border object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}

      {plano.atualizacoes.length > 0 ? (
        <ol className="mt-4 flex flex-col gap-3 border-l pl-4 text-sm">
          {plano.atualizacoes.map((a) => (
            <li key={a.id}>
              <p className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {ROTULO_TIPO[a.tipo as TipoAtualizacao] ?? a.tipo}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {a.autorNome} · {formatarDataHora(new Date(a.criadoEm))}
                </span>
              </p>
              {a.texto ? <p className="mt-1">{a.texto}</p> : null}
              {a.fotos.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.fotos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Foto do acompanhamento"
                        className="h-16 w-16 rounded-md border object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {erro ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {aberto ? (
          <>
            <Button
              size="sm"
              onClick={() => setPainel(painel === 'acompanhar' ? null : 'acompanhar')}
            >
              Acompanhar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPainel(painel === 'editar' ? null : 'editar')}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPainel(painel === 'resolver' ? null : 'resolver')}
            >
              Resolver
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPainel(painel === 'cancelar' ? null : 'cancelar')}
            >
              Cancelar
            </Button>
          </>
        ) : ehCoordenacao ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPainel(painel === 'reabrir' ? null : 'reabrir')}
          >
            Reabrir
          </Button>
        ) : null}
      </div>

      {aberto && !podeEncerrar && (painel === 'resolver' || painel === 'cancelar') ? (
        <Alert className="mt-3">
          <AlertDescription>
            Plano de prioridade {ROTULO_PRIORIDADE[plano.prioridade].toLowerCase()} é
            encerrado pela coordenação. Registre um acompanhamento com a
            solução e peça a validação.
          </AlertDescription>
        </Alert>
      ) : null}

      {painel === 'acompanhar' ? (
        <form
          action={enviarCom(acompanharPlano)}
          className="bg-muted/40 mt-3 flex flex-col gap-3 rounded-lg border p-4"
        >
          <div>
            <Label htmlFor={`t-${plano.id}`} className="mb-2">
              O que houve
            </Label>
            <Textarea id={`t-${plano.id}`} name="texto" rows={2} required />
          </div>
          <div>
            <Label htmlFor={`f-${plano.id}`} className="mb-2">
              Foto (opcional)
            </Label>
            <Input
              id={`f-${plano.id}`}
              name="foto"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="h-auto py-2"
            />
          </div>
          <div>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Registrar acompanhamento'}
            </Button>
          </div>
        </form>
      ) : null}

      {painel === 'editar' ? (
        <form
          action={enviarCom(editarPlano)}
          className="bg-muted/40 mt-3 flex flex-col gap-3 rounded-lg border p-4"
        >
          <div>
            <Label htmlFor={`d-${plano.id}`} className="mb-2">
              Descrição
            </Label>
            <Textarea
              id={`d-${plano.id}`}
              name="descricao"
              rows={2}
              defaultValue={plano.descricao}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`p-${plano.id}`} className="mb-2">
                Prioridade
              </Label>
              <Select id={`p-${plano.id}`} name="prioridade" defaultValue={plano.prioridade}>
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_PRIORIDADE[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`z-${plano.id}`} className="mb-2">
                Prazo
              </Label>
              <Input
                id={`z-${plano.id}`}
                name="prazo"
                type="date"
                defaultValue={plano.prazo ?? ''}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            A alteração entra no histórico: plano que pode ser reescrito em
            silêncio não serve de evidência.
          </p>
          <div>
            <Button type="submit" disabled={enviando}>
              Salvar alteração
            </Button>
          </div>
        </form>
      ) : null}

      {painel === 'resolver' && podeEncerrar ? (
        <form
          action={enviarCom(resolverPlano)}
          className="bg-muted/40 mt-3 flex flex-col gap-3 rounded-lg border p-4"
        >
          <div>
            <Label htmlFor={`rf-${plano.id}`} className="mb-2">
              Foto da solução
            </Label>
            <Input
              id={`rf-${plano.id}`}
              name="foto"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              required
              className="h-auto py-2"
            />
            <p className="text-muted-foreground mt-1 text-xs">Resolver exige foto.</p>
          </div>
          <div>
            <Label htmlFor={`rt-${plano.id}`} className="mb-2">
              Observação (opcional)
            </Label>
            <Textarea id={`rt-${plano.id}`} name="texto" rows={2} />
          </div>
          <div>
            <Button type="submit" disabled={enviando}>
              Marcar como resolvido
            </Button>
          </div>
        </form>
      ) : null}

      {painel === 'cancelar' && podeEncerrar ? (
        <form
          action={enviarCom(cancelarPlano)}
          className="bg-muted/40 mt-3 flex flex-col gap-3 rounded-lg border p-4"
        >
          <div>
            <Label htmlFor={`cm-${plano.id}`} className="mb-2">
              Por que está sendo cancelado
            </Label>
            <Textarea id={`cm-${plano.id}`} name="motivo" rows={2} required />
          </div>
          <div>
            <Button type="submit" variant="destructive" disabled={enviando}>
              Cancelar plano
            </Button>
          </div>
        </form>
      ) : null}

      {painel === 'reabrir' ? (
        <form
          action={enviarCom(reabrirPlano)}
          className="bg-muted/40 mt-3 flex flex-col gap-3 rounded-lg border p-4"
        >
          <div>
            <Label htmlFor={`rm-${plano.id}`} className="mb-2">
              Por que está sendo reaberto
            </Label>
            <Textarea id={`rm-${plano.id}`} name="motivo" rows={2} required />
          </div>
          <div>
            <Button type="submit" disabled={enviando}>
              Reabrir plano
            </Button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
