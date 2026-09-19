import type { z } from 'zod';

/**
 * Estado que toda server action de cadastro devolve ao formulário.
 * `campos` guarda o que foi digitado: o React limpa o form a cada submit e sem
 * isso o usuário redigitaria tudo por causa de um campo errado.
 */
export type EstadoForm = {
  erro?: string;
  erros?: Record<string, string>;
  campos?: Record<string, string | string[]>;
  ok?: boolean;
};

/** Primeira mensagem de erro por campo, no formato que o formulário consome. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const issue of erro.issues) {
    const campo = issue.path.join('.');
    if (campo && !saida[campo]) saida[campo] = issue.message;
  }
  return saida;
}

/** Texto opcional: string vazia vira null, para não gravar '' no lugar de NULL. */
export function textoOuNulo(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? '').trim();
  return texto === '' ? null : texto;
}

export function texto(valor: FormDataEntryValue | null): string {
  return String(valor ?? '').trim();
}

export function marcado(valor: FormDataEntryValue | null): boolean {
  return valor === 'on' || valor === 'true';
}

/** 'limpeza, bombeiros' -> ['limpeza','bombeiros']; vazio vira null. */
export function listaSeparadaPorVirgula(valor: FormDataEntryValue | null): string[] | null {
  const itens = String(valor ?? '')
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);
  return itens.length > 0 ? itens : null;
}
