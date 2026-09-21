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
| 5 | Painel do coordenador: indicadores, filtros e listas de ação | pronto |
| 6 | Exportação do REG-061 em Excel e PDF | pronto |
| 7 | Prazos e obrigações (seção 8) | pronto |
| 8 | Avaliação trimestral de desempenho (seção 9) | pronto |
| 9 | Planos de ação por contrato (seção 10) | pronto |
| — | Acabamento: trava da sexta (13.1), 404 e barreira de erro em português | pronto |

Todas as seções do escopo estão implementadas. O que ficou de fora é o que o
escopo declara fora de escopo na seção 12 (REG-090, Tobbits, app nativo, modo
offline, aprovação da programação pela coordenação e roteirização).

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
| `npm run e2e` | roda a bateria de navegador contra o servidor de desenvolvimento |

## Como publicar

O sistema é um Next.js com Postgres. Ele deduz sozinho o que dá para deduzir,
então sobram poucas variáveis de ambiente:

| Variável | Obrigatória | O que é |
| --- | --- | --- |
| `DATABASE_URL` | sim | conexão com o Postgres |
| `SESSION_SECRET` | sim | 32+ caracteres, **diferente por ambiente** (`openssl rand -base64 32`) |
| `S3_BUCKET` | em produção | o bucket das fotos — preenchê-lo já liga o armazenamento em nuvem |
| `S3_ENDPOINT` | com R2 ou Supabase | endereço do provedor; vazio usa a AWS |
| `S3_REGION` | com Supabase | a região do projeto; o padrão `auto` serve para R2 |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | com bucket | as chaves do bucket |

**O que o sistema deduz.** O tamanho do pool e os prepared statements saem da
própria `DATABASE_URL`: uma URL de *pooler* atende serverless, onde cada
instância abriria o próprio pool, então vale uma conexão e nada de prepared
statements — o pooler em modo transação não os guarda entre comandos.
`DB_POOL_MAX` e `DB_PREPARE` existem para contrariar a dedução, não para o uso
normal. E ter `S3_BUCKET` preenchido é o que escolhe o armazenamento em nuvem:
antes era preciso lembrar de `STORAGE_DRIVER=s3` *além* das chaves, e esquecer
disso num servidor de disco efêmero fazia a foto sumir com a instância, sem
erro nenhum.

### Os três passos

**1. Um Postgres 13 ou mais novo.** Com o banco criado e a `DATABASE_URL`
apontando para ele:

```bash
npm run db:migrate    # cria as 20 tabelas e os índices
npm run db:seed       # motivos, obrigações, modelo de avaliação e o admin
```

O seed é idempotente e não troca a senha de um admin que já exista.

**2. Um bucket para as fotos.** Em disco efêmero a evidência da visita sumiria
junto com a instância, então em produção é S3, R2 ou o Storage do Supabase —
os três falam o mesmo protocolo. O bucket é **privado**: a foto mostra o
interior da unidade do cliente e é servida por rota autenticada.

**3. Um lugar que sirva Node.** Numa plataforma serverless basta importar o
repositório e colar as variáveis; num servidor seu, `npm ci && npm run build &&
npm start` atrás de um proxy com TLS — o cookie de sessão é `secure` e não
chega por HTTP puro.

### Quem entra

O endereço é público, mas **toda página exige sessão**: sem login, o acesso
para no `/login`. Só entra quem o administrador cadastrar, e cada pessoa
enxerga conforme o papel. Não há cadastro aberto nem convite por link.

Entre com o admin do seed, troque a senha, cadastre os supervisores e importe
os contratos pela tela **Importar REG-061**.

### Se o banco for do Supabase

Duas coisas a mais, porque o Supabase publica o schema `public` numa API REST
que este sistema não usa — ele fala direto com o Postgres:

```sql
-- RLS ligada e sem política nenhuma: ninguém passa pela API REST.
-- O app conecta como dono das tabelas, que não é afetado.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t); END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
```

E use a connection string do **pooler de transação**, que o sistema reconhece
sozinho.

## Como os testes rodam

As regras de negócio puras (`lib/`) são exercitadas por funções, e o resto é
verificado no navegador, contra o Postgres de verdade — nada de mock: a
pergunta que interessa é se o supervisor consegue fazer o trabalho dele.

```bash
npm run dev                 # deixa o servidor de pé
npm run db:seed             # base limpa, com o admin
npm run e2e                 # roda as 27 suítes na ordem de dependência
```

A bateria vive em `e2e/`, com o detalhe em [`e2e/LEIAME.md`](e2e/LEIAME.md).
Cada suíte semeia o que precisa e imprime uma linha por verificação; o
`rodar-tudo.sh` considera uma suíte aprovada quando ela sai com código 0 e não
imprime nenhuma linha `FALHA`. Para rodar só uma parte:
`SUITES="planos janela" ./e2e/rodar-tudo.sh`. A porta (3000 por padrão) e o
caminho do Chromium saem de `E2E_PORTA` e `PLAYWRIGHT_CHROMIUM`.

Boa parte da bateria não testa a tela, e sim o servidor: várias suítes forjam o
POST da server action — trocando o contrato, o papel ou a célula — para provar
que a recusa não depende do botão estar desabilitado.

## Estrutura

```
/app
  (auth)/login              login (e-mail e senha)
  (app)/                    área autenticada, com o layout e a navegação por papel
    meu-dia/                demandas, visitas do dia, registro e cancelamento
    programacao/            grade da semana, avisos e envio
    prazos/                 obrigações do mês, marcação e justificativa
    planos/                 planos de ação por contrato, com histórico
    avaliacoes/             avaliação trimestral, PDI e ciência
    painel/                 indicadores, filtros e listas de ação
    exportar/               geração do REG-061 mensal
    cadastros/
      supervisores/         lista, novo, editar, reset de senha
      contratos/            lista, novo, editar (com os contatos do cliente)
      carteira/             supervisores à esquerda, contratos à direita
      feriados/             lista e inclusão
      importacao/           carga inicial a partir do REG-061 em Excel
  sem-acesso                papel não alcança a tela pedida
  not-found.tsx             404 em português; a de (app) mantém o menu de pé
  error.tsx                 barreira de erro; idem
  global-error.tsx          erro que derruba o layout raiz (estilo inline)
/db
  schema.ts                 as 20 tabelas
  migrations/               SQL versionado
  migrate.ts  seed.ts  seed-avaliacao.ts
/e2e                        a bateria de navegador (ver e2e/LEIAME.md)
/lib
  auth.ts                   sessaoAtual, requireSessao, requireRole, autenticar
  sessao.ts                 assinatura e leitura do cookie (roda também no Edge)
  papeis.ts                 papéis e hierarquia
  senha.ts                  hash e conferência (bcrypt)
  navegacao.ts              itens de menu e o papel mínimo de cada um
  formulario.ts             estado devolvido pelas server actions de cadastro
  datas.ts                  DATE do Postgres sem deslocar o dia por fuso
  semana.ts                 a semana de segunda a sexta, contada em UTC
  janela.ts                 a trava da sexta: fecha às 18h da sexta anterior
  indicadores.ts            as fórmulas da seção 7
  prazos.ts                 competências, prazos e cumprimento da seção 8
  avaliacao.ts              notas, pesos e faixas da seção 9
  planos.ts                 prioridade, prazo sugerido e resumo da seção 10
  reg061.ts                 monta a grade mensal a partir das visitas
  reg061-dados.ts           consulta que alimenta a exportação
  reg061-excel.ts           geração do .xlsx
  reg061-pdf.ts             geração do .pdf
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
visita, plano ou evidência feita por um supervisor filtra por `supervisor_id`
ou pela carteira vigente no backend. Vale também na escrita: formulário
forjado com o contrato de outra carteira é recusado pelo servidor, não pela
tela.

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

**A trava da sexta (decisão 13.1).** A pergunta do escopo é o horário em que a
programação fecha. Resposta: **sexta às 18h**, no fuso de São Paulo, da semana
anterior à que está sendo montada.

| Momento | O supervisor | A coordenação |
| --- | --- | --- |
| até sexta 18h | monta, salva e envia | tudo |
| depois de sexta 18h | nada — a grade fica só de leitura | tudo, inclusive enviar |

A quinta-feira da proposta ficou como **referência na tela, não como bloqueio**:
é a partir dela que a semana corrente já está quase toda registrada e os avisos
de periodicidade valem mais. Travar o envio antes disso custaria caro — quem
organiza a semana na segunda teria de voltar na quinta só para clicar — e não é
o que a decisão 13.1 pergunta.

Depois das 18h de sexta a semana fecha, e a saída de emergência é a
coordenação: ela edita e envia a qualquer hora. Sem essa saída, um esquecimento
na sexta deixaria a semana inteira sem programação, que é pior que o atraso. O
atraso em si não some: a seção 8 registra o envio fora do prazo como obrigação
"atendida com atraso". Na semana travada, um botão leva direto à semana
seguinte — tela sem saída é beco.

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

## Painel do coordenador

Corte padrão: mês corrente. Filtros de período, supervisor e contrato numa
linha só, acima dos indicadores.

**Aderência** segue a fórmula da seção 7 ao pé da letra:
`(realizadas programadas + extras realizadas) ÷ programadas × 100`. Duas
consequências que ficaram como estão, de propósito:

- **Pode passar de 100%.** Uma semana com muitas extras rende mais visitas do
  que as programadas. É o que a fórmula diz e é informação útil, então não foi
  limitada em 100%.
- **Sem visita programada no período, o indicador fica indefinido** e aparece
  como travessão. Virar "0%" seria mentira: não houve o que cumprir.

**Cumprimento da periodicidade** estende a regra semanal da seção 4.2 ao período
escolhido no filtro, usando semanas inteiras: um recorte de 10 dias cobra 1
visita de um contrato semanal, não 1,4. Período curto demais para cobrar
qualquer coisa tira o contrato da conta, em vez de deixá-lo passar como
cumprido de graça. Esta extensão é interpretação minha — o escopo define o
esperado por semana, não por período livre.

**Prazos e planos** entram no mesmo painel, cada um no seu bloco:
cumprimento de prazos e prazos em atraso (seção 8), com a quebra por obrigação;
e planos de ação (seção 10.4) com abertos, vencidos, tempo médio até resolver,
contratos reincidentes e as quebras por contrato e por supervisor. O recorte
dos planos é a data de abertura, como nas demandas — a tela `/planos` é que
mostra o que está em aberto hoje, venha de quando vier.

### Sobre os gráficos

O ranking de cancelamentos é série única, então usa **uma cor só** — a
identidade de cada barra vem do rótulo, não da cor. A cor foi validada por
script contra a superfície real dos cartões nos dois modos (contraste ≥ 3:1,
faixa de luminosidade e chroma). As cores de situação (verde/vermelho) nunca
aparecem sozinhas: sempre acompanham um rótulo em texto, porque cor sozinha não
é informação para quem não a distingue.

A mesma informação do gráfico está na tabela ao lado, visita a visita.

## Exportação do REG-061

Escolhe o mês e o supervisor (ou todos, com uma aba para cada) e gera o mesmo
layout da planilha a partir das visitas. Antes de baixar, a tela mostra o que
vai sair: quantos contratos entram por supervisor e a contagem de cada
marcação — assim ninguém baixa um mês vazio sem saber.

**Decisão 13.2, fechada:** a exportação sai **com R, C e E** marcando o
realizado, além de P/F/S/D do modelo Rev 04.

| Marca | Significado |
| --- | --- |
| R | realizada |
| E | extra |
| C | cancelada |
| P | programada |
| F | feriado |
| S | sábado |
| D | domingo |

**A visita vence o calendário.** Se houve visita num sábado ou num feriado, a
célula mostra a visita, não o S nem o F — o registro precisa mostrar o que
aconteceu. Entre visitas do mesmo dia a ordem é R > E > C > P: o que aconteceu
pesa mais do que o que estava previsto.

**Carteira vigente no mês, não hoje.** Entra na planilha o contrato cujo vínculo
esteve aberto em qualquer dia daquele mês. Um contrato que mudou de carteira em
outubro continua aparecendo no REG-061 de setembro, com o supervisor que o tinha
na época.

Pelo mesmo motivo, a exportação não filtra supervisor inativo: o REG-061 é
registro histórico, e quem trabalhou naquele mês precisa continuar aparecendo
nele. Numa exportação de "todos", supervisor sem contrato no mês não vira aba
vazia; pedido pelo nome, ele sai mesmo assim, para o download nunca devolver
nada sem explicação.

**Formatos.** Excel traz o layout completo, com legenda e bloco de periodicidade
no canto direito e campos de assinatura. O PDF sai em A4 paisagem — com três
colunas fixas mais 31 dias, retrato não cabe — quebrando em páginas quando a
carteira é grande, com as linhas de assinatura no rodapé de cada uma.

## Prazos e obrigações (seção 8)

A tela `/prazos` abre no mês corrente e lista, por supervisor, cada ocorrência
das obrigações do catálogo. O catálogo fica em tabela (`obrigacoes`), não em
código: a coordenação inclui, muda prazo ou aposenta uma obrigação pela tela.

| Obrigação | Recorrência | Prazo |
| --- | --- | --- |
| Lançamento das medições | mensal | dia 1 |
| Entrega de folha de ponto | mensal | dia 7 |
| Solicitações de férias | mensal | dia 8 |
| Solicitação de material | mensal | dia 10 |
| Cronograma de visitas | semanal | sexta-feira |
| Mapa de frequência atualizado | diária, consolidada no mês | fim do mês |

**Competência é a âncora.** Obrigação mensal e diária têm uma ocorrência por
mês (competência no dia 1º); a semanal tem uma por semana, e a competência é a
**segunda-feira** — a mesma âncora da programação.

**O cronograma de visitas se marca sozinho.** É a única obrigação `automatica`:
o sistema já sabe se a programação da semana seguinte foi enviada até a sexta,
então compara o dia do envio (em São Paulo) com o prazo e marca *atendido* ou
*atendido com atraso* sem ninguém tocar. As demais são marcadas à mão.

**Vencida e não marcada continua pendente.** O status não vira "não atendido"
sozinho: quem decide isso é a coordenação. A tela separa a pendente que ainda
tem prazo da que já passou, e o painel conta as vencidas em bloco próprio.
*Não atendido* e *não se aplica* exigem justificativa escrita.

## Avaliação trimestral (seção 9)

Modelo REV 00 versionado em tabela: 6 competências, 21 critérios, pesos que
somam 100% (operação 25, documentação 20, equipe 20, cliente 15, materiais 10,
postura 10). A avaliação aponta para a versão do modelo usada — finalizada, ela
não muda de versão nem de peso, mesmo que o modelo seja revisado depois.

> O texto da seção 9 fala em "22 critérios", mas a tabela de competências do
> próprio escopo soma 21 (4+4+4+3+3+3). Seguimos a tabela. Se faltou mesmo um
> critério, ele entra como REV 01 do modelo, sem mexer nas avaliações já feitas.

**Critério em branco sai do denominador (decisão 13.13).** "Não se aplica" não
vira zero: o peso da competência é **redistribuído** entre os critérios
respondidos. Zerar puniria o supervisor por uma situação que não existiu na
carteira dele. A consequência está declarada no relatório: quem foi avaliado em
18 critérios é comparado com quem foi avaliado em 21.

**Fluxo.** Rascunho é trabalho do avaliador e não fica visível para o avaliado.
Finalizada, a nota congela e o supervisor passa a enxergá-la. A ciência é
**aceite eletrônico dentro do sistema** (decisão 13.11): o supervisor entra,
lê e confirma — com carimbo de data e hora. O botão de ciência fica fora das
abas, senão ele só apareceria para quem navegasse até a última.

**Visibilidade (decisão 13.12).** O supervisor vê as próprias avaliações
finalizadas, inclusive o histórico — a avaliação serve para orientar, e
orientação que a pessoa não pode reler não orienta.

## Planos de ação (seção 10)

O plano **nasce dentro da visita e pertence ao contrato**. É isso que o faz
reaparecer na próxima ida à unidade: ao abrir o Meu dia, a visita mostra os
planos em aberto daquele contrato *antes* de qualquer ação, e, depois de
registrar, pergunta se é caso de abrir outro.

**Prazo sugerido pela prioridade (decisão 13.15).** O sistema sugere e o
supervisor pode trocar — travar impediria o caso real em que a solução depende
de terceiro.

| Prioridade | Prazo sugerido |
| --- | --- |
| Crítica | 48 horas |
| Alta | 7 dias |
| Normal | 15 dias |
| Baixa | 30 dias |

**Quem encerra (decisão 13.16).** Prioridade alta ou crítica só é encerrada
pela **coordenação**: quem abriu a ocorrência grave não é quem decide que ela
acabou. Normal e baixa o próprio supervisor resolve. Resolver exige foto —
evidência da solução, não só da falha. Cancelar exige justificativa. Reabrir é
só da coordenação, e também exige motivo.

**O histórico é somente-acréscimo.** Acompanhamento, edição, resolução,
reabertura e cancelamento viram linhas em `plano_atualizacoes`, cada uma com
autor e data. Editar um plano não apaga o que ele dizia antes: grava um
registro nomeando o que mudou.

**No painel (10.4):** planos em aberto, vencidos, tempo médio até resolver,
contratos reincidentes, e as quebras por contrato e por supervisor. O recorte é
a data de abertura, como nas demandas. Plano **cancelado não conta como
reincidência** — registro retirado não é problema da unidade, e contá-lo faria
o contrato parecer pior justamente quando alguém teve o cuidado de corrigir.

## Armazenamento das evidências

A seção 11 define S3 compatível. A decisão 13.3 ficou em **Cloudflare R2**:
fala o mesmo protocolo do S3, e o que pesa aqui é o tráfego de saída — toda
foto de evidência é lida de volta pela coordenação, e o R2 não cobra egresso.
Trocar para AWS S3 é configuração, não código: basta deixar o endpoint vazio.

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

**Retenção: 5 anos** (parte da decisão 13.3), alinhada ao prazo em que os
registros da qualidade costumam ser cobrados. Isso é regra de bucket, não de
código — uma *lifecycle rule* no R2 apagando o prefixo `evidencias/` depois de
60 meses —, justamente para que mudar o prazo não exija subir versão. O banco
guarda só a chave e a data de captura; a foto some do bucket e a linha da
evidência fica, com o histórico da visita intacto.

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
- Erro de servidor não mostra a mensagem técnica na tela: ela pode carregar
  nome de contrato, e-mail ou trecho de consulta. Fica no log, e o usuário
  recebe o código do erro para passar à coordenação.

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
| O mesmo feriado não entra duas vezes | único em `(data, abrangencia, coalesce(uf,''), coalesce(lower(municipio),''))` |

**Periodicidade gera aviso, nunca bloqueio** — por isso não há restrição de
periodicidade no banco: o esperado é calculado na montagem da semana e vira
aviso na tela, com a decisão de enviar assim mesmo registrada no envio.

**A trava da sexta também não está no banco.** Ela depende da hora em que a
gravação acontece, então vive na regra do servidor (`lib/janela.ts`), checada
em toda gravação de programação — inclusive num POST forjado.

## As 16 decisões da seção 13

O escopo abriu 16 decisões. Todas estão fechadas — as duas primeiras pela
coordenação, o resto por decisão nossa, com o critério anotado ao lado. Nenhuma
é irreversível: onde a escolha foi de proposta, está dito o que muda se for
outra.

| # | Assunto | Decisão | Por quê |
| --- | --- | --- | --- |
| 13.1 | Trava da sexta | Fecha **sexta às 18h**; a coordenação passa por cima a qualquer hora. A quinta da proposta virou referência na tela, não bloqueio | O horário de fechamento é o da proposta e é o que a pergunta pede; travar o envio antes da quinta só faria o supervisor voltar para clicar. A saída pela coordenação evita que um esquecimento deixe a semana sem programação |
| 13.2 | Exportação REG-061 | **Já com R, C e E**, além de P/F/S/D | Escolha da coordenação |
| 13.3 | Fotos | Cloudflare R2, retenção de 5 anos por *lifecycle rule* | Mesmo protocolo do S3 e sem custo de egresso, que é o que pesa numa base lida de volta |
| 13.4 | WhatsApp | Fase 1 só notifica dentro do app | É a proposta do escopo; a API oficial exige aprovação de template e custo por conversa, que não travam nada hoje |
| 13.5 | Carga inicial | Importador lê as abas do REG-061 em Excel, quantas forem | Não fixamos 63 contratos: a tela importa o arquivo que vier |
| 13.6 | Sábado | Semana de segunda a sexta | Nenhum contrato da base tem visita em sábado; `visitas.data_prevista` aceita qualquer data, então incluir sábado é mudar a montagem, não o schema |
| 13.7 | Supervisor afastado | A carteira migra temporariamente | `carteira` já guarda vigência com `inicio` e `fim`: mover preserva o histórico e o REG-061 do mês passado continua correto |
| 13.8 | Escopo das obrigações | Todas por **supervisor** | Por contrato, seriam mais de 60 marcações por mês; o campo `escopo` aceita os dois, então uma obrigação específica pode virar por contrato pela tela |
| 13.9 | Mapa de frequência | Consolidação mensal | É a proposta do escopo: marcar 22 células por supervisor todo mês não se sustenta na rotina |
| 13.10 | Atendido com atraso | Não conta como atendido no índice; tem coluna própria | É a proposta do escopo — entregar a folha no dia 9 não é o mesmo que não entregar |
| 13.11 | Assinatura da avaliação | Aceite eletrônico dentro do sistema | Digitalizar assinatura em papel devolveria ao fluxo o arquivo solto que este sistema veio substituir |
| 13.12 | Visibilidade da avaliação | O supervisor vê as próprias, finalizadas, com histórico | Avaliação que o avaliado não pode reler não orienta |
| 13.13 | Critério em branco | Sai do denominador; o peso é redistribuído | Zerar puniria o supervisor por situação que não existiu na carteira dele |
| 13.14 | Formato REG-060 | O registro digital basta; o REG-060 segue documento à parte | O plano já tem descrição, responsável, prazo, fotos e histórico com autor; gerar o formulário antigo a partir disso é exportação nova, não mudança de modelo |
| 13.15 | Prazo do plano | O sistema sugere por prioridade, o supervisor pode trocar | Sugerir evita o prazo em branco; travar impediria o caso em que a solução depende de terceiro |
| 13.16 | Quem encerra o plano | Alta e crítica só a coordenação | Quem abriu a ocorrência grave não é quem decide que ela acabou |

## Três lugares onde o DDL do escopo ficou curto

Cada um é uma regra escrita na seção 3 ou 4 que não tinha onde morar. Todos
viraram migration, e todos são fáceis de desfazer se a coordenação preferir
outro desenho.

1. **`programacoes.avisos_no_envio`** (JSONB) — a seção 4.2 exige que "a
   decisão de enviar fique registrada". Guarda a lista de avisos que estava na
   tela no momento do envio.
2. **`demandas_extras.concluida_em`** — a seção 7 pede o "tempo médio até a
   conclusão" da demanda, e não havia carimbo de conclusão.
3. **`obrigacao_ocorrencias_unica_sem_contrato`** — o `UNIQUE (obrigacao_id,
   supervisor_id, contrato_id, competencia)` não impede duplicata quando
   `contrato_id` é `NULL`, porque o Postgres trata `NULL` como valor distinto.
   Com a decisão 13.8 (obrigação por supervisor), esse é justamente o caso
   normal: o gerador de ocorrências criaria a mesma linha duas vezes. Um índice
   único parcial cobre o caso sem contrato.
