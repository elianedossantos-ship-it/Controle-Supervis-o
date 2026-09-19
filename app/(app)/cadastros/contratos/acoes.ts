'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { contatosContrato, contratos } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { PERIODICIDADES } from '@/lib/contratos';
import { UFS } from '@/lib/uf';
import {
  errosPorCampo,
  listaSeparadaPorVirgula,
  marcado,
  texto,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/formulario';

const esquema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do contrato.'),
  endereco: z.string().trim().min(1, 'Informe o endereço.'),
  bairro: z.string().trim().nullable(),
  cidade: z.string().trim().nullable(),
  uf: z.enum(UFS, { message: 'UF inválida. Use a sigla do estado, como RJ ou SP.' }).nullable(),
  periodicidade: z.enum(PERIODICIDADES, { message: 'Escolha a periodicidade.' }),
  escopo: z.array(z.string()).nullable(),
  observacoes: z.string().trim().nullable(),
  ativo: z.boolean(),
});

const esquemaContato = z.object({
  nome: z.string().trim().min(1, 'Contato sem nome.'),
  cargo: z.string().trim().nullable(),
  telefone: z.string().trim().nullable(),
  email: z.union([z.string().trim().email('E-mail de contato inválido.'), z.null()]),
  principal: z.boolean(),
});

function lerContrato(formData: FormData) {
  const uf = textoOuNulo(formData.get('uf'));
  return {
    nome: texto(formData.get('nome')),
    endereco: texto(formData.get('endereco')),
    bairro: textoOuNulo(formData.get('bairro')),
    cidade: textoOuNulo(formData.get('cidade')),
    uf: uf ? uf.toUpperCase() : null,
    periodicidade: texto(formData.get('periodicidade')),
    escopo: listaSeparadaPorVirgula(formData.get('escopo')),
    observacoes: textoOuNulo(formData.get('observacoes')),
    ativo: marcado(formData.get('ativo')),
  };
}

/**
 * Os contatos vêm em linhas repetidas do mesmo formulário: contato_nome[],
 * contato_cargo[] e assim por diante. Linha sem nome é descartada, para o
 * usuário poder deixar um bloco em branco sem virar contato vazio.
 */
function lerContatos(formData: FormData) {
  const nomes = formData.getAll('contato_nome').map((v) => String(v).trim());
  const cargos = formData.getAll('contato_cargo').map((v) => String(v).trim());
  const telefones = formData.getAll('contato_telefone').map((v) => String(v).trim());
  const emails = formData.getAll('contato_email').map((v) => String(v).trim());
  const principais = new Set(formData.getAll('contato_principal').map((v) => String(v)));

  return nomes
    .map((nome, i) => ({
      nome,
      cargo: cargos[i] || null,
      telefone: telefones[i] || null,
      email: emails[i] || null,
      principal: principais.has(String(i)),
    }))
    .filter((c) => c.nome !== '');
}

function devolver(formData: FormData): Record<string, string | string[]> {
  return {
    nome: texto(formData.get('nome')),
    endereco: texto(formData.get('endereco')),
    bairro: texto(formData.get('bairro')),
    cidade: texto(formData.get('cidade')),
    uf: texto(formData.get('uf')),
    periodicidade: texto(formData.get('periodicidade')),
    escopo: texto(formData.get('escopo')),
    observacoes: texto(formData.get('observacoes')),
    ativo: marcado(formData.get('ativo')) ? 'on' : '',
    contato_nome: formData.getAll('contato_nome').map(String),
    contato_cargo: formData.getAll('contato_cargo').map(String),
    contato_telefone: formData.getAll('contato_telefone').map(String),
    contato_email: formData.getAll('contato_email').map(String),
    contato_principal: formData.getAll('contato_principal').map(String),
  };
}

function validar(formData: FormData) {
  const campos = devolver(formData);
  const contrato = esquema.safeParse(lerContrato(formData));

  if (!contrato.success) {
    return { falha: { erros: errosPorCampo(contrato.error), campos } as EstadoForm };
  }

  const contatos = lerContatos(formData);
  for (const contato of contatos) {
    const conferido = esquemaContato.safeParse(contato);
    if (!conferido.success) {
      return {
        falha: {
          erro: conferido.error.issues[0]?.message ?? 'Contato inválido.',
          campos,
        } as EstadoForm,
      };
    }
  }

  return { dados: contrato.data, contatos };
}

export async function criarContrato(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireRole('coordenador');

  const conferido = validar(formData);
  if (conferido.falha) return conferido.falha;

  await db.transaction(async (tx) => {
    const [criado] = await tx.insert(contratos).values(conferido.dados!).returning({
      id: contratos.id,
    });

    if (conferido.contatos!.length > 0) {
      await tx
        .insert(contatosContrato)
        .values(conferido.contatos!.map((c) => ({ ...c, contratoId: criado.id })));
    }
  });

  revalidatePath('/cadastros/contratos');
  redirect('/cadastros/contratos?criado=1');
}

export async function atualizarContrato(
  _anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  await requireRole('coordenador');
  const id = texto(formData.get('id'));

  const conferido = validar(formData);
  if (conferido.falha) return conferido.falha;

  const [existe] = await db
    .select({ id: contratos.id })
    .from(contratos)
    .where(eq(contratos.id, id));
  if (!existe) return { erro: 'Contrato não encontrado.', campos: devolver(formData) };

  await db.transaction(async (tx) => {
    await tx.update(contratos).set(conferido.dados!).where(eq(contratos.id, id));

    // Os contatos são regravados por inteiro: a tela envia a lista completa.
    await tx.delete(contatosContrato).where(eq(contatosContrato.contratoId, id));

    if (conferido.contatos!.length > 0) {
      await tx
        .insert(contatosContrato)
        .values(conferido.contatos!.map((c) => ({ ...c, contratoId: id })));
    }
  });

  revalidatePath('/cadastros/contratos');
  redirect('/cadastros/contratos?salvo=1');
}

export async function listarContratos() {
  await requireRole('coordenador');
  return db.select().from(contratos).orderBy(asc(contratos.nome));
}

export async function buscarContrato(id: string) {
  await requireRole('coordenador');

  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, id));
  if (!contrato) return null;

  const contatos = await db
    .select()
    .from(contatosContrato)
    .where(eq(contatosContrato.contratoId, id))
    .orderBy(asc(contatosContrato.nome));

  return { contrato, contatos };
}
