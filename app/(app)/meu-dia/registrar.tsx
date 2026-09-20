'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { registrarRealizada } from './acoes';
import type { EstadoForm } from '@/lib/formulario';

type Localizacao =
  | { estado: 'procurando' }
  | { estado: 'obtida'; lat: number; lon: number; precisao: number }
  | { estado: 'negada'; motivo: string };

export function PainelRegistro({
  visitaId,
  onFechar,
}: {
  visitaId: string;
  onFechar: () => void;
}) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(registrarRealizada, {});
  const [local, setLocal] = useState<Localizacao>({ estado: 'procurando' });
  const [fotos, setFotos] = useState<string[]>([]);
  const entradaFoto = useRef<HTMLInputElement>(null);

  // A localização é capturada no mesmo instante da foto (seção 4.5). Se o GPS
  // falhar ou for negado, a visita é registrada assim mesmo e fica marcada como
  // sem localização — bloquear travaria o supervisor em prédio sem sinal.
  useEffect(() => {
    // Guarda de desmontagem: o supervisor pode fechar o painel antes de o GPS
    // responder, e aí não há mais estado para atualizar.
    let vivo = true;
    const responder = (l: Localizacao) => {
      if (vivo) setLocal(l);
    };

    if (!('geolocation' in navigator)) {
      // Pelo microtask, e não direto: setState no corpo do efeito encadeia
      // renderizações à toa.
      queueMicrotask(() =>
        responder({ estado: 'negada', motivo: 'Este aparelho não informa a localização.' }),
      );
      return () => {
        vivo = false;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (p) =>
        responder({
          estado: 'obtida',
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          precisao: p.coords.accuracy,
        }),
      (erro) =>
        responder({
          estado: 'negada',
          motivo:
            erro.code === erro.PERMISSION_DENIED
              ? 'Localização negada no aparelho.'
              : 'Não consegui obter a localização aqui.',
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    return () => {
      vivo = false;
    };
  }, []);

  function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const lista = Array.from(e.target.files ?? []);
    setFotos(lista.map((f) => URL.createObjectURL(f)));
  }

  // Fechar é efeito colateral: chamar o setState do pai durante a renderização
  // é justamente o que o React manda não fazer.
  useEffect(() => {
    if (estado.ok) onFechar();
  }, [estado.ok, onFechar]);

  return (
    <form action={enviar} className="bg-muted/40 mt-3 flex flex-col gap-4 rounded-lg border p-4">
      <input type="hidden" name="visitaId" value={visitaId} />
      <input
        type="hidden"
        name="latitude"
        value={local.estado === 'obtida' ? local.lat : ''}
      />
      <input
        type="hidden"
        name="longitude"
        value={local.estado === 'obtida' ? local.lon : ''}
      />
      <input
        type="hidden"
        name="precisao"
        value={local.estado === 'obtida' ? local.precisao : ''}
      />

      <div>
        <Label htmlFor={`foto-${visitaId}`} className="mb-2">
          Foto da visita
        </Label>
        {/*
          capture="environment" pede a câmera traseira. É uma dica ao navegador:
          o celular abre a câmera, mas nenhum site consegue impedir, por conta
          própria, que a pessoa escolha da galeria.
        */}
        <Input
          ref={entradaFoto}
          id={`foto-${visitaId}`}
          name="foto"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          required
          onChange={aoEscolherFoto}
          className="h-auto py-2"
        />
        {fotos.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {fotos.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt="Prévia da foto"
                className="h-20 w-20 rounded-md border object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="text-sm">
        {local.estado === 'procurando' ? (
          <p className="text-muted-foreground">Obtendo a localização…</p>
        ) : local.estado === 'obtida' ? (
          <p className="text-muted-foreground">
            Localização obtida (precisão de {Math.round(local.precisao)} m).
          </p>
        ) : (
          <p className="text-destructive">
            {local.motivo} A visita será registrada mesmo assim e aparecerá no painel
            como <strong>sem localização</strong>.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor={`obs-${visitaId}`} className="mb-2">
          Observação (opcional)
        </Label>
        <Textarea id={`obs-${visitaId}`} name="observacao" rows={2} />
      </div>

      {estado.erro ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <BotaoConfirmar />
        <Button type="button" variant="outline" size="lg" onClick={onFechar}>
          Cancelar
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        O horário do registro é o do servidor, não o do aparelho.
      </p>
    </form>
  );
}

function BotaoConfirmar() {
  return (
    <Button type="submit" size="lg" className="flex-1">
      Confirmar visita
    </Button>
  );
}
