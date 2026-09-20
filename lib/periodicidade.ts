import type { Periodicidade } from './contratos';
import { ehUltimaSemanaDoMes, mesDaSemana, somarDias, type Semana } from './semana';

export type ContratoParaAviso = {
  contratoId: string;
  contratoNome: string;
  periodicidade: Periodicidade;
  /** Visitas marcadas na semana que está sendo montada. */
  programadasNaSemana: number;
  /** Última visita realizada, 'YYYY-MM-DD', ou null se nunca houve. */
  ultimaRealizada: string | null;
  /** Já há visita (realizada ou prevista) no mês da semana? */
  temVisitaNoMes: boolean;
};

export type Aviso = {
  contratoId: string;
  contratoNome: string;
  periodicidade: Periodicidade;
  motivo: string;
};

/** O que cada periodicidade espera de uma semana — para exibir na grade. */
export const ESPERADO: Record<Periodicidade, string> = {
  SEMANAL: '1 visita na semana',
  '2X NA SEMANA': '2 visitas na semana',
  QUINZENAL: '1 visita a cada 2 semanas',
  MENSAL: '1 visita no mês',
};

/**
 * Regras da seção 4.2. São aviso, nunca bloqueio: o sistema calcula o esperado,
 * mostra a lista antes do envio e o supervisor pode enviar assim mesmo.
 */
export function avaliarContrato(
  contrato: ContratoParaAviso,
  semana: Semana,
): Aviso | null {
  const motivo = motivoDoAviso(contrato, semana);
  if (!motivo) return null;

  return {
    contratoId: contrato.contratoId,
    contratoNome: contrato.contratoNome,
    periodicidade: contrato.periodicidade,
    motivo,
  };
}

function motivoDoAviso(c: ContratoParaAviso, semana: Semana): string | null {
  switch (c.periodicidade) {
    case 'SEMANAL':
      return c.programadasNaSemana === 0 ? 'Nenhuma visita programada na semana.' : null;

    case '2X NA SEMANA':
      if (c.programadasNaSemana >= 2) return null;
      return c.programadasNaSemana === 0
        ? 'Nenhuma visita programada; esperado 2 na semana.'
        : 'Só 1 visita programada; esperado 2 na semana.';

    case 'QUINZENAL': {
      if (c.programadasNaSemana > 0) return null;

      // "sem visita há 2 semanas fechadas": as duas semanas inteiras anteriores
      // a esta. Se a última realizada for anterior a esse corte, está atrasado.
      const corte = somarDias(semana.inicio, -14);

      if (c.ultimaRealizada === null) {
        return 'Sem visita programada e nenhuma visita realizada até hoje.';
      }
      return c.ultimaRealizada < corte
        ? `Sem visita programada e a última realizada foi em ${formatar(c.ultimaRealizada)}.`
        : null;
    }

    case 'MENSAL': {
      if (c.programadasNaSemana > 0) return null;
      if (c.temVisitaNoMes) return null;

      // "mês corrente sem visita e restando 1 semana": só avisa quando é a
      // última semana do mês. Antes disso ainda dá tempo.
      return ehUltimaSemanaDoMes(semana)
        ? `Última semana de ${nomeDoMes(mesDaSemana(semana))} e o mês está sem visita.`
        : null;
    }
  }
}

function formatar(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function nomeDoMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(ano, mes - 1, 1)),
  );
}

export function avaliarTodos(
  contratos: ContratoParaAviso[],
  semana: Semana,
): Aviso[] {
  return contratos
    .map((c) => avaliarContrato(c, semana))
    .filter((a): a is Aviso => a !== null);
}

/** "3 contratos fora da periodicidade" */
export function resumoDosAvisos(avisos: Aviso[]): string {
  if (avisos.length === 0) return 'Todos os contratos dentro da periodicidade.';
  return avisos.length === 1
    ? '1 contrato fora da periodicidade'
    : `${avisos.length} contratos fora da periodicidade`;
}
