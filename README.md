# REG-061 Digital — Cronograma de Visitas

Sistema que substitui a planilha REG-061 (Rev 04): o supervisor monta a
programação da semana seguinte, registra a execução em campo e a coordenação
acompanha a aderência em tempo real.

O dado primário é **a visita por data**, não a célula de uma grade mensal. A
programação semanal é a janela de edição; o REG-061 mensal passa a ser uma
exportação gerada a partir das visitas.

## Estado atual: Entrega 1 — Fundação

Esta entrega é a base. As telas entram nas próximas, uma por vez.

| Item | Situação |
| --- | --- |
| Projeto, Tailwind, shadcn/ui, Postgres via Drizzle | pronto |
| Schema e migrations das 20 tabelas | pronto |
| Seed: 12 motivos de cancelamento + usuário admin | pronto |
| Autenticação: login, logout, sessão e `requireRole()` | pronto |
| Layout base com navegação por papel | pronto |
| Cadastros, carteira, montagem da semana, Meu dia, painel, exportação | próximas entregas |

As rotas das telas futuras já existem e já respeitam o papel, mas exibem apenas
um aviso de "próxima entrega".

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind v4 + shadcn/ui, mobile-first |
| Banco | PostgreSQL 13+ (usa `gen_random_uuid()`, nativo a partir do 13) |
| ORM / migrations | Drizzle |
| Autenticação | e-mail e senha, sessão JWT em cookie httpOnly, papel no token |

## Como rodar

```bash
npm install
cp .env.example .env     # preencha DATABASE_URL, SESSION_SECRET e a senha do admin
npm run db:migrate       # cria as 20 tabelas
npm run db:seed          # 12 motivos de cancelamento + usuário admin
npm run dev
```

`SESSION_SECRET` precisa de 32 caracteres ou mais — gere com
`openssl rand -base64 32` e use um valor diferente por ambiente.

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | sobe em desenvolvimento |
| `npm run build` / `npm run start` | build e execução de produção |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |
| `npm run db:generate` | gera uma migration a partir de `db/schema.ts` |
| `npm run db:migrate` | aplica as migrations pendentes |
| `npm run db:seed` | carga inicial (idempotente: pode rodar de novo) |
| `npm run db:studio` | abre o Drizzle Studio |

## Estrutura

```
/app
  (auth)/login              login (e-mail e senha)
  (app)/                    área autenticada, com o layout e a navegação por papel
    meu-dia  programacao  prazos
    painel  avaliacoes  exportar
    cadastros/{supervisores,contratos,carteira,feriados}
  sem-acesso                papel não alcança a tela pedida
/db
  schema.ts                 as 20 tabelas
  migrations/               SQL versionado
  migrate.ts  seed.ts
/lib
  auth.ts                   sessaoAtual, requireSessao, requireRole, autenticar
  sessao.ts                 assinatura e leitura do cookie (roda também no Edge)
  papeis.ts                 papéis e hierarquia
  senha.ts                  hash e conferência (bcrypt)
  navegacao.ts              itens de menu e o papel mínimo de cada um
proxy.ts                    barreira de sessão (o "middleware" do Next 16)
```

## Papéis

| Papel | Alcance |
| --- | --- |
| `supervisor` | só os contratos da própria carteira |
| `coordenador` | tudo do supervisor, em todas as carteiras, mais cadastros, demandas extras e exportação |
| `admin` | tudo do coordenador, mais gestão de usuários |

A hierarquia está em `lib/papeis.ts`: `requireRole('supervisor')` é atendido
também por coordenador e admin.

**Autorização de rota não é isolamento de dados.** `requireRole()` diz quem
entra na tela. O isolamento por carteira é regra de consulta: toda busca de
visita feita por um supervisor filtra por `supervisor_id` no backend. Isso vale
a partir da entrega que trouxer as consultas de visita.

## Segurança da sessão

- Cookie `httpOnly`, `sameSite=lax` e `secure` em produção — o JavaScript da
  página não alcança o token.
- JWT HS256 assinado com `SESSION_SECRET`; token adulterado é recusado.
- Sessão longa (30 dias por padrão, via `SESSION_DIAS`): o supervisor registra
  visita em campo e não deve relogar a cada visita.
- E-mail inexistente, senha errada e usuário inativo devolvem a mesma mensagem,
  e o caminho do e-mail inexistente gasta o mesmo tempo de um bcrypt real —
  senão o sistema entregaria, pela mensagem ou pelo tempo de resposta, quais
  e-mails estão cadastrados.
- O destino guardado no login (`?de=`) só é aceito se for caminho interno.

## Regras que o schema sustenta

| Regra | Como |
| --- | --- |
| 1 contrato tem 1 supervisor vigente, com histórico | índice único parcial `carteira_vigente_unica` em `contrato_id` onde `fim IS NULL` |
| 1 programação por supervisor por semana | único em `(supervisor_id, semana_inicio)` |
| Programação enviada não se edita | `status` em `('rascunho','enviada')` + `enviada_em` |
| Visita extra fora da semana | `programacao_id` aceita `NULL`, `origem = 'extra'` |
| Visita realizada sem GPS não trava | `latitude`/`longitude`/`precisao_m` são opcionais; só a foto e o `capturado_em` são obrigatórios |
| Evidência serve visita, plano ou acompanhamento | `evidencia_tem_dono` exige ao menos um dos três donos |
| Motivo "Outro" exige texto | `motivos_cancelamento.exige_texto` + `visitas.motivo_outro` |
| Critério "não se aplica" na avaliação | `avaliacao_notas.nota` aceita `NULL`; `CHECK` só vale para valor preenchido |
| Modelo de avaliação versionado | `avaliacoes.modelo_id` aponta para a versão usada; finalizada não muda de versão |
| Histórico do plano de ação é somente-acréscimo | `plano_atualizacoes`, uma linha por evento, com autor e data |

**Periodicidade gera aviso, nunca bloqueio** — por isso não há restrição de
periodicidade no banco. O cálculo do esperado entra junto com a tela de
montagem da semana.

## Pendências que afetam o schema

1. **`obrigacao_ocorrencias`** — o `UNIQUE (obrigacao_id, supervisor_id,
   contrato_id, competencia)` não impede duplicata quando `contrato_id` é
   `NULL`, que é justamente o caso de `escopo = 'supervisor'`: o Postgres trata
   `NULL` como valor distinto. Está como no DDL. A correção depende da decisão
   13.8 (obrigação por supervisor ou por contrato) e seria um segundo índice
   único parcial para o caso sem contrato.
2. **Decisão 13.6 (sábado)** — hoje a semana é de segunda a sexta. Se existir
   contrato com visita em sábado, muda a montagem da semana, não o schema:
   `visitas.data_prevista` já aceita qualquer data.
3. **Decisão 13.7 (supervisor afastado)** — `carteira` já guarda vigência com
   `inicio` e `fim`, então dá para migrar a carteira temporariamente. Falta
   decidir se é isso ou se os contratos ficam sem visita no período.

As demais decisões em aberto da seção 13 do escopo (trava da sexta, formato da
exportação, armazenamento de fotos, WhatsApp, carga inicial, avaliação e planos
de ação) não travam esta entrega.
