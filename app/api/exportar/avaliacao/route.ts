import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { carregarAvaliacao } from '@/app/(app)/avaliacoes/acoes';
import { gerarPdfAvaliacao } from '@/lib/avaliacao-pdf';

export async function GET(pedido: Request) {
  // A leitura já filtra por papel: o supervisor só alcança a própria, finalizada.
  await requireRole('supervisor');

  const id = new URL(pedido.url).searchParams.get('id') ?? '';
  const a = await carregarAvaliacao(id);

  if (!a) return new NextResponse('Avaliação não encontrada.', { status: 404 });

  const pdf = await gerarPdfAvaliacao(a);
  const nome = `avaliacao-${a.periodoInicio.slice(0, 7)}-${a.supervisorNome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}
