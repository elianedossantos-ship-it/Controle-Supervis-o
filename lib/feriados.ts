export const ABRANGENCIAS = ['nacional', 'estadual', 'municipal'] as const;

export type Abrangencia = (typeof ABRANGENCIAS)[number];

export const ROTULO_ABRANGENCIA: Record<Abrangencia, string> = {
  nacional: 'Nacional',
  estadual: 'Estadual',
  municipal: 'Municipal',
};
