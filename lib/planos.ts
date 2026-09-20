import { somarDias } from './semana';

/**
 * Planos de ação por contrato (seção 10). O plano nasce dentro da visita, mas
 * pertence ao contrato — é isso que o faz reaparecer na próxima ida à unidade.
 */

export const PRIORIDADES = ['baixa', 'normal', 'alta', 'critica'] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const STATUS_PLANO = ['aberto', 'em_andamento', 'resolvido', 'cancelado'] as const;
export type StatusPlano = (typeof STATUS_PLANO)[number];

export const TIPOS_ATUALIZACAO = [
  'acompanhamento',
  'edicao',
  'resolucao',
  'reabertura',
  'cancelamento',
] as const;
export type TipoAtualizacao = (typeof TIPOS_ATUALIZACAO)[number];

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  critica: 'Crítica',
};

export const ROTULO_STATUS_PLANO: Record<StatusPlano, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
};

export const ROTULO_TIPO: Record<TipoAtualizacao, string> = {
  acompanhamento: 'Acompanhamento',
  edicao: 'Edição',
  resolucao: 'Resolução',
  reabertura: 'Reabertura',
  cancelamento: 'Cancelamento',
};

/**
 * Decisão 13.15: o sistema sugere o prazo pela prioridade, e o supervisor pode
 * trocar. Sugerir evita o prazo em branco; travar impediria o caso real em que
 * a solução depende de terceiro.
 */
const DIAS_SUGERIDOS: Record<Prioridade, number> = {
  critica: 2,
  alta: 7,
  normal: 15,
  baixa: 30,
};

export function prazoSugerido(prioridade: Prioridade, hoje: string): string {
  return somarDias(hoje, DIAS_SUGERIDOS[prioridade]);
}

export function textoDoPrazoSugerido(prioridade: Prioridade): string {
  const dias = DIAS_SUGERIDOS[prioridade];
  return dias === 2 ? '48 horas' : `${dias} dias`;
}

/**
 * Decisão 13.16: plano de prioridade alta ou crítica só é encerrado pela
 * coordenação. Quem abriu a ocorrência grave não é quem decide que ela acabou.
 */
export function exigeCoordenacaoParaEncerrar(prioridade: Prioridade): boolean {
  return prioridade === 'alta' || prioridade === 'critica';
}

export function estaVencido(
  plano: { prazo: string | null; status: StatusPlano },
  hoje: string,
): boolean {
  if (plano.status === 'resolvido' || plano.status === 'cancelado') return false;
  return plano.prazo !== null && plano.prazo < hoje;
}

/** Aberto e em andamento são os que ainda cobram (seção 10.2). */
export function estaAberto(status: StatusPlano): boolean {
  return status === 'aberto' || status === 'em_andamento';
}

export type PlanoMedido = {
  status: StatusPlano;
  prazo: string | null;
  criadoEm: Date;
  resolvidoEm: Date | null;
  contratoId: string;
};

export type ResumoPlanos = {
  abertos: number;
  emAndamento: number;
  resolvidos: number;
  cancelados: number;
  vencidos: number;
  /** Horas entre a abertura e a resolução, média dos resolvidos. */
  horasMediaAteResolver: number | null;
  /** Contratos com mais de um plano não cancelado no período: reincidência. */
  contratosReincidentes: number;
};

export function resumirPlanos(planos: PlanoMedido[], hoje: string): ResumoPlanos {
  const resolvidos = planos.filter((p) => p.status === 'resolvido' && p.resolvidoEm !== null);

  const horas =
    resolvidos.length === 0
      ? null
      : resolvidos.reduce(
          (soma, p) => soma + (p.resolvidoEm!.getTime() - p.criadoEm.getTime()),
          0,
        ) /
        resolvidos.length /
        (1000 * 60 * 60);

  /*
   * Reincidência conta o que de fato virou problema na unidade. Plano
   * cancelado é o que foi retirado — contá-lo faria a unidade parecer pior do
   * que é justamente quando alguém teve o cuidado de corrigir o registro.
   */
  const porContrato = new Map<string, number>();
  for (const p of planos) {
    if (p.status === 'cancelado') continue;
    porContrato.set(p.contratoId, (porContrato.get(p.contratoId) ?? 0) + 1);
  }

  return {
    abertos: planos.filter((p) => p.status === 'aberto').length,
    emAndamento: planos.filter((p) => p.status === 'em_andamento').length,
    resolvidos: planos.filter((p) => p.status === 'resolvido').length,
    cancelados: planos.filter((p) => p.status === 'cancelado').length,
    vencidos: planos.filter((p) => estaVencido(p, hoje)).length,
    horasMediaAteResolver: horas,
    contratosReincidentes: [...porContrato.values()].filter((n) => n > 1).length,
  };
}
