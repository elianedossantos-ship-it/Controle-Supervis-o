'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { carteira, contratos, usuarios } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { PERIODICIDADES } from '@/lib/contratos';
import { hojeISO } from '@/lib/datas';
import { chave, lerPlanilhaREG061 } from '@/lib/importacao-reg061';

export type ItemPrevia = {
  cliente: string;
  endereco: string;
  periodicidade: string;
  aba: string;
  linha: number;
  supervisorNome: string | null;
  supervisorId: string | null;
  /** criar | ja_existe | ignorar */
  situacao: 'criar' | 'ja_existe' | 'ignorar';
  observacao: string | null;
};

export type Previa = {
  erro?: string;
  avisos?: string[];
  itens?: ItemPrevia[];
  resumo?: {
    criar: number;
    jaExistem: number;
    ignorar: number;
    semSupervisor: number;
  };
};

/**
 * Passo 1: lê a planilha e mostra o que aconteceria. Não grava nada.
 * A conferência é obrigatória porque o REG-061 é preenchido à mão e o layout
 * varia — importar às cegas encheria a base de contrato torto.
 */
export async function conferirPlanilha(_anterior: Previa, formData: FormData): Promise<Previa> {
  await requireRole('coordenador');

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: 'Escolha o arquivo do REG-061.' };
  }
  if (arquivo.size > 10 * 1024 * 1024) {
    return { erro: 'Arquivo acima de 10 MB.' };
  }

  let leitura;
  try {
    leitura = await lerPlanilhaREG061(await arquivo.arrayBuffer());
  } catch {
    return { erro: 'Não consegui ler o arquivo. Ele precisa ser .xlsx.' };
  }

  if (leitura.linhas.length === 0) {
    return {
      erro: 'Nenhuma linha de contrato encontrada. Confira se é o REG-061 e se há a coluna CLIENTE.',
      avisos: leitura.avisos,
    };
  }

  const supervisores = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)));

  const porNome = new Map(supervisores.map((s) => [chave(s.nome), s.id]));

  const existentes = await db.select({ nome: contratos.nome }).from(contratos);
  const jaCadastrados = new Set(existentes.map((c) => chave(c.nome)));

  // Duplicata dentro da própria planilha: o mesmo cliente em duas abas.
  const vistos = new Set<string>();

  const itens: ItemPrevia[] = leitura.linhas.map((l) => {
    const supervisorId = l.supervisorNome ? (porNome.get(chave(l.supervisorNome)) ?? null) : null;
    const k = chave(l.cliente);

    let situacao: ItemPrevia['situacao'] = 'criar';
    let observacao: string | null = null;

    if (l.problema) {
      situacao = 'ignorar';
      observacao = l.problema;
    } else if (jaCadastrados.has(k)) {
      situacao = 'ja_existe';
      observacao = 'Já existe contrato com este nome. Não será duplicado.';
    } else if (vistos.has(k)) {
      situacao = 'ignorar';
      observacao = 'Repetido na própria planilha.';
    } else {
      vistos.add(k);
      if (!supervisorId) {
        observacao = l.supervisorNome
          ? `Supervisor "${l.supervisorNome}" não está cadastrado. O contrato entra sem carteira.`
          : 'Sem supervisor na aba. O contrato entra sem carteira.';
      }
    }

    return {
      cliente: l.cliente,
      endereco: l.endereco,
      periodicidade: l.periodicidade ?? l.periodicidadeBruta,
      aba: l.aba,
      linha: l.linha,
      supervisorNome: l.supervisorNome,
      supervisorId,
      situacao,
      observacao,
    };
  });

  return {
    avisos: leitura.avisos,
    itens,
    resumo: {
      criar: itens.filter((i) => i.situacao === 'criar').length,
      jaExistem: itens.filter((i) => i.situacao === 'ja_existe').length,
      ignorar: itens.filter((i) => i.situacao === 'ignorar').length,
      semSupervisor: itens.filter((i) => i.situacao === 'criar' && !i.supervisorId).length,
    },
  };
}

const itemImportavel = z.object({
  cliente: z.string().trim().min(1),
  endereco: z.string().trim().min(1),
  periodicidade: z.enum(PERIODICIDADES),
  supervisorId: z.union([z.string().uuid(), z.null()]),
});

export type ResultadoImportacao = {
  erro?: string;
  ok?: boolean;
  criados?: number;
  vinculados?: number;
  pulados?: number;
};

/**
 * Passo 2: grava o que foi conferido. Revalida tudo do zero — o que volta da
 * tela é dado de cliente, não fonte de verdade.
 */
export async function importar(
  _anterior: ResultadoImportacao,
  formData: FormData,
): Promise<ResultadoImportacao> {
  await requireRole('coordenador');

  let bruto: unknown;
  try {
    bruto = JSON.parse(String(formData.get('itens') ?? '[]'));
  } catch {
    return { erro: 'Não consegui ler a conferência. Suba a planilha de novo.' };
  }

  const conferido = z.array(itemImportavel).safeParse(bruto);
  if (!conferido.success) {
    return { erro: 'A conferência veio inválida. Suba a planilha de novo.' };
  }
  if (conferido.data.length === 0) {
    return { erro: 'Nada a importar.' };
  }

  const supervisoresAtivos = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)));
  const idsValidos = new Set(supervisoresAtivos.map((s) => s.id));

  const existentes = await db.select({ nome: contratos.nome }).from(contratos);
  const jaCadastrados = new Set(existentes.map((c) => chave(c.nome)));

  const hoje = hojeISO();
  let criados = 0;
  let vinculados = 0;
  let pulados = 0;

  await db.transaction(async (tx) => {
    for (const item of conferido.data) {
      if (jaCadastrados.has(chave(item.cliente))) {
        pulados++;
        continue;
      }
      jaCadastrados.add(chave(item.cliente));

      const [criado] = await tx
        .insert(contratos)
        .values({
          nome: item.cliente,
          endereco: item.endereco,
          periodicidade: item.periodicidade,
        })
        .returning({ id: contratos.id });

      criados++;

      if (item.supervisorId && idsValidos.has(item.supervisorId)) {
        await tx.insert(carteira).values({
          contratoId: criado.id,
          supervisorId: item.supervisorId,
          inicio: hoje,
        });
        vinculados++;
      }
    }
  });

  revalidatePath('/cadastros/contratos');
  revalidatePath('/cadastros/carteira');

  return { ok: true, criados, vinculados, pulados };
}

export async function supervisoresCadastrados() {
  await requireRole('coordenador');

  return db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.papel, 'supervisor'), eq(usuarios.ativo, true)))
    .orderBy(asc(usuarios.nome));
}

export async function totaisAtuais() {
  await requireRole('coordenador');

  const todos = await db.select({ id: contratos.id }).from(contratos);
  const vigentes = await db
    .select({ id: carteira.id })
    .from(carteira)
    .where(isNull(carteira.fim));

  return { contratos: todos.length, vinculos: vigentes.length };
}
