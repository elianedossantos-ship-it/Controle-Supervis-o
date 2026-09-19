/**
 * Periodicidades contratadas (seção 3 do escopo). Lista fechada, igual à do
 * CHECK em contratos.periodicidade — precisa viver fora do arquivo de server
 * actions, que só pode exportar função assíncrona.
 */
export const PERIODICIDADES = ['SEMANAL', '2X NA SEMANA', 'QUINZENAL', 'MENSAL'] as const;

export type Periodicidade = (typeof PERIODICIDADES)[number];
