import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Programação — REG-061 Digital' };

export default async function PaginaProgramacao() {
  await requireRole('supervisor');

  return (
    <EmConstrucao
      titulo="Programação"
      descricao="Montagem da semana seguinte, de segunda a sexta."
      entrega="Tela da Entrega 3."
    />
  );
}
