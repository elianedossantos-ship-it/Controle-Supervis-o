import { feriadoAlcancaContrato, type FeriadoRegistro } from './feriados-aplicaveis';
import { diaDaSemana, somarDias } from './semana';

/**
 * Montagem do REG-061 mensal a partir das visitas.
 *
 * A planilha é mensal, mas o dado primário do sistema é a visita por data: este
 * módulo faz a volta, transformando visitas em grade de 31 colunas.
 */

/** Marcações da legenda, na ordem de prioridade da célula. */
export const MARCACOES = {
  R: 'Realizada',
  E: 'Extra',
  C: 'Cancelada',
  P: 'Programada',
  F: 'Feriado',
  S: 'Sábado',
  D: 'Domingo',
} as const;

export type Marcacao = keyof typeof MARCACOES | '';

export type VisitaDoMes = {
  contratoId: string;
  dia: number;
  origem: string;
  status: string;
};

export type ContratoDoMes = {
  contratoId: string;
  nome: string;
  endereco: string;
  periodicidade: string;
  cidade: string | null;
  uf: string | null;
};

export type LinhaREG061 = {
  contratoId: string;
  cliente: string;
  endereco: string;
  periodicidade: string;
  /** Índice 0 = dia 1. */
  marcacoes: Marcacao[];
};

export type GradeREG061 = {
  /** 'YYYY-MM' */
  competencia: string;
  mesPorExtenso: string;
  ano: number;
  diasNoMes: number;
  supervisorNome: string;
  linhas: LinhaREG061[];
};

export function diasNoMes(competencia: string): number {
  const [ano, mes] = competencia.split('-').map(Number);
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function primeiroDia(competencia: string): string {
  return `${competencia}-01`;
}

export function ultimoDia(competencia: string): string {
  return `${competencia}-${String(diasNoMes(competencia)).padStart(2, '0')}`;
}

export function mesPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const nome = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, mes - 1, 1)));
  return nome.toUpperCase();
}

/**
 * A marcação da célula. Visita tem prioridade sobre o calendário: se houve
 * visita num sábado ou feriado, o que o registro precisa mostrar é a visita.
 *
 * Entre visitas do mesmo dia vale R > E > C > P: o que aconteceu pesa mais que
 * o que estava previsto.
 */
export function marcacaoDaCelula(
  visitas: VisitaDoMes[],
  ehFeriado: boolean,
  diaSemana: number,
): Marcacao {
  if (visitas.some((v) => v.status === 'realizada')) return 'R';
  if (visitas.some((v) => v.origem === 'extra')) return 'E';
  if (visitas.some((v) => v.status === 'cancelada')) return 'C';
  if (visitas.length > 0) return 'P';

  if (ehFeriado) return 'F';
  if (diaSemana === 6) return 'S';
  if (diaSemana === 0) return 'D';
  return '';
}

export function montarGrade(
  competencia: string,
  supervisorNome: string,
  contratos: ContratoDoMes[],
  visitas: VisitaDoMes[],
  feriados: FeriadoRegistro[],
): GradeREG061 {
  const total = diasNoMes(competencia);
  const inicio = primeiroDia(competencia);

  const linhas: LinhaREG061[] = contratos.map((c) => {
    const doContrato = visitas.filter((v) => v.contratoId === c.contratoId);

    const marcacoes: Marcacao[] = [];
    for (let i = 0; i < total; i++) {
      const dataISO = somarDias(inicio, i);
      const dia = i + 1;

      const ehFeriado = feriados.some(
        (f) => f.data === dataISO && feriadoAlcancaContrato(f, { uf: c.uf, cidade: c.cidade }),
      );

      marcacoes.push(
        marcacaoDaCelula(
          doContrato.filter((v) => v.dia === dia),
          ehFeriado,
          diaDaSemana(dataISO),
        ),
      );
    }

    return {
      contratoId: c.contratoId,
      cliente: c.nome,
      endereco: c.endereco,
      periodicidade: c.periodicidade,
      marcacoes,
    };
  });

  const [ano] = competencia.split('-').map(Number);

  return {
    competencia,
    mesPorExtenso: mesPorExtenso(competencia),
    ano,
    diasNoMes: total,
    supervisorNome,
    linhas,
  };
}

/** Nome de arquivo previsível, sem acento nem espaço. */
export function nomeDoArquivo(
  competencia: string,
  supervisorNome: string,
  extensao: 'xlsx' | 'pdf',
): string {
  const limpo = supervisorNome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `REG-061-${competencia}-${limpo || 'supervisor'}.${extensao}`;
}
