import { diasNoMes } from './reg061';
import { ehFimDeSemana, segundaDaSemana, somarDias } from './semana';

/**
 * Regras do módulo de prazos e obrigações (seção 8).
 */

export const RECORRENCIAS = ['mensal', 'semanal', 'diaria'] as const;
export type Recorrencia = (typeof RECORRENCIAS)[number];

export const ESCOPOS = ['supervisor', 'contrato'] as const;
export type EscopoObrigacao = (typeof ESCOPOS)[number];

export const STATUS = [
  'pendente',
  'atendido',
  'atendido_atraso',
  'nao_atendido',
  'nao_aplicavel',
] as const;
export type StatusOcorrencia = (typeof STATUS)[number];

export const ROTULO_STATUS: Record<StatusOcorrencia, string> = {
  pendente: 'Pendente',
  atendido: 'Atendido',
  atendido_atraso: 'Atendido com atraso',
  nao_atendido: 'Não atendido',
  nao_aplicavel: 'Não se aplica',
};

export const ROTULO_RECORRENCIA: Record<Recorrencia, string> = {
  mensal: 'Mensal',
  semanal: 'Semanal',
  diaria: 'Diária',
};

export type Obrigacao = {
  id: string;
  nome: string;
  recorrencia: Recorrencia;
  diaLimite: number | null;
  diaSemana: number | null;
  escopo: EscopoObrigacao;
  automatica: boolean;
};

/* -------------------------------------------------------------------------- */
/* Competências e prazos                                                       */
/* -------------------------------------------------------------------------- */

/**
 * As competências de uma obrigação dentro de um mês.
 *
 * Mensal e diária têm uma por mês (o 1º dia). Semanal tem uma por semana, e a
 * competência é a segunda-feira — a mesma âncora usada na programação.
 */
export function competenciasDoMes(obrigacao: Obrigacao, mes: string): string[] {
  if (obrigacao.recorrencia !== 'semanal') return [`${mes}-01`];

  const total = diasNoMes(mes);
  const competencias: string[] = [];

  for (let dia = 1; dia <= total; dia++) {
    const data = `${mes}-${String(dia).padStart(2, '0')}`;
    const segunda = segundaDaSemana(data);
    // Só entram as semanas cuja segunda-feira cai dentro do mês: assim uma
    // semana que cruza a virada pertence a um mês só.
    if (segunda.slice(0, 7) === mes && !competencias.includes(segunda)) {
      competencias.push(segunda);
    }
  }

  return competencias;
}

/**
 * O prazo de uma competência.
 *
 * Mensal: o dia_limite do próprio mês. "Até o dia 7" é dia 7 daquele mês.
 * Semanal: o dia_semana dentro da semana (5 = sexta), contado da segunda.
 * Diária: o último dia do mês, porque a marcação é consolidada (decisão 13.9).
 */
export function prazoDaCompetencia(obrigacao: Obrigacao, competencia: string): string {
  if (obrigacao.recorrencia === 'semanal') {
    const dia = obrigacao.diaSemana ?? 5;
    // 1 = segunda ... 7 = domingo. A competência já é a segunda-feira.
    return somarDias(competencia, Math.min(Math.max(dia, 1), 7) - 1);
  }

  const mes = competencia.slice(0, 7);
  const ultimo = diasNoMes(mes);

  if (obrigacao.recorrencia === 'diaria') {
    return `${mes}-${String(ultimo).padStart(2, '0')}`;
  }

  const dia = Math.min(Math.max(obrigacao.diaLimite ?? 1, 1), ultimo);
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

/** Dias úteis (segunda a sexta) do mês — denominador do mapa de frequência. */
export function diasUteisDoMes(mes: string, feriados: string[] = []): number {
  const total = diasNoMes(mes);
  let n = 0;

  for (let dia = 1; dia <= total; dia++) {
    const data = `${mes}-${String(dia).padStart(2, '0')}`;
    if (ehFimDeSemana(data)) continue;
    if (feriados.includes(data)) continue;
    n++;
  }

  return n;
}

/* -------------------------------------------------------------------------- */
/* Situação da ocorrência                                                      */
/* -------------------------------------------------------------------------- */

export type Ocorrencia = {
  status: StatusOcorrencia;
  prazo: string;
  marcadoEm: Date | null;
};

/**
 * Ocorrência vencida e ainda não marcada continua 'pendente' (seção 8.2) — mas
 * a tela precisa distinguir a que ainda tem prazo da que já passou.
 */
export function estaVencida(o: Ocorrencia, hoje: string): boolean {
  return o.status === 'pendente' && o.prazo < hoje;
}

/**
 * Status automático do cronograma de visitas: o sistema já sabe se a
 * programação da semana seguinte foi enviada até a sexta (seção 8.2).
 */
export function statusDoCronograma(
  enviadaEm: Date | null,
  prazo: string,
  hoje: string,
): StatusOcorrencia {
  if (!enviadaEm) return prazo < hoje ? 'nao_atendido' : 'pendente';

  // O prazo é o dia inteiro: enviar às 18h da sexta ainda é dentro do prazo.
  const diaDoEnvio = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(enviadaEm);

  return diaDoEnvio <= prazo ? 'atendido' : 'atendido_atraso';
}

/* -------------------------------------------------------------------------- */
/* Indicador de cumprimento (seção 7)                                          */
/* -------------------------------------------------------------------------- */

export type CumprimentoPrazos = {
  aplicaveis: number;
  atendidos: number;
  atendidosComAtraso: number;
  naoAtendidos: number;
  pendentes: number;
  naoAplicaveis: number;
  /** atendidas no prazo ÷ aplicáveis × 100, ou null sem denominador. */
  percentual: number | null;
};

/**
 * "Ocorrências atendidas no prazo ÷ ocorrências aplicáveis × 100" (seção 7).
 *
 * Decisão 13.10, seguindo a proposta do escopo: "atendido com atraso" NÃO conta
 * como atendido no índice principal, e aparece em número próprio. Entregar a
 * folha no dia 9 não é o mesmo que não entregar, mas também não é no prazo.
 *
 * 'nao_aplicavel' sai do denominador: não havia o que cumprir.
 */
export function cumprimentoDePrazos(ocorrencias: { status: StatusOcorrencia }[]): CumprimentoPrazos {
  const conta = (s: StatusOcorrencia) => ocorrencias.filter((o) => o.status === s).length;

  const atendidos = conta('atendido');
  const atendidosComAtraso = conta('atendido_atraso');
  const naoAtendidos = conta('nao_atendido');
  const pendentes = conta('pendente');
  const naoAplicaveis = conta('nao_aplicavel');

  const aplicaveis = ocorrencias.length - naoAplicaveis;

  return {
    aplicaveis,
    atendidos,
    atendidosComAtraso,
    naoAtendidos,
    pendentes,
    naoAplicaveis,
    percentual: aplicaveis === 0 ? null : (atendidos / aplicaveis) * 100,
  };
}

/** Ocorrências vencidas ainda pendentes ou marcadas como não atendidas. */
export function prazosEmAtraso(
  ocorrencias: (Ocorrencia & { status: StatusOcorrencia })[],
  hoje: string,
): number {
  return ocorrencias.filter((o) => o.status === 'nao_atendido' || estaVencida(o, hoje)).length;
}
