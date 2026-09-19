import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Exportar REG-061 — REG-061 Digital' };

export default async function PaginaExportar() {
  await requireRole('coordenador');

  return (
    <EmConstrucao
      titulo="Exportar REG-061"
      descricao="Geração do REG-061 mensal por supervisor, em Excel e PDF."
      entrega="Tela da Entrega 6."
    />
  );
}
