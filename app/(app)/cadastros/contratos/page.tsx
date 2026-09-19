import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Contratos — REG-061 Digital' };

export default async function PaginaContratos() {
  await requireRole('coordenador');

  return (
    <EmConstrucao
      titulo="Contratos"
      descricao="Endereço, periodicidade, escopo, observações e contatos do cliente."
      entrega="Tela da Entrega 2."
    />
  );
}
