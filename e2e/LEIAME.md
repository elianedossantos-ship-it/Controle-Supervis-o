# Bateria de navegador

Cada arquivo `.mjs` é uma suíte: ela semeia o que precisa direto no Postgres,
abre o Chromium pelo Playwright, faz o caminho de um usuário real e confere o
resultado **no banco**, não só na tela. Uma linha por verificação, `PASS` ou
`FALHA`.

```bash
npm run dev            # servidor de desenvolvimento
npm run db:seed        # base limpa, com o admin
npm run e2e            # a bateria inteira, na ordem de dependência
SUITES="planos janela" ./e2e/rodar-tudo.sh   # só um pedaço
```

`E2E_PORTA` troca a porta (3000 por padrão); `PLAYWRIGHT_CHROMIUM` troca o
caminho do navegador. As telas geradas vão para `e2e/telas/` e os arquivos
exportados para `e2e/saida/` — os dois ficam fora do Git.

## A ordem importa

`cadastros` cria supervisores, contratos e feriados; `carteira` distribui;
`importacao` recarrega a base a partir da planilha. Daí em diante cada suíte
cuida do próprio cenário, e a que mexe em conta alheia devolve o estado ao
final — `permissoes` inativa o Rafael e troca a senha dele, então ela mesma o
restaura. O `rodar-tudo.sh` mantém a ordem.

## O que a bateria realmente testa

Boa parte não testa a tela, e sim o servidor. Várias suítes interceptam o POST
da server action e o adulteram em trânsito — trocando o contrato, o papel, a
célula ou o status — para provar que a recusa vem do backend, e não do botão
estar desabilitado. `adulteracao` forja o cookie de sessão; `guardas` e
`permissoes` percorrem as rotas papel a papel.

## Datas

O cenário é ancorado em setembro e outubro de 2026, e algumas regras dependem
de "hoje": a trava da sexta, os prazos vencidos, os planos em atraso. Uma suíte
que precise montar a semana usa uma semana cuja janela ainda não fechou; a
`janela` é justamente a que exercita os dois lados da trava.
