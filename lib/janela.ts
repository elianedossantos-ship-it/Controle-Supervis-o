import { formatarData } from './datas';
import { somarDias } from './semana';

/**
 * Decisão 13.1 — a trava da sexta. A pergunta do escopo é o horário em que a
 * programação fecha: **sexta às 18h**, no fuso de São Paulo, da semana
 * anterior à que está sendo montada.
 *
 * Fecha é fecha: depois disso o supervisor não monta nem envia, e só a
 * coordenação reabre (seção 4.1). A saída de emergência existe — a coordenação
 * edita e envia a qualquer hora —, senão um esquecimento na sexta deixaria a
 * semana inteira sem programação, que é pior que o atraso.
 *
 * A quinta-feira da proposta ficou como **referência, não como bloqueio**: é
 * quando a semana corrente já está quase fechada e os avisos de periodicidade
 * valem mais. Travar o envio antes disso custaria caro — o supervisor que
 * organiza a semana na segunda teria de voltar na quinta só para clicar — e
 * não é o que a decisão 13.1 pergunta.
 */

export const HORA_FECHAMENTO = 18;

export type EstadoJanela = 'antes' | 'aberta' | 'fechada';

/** Quinta-feira anterior à semana montada. */
export function aberturaDaJanela(semanaInicio: string): string {
  return somarDias(semanaInicio, -4);
}

/** Sexta-feira anterior à semana montada. */
export function fechamentoDaJanela(semanaInicio: string): string {
  return somarDias(semanaInicio, -3);
}

/** Dia e minutos do dia em São Paulo — o servidor pode estar em UTC. */
function emSaoPaulo(instante: Date): { dia: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);

  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;

  return {
    dia: `${parte('year')}-${parte('month')}-${parte('day')}`,
    minutos: Number(parte('hour')) * 60 + Number(parte('minute')),
  };
}

export function estadoDaJanela(semanaInicio: string, agora: Date): EstadoJanela {
  const { dia, minutos } = emSaoPaulo(agora);
  const abre = aberturaDaJanela(semanaInicio);
  const fecha = fechamentoDaJanela(semanaInicio);

  if (dia > fecha) return 'fechada';
  if (dia === fecha && minutos >= HORA_FECHAMENTO * 60) return 'fechada';
  // Antes da quinta a semana já é editável e enviável; o estado só muda o aviso.
  return dia < abre ? 'antes' : 'aberta';
}

/** Frase para a tela: o supervisor precisa saber até quando tem. */
export function textoDaJanela(semanaInicio: string, agora: Date): string {
  const estado = estadoDaJanela(semanaInicio, agora);
  const abre = formatarData(aberturaDaJanela(semanaInicio));
  const fecha = formatarData(fechamentoDaJanela(semanaInicio));

  if (estado === 'antes') {
    return `Envie até as ${HORA_FECHAMENTO}h da sexta, ${fecha}. A semana costuma ser fechada a partir de quinta, ${abre}, quando a semana corrente já está quase toda registrada.`;
  }
  if (estado === 'aberta') {
    return `Envie até as ${HORA_FECHAMENTO}h da sexta, ${fecha}. Depois disso só a coordenação reabre.`;
  }
  return `A janela fechou às ${HORA_FECHAMENTO}h de sexta, ${fecha}. Só a coordenação reabre.`;
}
