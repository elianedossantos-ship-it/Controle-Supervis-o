import ExcelJS from 'exceljs';
import { PERIODICIDADES, type Periodicidade } from './contratos';

export type LinhaLida = {
  aba: string;
  linha: number;
  supervisorNome: string | null;
  cliente: string;
  endereco: string;
  periodicidade: Periodicidade | null;
  periodicidadeBruta: string;
  /** Impede a importação desta linha. */
  problema: string | null;
};

export type LeituraPlanilha = {
  linhas: LinhaLida[];
  /** Problemas de aba inteira: cabeçalho não encontrado, supervisor ausente. */
  avisos: string[];
};

function normalizar(valor: unknown): string {
  if (valor === null || valor === undefined) return '';

  // Célula de fórmula ou de texto rico vem como objeto.
  if (typeof valor === 'object') {
    const v = valor as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').trim();
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    return '';
  }

  return String(valor).trim();
}

/** Sem acento, sem caixa e sem espaço repetido — para comparar rótulos. */
export function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 'Quinzenal', '2x na semana', '2 X SEMANA' -> valor da lista fechada. */
export function normalizarPeriodicidade(bruta: string): Periodicidade | null {
  const k = chave(bruta).replace(/[.\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (k === '') return null;

  const direta = PERIODICIDADES.find((p) => chave(p) === k);
  if (direta) return direta;

  if (/^2\s*X?\s*(NA|POR)?\s*SEMANA$/.test(k) || k === '2X NA SEMANA' || k === 'DUAS VEZES NA SEMANA') {
    return '2X NA SEMANA';
  }
  if (k.startsWith('SEMANAL')) return 'SEMANAL';
  if (k.startsWith('QUINZENAL')) return 'QUINZENAL';
  if (k.startsWith('MENSAL')) return 'MENSAL';

  return null;
}

/**
 * Lê o REG-061. Não assume posição fixa de célula: procura a linha de cabeçalho
 * pelo rótulo CLIENTE e o supervisor pelo rótulo SUPERVISOR nas linhas acima.
 * A planilha é preenchida à mão todo mês e a altura do cabeçalho varia.
 */
export async function lerPlanilhaREG061(buffer: ArrayBuffer): Promise<LeituraPlanilha> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const linhas: LinhaLida[] = [];
  const avisos: string[] = [];

  for (const aba of wb.worksheets) {
    const nomeAba = aba.name.trim();

    // 1. Linha de cabeçalho: a que tem uma célula CLIENTE.
    let linhaCabecalho = 0;
    let colCliente = 0;
    let colEndereco = 0;
    let colPeriodicidade = 0;

    for (let r = 1; r <= Math.min(aba.rowCount, 30); r++) {
      const row = aba.getRow(r);
      let achouCliente = 0;

      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const k = chave(normalizar(cell.value));
        if (k === 'CLIENTE') achouCliente = col;
        else if (k.startsWith('ENDERECO')) colEndereco = col;
        else if (k.startsWith('PERIODICIDADE')) colPeriodicidade = col;
      });

      if (achouCliente) {
        linhaCabecalho = r;
        colCliente = achouCliente;
        break;
      }
      colEndereco = 0;
      colPeriodicidade = 0;
    }

    if (!linhaCabecalho) {
      avisos.push(`Aba "${nomeAba}": não achei a coluna CLIENTE. Aba ignorada.`);
      continue;
    }
    if (!colEndereco) avisos.push(`Aba "${nomeAba}": não achei a coluna ENDEREÇO.`);
    if (!colPeriodicidade) avisos.push(`Aba "${nomeAba}": não achei a coluna PERIODICIDADE.`);

    // 2. Supervisor: rótulo SUPERVISOR acima do cabeçalho; se não houver, o
    //    nome da aba, que no REG-061 já é o nome do supervisor.
    let supervisorNome: string | null = null;

    for (let r = 1; r < linhaCabecalho && !supervisorNome; r++) {
      const row = aba.getRow(r);
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        if (supervisorNome) return;
        const texto = normalizar(cell.value);
        if (!chave(texto).startsWith('SUPERVISOR')) return;

        const depoisDoRotulo = texto.split(':').slice(1).join(':').trim();
        if (depoisDoRotulo) {
          supervisorNome = depoisDoRotulo;
          return;
        }
        // Rótulo e nome em células vizinhas.
        for (let c = col + 1; c <= col + 4; c++) {
          const vizinho = normalizar(row.getCell(c).value);
          if (vizinho) {
            supervisorNome = vizinho;
            return;
          }
        }
      });
    }

    if (!supervisorNome) {
      supervisorNome = nomeAba || null;
      avisos.push(
        `Aba "${nomeAba}": sem rótulo SUPERVISOR(A). Usei o nome da aba como supervisor.`,
      );
    }

    // 3. Linhas de contrato.
    for (let r = linhaCabecalho + 1; r <= aba.rowCount; r++) {
      const row = aba.getRow(r);
      const cliente = normalizar(row.getCell(colCliente).value);
      if (!cliente) continue;

      // A legenda fica abaixo da tabela e tem "P = PROGRAMADA" na coluna do
      // cliente: sem isso ela entraria como contrato.
      const k = chave(cliente);
      if (k.includes('LEGENDA') || /^[PFSD]\s*[=-]/.test(k)) continue;

      const endereco = colEndereco ? normalizar(row.getCell(colEndereco).value) : '';
      const periodicidadeBruta = colPeriodicidade
        ? normalizar(row.getCell(colPeriodicidade).value)
        : '';
      const periodicidade = normalizarPeriodicidade(periodicidadeBruta);

      let problema: string | null = null;
      if (!endereco) problema = 'Sem endereço.';
      else if (!periodicidade) {
        problema = periodicidadeBruta
          ? `Periodicidade não reconhecida: "${periodicidadeBruta}".`
          : 'Sem periodicidade.';
      }

      linhas.push({
        aba: nomeAba,
        linha: r,
        supervisorNome,
        cliente,
        endereco,
        periodicidade,
        periodicidadeBruta,
        problema,
      });
    }
  }

  return { linhas, avisos };
}
