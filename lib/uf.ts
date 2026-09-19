/**
 * As 27 unidades federativas. O banco guarda CHAR(2), mas aceitar qualquer par
 * de letras cria furo silencioso: feriado estadual com UF inexistente nunca
 * casaria com contrato nenhum, e o dia seguiria aberto para programação.
 */
export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

export type UF = (typeof UFS)[number];

export function ehUF(valor: string): valor is UF {
  return (UFS as readonly string[]).includes(valor);
}
