import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Avaliações — REG-061 Digital' };

export default async function PaginaAvaliacoes() {
  await requireRole('coordenador');

  return (
    <EmConstrucao
      titulo="Avaliações"
      descricao="Avaliação trimestral de desempenho e histórico por supervisor."
      entrega="Tela de uma entrega posterior."
    />
  );
}
