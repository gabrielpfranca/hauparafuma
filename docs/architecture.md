# Arquitetura

## Porquê uma PWA e não uma app nativa

Timor-Leste: telemóveis Android baratos, dados móveis caros e intermitentes, e pouca
prática de instalar apps pela Play Store. Uma PWA responde a isso:

- **Funciona offline por completo.** O momento em que a pessoa mais precisa da app —
  uma vontade forte, num autocarro, sem rede — é exatamente onde uma app dependente de
  servidor falha. Todo o conteúdo do programa, o jogo, a respiração e os motivos pessoais
  estão no dispositivo.
- **Sem loja de aplicações.** Distribui-se por link. Atualiza-se sem que o utilizador faça
  nada.
- **Pequena.** Sem framework, sem build, sem fontes externas, sem CDN. Abre em 3G.
- **Sem instalação para experimentar.** Reduz o atrito de adesão, que é o ponto onde os
  programas de cessação perdem mais gente.

Custo assumido: as notificações web em segundo plano são menos fiáveis do que as nativas,
e quem não tem smartphone fica de fora (ver `docs/who-alignment.md` → "Lacunas
conhecidas").

## Regra de camadas

```
content/  ─┐
format.js  ├─ PURO: sem DOM, sem window, sem store. Testado em tests/unit.mjs.
programme.js┘   É o que um port React Native reutiliza tal e qual.
game.js    ┘

store.js    ─── estado + localStorage + pub/sub
tracking.js ─── matemática derivada (dinheiro, saúde, streak, medalhas)
community.js ── feed: adaptador local + REST + fila offline
notifications.js ─ permissões, agendamento, quiet hours

views/*.js  ─── só DOM. Nenhuma regra de negócio.
app.js      ─── shell, router, e o único sítio que decide quando gravar
```

A regra que mantém isto honesto: **`programme.js` nunca escreve no store.** `due()` devolve
as mensagens devidas; `app.js` é que as grava e marca como entregues. Por isso o
agendamento — a parte que corromperia silenciosamente o programa de alguém se falhasse —
é testável sem browser.

## Fluxo de dados

```
  quit.date  ──► programmeDay() ──► phaseFor() / slotsFor()
                                          │
                                          ▼
                              messageFor(day, slot)
                                          │
                    due({ delivered, now, slotTimes })
                                          │
                            app.js: pushThread() + marca entregue
                                          │
                              views/messages.js renderiza
```

Resposta do utilizador:

```
  texto ──► detectIntent() ──► replyTo(texto, { números reais })
                                          │
                            app.js: grava e mostra a resposta
```

## Formato do estado (`store.js`)

Uma chave em `localStorage`: `hauparafuma.v1`. Versionada (`schema`) para permitir
migrações em vez de apagar a sequência de dias de alguém — perder um streak é um dano real
para quem está a deixar de fumar.

```js
{
  schema, createdAt, onboarded,
  profile:   { nickname, avatarSeed, cigsPerDay, pricePerPack, cigsPerPack, reasons, customReason },
  quit:      { date, startedAt, attempt, bestDays, history[] },
  settings:  { theme, notifications, morningAt, eveningAt, quietFrom, quietTo, apiBase },
  thread:    [{ id, msgId, dir, type, text, at, read, action, quick, assessDay }],
  programme: { delivered[], lastDeliveredKey, assessments[] },
  checkins:  { 'YYYY-MM-DD': 'clean' | 'smoked' },
  diary:     [{ id, at, strength, trigger, action, smoked, note }],
  counters:  { cravingsBeaten, gamesPlayed, breathsDone },
  game:      { best: { level: { ms, moves } }, level },
  fagerstrom, badges[], plan, moneyGoals[],
  community: { deviceId, posts[], outbox[], reacted[], reported[], lastPostAt, seenRules }
}
```

`hydrate()` preenche chaves em falta a partir dos defaults sem apagar dados do utilizador,
e preserva chaves desconhecidas, para que um downgrade não destrua o que uma versão mais
recente escreveu. Se o `localStorage` encher, `writeStorage()` corta primeiro o que é menos
valioso (diário antigo, espelho do feed) em vez de perder a contagem.

## Comunidade: dois adaptadores, uma interface

`community.js` funciona em dois modos:

- **remoto** — `server/server.js`. Escritas otimistas: a publicação aparece de imediato e
  vai para uma `outbox` se não houver rede, sincronizando depois. Quem finalmente ganha
  coragem para escrever "ha'u fila fali fuma" sem rede não pode perder esse texto.
- **local** (sem servidor) — as publicações ficam no dispositivo. A app **diz isto no
  ecrã** (`com.local`) em vez de fingir que chegaram a alguém.

**O servidor vem embutido, não é uma escolha do utilizador.** `detectServer()` sonda
`/api/health` na própria origem de onde a app foi servida; como `server/server.js` serve
a app *e* a API, a comunidade funciona sem que ninguém abra as definições. Não existe
campo de servidor na interface — é uma decisão que a pessoa não deve ter de perceber.

O valor detetado é **gravado**, não apenas mantido em memória. Offline a sondagem falha, e
esquecer o servidor faria a app cair para modo local e gravar a publicação como local em
vez de a pôr na `outbox` — exatamente a publicação que a `outbox` existe para salvar.

`settings.apiBase` continua a existir como *override* sem interface (usado pelos testes,
e o gancho natural para salas por município, se um dia forem precisas).

Consequência de servir tudo na mesma origem: **o limite de pedidos aplica-se só a
`/api/`**. Um carregamento da app são dezenas de pedidos de módulos; contá-los esgotaria o
limite antes de alguém publicar, e atrás de um NAT de operadora — normal em Timor-Leste —
tiraria a comunidade a toda a gente nesse gateway ao mesmo tempo. Coberto por
`tests/single-origin.mjs`.

O servidor revalida tudo o que o cliente valida: o cliente não é fronteira de confiança.
IDs de dispositivo nunca são devolvidos a outros clientes (`publicPost()`).

## Segurança do conteúdo gerado por utilizadores

Regra única e absoluta: **texto do utilizador só é inserido com `textContent`**, através de
`el()` em `app/js/ui.js`. Não existe caminho de `innerHTML` que toque em dados de
utilizador. Numa app com um feed público onde qualquer pessoa escreve, é a única defesa
que importa.

Além disso: limite de caracteres, intervalo mínimo entre publicações, denúncia com
ocultação automática ao fim de 3 denúncias, e bloqueio de números de telefone, e-mails e
URLs — no cliente **e** no servidor.

## Notificações: três camadas

1. **Web Push** — funciona com a app fechada; só com o servidor configurado com chaves
   VAPID. Opcional.
2. **Temporizador local** — enquanto a app está viva. Um só temporizador, rearmado, com
   limite de 6 h por espera (temporizadores longos são descartados pelos browsers móveis).
3. **Catch-up ao abrir** — `deliverDue()` entrega tudo o que ficou por entregar.

A camada 3 é a garantia: **nenhuma mensagem se perde**, mesmo que 1 e 2 falhem. As horas
de silêncio são respeitadas em todas — acordar alguém às 03:00 faz mais mal do que o
lembrete faz bem.

## Portar para React Native

Reutilizáveis sem alteração: `content/*`, `format.js`, `programme.js`, `game.js`,
`tracking.js` (trocando o import do store), `content/*`.

A substituir: `views/*` (→ componentes RN), `ui.js` (→ primitivas RN), `store.js`
(localStorage → AsyncStorage/SQLite), `notifications.js` (→ `expo-notifications`, que
resolveria a fragilidade da camada 2), `sw.js` (desnecessário).

O motor do programa não precisaria de tocar-se, e é aí que está a lógica que importa.

## Testes

- `npm test` — 57 testes sobre as camadas puras: seleção de mensagens em todas as bandas e
  fronteiras, palavras-chave, catch-up, matemática de dinheiro e saúde, Fagerström,
  medalhas, minigame, formatação em Tétum.
- `npm run test:smoke` — 79 asserções num Chromium em tamanho de telemóvel: percurso
  completo do utilizador, comunidade real entre **dois dispositivos** em **duas origens**
  (CORS + `apiBase` manual), minigame até vencer, offline, e uma varredura que falha se
  alguma string em português ou inglês aparecer na interface.
- `npm run test:origin` — 10 asserções na topologia de produção: app e API na mesma
  origem, comunidade a funcionar sem qualquer configuração, e o limite de pedidos a não
  travar o carregamento da app.

Três bugs reais foram encontrados por estes testes e corrigidos: as avaliações dos dias
30/90/180 nunca eram feitas, o botão SOS cobria o botão de enviar mensagem, e — ao juntar
a app e a API na mesma origem — o limite de pedidos por IP passou a contar os ficheiros
estáticos, esgotando-se durante o carregamento e devolvendo 429 à comunidade.
