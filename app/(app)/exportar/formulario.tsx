'use client';

import { useEffect, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { MARCACOES } from '@/lib/reg061';
import { previaDoMes, type Previa } from './acoes';

export function FormularioExportacao({
  supervisores,
  competenciaInicial,
}: {
  supervisores: { id: string; nome: string }[];
  competenciaInicial: string;
}) {
  const [competencia, setCompetencia] = useState(competenciaInicial);
  const [supervisorId, setSupervisorId] = useState('');
  const [previa, setPrevia] = useState<Previa[] | null>(null);
  const [carregando, iniciar] = useTransition();

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(competencia)) return;
    let vivo = true;
    iniciar(async () => {
      const r = await previaDoMes(competencia, supervisorId || null);
      if (vivo) setPrevia(r);
    });
    return () => {
      vivo = false;
    };
  }, [competencia, supervisorId]);

  /**
   * Link de verdade, e não navegação do router: isto baixa um arquivo, não abre
   * uma página. Assim o navegador cuida do download e o "salvar como" funciona.
   */
  const endereco = (formato: 'xlsx' | 'pdf') => {
    const p = new URLSearchParams({ competencia, formato });
    if (supervisorId) p.set('supervisor', supervisorId);
    return `/api/exportar/reg061?${p.toString()}`;
  };

  const valido = /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia);
  const temConteudo = (previa ?? []).some((p) => p.contratos > 0);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="bg-card grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="competencia" className="mb-2">
            Mês
          </Label>
          <Input
            id="competencia"
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="supervisor" className="mb-2">
            Supervisor
          </Label>
          <Select
            id="supervisor"
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
          >
            <option value="">Todos — uma aba por supervisor</option>
            {supervisores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Prévia: o que vai sair, antes de gerar */}
      <div>
        <h2 className="mb-2 font-semibold">O que vai no arquivo</h2>

        {!valido ? (
          <p className="text-muted-foreground text-sm">Escolha o mês.</p>
        ) : carregando && previa === null ? (
          <p className="text-muted-foreground text-sm">Conferindo…</p>
        ) : (previa ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum supervisor cadastrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(previa ?? []).map((p) => (
              <li
                key={p.supervisorNome}
                className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{p.supervisorNome}</p>
                  <p className="text-muted-foreground text-sm">
                    {p.contratos} contrato{p.contratos === 1 ? '' : 's'} na carteira do mês
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {Object.entries(p.marcacoes).length === 0 ? (
                    <span className="text-muted-foreground text-xs">
                      nenhuma marcação no mês
                    </span>
                  ) : (
                    Object.entries(p.marcacoes).map(([letra, n]) => (
                      <Badge key={letra} variant="secondary">
                        {letra} {n}
                      </Badge>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {valido && temConteudo ? (
          <>
            <Button size="lg" asChild>
              <a href={endereco('xlsx')} download>
                Baixar Excel
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={endereco('pdf')} download>
                Baixar PDF
              </a>
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" disabled>
              Baixar Excel
            </Button>
            <Button size="lg" variant="outline" disabled>
              Baixar PDF
            </Button>
          </>
        )}
      </div>

      <div className="text-muted-foreground text-sm">
        <p className="mb-1 font-medium">Legenda do arquivo</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(MARCACOES).map(([letra, descricao]) => (
            <li key={letra}>
              <strong>{letra}</strong> {descricao.toLowerCase()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
