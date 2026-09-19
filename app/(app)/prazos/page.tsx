import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Prazos — REG-061 Digital' };

export default async function PaginaPrazos() {
  await requireRole('supervisor');

  return (
    <EmConstrucao
      titulo="Prazos"
      descricao="Obrigações do mês por supervisor. O supervisor vê só a própria coluna, em leitura."
      entrega="Tela de uma entrega posterior."
    />
  );
}
