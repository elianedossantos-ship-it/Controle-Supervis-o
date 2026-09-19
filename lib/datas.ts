/**
 * Datas do sistema são DATE do Postgres, tratadas como 'YYYY-MM-DD' puro.
 * Nada de `new Date(texto)` para exibir: isso interpreta a string como UTC e,
 * no fuso do Brasil, mostra o dia anterior.
 */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function hojeISO(): string {
  // Usa o fuso de São Paulo: o servidor pode rodar em UTC e virar o dia antes.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatarDataHora(valor: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(valor);
}
