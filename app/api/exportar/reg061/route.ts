import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { gradesDoMes } from '@/lib/reg061-dados';
import { nomeDoArquivo } from '@/lib/reg061';
import { gerarExcelREG061 } from '@/lib/reg061-excel';
import { gerarPdfREG061 } from '@/lib/reg061-pdf';

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(pedido: Request) {
  await requireRole('coordenador');

  const url = new URL(pedido.url);
  const competencia = url.searchParams.get('competencia') ?? '';
  const supervisorId = url.searchParams.get('supervisor') || null;
  const formato = url.searchParams.get('formato') === 'pdf' ? 'pdf' : 'xlsx';

  if (!COMPETENCIA.test(competencia)) {
    return new NextResponse('Informe a competência no formato AAAA-MM.', { status: 400 });
  }

  const grades = await gradesDoMes(competencia, supervisorId);

  if (grades.length === 0) {
    return new NextResponse('Nenhum supervisor para exportar.', { status: 404 });
  }

  const arquivo =
    formato === 'pdf' ? await gerarPdfREG061(grades) : await gerarExcelREG061(grades);

  const nome = nomeDoArquivo(
    competencia,
    grades.length === 1 ? grades[0].supervisorNome : 'todos',
    formato,
  );

  return new NextResponse(new Uint8Array(arquivo), {
    headers: {
      'Content-Type':
        formato === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Content-Length': String(arquivo.length),
      'Cache-Control': 'no-store',
    },
  });
}
