/**
 * Avaliação trimestral de desempenho (seção 9). Digitaliza o formulário REV 00.
 */

export type CriterioComNota = {
  criterioId: string;
  competenciaId: string;
  /** null = não se aplica, e sai do denominador (seção 9.1). */
  nota: number | null;
};

export type CompetenciaAvaliada = {
  id: string;
  nome: string;
  /** 0.250 para 25% */
  peso: number;
};

export type NotaDaCompetencia = {
  competenciaId: string;
  nome: string;
  peso: number;
  preenchidos: number;
  total: number;
  /** Média dos critérios preenchidos, ou null se nenhum foi preenchido. */
  media: number | null;
};

/**
 * "Nota da competência = média dos critérios preenchidos."
 *
 * Critério em branco é "não se aplica" e sai do denominador (decisão 13.13,
 * confirmando o modelo REV 00). Competência inteira em branco fica sem nota e
 * sai do cálculo da final, em vez de contar zero.
 */
export function notasPorCompetencia(
  competencias: CompetenciaAvaliada[],
  notas: CriterioComNota[],
  criterios: { id: string; competenciaId: string }[],
): NotaDaCompetencia[] {
  return competencias.map((c) => {
    const doGrupo = criterios.filter((k) => k.competenciaId === c.id);
    const preenchidas = doGrupo
      .map((k) => notas.find((n) => n.criterioId === k.id)?.nota ?? null)
      .filter((n): n is number => n !== null);

    return {
      competenciaId: c.id,
      nome: c.nome,
      peso: c.peso,
      preenchidos: preenchidas.length,
      total: doGrupo.length,
      media:
        preenchidas.length === 0
          ? null
          : preenchidas.reduce((a, b) => a + b, 0) / preenchidas.length,
    };
  });
}

export type ResultadoAvaliacao = {
  /** Σ (nota da competência × peso), renormalizada se houver competência vazia. */
  notaFinal: number | null;
  /** nota final ÷ 5, em percentual. */
  aproveitamento: number | null;
  classificacao: string | null;
  /** Competências sem nenhum critério preenchido. */
  competenciasSemNota: string[];
};

/**
 * Faixas da seção 9.1, com o encaminhamento de cada uma.
 */
export const FAIXAS = [
  { min: 90, rotulo: 'Excelente', encaminhamento: 'Reconhecer e manter o padrão.' },
  { min: 75, rotulo: 'Bom', encaminhamento: 'Seguir com acompanhamento regular.' },
  { min: 60, rotulo: 'Satisfatório', encaminhamento: 'Plano de ação nos pontos de atenção.' },
  { min: 40, rotulo: 'Abaixo do esperado', encaminhamento: 'Plano de ação formal e acompanhamento próximo.' },
  { min: 0, rotulo: 'Insatisfatório', encaminhamento: 'Tratativa imediata com a coordenação.' },
] as const;

export function classificar(aproveitamento: number): string {
  return FAIXAS.find((f) => aproveitamento >= f.min)!.rotulo;
}

export function encaminhamentoDa(aproveitamento: number): string {
  return FAIXAS.find((f) => aproveitamento >= f.min)!.encaminhamento;
}

/**
 * "Nota final = Σ (nota da competência × peso)" e "aproveitamento = nota ÷ 5".
 *
 * Quando uma competência inteira fica sem nota, o peso dela é redistribuído
 * proporcionalmente entre as demais. Somar como zero puniria o supervisor por
 * algo que o avaliador marcou como não aplicável.
 */
export function calcularResultado(notas: NotaDaCompetencia[]): ResultadoAvaliacao {
  const comNota = notas.filter((n) => n.media !== null);
  const semNota = notas.filter((n) => n.media === null).map((n) => n.nome);

  if (comNota.length === 0) {
    return {
      notaFinal: null,
      aproveitamento: null,
      classificacao: null,
      competenciasSemNota: semNota,
    };
  }

  const pesoTotal = comNota.reduce((s, n) => s + n.peso, 0);
  const soma = comNota.reduce((s, n) => s + n.media! * n.peso, 0);
  const notaFinal = soma / pesoTotal;
  const aproveitamento = (notaFinal / 5) * 100;

  return {
    notaFinal,
    aproveitamento,
    classificacao: classificar(aproveitamento),
    competenciasSemNota: semNota,
  };
}

/** A soma dos pesos precisa fechar 100% (seção 9.2). */
export function pesosFecham(pesos: number[]): boolean {
  const soma = pesos.reduce((a, b) => a + b, 0);
  return Math.abs(soma - 1) < 0.0005;
}

export const ESCALA = [
  { nota: 5, rotulo: 'Excelente' },
  { nota: 4, rotulo: 'Acima do esperado' },
  { nota: 3, rotulo: 'Atende' },
  { nota: 2, rotulo: 'Abaixo do esperado' },
  { nota: 1, rotulo: 'Insatisfatório' },
] as const;

/** Trimestre a que uma data pertence, como período fechado. */
export function trimestreDe(iso: string): { inicio: string; fim: string; rotulo: string } {
  const [ano, mes] = iso.split('-').map(Number);
  const indice = Math.floor((mes - 1) / 3);
  const primeiroMes = indice * 3 + 1;
  const ultimoMes = primeiroMes + 2;
  const ultimoDia = new Date(Date.UTC(ano, ultimoMes, 0)).getUTCDate();

  return {
    inicio: `${ano}-${String(primeiroMes).padStart(2, '0')}-01`,
    fim: `${ano}-${String(ultimoMes).padStart(2, '0')}-${ultimoDia}`,
    rotulo: `${indice + 1}º trimestre de ${ano}`,
  };
}

export function formatarNota(valor: number | null): string {
  return valor === null ? '—' : valor.toFixed(2).replace('.', ',');
}
