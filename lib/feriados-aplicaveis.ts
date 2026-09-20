import type { Abrangencia } from './feriados';

export type FeriadoRegistro = {
  data: string;
  descricao: string;
  abrangencia: string;
  uf: string | null;
  municipio: string | null;
};

export type LocalDoContrato = {
  uf: string | null;
  cidade: string | null;
};

function mesmoTexto(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return (
    a
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toUpperCase() ===
    b
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toUpperCase()
  );
}

/**
 * Um feriado nacional vale para todo contrato. Estadual só para os da UF, e
 * municipal só para os daquele município — senão um feriado de uma cidade
 * bloquearia a agenda inteira do supervisor, inclusive em outra cidade.
 *
 * Contrato sem cidade/UF cadastrados só é alcançado por feriado nacional: não
 * dá para supor a localidade de quem não a informou.
 */
export function feriadoAlcancaContrato(
  feriado: FeriadoRegistro,
  local: LocalDoContrato,
): boolean {
  const abrangencia = feriado.abrangencia as Abrangencia;

  if (abrangencia === 'nacional') return true;
  if (abrangencia === 'estadual') return mesmoTexto(feriado.uf, local.uf);
  if (abrangencia === 'municipal') {
    return mesmoTexto(feriado.uf, local.uf) && mesmoTexto(feriado.municipio, local.cidade);
  }
  return false;
}

/** Os feriados de um dia que alcançam um contrato específico. */
export function feriadosDoContratoNoDia(
  feriados: FeriadoRegistro[],
  dia: string,
  local: LocalDoContrato,
): FeriadoRegistro[] {
  return feriados.filter((f) => f.data === dia && feriadoAlcancaContrato(f, local));
}

/** Texto do cabeçalho do dia: 'Independência' ou 'Independência e mais 1'. */
export function rotuloDoDia(feriados: FeriadoRegistro[], dia: string): string | null {
  const doDia = feriados.filter((f) => f.data === dia);
  if (doDia.length === 0) return null;
  if (doDia.length === 1) return doDia[0].descricao;
  return `${doDia[0].descricao} e mais ${doDia.length - 1}`;
}

/** O dia inteiro está bloqueado, para todos os contratos? Só feriado nacional faz isso. */
export function diaBloqueadoParaTodos(feriados: FeriadoRegistro[], dia: string): boolean {
  return feriados.some((f) => f.data === dia && f.abrangencia === 'nacional');
}
