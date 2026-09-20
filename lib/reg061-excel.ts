import 'server-only';
import ExcelJS from 'exceljs';
import { MARCACOES, type GradeREG061 } from './reg061';

/**
 * Gera o REG-061 em Excel: uma aba por supervisor, com o mesmo layout da
 * planilha atual — cabeçalho, CLIENTE / ENDEREÇO / PERIODICIDADE, os dias do
 * mês e, no canto direito, a legenda e o bloco de periodicidade.
 */

const BORDA_FINA: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
  left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
  bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
  right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
};

const CINZA_CABECALHO = 'FFE5E7EB';
const CINZA_NAO_UTIL = 'FFF3F4F6';

const PERIODICIDADES = ['SEMANAL', '2X NA SEMANA', 'QUINZENAL', 'MENSAL'];

/** Uma aba por supervisor, como na planilha de hoje. */
export async function gerarExcelREG061(grades: GradeREG061[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'REG-061 Digital';
  wb.created = new Date();

  for (const grade of grades) {
    montarAba(wb, grade);
  }

  const bytes = await wb.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

function montarAba(wb: ExcelJS.Workbook, grade: GradeREG061) {
  // O nome da aba é o do supervisor, como no REG-061. O Excel limita a 31
  // caracteres e proíbe alguns símbolos.
  const nomeAba =
    grade.supervisorNome.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'Supervisor';
  const ws = wb.addWorksheet(nomeAba, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const primeiraColunaDia = 4;
  const ultimaColunaDia = primeiraColunaDia + grade.diasNoMes - 1;
  const colunaLegenda = ultimaColunaDia + 2;

  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 42;
  ws.getColumn(3).width = 16;
  for (let c = primeiraColunaDia; c <= ultimaColunaDia; c++) ws.getColumn(c).width = 3.6;
  ws.getColumn(colunaLegenda).width = 4;
  ws.getColumn(colunaLegenda + 1).width = 22;

  /* Cabeçalho ------------------------------------------------------------- */
  ws.getCell('A1').value = 'Nº: REG-061';
  ws.getCell('A2').value = 'REV: 04';
  ws.getCell('A3').value = 'Data:';
  ws.getCell('A4').value = `MÊS/ANO: ${grade.mesPorExtenso}/${grade.ano}`;
  ws.getCell('A5').value = `SUPERVISOR(A): ${grade.supervisorNome}`;

  for (const linha of [1, 2, 3, 4, 5]) {
    ws.getCell(`A${linha}`).font = { bold: linha >= 4, size: 11 };
  }

  /* Linha de títulos ------------------------------------------------------ */
  const LINHA_TITULO = 6;
  const titulo = ws.getRow(LINHA_TITULO);
  titulo.getCell(1).value = 'CLIENTE';
  titulo.getCell(2).value = 'ENDEREÇO';
  titulo.getCell(3).value = 'PERIODICIDADE DA VISITA';

  for (let dia = 1; dia <= grade.diasNoMes; dia++) {
    titulo.getCell(primeiraColunaDia + dia - 1).value = dia;
  }

  titulo.height = 30;
  for (let c = 1; c <= ultimaColunaDia; c++) {
    const cel = titulo.getCell(c);
    cel.font = { bold: true, size: c <= 3 ? 10 : 9 };
    cel.alignment = { horizontal: c <= 3 ? 'left' : 'center', vertical: 'middle', wrapText: c <= 3 };
    cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_CABECALHO } };
    cel.border = BORDA_FINA;
  }

  /* Linhas de contrato ---------------------------------------------------- */
  grade.linhas.forEach((l, i) => {
    const linha = ws.getRow(LINHA_TITULO + 1 + i);
    linha.getCell(1).value = l.cliente;
    linha.getCell(2).value = l.endereco;
    linha.getCell(3).value = l.periodicidade;

    for (let dia = 1; dia <= grade.diasNoMes; dia++) {
      const marca = l.marcacoes[dia - 1];
      const cel = linha.getCell(primeiraColunaDia + dia - 1);
      cel.value = marca || null;
      cel.alignment = { horizontal: 'center', vertical: 'middle' };
      cel.font = { size: 9, bold: marca === 'R' || marca === 'E' };
      cel.border = BORDA_FINA;

      // Sábado, domingo e feriado com fundo cinza, como na planilha.
      if (marca === 'S' || marca === 'D' || marca === 'F') {
        cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_NAO_UTIL } };
      }
    }

    for (let c = 1; c <= 3; c++) {
      linha.getCell(c).font = { size: 10 };
      linha.getCell(c).alignment = { vertical: 'middle', wrapText: c <= 2 };
      linha.getCell(c).border = BORDA_FINA;
    }
  });

  /* Legenda e periodicidade, no canto direito ----------------------------- */
  let l = LINHA_TITULO;
  ws.getCell(l, colunaLegenda).value = 'LEGENDA';
  ws.getCell(l, colunaLegenda).font = { bold: true, size: 10 };

  for (const [letra, descricao] of Object.entries(MARCACOES)) {
    l++;
    const celLetra = ws.getCell(l, colunaLegenda);
    celLetra.value = letra;
    celLetra.font = { bold: true, size: 9 };
    celLetra.alignment = { horizontal: 'center' };
    celLetra.border = BORDA_FINA;

    const celTexto = ws.getCell(l, colunaLegenda + 1);
    celTexto.value = descricao;
    celTexto.font = { size: 9 };
  }

  l += 2;
  ws.getCell(l, colunaLegenda).value = 'PERIODICIDADE';
  ws.getCell(l, colunaLegenda).font = { bold: true, size: 10 };

  for (const p of PERIODICIDADES) {
    l++;
    ws.getCell(l, colunaLegenda).value = '';
    ws.getCell(l, colunaLegenda).border = BORDA_FINA;
    ws.getCell(l, colunaLegenda + 1).value = p;
    ws.getCell(l, colunaLegenda + 1).font = { size: 9 };
  }

  /* Rodapé para assinatura ------------------------------------------------ */
  const linhaAssinatura = LINHA_TITULO + grade.linhas.length + 3;
  ws.getCell(linhaAssinatura, 1).value = 'Assinatura do(a) supervisor(a):';
  ws.getCell(linhaAssinatura, 1).font = { size: 10 };
  ws.getCell(linhaAssinatura + 2, 1).value = 'Assinatura da coordenação:';
  ws.getCell(linhaAssinatura + 2, 1).font = { size: 10 };
}
