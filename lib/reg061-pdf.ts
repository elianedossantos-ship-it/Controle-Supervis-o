import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { MARCACOES, type GradeREG061 } from './reg061';

/**
 * REG-061 em PDF, para assinatura e arquivo do SGI. Paisagem A4: com as três
 * colunas fixas mais 31 dias, retrato não cabe de jeito nenhum.
 */

const A4_PAISAGEM: [number, number] = [841.89, 595.28];
const MARGEM = 24;

const LARGURA_CLIENTE = 124;
const LARGURA_ENDERECO = 150;
const LARGURA_PERIODICIDADE = 58;
const LARGURA_LEGENDA = 96;

const ALTURA_LINHA = 16;

const TINTA = rgb(0.06, 0.06, 0.06);
const TINTA_FRACA = rgb(0.42, 0.42, 0.42);
const GRADE = rgb(0.72, 0.72, 0.72);
const FUNDO_CABECALHO = rgb(0.9, 0.91, 0.92);
const FUNDO_NAO_UTIL = rgb(0.95, 0.96, 0.96);

/**
 * As fontes padrão do PDF usam WinAnsi, que cobre o português mas não tudo.
 * Um caractere fora da tabela derruba a geração inteira, então o texto é
 * higienizado antes de ser desenhado.
 */
function limpar(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\xFF]/g, '');
}

function encurtar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string {
  const limpo = limpar(texto);
  if (fonte.widthOfTextAtSize(limpo, tamanho) <= largura) return limpo;

  let corte = limpo;
  while (corte.length > 1 && fonte.widthOfTextAtSize(`${corte}...`, tamanho) > largura) {
    corte = corte.slice(0, -1);
  }
  return `${corte}...`;
}

export async function gerarPdfREG061(grades: GradeREG061[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('REG-061 — Cronograma de Visitas');
  pdf.setProducer('REG-061 Digital');

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const grade of grades) {
    desenharSupervisor(pdf, grade, normal, negrito);
  }

  return Buffer.from(await pdf.save());
}

function desenharSupervisor(
  pdf: PDFDocument,
  grade: GradeREG061,
  normal: PDFFont,
  negrito: PDFFont,
) {
  const larguraUtil = A4_PAISAGEM[0] - MARGEM * 2 - LARGURA_LEGENDA;
  const larguraFixa = LARGURA_CLIENTE + LARGURA_ENDERECO + LARGURA_PERIODICIDADE;
  const larguraDia = (larguraUtil - larguraFixa) / grade.diasNoMes;

  // Quantas linhas de contrato cabem numa página, já descontando cabeçalho.
  const alturaCabecalho = 86;
  const alturaRodape = 48;
  const disponivel = A4_PAISAGEM[1] - MARGEM * 2 - alturaCabecalho - alturaRodape;
  const porPagina = Math.max(1, Math.floor(disponivel / ALTURA_LINHA));

  const paginas = Math.max(1, Math.ceil(grade.linhas.length / porPagina));

  for (let p = 0; p < paginas; p++) {
    const pagina = pdf.addPage(A4_PAISAGEM);
    const fatia = grade.linhas.slice(p * porPagina, (p + 1) * porPagina);

    let y = A4_PAISAGEM[1] - MARGEM;

    /* Cabeçalho ----------------------------------------------------------- */
    pagina.drawText('Nº: REG-061', { x: MARGEM, y: y - 10, size: 9, font: negrito, color: TINTA });
    pagina.drawText('REV: 04', { x: MARGEM + 90, y: y - 10, size: 9, font: normal, color: TINTA });
    pagina.drawText('Data: ____/____/______', {
      x: MARGEM + 150, y: y - 10, size: 9, font: normal, color: TINTA,
    });

    pagina.drawText(`MÊS/ANO: ${limpar(grade.mesPorExtenso)}/${grade.ano}`, {
      x: MARGEM, y: y - 28, size: 11, font: negrito, color: TINTA,
    });
    pagina.drawText(`SUPERVISOR(A): ${limpar(grade.supervisorNome)}`, {
      x: MARGEM, y: y - 44, size: 11, font: negrito, color: TINTA,
    });

    if (paginas > 1) {
      const rotulo = `Página ${p + 1} de ${paginas}`;
      pagina.drawText(rotulo, {
        x: A4_PAISAGEM[0] - MARGEM - normal.widthOfTextAtSize(rotulo, 8),
        y: y - 10, size: 8, font: normal, color: TINTA_FRACA,
      });
    }

    y -= alturaCabecalho;

    /* Linha de títulos ---------------------------------------------------- */
    const topoTabela = y + ALTURA_LINHA;
    desenharCelula(pagina, MARGEM, y, LARGURA_CLIENTE, 'CLIENTE', negrito, 8, FUNDO_CABECALHO, 'left');
    desenharCelula(pagina, MARGEM + LARGURA_CLIENTE, y, LARGURA_ENDERECO, 'ENDEREÇO', negrito, 8, FUNDO_CABECALHO, 'left');
    desenharCelula(
      pagina, MARGEM + LARGURA_CLIENTE + LARGURA_ENDERECO, y, LARGURA_PERIODICIDADE,
      'PERIODIC.', negrito, 8, FUNDO_CABECALHO, 'left',
    );

    for (let dia = 1; dia <= grade.diasNoMes; dia++) {
      const x = MARGEM + larguraFixa + (dia - 1) * larguraDia;
      desenharCelula(pagina, x, y, larguraDia, String(dia), negrito, 6.5, FUNDO_CABECALHO, 'center');
    }

    /* Linhas de contrato -------------------------------------------------- */
    for (const linha of fatia) {
      y -= ALTURA_LINHA;

      desenharCelula(pagina, MARGEM, y, LARGURA_CLIENTE,
        encurtar(linha.cliente, normal, 7, LARGURA_CLIENTE - 6), normal, 7, undefined, 'left');
      desenharCelula(pagina, MARGEM + LARGURA_CLIENTE, y, LARGURA_ENDERECO,
        encurtar(linha.endereco, normal, 7, LARGURA_ENDERECO - 6), normal, 7, undefined, 'left');
      desenharCelula(pagina, MARGEM + LARGURA_CLIENTE + LARGURA_ENDERECO, y, LARGURA_PERIODICIDADE,
        encurtar(linha.periodicidade, normal, 6.5, LARGURA_PERIODICIDADE - 6), normal, 6.5, undefined, 'left');

      for (let dia = 1; dia <= grade.diasNoMes; dia++) {
        const marca = linha.marcacoes[dia - 1];
        const x = MARGEM + larguraFixa + (dia - 1) * larguraDia;
        const naoUtil = marca === 'S' || marca === 'D' || marca === 'F';
        const destacada = marca === 'R' || marca === 'E';

        desenharCelula(
          pagina, x, y, larguraDia, marca,
          destacada ? negrito : normal, 7,
          naoUtil ? FUNDO_NAO_UTIL : undefined,
          'center',
        );
      }
    }

    /* Legenda e periodicidade, no canto direito --------------------------- */
    const xLegenda = A4_PAISAGEM[0] - MARGEM - LARGURA_LEGENDA + 8;
    let yLegenda = topoTabela - 2;

    pagina.drawText('LEGENDA', { x: xLegenda, y: yLegenda, size: 8, font: negrito, color: TINTA });
    for (const [letra, descricao] of Object.entries(MARCACOES)) {
      yLegenda -= 11;
      pagina.drawText(`${letra}  ${limpar(descricao)}`, {
        x: xLegenda, y: yLegenda, size: 7, font: normal, color: TINTA,
      });
    }

    yLegenda -= 18;
    pagina.drawText('PERIODICIDADE', { x: xLegenda, y: yLegenda, size: 8, font: negrito, color: TINTA });
    for (const p of ['SEMANAL', '2X NA SEMANA', 'QUINZENAL', 'MENSAL']) {
      yLegenda -= 11;
      pagina.drawText(p, { x: xLegenda, y: yLegenda, size: 7, font: normal, color: TINTA });
    }

    /* Assinaturas --------------------------------------------------------- */
    const yAssinatura = MARGEM + 24;
    for (const [i, rotulo] of ['Assinatura do(a) supervisor(a)', 'Assinatura da coordenação'].entries()) {
      const x = MARGEM + i * 300;
      pagina.drawLine({
        start: { x, y: yAssinatura },
        end: { x: x + 240, y: yAssinatura },
        thickness: 0.7,
        color: GRADE,
      });
      pagina.drawText(limpar(rotulo), {
        x, y: yAssinatura - 11, size: 7.5, font: normal, color: TINTA_FRACA,
      });
    }
  }
}

function desenharCelula(
  pagina: PDFPage,
  x: number,
  y: number,
  largura: number,
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  fundo: ReturnType<typeof rgb> | undefined,
  alinhamento: 'left' | 'center',
) {
  if (fundo) {
    pagina.drawRectangle({ x, y, width: largura, height: ALTURA_LINHA, color: fundo });
  }

  pagina.drawRectangle({
    x, y, width: largura, height: ALTURA_LINHA,
    borderColor: GRADE, borderWidth: 0.4,
  });

  if (!texto) return;

  const limpo = limpar(texto);
  const larguraTexto = fonte.widthOfTextAtSize(limpo, tamanho);
  const tx = alinhamento === 'center' ? x + (largura - larguraTexto) / 2 : x + 3;

  pagina.drawText(limpo, {
    x: tx,
    y: y + (ALTURA_LINHA - tamanho) / 2 + 1,
    size: tamanho,
    font: fonte,
    color: TINTA,
  });
}
