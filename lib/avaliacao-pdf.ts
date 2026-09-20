import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { ESCALA, FAIXAS, encaminhamentoDa, formatarNota } from './avaliacao';
import { formatarData } from './datas';
import { formatarPercentual } from './indicadores';
import type { AvaliacaoCompleta } from '@/app/(app)/avaliacoes/acoes';

/** PDF no layout do formulário: Resumo, Avaliação, Plano de Ação, Critérios. */
const A4: [number, number] = [595.28, 841.89];
const MARGEM = 42;
const LARGURA = A4[0] - MARGEM * 2;

const TINTA = rgb(0.06, 0.06, 0.06);
const FRACA = rgb(0.42, 0.42, 0.42);
const LINHA = rgb(0.75, 0.75, 0.75);

function limpar(t: string): string {
  return t
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\xFF]/g, '');
}

/** Quebra o texto na largura disponível, respeitando as palavras. */
function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const palavras = limpar(texto).split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';

  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(teste, tamanho) <= largura) {
      atual = teste;
    } else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length > 0 ? linhas : [''];
}

export async function gerarPdfAvaliacao(a: AvaliacaoCompleta): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Avaliação trimestral — ${a.supervisorNome}`);

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italico = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let pagina = pdf.addPage(A4);
  let y = A4[1] - MARGEM;

  const novaPagina = () => {
    pagina = pdf.addPage(A4);
    y = A4[1] - MARGEM;
  };

  const espaco = (n: number) => {
    if (y - n < MARGEM + 20) novaPagina();
    y -= n;
  };

  const texto = (
    t: string,
    { fonte = normal, tamanho = 9, cor = TINTA, x = MARGEM, largura = LARGURA } = {},
  ) => {
    for (const linha of quebrar(t, fonte, tamanho, largura)) {
      espaco(tamanho + 4);
      pagina.drawText(linha, { x, y, size: tamanho, font: fonte, color: cor });
    }
  };

  const regua = () => {
    espaco(10);
    pagina.drawLine({
      start: { x: MARGEM, y: y + 4 },
      end: { x: MARGEM + LARGURA, y: y + 4 },
      thickness: 0.6,
      color: LINHA,
    });
  };

  /* Cabeçalho ------------------------------------------------------------- */
  texto('AVALIAÇÃO TRIMESTRAL DE SUPERVISORES', { fonte: negrito, tamanho: 13 });
  texto(`Modelo ${a.versaoModelo}`, { cor: FRACA, tamanho: 8 });
  espaco(6);

  /* Resumo ---------------------------------------------------------------- */
  texto('RESUMO', { fonte: negrito, tamanho: 10 });
  regua();
  texto(`Supervisor(a): ${a.supervisorNome}`);
  texto(`Avaliador(a): ${a.avaliadorNome}`);
  texto(
    `Período avaliado: ${formatarData(a.periodoInicio)} a ${formatarData(a.periodoFim)} (${a.rotuloPeriodo})`,
  );
  texto(`Situação: ${a.status}`);
  espaco(4);
  texto(
    `Nota final: ${formatarNota(a.resultado.notaFinal)}   ·   Aproveitamento: ${formatarPercentual(a.resultado.aproveitamento)}   ·   Classificação: ${a.resultado.classificacao ?? '—'}`,
    { fonte: negrito, tamanho: 10 },
  );
  if (a.resultado.aproveitamento !== null) {
    texto(`Encaminhamento: ${encaminhamentoDa(a.resultado.aproveitamento)}`, { cor: FRACA });
  }
  if (a.resultado.competenciasSemNota.length > 0) {
    texto(
      `Sem nota em: ${a.resultado.competenciasSemNota.join(', ')}. O peso foi redistribuído entre as demais competências.`,
      { cor: FRACA, tamanho: 8 },
    );
  }

  /* Avaliação por competência --------------------------------------------- */
  espaco(10);
  texto('AVALIAÇÃO', { fonte: negrito, tamanho: 10 });
  regua();

  for (const c of a.competencias) {
    espaco(4);
    texto(`${c.ordem}. ${c.nome}  (peso ${Math.round(c.peso * 100)}%)`, {
      fonte: negrito,
      tamanho: 9.5,
    });

    for (const k of c.criterios) {
      const nota = k.nota === null ? 'não se aplica' : `${k.nota} — ${ESCALA.find((e) => e.nota === k.nota)?.rotulo}`;
      texto(`${k.codigo} ${k.descricao}:  ${nota}`, { x: MARGEM + 10, largura: LARGURA - 10 });
      if (k.comentario) {
        texto(k.comentario, {
          x: MARGEM + 20,
          largura: LARGURA - 20,
          tamanho: 8,
          cor: FRACA,
          fonte: italico,
        });
      }
    }
  }

  /* Pontos fortes e de atenção -------------------------------------------- */
  espaco(10);
  texto('PONTOS FORTES', { fonte: negrito, tamanho: 10 });
  regua();
  texto(a.pontosFortes ?? '—');

  espaco(8);
  texto('PONTOS DE ATENÇÃO', { fonte: negrito, tamanho: 10 });
  regua();
  texto(a.pontosAtencao ?? '—');

  /* Plano de ação --------------------------------------------------------- */
  espaco(10);
  texto('PLANO DE AÇÃO (PDI)', { fonte: negrito, tamanho: 10 });
  regua();

  if (a.acoes.length === 0) {
    texto('Nenhuma ação acordada.', { cor: FRACA });
  } else {
    for (const acao of a.acoes) {
      texto(`• ${acao.acao}`, { fonte: negrito, tamanho: 9 });
      texto(
        [
          acao.como ? `Como: ${acao.como}` : null,
          acao.responsavel ? `Responsável: ${acao.responsavel}` : null,
          acao.prazo ? `Prazo: ${formatarData(acao.prazo)}` : 'Sem prazo',
          `Situação: ${acao.status}`,
        ]
          .filter(Boolean)
          .join('   ·   '),
        { x: MARGEM + 10, largura: LARGURA - 10, tamanho: 8, cor: FRACA },
      );
    }
  }

  /* Critérios: escala e faixas -------------------------------------------- */
  espaco(10);
  texto('CRITÉRIOS', { fonte: negrito, tamanho: 10 });
  regua();
  texto(`Escala: ${ESCALA.map((e) => `${e.nota} ${e.rotulo.toLowerCase()}`).join('  ·  ')}`, {
    tamanho: 8,
  });
  texto('Critério em branco é "não se aplica" e sai do denominador da competência.', {
    tamanho: 8,
    cor: FRACA,
  });
  espaco(2);
  for (const f of FAIXAS) {
    texto(`${f.min}% ou mais: ${f.rotulo} — ${f.encaminhamento}`, { tamanho: 8, cor: FRACA });
  }

  /* Assinaturas ----------------------------------------------------------- */
  assinaturas(pagina, normal, y);

  return Buffer.from(await pdf.save());
}

function assinaturas(pagina: PDFPage, fonte: PDFFont, yAtual: number) {
  const y = Math.min(yAtual - 30, MARGEM + 46);

  for (const [i, rotulo] of ['Supervisor(a)', 'Coordenação'].entries()) {
    const x = MARGEM + i * (LARGURA / 2);
    pagina.drawLine({
      start: { x, y },
      end: { x: x + LARGURA / 2 - 30, y },
      thickness: 0.7,
      color: LINHA,
    });
    pagina.drawText(limpar(rotulo), {
      x, y: y - 11, size: 8, font: fonte, color: FRACA,
    });
  }
}
