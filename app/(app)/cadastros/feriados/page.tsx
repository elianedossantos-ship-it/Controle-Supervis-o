import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Feriados — REG-061 Digital' };

export default async function PaginaFeriados() {
  await requireRole('coordenador');

  return (
    <EmConstrucao
      titulo="Feriados"
      descricao="Data, descrição e abrangência. Alimenta a marcação F."
      entrega="Tela da Entrega 2."
    />
  );
}
