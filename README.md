# REG-061 Digital — Cronograma de Visitas

Sistema que substitui a planilha REG-061 (Rev 04): o supervisor monta a
programação da semana seguinte, registra a execução em campo e a coordenação
acompanha a aderência em tempo real.

O dado primário é **a visita por data**, não a célula de uma grade mensal. A
programação semanal é a janela de edição; o REG-061 mensal passa a ser uma
exportação gerada a partir das visitas.

## Estado atual

| Entrega | Item | Situação |
| --- | --- | --- |
| 1 | Projeto, Tailwind, shadcn/ui, Postgres via Drizzle | pronto |
| 1 | Schema e migrations das 20 tabelas | pronto |
| 1 | Seed: 12 motivos de cancelamento + usuário admin | pronto |
| 1 | Autenticação: login, logout, sessão e `requireRole()` | pronto |
| 1 | Layout base com navegação por papel | pronto |
| 2 | Cadastro de supervisores, com reset de senha e inativação | pronto |
| 2 | Cadastro de contratos, com os contatos do cliente | pronto |
| 2 | Cadastro de feriados | pronto |
| 2 | Carteira: mover contrato preservando o histórico | pronto |
| 2 | Importação inicial do REG-061 em Excel | pronto |
| 3 | Montagem da semana, com avisos de periodicidade e envio | pronto |
| 4 | Meu dia: registro com foto e GPS, cancelamento, visita extra, demandas | pronto |
| 5+ | Painel, prazos, avaliações, planos de ação, exportação | próximas entregas |

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
    prazos
    meu-dia/                demandas, visitas do dia, registro e cancelamento
    programacao/            grade da semana, avisos e envio
    painel  avaliacoes  exportar
    cadastros/
      supervisores/         lista, novo, editar, reset de senha
      contratos/            lista, novo, editar (com os contatos do cliente)
      carteira/             supervisores à esquerda, contratos à direita
      feriados/             lista e inclusão
      importacao/           carga inicial a partir do REG-061 em Excel
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
  formulario.ts             estado devolvido pelas server actions de cadastro
  datas.ts                  DATE do Postgres sem deslocar o dia por fuso
  semana.ts                 a semana de segunda a sexta, contada em UTC
  storage.ts                evidências: driver local ou S3 compatível
  storage-local.ts          driver de disco, só para desenvolvimento
  periodicidade.ts          as regras de aviso da seção 4.2
  feriados-aplicaveis.ts    qual feriado alcança qual contrato
  contratos.ts  feriados.ts  uf.ts    listas fechadas do domínio
  importacao-reg061.ts      leitura da planilha REG-061
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

## Cadastros e carteira

**Quem faz o quê.** A seção 2 do escopo dá ao coordenador "cadastrar
supervisores, contratos, contatos e feriados", e ao admin "gestão de usuários,
reset de senha e inativação". A leitura aplicada foi:

| Ação | Coordenador | Admin |
| --- | --- | --- |
| Criar usuário e editar nome, e-mail, telefone e WhatsApp | sim | sim |
| Alterar o papel de um usuário | não | sim |
| Inativar ou reativar um usuário | não | sim |
| Redefinir senha | não | sim |
| Contratos, contatos, feriados, carteira e importação | sim | sim |

Os campos travados vão desabilitados na tela **e** recusados no servidor: uma
tentativa de editar o formulário no navegador e promover alguém a admin volta
com erro e não altera o banco.

Três travas protegem o acesso de quem administra: ninguém altera o próprio
papel nem a própria situação, e o último admin ativo não pode ser rebaixado
nem inativado — senão o sistema ficaria sem quem desfaça.

**Carteira.** Mover um contrato roda numa transação: fecha o vínculo vigente
com `fim = hoje` e abre o novo. O anterior nunca é apagado nem reescrito, então
o histórico fica de pé. Fora da transação, fechar sem abrir deixaria o contrato
órfão e abrir sem fechar bateria no índice `carteira_vigente_unica`. Contrato
sem supervisor aparece em destaque no grupo "Sem supervisor", e supervisor
inativo some da tela — contrato não vai para quem não acessa o sistema.

**Importação do REG-061.** Tem dois passos, e o primeiro não grava nada. A
leitura não assume posição fixa de célula: procura a linha de cabeçalho pelo
rótulo CLIENTE e o supervisor pelo rótulo SUPERVISOR acima dele, caindo no nome
da aba quando o rótulo não existe. Isso porque a planilha é preenchida à mão e
a altura do cabeçalho varia de aba para aba.

A conferência mostra, linha a linha, o que vai ser criado, o que já existe e o
que será ignorado, com o motivo. Não importa linha sem endereço nem com
periodicidade fora da lista; normaliza grafias como "2x semana" e "Quinzenal";
descarta a legenda do rodapé; e marca repetição dentro da própria planilha.
Contrato cujo supervisor não está cadastrado (ou está inativo) entra sem
carteira, e a tela avisa. Reimportar o mesmo arquivo não duplica nada.

**UF.** O banco guarda `CHAR(2)`, mas o sistema só aceita uma das 27 siglas
reais, por seletor. Aceitar qualquer par de letras criaria furo silencioso:
feriado estadual com UF inexistente nunca casaria com contrato nenhum e o dia
seguiria aberto para programação.

## Montagem da semana

A grade tem os contratos da carteira nas linhas e segunda a sexta nas colunas.
Sem parâmetro, a tela abre na **semana seguinte** — é ela que o supervisor monta
na sexta. Coordenador e admin escolhem de qual supervisor é a semana.

**Legenda das células.** `P` programada (clicável), `R` realizada, `E` extra,
`F` feriado. Só a `P` é editável: visita já realizada ou lançada como extra
aparece na grade mas não se desmarca ali, porque ela não nasceu da montagem da
semana. Salvar regrava apenas as visitas `prevista` de origem `programada` da
semana — realizada, cancelada e extra ficam intactas.

**Feriados.** Um feriado nacional bloqueia o dia para todos os contratos; um
estadual só para os da UF; um municipal só para os daquele município. Sem isso,
o aniversário de uma cidade travaria a agenda do supervisor inclusive em
contrato de outro estado. Contrato sem cidade/UF cadastrados só é alcançado por
feriado nacional.

**Periodicidade é aviso, nunca bloqueio.** Ao enviar, o sistema lista os
contratos fora do esperado e oferece *Enviar assim mesmo*; o rascunho já fica
salvo nesse momento, então nada se perde. Dentro da grade, a marcação vermelha
na linha acompanha os cliques.

| Periodicidade | Esperado | Avisa quando |
| --- | --- | --- |
| SEMANAL | 1 visita na semana | nenhuma visita na semana |
| 2X NA SEMANA | 2 visitas na semana | menos de 2 |
| QUINZENAL | 1 a cada 2 semanas | sem visita na semana e a última realizada é anterior a 2 semanas fechadas |
| MENSAL | 1 no mês | é a última semana do mês e o mês está sem visita |

Realizada e extra contam junto com as programadas para essas contas.

**O envio trava a semana.** Enviada, a programação não aceita mais gravação —
nem pela tela, nem por requisição forjada. Daí em diante restam registrar a
visita, cancelar com motivo ou lançar extra. Só coordenador e admin reabrem.

**A decisão de enviar fica registrada.** A seção 4.2 exige isso, mas o DDL da
seção 3 não tinha onde guardar. Foi acrescentada a coluna
`programacoes.avisos_no_envio` (JSONB), que grava a lista de avisos que estava
na tela no momento do envio — `NULL` quando não havia nenhum. Se a coordenação
preferir outro lugar para esse registro, é só dizer.

**Semana em UTC.** Toda conta de data é feita sobre `'YYYY-MM-DD'` em UTC. Em
fuso local, uma virada de horário de verão deslocaria a segunda-feira da semana.
A regra MENSAL usa o mês da **segunda-feira**: numa semana que cruza a virada do
mês, quem está acabando é o mês em que ela começou.

## Meu dia

A tela que o supervisor usa em pé, no corredor da unidade. Ordem fixa: primeiro
as demandas abertas da coordenação, depois as visitas do dia. Cada visita traz
endereço com link para o mapa, o contato principal com telefone clicável, e as
três ações: **Realizada**, **Cancelar** e **Detalhes**. No rodapé, fixo,
**+ Visita extra**.

**Registrar como realizada** exige foto. O campo usa `capture="environment"`,
que faz o celular abrir a câmera traseira — vale registrar que isso é uma dica
ao navegador: nenhum site consegue, por conta própria, impedir que a pessoa
escolha da galeria. O horário é carimbo do servidor, nunca do aparelho, porque
o relógio do celular é editável. A localização é capturada no mesmo instante.

**GPS que falha não trava o supervisor.** Negada a permissão ou sem sinal, a
tela avisa, a visita é registrada com a foto e o horário, e fica marcada como
*sem localização* — que é exatamente o que o painel vai listar. Bloquear
prenderia o supervisor em prédio sem sinal.

**Cancelar** só depois do envio e só pelo supervisor dono da visita (seção 4.3),
com motivo da lista fechada. O item "Outro" abre campo de texto obrigatório.
Visita já registrada como realizada não se cancela.

**Visita extra** aceita qualquer contrato da carteira vigente, mesmo o que não
estava programado na semana, e entra como prevista — a execução é registrada
com foto, igual às demais.

**Demandas da coordenação** (seção 4.6) aparecem no topo até serem concluídas.
Abrir o Meu dia marca a demanda como lida, que é de onde o painel vai medir o
tempo até a conclusão. Com contrato e data, a demanda já cria a visita
correspondente, com `origem = 'demanda_coordenacao'`.

**O que a coordenação faz aqui.** Vê o dia de qualquer supervisor e cria
demandas. Não registra nem cancela por ele: a seção 4.3 diz que cancelar é
"apenas pelo supervisor dono da visita", e registrar execução por quem não foi
a campo esvaziaria o sentido da evidência. Se a intenção era outra, é um ajuste
pequeno.

## Armazenamento das evidências

A seção 11 define S3 compatível. Qual provedor é a decisão 13.3, ainda aberta —
mas Cloudflare R2 e AWS S3 falam o mesmo protocolo, então a escolha é
configuração e não código:

```bash
STORAGE_DRIVER="s3"
S3_BUCKET="evidencias-reg061"
S3_ENDPOINT="https://<conta>.r2.cloudflarestorage.com"   # AWS: deixe vazio
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
```

Em desenvolvimento, `STORAGE_DRIVER=local` grava em disco e não exige bucket
nenhum. O driver local vive em módulo separado justamente para o acesso a
arquivo não entrar no pacote de produção — o `next build` ainda avisa sobre ele,
e o aviso é esperado.

O driver S3 foi conferido contra um servidor de teste que registra a requisição:
o PUT sai assinado em SigV4, no caminho `/<bucket>/<chave>`, com o content-type
e o corpo corretos, e o GET devolve os mesmos bytes. **Ainda não foi exercitado
contra um bucket de verdade**, o que depende das credenciais do provedor
escolhido.

**A foto não é arquivo público.** Ela mostra o interior da unidade do cliente,
então é servida por rota autenticada (`/api/evidencias/...`): sem sessão devolve
401, supervisor de outra carteira recebe 403, e a coordenação acessa. A chave é
um UUID sob `evidencias/<ano>/<mês>/`, validada por formato antes de virar
caminho em disco — nome de arquivo nunca vem do que o usuário enviou.

Falta definir, junto com o provedor, **por quanto tempo a evidência fica
guardada** (parte da decisão 13.3).

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
