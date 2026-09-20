'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CartaoDoPlano } from '@/components/planos/cartao';
import { NovoPlano } from '@/app/(app)/planos/novo';
import { carregarPlano, listarPlanos } from '@/app/(app)/planos/acoes';
import { hojeISO } from '@/lib/datas';
import type { PlanoCompleto } from '@/app/(app)/planos/acoes';

/**
 * Seção 10: na visita, os planos abertos da unidade aparecem antes de qualquer
 * ação; e logo depois de registrar a visita vem a pergunta do plano novo.
 */
export function PlanosDaVisita({
  contratoId,
  contratoNome,
  visitaId,
  perguntar,
  onDispensar,
}: {
  contratoId: string;
  contratoNome: string;
  visitaId: string;
  perguntar: boolean;
  onDispensar: () => void;
}) {
  const [planos, setPlanos] = useState<PlanoCompleto[] | null>(null);
  const [querAbrir, setQuerAbrir] = useState(false);
  const hoje = hojeISO();

  useEffect(() => {
    let vivo = true;
    listarPlanos({ contratoId, apenasAbertos: true })
      .then(async (resumidos) => {
        const completos = await Promise.all(resumidos.map((p) => carregarPlano(p.id)));
        if (vivo) setPlanos(completos.filter((p): p is PlanoCompleto => p !== null));
      })
      .catch(() => {
        if (vivo) setPlanos([]);
      });
    return () => {
      vivo = false;
    };
  }, [contratoId]);

  return (
    <div className="mt-3 flex flex-col gap-3">
      {planos && planos.length > 0 ? (
        <section className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">
            Planos abertos em {contratoNome}
          </p>
          <div className="flex flex-col gap-3">
            {planos.map((p) => (
              <CartaoDoPlano
                key={p.id}
                plano={p}
                hoje={hoje}
                ehCoordenacao={false}
                visitaId={visitaId}
              />
            ))}
          </div>
        </section>
      ) : null}

      {perguntar && !querAbrir ? (
        <Alert>
          <AlertDescription>
            <p className="mb-3 font-medium">Precisa abrir plano de ação?</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setQuerAbrir(true)}>
                Sim
              </Button>
              <Button size="sm" variant="outline" onClick={onDispensar}>
                Não
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {querAbrir ? (
        <NovoPlano
          contratos={[]}
          hoje={hoje}
          contratoFixo={contratoId}
          visitaId={visitaId}
          rotuloBotao="Abrir plano de ação"
          aoConcluir={() => {
            setQuerAbrir(false);
            onDispensar();
          }}
        />
      ) : null}
    </div>
  );
}
