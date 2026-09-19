import type { Route } from 'next';
import type { Papel } from './papeis';

export type ItemNav = {
  href: Route;
  rotulo: string;
  /** Papel mínimo exigido, na hierarquia de lib/papeis.ts. */
  exige: Papel;
};

export type GrupoNav = {
  titulo: string | null;
  itens: ItemNav[];
};

/**
 * Telas declaradas no escopo. A navegação é montada por papel, mas ela é só a
 * camada de tela: cada página revalida o papel com requireRole().
 */
export const NAVEGACAO: GrupoNav[] = [
  {
    titulo: null,
    itens: [
      { href: '/meu-dia', rotulo: 'Meu dia', exige: 'supervisor' },
      { href: '/programacao', rotulo: 'Programação', exige: 'supervisor' },
      { href: '/prazos', rotulo: 'Prazos', exige: 'supervisor' },
      { href: '/painel', rotulo: 'Painel', exige: 'coordenador' },
      { href: '/avaliacoes', rotulo: 'Avaliações', exige: 'coordenador' },
      { href: '/exportar', rotulo: 'Exportar REG-061', exige: 'coordenador' },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { href: '/cadastros/supervisores', rotulo: 'Supervisores', exige: 'coordenador' },
      { href: '/cadastros/contratos', rotulo: 'Contratos', exige: 'coordenador' },
      { href: '/cadastros/carteira', rotulo: 'Carteira', exige: 'coordenador' },
      { href: '/cadastros/feriados', rotulo: 'Feriados', exige: 'coordenador' },
    ],
  },
];

/** Para onde cada papel vai ao abrir a raiz. */
export function telaInicial(papel: Papel): Route {
  return papel === 'supervisor' ? '/meu-dia' : '/painel';
}
