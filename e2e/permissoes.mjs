import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/** Caminhos relativos a esta pasta — a suíte roda de qualquer lugar. */
const AQUI = dirname(fileURLToPath(import.meta.url));
const raiz = (p) => resolve(AQUI, p);

/** Porta e navegador vêm do ambiente, com o padrão do desenvolvimento. */
const PORTA = process.env.E2E_PORTA ?? '3000';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';


const B = `http://localhost:${PORTA}`;
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FALHA'}  ${m}`); if (!c) falhas++; };
const sql = (q) => execSync(
  `PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`,
  { encoding: 'utf8' },
).trim();

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function sessao(email, senha) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', senha);
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(2200);
  return { ctx, page };
}

console.log('\n===== SUPERVISOR NÃO ALCANÇA OS CADASTROS =====');
{
  const { ctx, page } = await sessao('aline@empresa.com.br', 'senha12345');
  // A Aline foi criada com senha própria no teste anterior
  const entrou = new URL(page.url()).pathname !== '/login';
  if (!entrou) {
    console.log('  (Aline usa outra senha; recriando sessão com a senha do cadastro)');
  }
  await ctx.close();
}
{
  const { ctx, page } = await sessao('rafael@empresa.com.br', 'senha12345');
  ok(new URL(page.url()).pathname === '/meu-dia', `supervisor cai em ${new URL(page.url()).pathname}`);
  for (const rota of ['/cadastros/supervisores', '/cadastros/contratos', '/cadastros/carteira', '/cadastros/feriados', '/cadastros/contratos/novo']) {
    await page.goto(`${B}${rota}`, { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === '/sem-acesso', `${rota} -> sem-acesso`);
  }
  await ctx.close();
}

console.log('\n===== COORDENADOR: CADASTRA, MAS NÃO GERE USUÁRIOS =====');
{
  const { ctx, page } = await sessao('carla@empresa.com.br', 'senha12345');
  ok(new URL(page.url()).pathname === '/painel', 'coordenador entra no painel');

  await page.goto(`${B}/cadastros/contratos/novo`, { waitUntil: 'networkidle' });
  ok(new URL(page.url()).pathname === '/cadastros/contratos/novo', 'coordenador cadastra contrato');

  console.log('-- papel e situação vão travados para o coordenador --');
  const idRafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
  await page.goto(`${B}/cadastros/supervisores/${idRafael}`, { waitUntil: 'networkidle' });
  ok(await page.locator('#papel').isDisabled(), 'select de papel desabilitado');
  ok(await page.locator('#ativo').isDisabled(), 'checkbox de ativo desabilitado');
  ok(!(await page.locator('body').innerText()).includes('Redefinir senha'), 'sem bloco de redefinir senha');

  console.log('-- editar os demais campos funciona --');
  await page.fill('#telefone', '(21) 90000-1111');
  await page.click('button:has-text("Salvar")');
  await page.waitForTimeout(2200);
  ok(sql(`select telefone from usuarios where email='rafael@empresa.com.br'`) === '(21) 90000-1111', 'telefone atualizado pelo coordenador');
  ok(sql(`select papel from usuarios where email='rafael@empresa.com.br'`) === 'supervisor', 'papel intacto');
  await ctx.close();
}

console.log('\n===== ADMIN: GERE USUÁRIOS =====');
{
  const { ctx, page } = await sessao('admin@empresa.com.br', 'admin123');
  const idRafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
  await page.goto(`${B}/cadastros/supervisores/${idRafael}`, { waitUntil: 'networkidle' });
  ok(!(await page.locator('#papel').isDisabled()), 'admin altera papel');
  ok((await page.locator('body').innerText()).includes('Redefinir senha'), 'admin vê redefinir senha');

  console.log('-- inativar --');
  await page.uncheck('#ativo');
  await page.click('button:has-text("Salvar")');
  await page.waitForTimeout(2200);
  ok(sql("select ativo from usuarios where email='rafael@empresa.com.br'") === 'f', 'Rafael inativado');

  console.log('-- contrato não vai para supervisor inativo --');
  await page.goto(`${B}/cadastros/carteira`, { waitUntil: 'networkidle' });
  const corpo = await page.locator('body').innerText();
  ok(!corpo.includes('Rafael Silva'), 'supervisor inativo sumiu da carteira');

  console.log('-- reativar --');
  await page.goto(`${B}/cadastros/supervisores/${idRafael}`, { waitUntil: 'networkidle' });
  await page.check('#ativo');
  await page.click('button:has-text("Salvar")');
  await page.waitForTimeout(2200);
  ok(sql("select ativo from usuarios where email='rafael@empresa.com.br'") === 't', 'Rafael reativado');

  console.log('-- admin não altera o próprio papel --');
  const idAdmin = sql("select id from usuarios where email='admin@empresa.com.br'");
  await page.goto(`${B}/cadastros/supervisores/${idAdmin}`, { waitUntil: 'networkidle' });
  await page.selectOption('#papel', 'supervisor');
  await page.click('button:has-text("Salvar")');
  await page.waitForTimeout(2200);
  ok((await page.locator('body').innerText()).includes('não pode alterar o próprio papel'), 'auto-rebaixamento recusado');
  ok(sql("select papel from usuarios where email='admin@empresa.com.br'") === 'admin', 'admin continua admin');

  console.log('-- redefinir senha --');
  await page.goto(`${B}/cadastros/supervisores/${idRafael}`, { waitUntil: 'networkidle' });
  const hashAntes = sql("select senha_hash from usuarios where email='rafael@empresa.com.br'");
  await page.fill('#senha', 'novasenha123');
  await page.fill('#confirmacao', 'diferente123');
  await page.click('button:has-text("Redefinir senha")');
  await page.waitForTimeout(2200);
  ok((await page.locator('body').innerText()).includes('não conferem'), 'confirmação divergente recusada');

  await page.fill('#senha', 'novasenha123');
  await page.fill('#confirmacao', 'novasenha123');
  await page.click('button:has-text("Redefinir senha")');
  await page.waitForTimeout(2200);
  ok(sql("select senha_hash from usuarios where email='rafael@empresa.com.br'") !== hashAntes, 'hash da senha mudou');
  await ctx.close();
}

console.log('\n-- a nova senha funciona, a antiga não --');
{
  const { ctx, page } = await sessao('rafael@empresa.com.br', 'senha12345');
  ok(new URL(page.url()).pathname === '/login', 'senha antiga recusada');
  await ctx.close();
}
{
  const { ctx, page } = await sessao('rafael@empresa.com.br', 'novasenha123');
  ok(new URL(page.url()).pathname === '/meu-dia', 'senha nova aceita');
  await ctx.close();
}

/*
 * Esta suíte inativa o Rafael e troca a senha dele. As suítes seguintes contam
 * com ele ativo e com a senha padrão, então ela desfaz o que fez. O hash é
 * bcrypt de 'senha12345' e vai por arquivo .sql: o shell comeria os cifrões.
 */
const RESTAURA = resolve(tmpdir(), 'permissoes-restaura.sql');
writeFileSync(RESTAURA, `
update usuarios
   set ativo = true,
       senha_hash = '$2b$12$Kk53JuwFD.dLcFN0fWJF1.hqovWN2qrwzBvQ.s0D3OwLGfLtoV63O'
 where email = 'rafael@empresa.com.br';
`);
execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -f ${RESTAURA}`, { encoding: 'utf8' });
console.log('  (Rafael devolvido ao estado padrão para as próximas suítes)');

await browser.close();
console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
