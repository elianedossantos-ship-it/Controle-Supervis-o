import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Carteira — REG-061 Digital' };

export default async function PaginaCarteira() {
  await requireRole('coordenador');

  return (
    <EmConstrucao
      titulo="Carteira"
      descricao="Vínculo de contrato e supervisor, preservando o histórico."
      entrega="Tela da Entrega 2."
    />
  );
}
