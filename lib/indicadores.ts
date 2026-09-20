import type { Periodicidade } from './contratos';
import { somarDias } from './semana';

/* -------------------------------------------------------------------------- */
/* Aderência (seção 7)                                                         */
/* -------------------------------------------------------------------------- */

export type ContagemVisitas = {
  /** Visitas de origem 'programada' no período, em qualquer status. */
  programadas: number;
  /** Dessas, as que foram realizadas. */
  programadasRealizadas: number;
  /** Visitas extras realizadas no período. */
  extrasRealizadas: number;
};

/**
 * Fórmula da seção 7:
 *   (realizadas programadas + extras realizadas) ÷ programadas × 100
 *
 * Pode passar de 100%: uma semana com muitas extras rende mais visitas do que
 * as programadas. É o que a fórmula diz, e é informação útil — não foi limitada.
 * Sem nenhuma visita programada no período não há denominador, e o indicador
 * fica indefinido em vez de virar zero.
 */
export function aderencia(c: ContagemVisitas): number | null {
  if (c.programadas === 0) return null;
  return ((c.programadasRealizadas + c.extrasRealizadas) / c.programadas) * 100;
}

export function formatarPercentual(valor: number | null, casas = 1): string {
  if (valor === null) return '—';
  return `${valor.toFixed(casas).replace('.', ',')}%`;
}

/* -------------------------------------------------------------------------- */
/* Cumprimento da periodicidade                                                */
/* -------------------------------------------------------------------------- */

export type PeriodoAvaliado = {
  inicio: string;
  fim: string;
};

/** Dias do período, contando as duas pontas. */
export function diasDoPeriodo(p: PeriodoAvaliado): number {
  let n = 0;
  for (let d = p.inicio; d <= p.fim; d = somarDias(d, 1)) n++;
  return n;
}

/** Meses de calendário que o período encosta. */
export function mesesDoPeriodo(p: PeriodoAvaliado): number {
  const meses = new Set<string>();
  for (let d = p.inicio; d <= p.fim; d = somarDias(d, 1)) meses.add(d.slice(0, 7));
  return meses.size;
}

/**
 * Quantas visitas se espera de um contrato no período.
 *
 * A seção 4.2 define o esperado por semana; aqui ele é estendido ao período
 * escolhido no filtro. Usa semanas inteiras (`floor`) de propósito: um período
 * de 10 dias não deve cobrar 1,4 visita de um contrato semanal.
 *
 * Período curto demais devolve 0 — e aí o contrato não entra na conta de dentro
 * x fora, em vez de aparecer como cumprido de graça.
 */
export function esperadoNoPeriodo(
  periodicidade: Periodicidade,
  p: PeriodoAvaliado,
): number {
  const semanas = Math.floor(diasDoPeriodo(p) / 7);

  switch (periodicidade) {
    case 'SEMANAL':
      return semanas;
    case '2X NA SEMANA':
      return semanas * 2;
    case 'QUINZENAL':
      return Math.floor(semanas / 2);
    case 'MENSAL':
      return mesesDoPeriodo(p);
  }
}

export type ContratoNoPeriodo = {
  contratoId: string;
  contratoNome: string;
  periodicidade: Periodicidade;
  realizadas: number;
};

export type CumprimentoPeriodicidade = {
  dentro: number;
  fora: number;
  /** Contratos cujo esperado no período é 0: não dá para avaliar. */
  naoAvaliados: number;
  detalhe: {
    contratoId: string;
    contratoNome: string;
    periodicidade: Periodicidade;
    esperado: number;
    realizadas: number;
    dentro: boolean;
  }[];
};

export function cumprimentoDaPeriodicidade(
  contratos: ContratoNoPeriodo[],
  p: PeriodoAvaliado,
): CumprimentoPeriodicidade {
  let dentro = 0;
  let fora = 0;
  let naoAvaliados = 0;
  const detalhe: CumprimentoPeriodicidade['detalhe'] = [];

  for (const c of contratos) {
    const esperado = esperadoNoPeriodo(c.periodicidade, p);

    if (esperado === 0) {
      naoAvaliados++;
      continue;
    }

    const cumpriu = c.realizadas >= esperado;
    if (cumpriu) dentro++;
    else fora++;

    detalhe.push({
      contratoId: c.contratoId,
      contratoNome: c.contratoNome,
      periodicidade: c.periodicidade,
      esperado,
      realizadas: c.realizadas,
      dentro: cumpriu,
    });
  }

  // Os fora da periodicidade primeiro: é o que a coordenação precisa ver.
  detalhe.sort((a, b) => {
    if (a.dentro !== b.dentro) return a.dentro ? 1 : -1;
    return a.realizadas / a.esperado - b.realizadas / b.esperado;
  });

  return { dentro, fora, naoAvaliados, detalhe };
}

/* -------------------------------------------------------------------------- */
/* Visitas extras e registros sem localização                                  */
/* -------------------------------------------------------------------------- */

export function percentualDeExtras(
  extrasRealizadas: number,
  totalRealizadas: number,
): number | null {
  if (totalRealizadas === 0) return null;
  return (extrasRealizadas / totalRealizadas) * 100;
}

/* -------------------------------------------------------------------------- */
/* Demandas extras                                                             */
/* -------------------------------------------------------------------------- */

export type DemandaMedida = {
  criadoEm: Date;
  concluidaEm: Date | null;
};

export type ResumoDemandas = {
  abertas: number;
  concluidas: number;
  /** Horas entre a criação e a conclusão, média das concluídas. */
  horasMediaAteConcluir: number | null;
};

export function resumirDemandas(
  abertas: number,
  concluidas: DemandaMedida[],
): ResumoDemandas {
  const comPrazo = concluidas.filter((d) => d.concluidaEm !== null);

  if (comPrazo.length === 0) {
    return { abertas, concluidas: concluidas.length, horasMediaAteConcluir: null };
  }

  const horas =
    comPrazo.reduce(
      (soma, d) => soma + (d.concluidaEm!.getTime() - d.criadoEm.getTime()),
      0,
    ) /
    comPrazo.length /
    (1000 * 60 * 60);

  return {
    abertas,
    concluidas: concluidas.length,
    horasMediaAteConcluir: horas,
  };
}

/** '4 h', '2 d 6 h' — para o painel, que lê melhor que "54,3 horas". */
export function formatarDuracao(horas: number | null): string {
  if (horas === null) return '—';
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1).replace('.', ',')} h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas % 24);
  return resto === 0 ? `${dias} d` : `${dias} d ${resto} h`;
}

/* -------------------------------------------------------------------------- */
/* Cancelamentos por motivo                                                    */
/* -------------------------------------------------------------------------- */

export type MotivoContado = {
  descricao: string;
  categoria: string | null;
  quantidade: number;
};

export type RankingMotivos = {
  total: number;
  itens: (MotivoContado & { percentual: number })[];
};

/** Ranqueado do que mais tira o supervisor da rota para o que menos tira. */
export function ranquearMotivos(motivos: MotivoContado[]): RankingMotivos {
  const total = motivos.reduce((s, m) => s + m.quantidade, 0);

  const itens = [...motivos]
    .filter((m) => m.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade || a.descricao.localeCompare(b.descricao))
    .map((m) => ({ ...m, percentual: total === 0 ? 0 : (m.quantidade / total) * 100 }));

  return { total, itens };
}

/* -------------------------------------------------------------------------- */
/* Período padrão: mês corrente (seção 7)                                      */
/* -------------------------------------------------------------------------- */

export function mesCorrente(hoje: string): PeriodoAvaliado {
  const [ano, mes] = hoje.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}` };
}
