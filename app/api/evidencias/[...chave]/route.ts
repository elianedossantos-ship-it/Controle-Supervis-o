import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { evidencias, visitas } from '@/db/schema';
import { sessaoAtual } from '@/lib/auth';
import { chaveValida, lerEvidencia, urlDaEvidencia } from '@/lib/storage';

/**
 * Serve a foto da evidência. Não é arquivo público: a foto mostra o interior
 * de unidade de cliente. Exige sessão e, para supervisor, que a evidência seja
 * de visita da própria carteira.
 */
export async function GET(
  _pedido: Request,
  { params }: { params: Promise<{ chave: string[] }> },
) {
  const sessao = await sessaoAtual();
  if (!sessao) return new NextResponse('Não autenticado.', { status: 401 });

  const { chave: partes } = await params;
  const chave = partes.join('/');

  if (!chaveValida(chave)) return new NextResponse('Chave inválida.', { status: 400 });

  const [registro] = await db
    .select({ id: evidencias.id, visitaId: evidencias.visitaId })
    .from(evidencias)
    .where(eq(evidencias.arquivoUrl, urlDaEvidencia(chave)));

  if (!registro) return new NextResponse('Não encontrada.', { status: 404 });

  // Isolamento por carteira é regra de dados, e vale também para a foto.
  if (sessao.papel === 'supervisor' && registro.visitaId) {
    const [visita] = await db
      .select({ supervisorId: visitas.supervisorId })
      .from(visitas)
      .where(eq(visitas.id, registro.visitaId));

    if (!visita || visita.supervisorId !== sessao.usuarioId) {
      return new NextResponse('Sem acesso.', { status: 403 });
    }
  }

  const arquivo = await lerEvidencia(chave);
  if (!arquivo) return new NextResponse('Não encontrada.', { status: 404 });

  return new NextResponse(Buffer.from(arquivo.bytes), {
    headers: {
      'Content-Type': arquivo.contentType,
      // Privado: a foto não pode ficar em cache compartilhado.
      'Cache-Control': 'private, max-age=3600',
      'Content-Length': String(arquivo.bytes.length),
    },
  });
}
