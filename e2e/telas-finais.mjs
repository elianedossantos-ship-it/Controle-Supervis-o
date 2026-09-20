import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/** Caminhos relativos a esta pasta — a suíte roda de qualquer lugar. */
const AQUI = dirname(fileURLToPath(import.meta.url));
const raiz = (p) => resolve(AQUI, p);

/** Porta e navegador vêm do ambiente, com o padrão do desenvolvimento. */
const PORTA = process.env.E2E_PORTA ?? '3000';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';


const B = `http://localhost:${PORTA}`;
const T = raiz('telas');
const FOTO = raiz('fixtures/foto-teste.jpg');
const sql = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -tAc "${q}"`, { encoding: 'utf8' }).trim();
const exec = (q) => execSync(`PGPASSWORD=cronograma psql -h 127.0.0.1 -U cronograma -d cronograma -q -c "${q}"`, { encoding: 'utf8' });

const aline = sql("select id from usuarios where email='aline@empresa.com.br'");
const rafael = sql("select id from usuarios where email='rafael@empresa.com.br'");
const solar = sql("select id from contratos where nome='Condomínio Solar das Flores'");
const colegio = sql("select id from contratos where nome='Colégio Monte Verde'");

exec("delete from evidencias where plano_id is not null; delete from plano_atualizacoes; delete from planos_acao;");
exec(`insert into planos_acao (contrato_id, aberto_por, descricao, local_setor, responsavel, prioridade, prazo, status, criado_em, resolvido_em) values
 ('${solar}','${aline}','Infiltração no teto da garagem, junto à vaga 12.','Garagem','Zeladoria','alta','2026-09-24','em_andamento','2026-09-15 09:00-03',null),
 ('${solar}','${aline}','Lâmpada queimada na escada de emergência.','Escada bloco B','Manutenção','baixa','2026-10-10','aberto','2026-09-18 09:00-03',null),
 ('${colegio}','${rafael}','Vazamento no banheiro do pátio.','Pátio','Hidráulica','critica','2026-09-17','aberto','2026-09-16 08:00-03',null),
 ('${colegio}','${rafael}','Grade do portão lateral solta.','Portão lateral','Serralheria','normal','2026-09-30','resolvido','2026-09-10 08:00-03','2026-09-14 08:00-03')`);
const plano = sql(`select id from planos_acao where prioridade='alta'`);
exec(`insert into plano_atualizacoes (plano_id, autor_id, tipo, texto) values
 ('${plano}','${aline}','acompanhamento','Zeladoria abriu chamado com a construtora. Visita técnica marcada.')`);

// Visita de hoje para o Meu dia mostrar o plano do contrato.
exec(`delete from visitas where data_prevista = current_date`);
exec(`insert into visitas (contrato_id, supervisor_id, data_prevista, origem, status) values
 ('${solar}','${aline}', current_date, 'programada', 'prevista')`);

const browser = await chromium.launch({ executablePath: CHROMIUM });
async function entrar(email, mobile = false) {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR' }
      : { viewport: { width: 1400, height: 1000 }, locale: 'pt-BR' },
  );
  const page = await ctx.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#senha', 'senha12345');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(2600);
  return { ctx, page };
}

const tirar = async (page, rota, arquivo, espera = 2000, cheia = true) => {
  await page.goto(`${B}${rota}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(espera);
  await page.screenshot({ path: `${T}/${arquivo}`, fullPage: cheia });
  console.log('  ok', arquivo);
};

{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await tirar(page, '/planos', '19-planos.png');
  await tirar(page, '/painel?inicio=2026-09-01&fim=2026-09-30', '21-painel-planos.png', 2500);
  await tirar(page, '/programacao?semana=2026-09-28', '23-programacao-janela.png', 2200);
  await ctx.close();
}
{
  const { ctx, page } = await entrar('aline@empresa.com.br', true);
  await tirar(page, '/meu-dia', '20-meu-dia-planos.png', 2500);
  await tirar(page, '/programacao?semana=2026-09-21', '22-janela-fechada.png', 2200);
  await tirar(page, '/planos', '24-planos-celular.png', 2200);
  await ctx.close();
}
{
  const { ctx, page } = await entrar('carla@empresa.com.br');
  await tirar(page, '/rota-que-nao-existe', '25-nao-encontrada.png', 1500, false);
  await ctx.close();
}

await browser.close();
console.log('TELAS PRONTAS');
