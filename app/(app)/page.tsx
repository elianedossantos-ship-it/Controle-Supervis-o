import { redirect } from 'next/navigation';
import { requireSessao } from '@/lib/auth';
import { telaInicial } from '@/lib/navegacao';

export default async function PaginaInicial() {
  const sessao = await requireSessao();
  redirect(telaInicial(sessao.papel));
}
