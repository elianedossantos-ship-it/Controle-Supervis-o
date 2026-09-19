import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Painel — REG-061 Digital' };

export default async function PaginaPainel() {
  await requireRole('coordenador');

  return (
    <EmConstrucao
      titulo="Painel"
      descricao="Aderência, cancelamentos por motivo e contratos sem visita."
      entrega="Tela da Entrega 5."
    />
  );
}
