import { requireRole } from '@/lib/auth';
import { EmConstrucao } from '@/components/em-construcao';

export const metadata = { title: 'Supervisores — REG-061 Digital' };

export default async function PaginaSupervisores() {
  await requireRole('coordenador');

  return (
    <EmConstrucao
      titulo="Supervisores"
      descricao="Nome, e-mail, telefone, WhatsApp, papel e situação."
      entrega="Tela da Entrega 2."
    />
  );
}
