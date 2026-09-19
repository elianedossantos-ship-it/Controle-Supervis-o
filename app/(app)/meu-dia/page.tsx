import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Meu dia — REG-061 Digital' };

export default async function PaginaMeuDia() {
  await requireRole('supervisor');

  return (
    <EmConstrucao
      titulo="Meu dia"
      descricao="Demandas extras abertas e as visitas de hoje."
      entrega="Tela da Entrega 4."
    />
  );
}
