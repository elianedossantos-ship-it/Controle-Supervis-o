/**
 * Papéis e hierarquia (seção 2 do escopo). Sem dependência de banco ou de React:
 * este módulo é importado tanto pelo proxy (Edge) quanto pelo servidor.
 */
export const PAPEIS = ['supervisor', 'coordenador', 'admin'] as const;

export type Papel = (typeof PAPEIS)[number];

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
}

/**
 * Coordenador faz tudo do supervisor em todas as carteiras; admin faz tudo do
 * coordenador. Um papel exigido é atendido por ele mesmo ou por quem está acima.
 */
const ABRANGE: Record<Papel, readonly Papel[]> = {
  supervisor: ['supervisor', 'coordenador', 'admin'],
  coordenador: ['coordenador', 'admin'],
  admin: ['admin'],
};

export function papelAtende(papel: Papel, exigido: Papel): boolean {
  return ABRANGE[exigido].includes(papel);
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  supervisor: 'Supervisor',
  coordenador: 'Coordenador',
  admin: 'Admin',
};
