import { hojeISO } from './datas';

/**
 * A semana de referência do sistema é segunda a sexta (seção 4.1).
 *
 * Toda conta é feita sobre 'YYYY-MM-DD' em UTC. Trabalhar com Date no fuso
 * local faria a virada do horário de verão deslocar a segunda-feira.
 */
export type Semana = {
  /** Segunda-feira, 'YYYY-MM-DD'. */
  inicio: string;
  /** Sexta-feira, 'YYYY-MM-DD'. */
  fim: string;
  /** Os cinco dias úteis, de segunda a sexta. */
  dias: string[];
};

export const DIAS_DA_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'] as const;

export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const;

function paraUTC(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function paraISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  const d = paraUTC(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraISO(d);
}

/** 0 = domingo, 1 = segunda ... 6 = sábado. */
export function diaDaSemana(iso: string): number {
  return paraUTC(iso).getUTCDay();
}

export function ehFimDeSemana(iso: string): boolean {
  const d = diaDaSemana(iso);
  return d === 0 || d === 6;
}

/** A segunda-feira da semana em que a data cai. Domingo pertence à semana anterior. */
export function segundaDaSemana(iso: string): string {
  const d = diaDaSemana(iso);
  const recuo = d === 0 ? 6 : d - 1;
  return somarDias(iso, -recuo);
}

export function semanaDe(iso: string): Semana {
  const inicio = segundaDaSemana(iso);
  return {
    inicio,
    fim: somarDias(inicio, 4),
    dias: [0, 1, 2, 3, 4].map((i) => somarDias(inicio, i)),
  };
}

/** A semana seguinte à de hoje: a que o supervisor monta na sexta. */
export function proximaSemana(): Semana {
  return semanaDe(somarDias(segundaDaSemana(hojeISO()), 7));
}

export function semanaAtual(): Semana {
  return semanaDe(hojeISO());
}

/** 'de 21 a 25 de setembro de 2026' — para o cabeçalho da tela. */
export function rotuloSemana(semana: Semana): string {
  const inicio = paraUTC(semana.inicio);
  const fim = paraUTC(semana.fim);

  const mesDe = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(d);

  const diaInicio = inicio.getUTCDate();
  const diaFim = fim.getUTCDate();
  const ano = fim.getUTCFullYear();

  if (inicio.getUTCMonth() === fim.getUTCMonth()) {
    return `${diaInicio} a ${diaFim} de ${mesDe(fim)} de ${ano}`;
  }
  return `${diaInicio} de ${mesDe(inicio)} a ${diaFim} de ${mesDe(fim)} de ${ano}`;
}

/** Primeiro e último dia do mês em que a data cai, em ISO. */
export function limitesDoMes(iso: string): { primeiro: string; ultimo: string } {
  const [ano, mes] = iso.split('-').map(Number);
  const primeiro = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const ultimo = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { primeiro, ultimo };
}

/**
 * O mês a que a semana pertence, 'YYYY-MM'. É o mês da segunda-feira: numa
 * semana que cruza a virada, quem está acabando é o mês em que ela começou, e
 * é dele que a regra MENSAL fala.
 */
export function mesDaSemana(semana: Semana): string {
  return semana.inicio.slice(0, 7);
}

/**
 * É a última semana do mês a que ela pertence? Comparar com o último dia do mês
 * não serve: a semana pode terminar já no mês seguinte. O que decide é a semana
 * seguinte cair em outro mês.
 */
export function ehUltimaSemanaDoMes(semana: Semana): boolean {
  return somarDias(semana.inicio, 7).slice(0, 7) !== mesDaSemana(semana);
}
