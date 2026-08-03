# Hau Para Fuma 🌱

**Aplicação de apoio para deixar de fumar, inteiramente em Tétum, para Timor-Leste.**

Um programa de acompanhamento de 6 meses estruturado segundo o guia OMS/ITU
*Be He@lthy, Be Mobile — mTobaccoCessation*: mensagens diárias com frequência decrescente,
conversa bidirecional, comunidade de pares, acompanhamento dos ganhos financeiros e de
saúde, e ferramentas para o momento em que a vontade aperta.

Funciona **offline**, instala-se no ecrã inicial e não precisa de conta.

---

## ⚠️ Antes de usar com pessoas reais

Duas ressalvas que não devem passar despercebidas:

1. **O Tétum ainda não foi revisto por um falante nativo.** Foi escrito com cuidado, mas
   não validado. Como a app é só em Tétum, não há segunda língua a servir de rede de
   segurança. Ver **[`docs/translation-review.md`](docs/translation-review.md)** — tem o
   glossário, as decisões em aberto e a checklist de aceitação.
2. **Os textos das mensagens são autorais, não são as mensagens oficiais da OMS.** Os PDFs
   do handbook estavam inacessíveis (HTTP 403) durante o desenvolvimento, por isso foi
   reproduzida a *estrutura* documentada do programa, não o seu conteúdo. Ver
   **[`docs/who-alignment.md`](docs/who-alignment.md)**.

Também: nenhum número de telefone de serviço de saúde foi inventado — são campos a
preencher e confirmar localmente. A app não substitui atendimento de saúde e não faz
qualquer alegação de eficácia clínica.

---

## Funcionalidades

**Programa de 6 meses (180 dias)** ancorado numa data de cessação escolhida pela pessoa.
Intensidade decrescente, como recomenda o handbook: 2 mensagens/dia na preparação e nas
duas primeiras semanas, 4 no dia D, depois diária, de 2 em 2 dias, de 3 em 3, e semanal
até ao 6.º mês. As mensagens estão etiquetadas com as categorias do handbook (Forsa,
Informasaun, Oinsá hasoru, Benefísiu, Fila fali, …).

**Conversa bidirecional.** A pessoa pode escrever em Tétum a qualquer momento. O motor
reconhece `HAKARAK` (vontade), `FUMA TIHA` (recaída), `TULUN`, `OSAN`, `SAÚDE`, `JOGU`,
`DADA IIS` — sem sensibilidade a maiúsculas ou acentos — e responde com técnicas concretas
ou com os números reais da pessoa. Quem prefere não escrever tem tudo a um toque, em chips
de resposta rápida.

**Comunidade** onde qualquer participante publica e responde. Etiquetas `Konkista`,
`Buka tulun` e `Konsellu` — pedir ajuda tem o mesmo destaque que celebrar. Com denúncia,
ocultação automática, limite de ritmo, bloqueio de dados pessoais e fila offline.

**Acompanhamento.** Contador ao segundo, dinheiro poupado em USD com metas locais (de uma
garrafa de água a um sinal para uma mota), cigarros não fumados, tempo de vida recuperado,
e a cronologia de recuperação da saúde da OMS/CDC — dos 20 minutos aos 15 anos.

**Para o momento da vontade.** Um botão SOS vermelho alcançável de qualquer ecrã, com
temporizador de 5 minutos (a janela em que a vontade sobe e cede), um **minigame de
memória** calibrado para esses ~3 minutos, respiração 4-4-6, os motivos pessoais, e
contactos de apoio com ligação direta.

> O minigame usa símbolos de comida, plantas e animais. **Não há cigarros, isqueiros nem
> fogo** — mostrar pistas de fumo a alguém a meio de uma vontade é o oposto de ajudar.

**Outras ferramentas.** Diário da vontade (que revela os gatilhos pessoais), cartões para
gatilhos locais (kafé, tuak, festa, stress, depois de comer), plano de emergência,
teste de dependência de Fagerström com encaminhamento para o Sentru Saúde Komunidade, guia
de sintomas de abstinência, 40 frases motivacionais, e 16 conquistas partilháveis.

**Recaída sem julgamento.** A contagem nunca é reiniciada automaticamente: a pessoa escolhe
entre "foi só um cigarro, continuar" e "recomeçar". O histórico de tentativas e o recorde
de dias são preservados.

---

## Como executar

Não há passo de compilação e não há dependências obrigatórias.

```bash
npm start          # serve a app em http://localhost:8080
```

No Windows, sem terminal: clique duas vezes em **`start.bat`** — abre o servidor e o
browser sozinho.

Servidor da comunidade (opcional — sem ele a app corre em modo local e diz isso no ecrã):

```bash
npm run server     # http://localhost:8081
```

Depois, na app: **Ha'u → Servidór komunidade** → `http://localhost:8081`.

Notificações push (opcional, requer `npm install web-push`):

```bash
VAPID_PUBLIC=… VAPID_PRIVATE=… VAPID_SUBJECT=mailto:voce@exemplo.org npm run server
```

### Testes

```bash
npm test           # 57 testes unitários das camadas puras
npm run test:smoke # 79 asserções ponta-a-ponta num Chromium em tamanho de telemóvel
```

O smoke test percorre o registo, o painel, a conversa, a comunidade real **entre dois
dispositivos**, o minigame até vencer, o modo offline, e falha se alguma string em
português ou inglês aparecer na interface. Guarda capturas em `tests/screens/`.

---

## Estrutura

```
app/                  PWA (HTML/CSS/ES modules, sem build)
  js/content/         todo o conteúdo em Tétum — ficheiros de dados, trocáveis
  js/programme.js     motor OMS: cronograma, entrega, palavras-chave    ← puro
  js/format.js        durações, moeda e datas em Tétum                   ← puro
  js/game.js          minigame de memória                                ← puro
  js/tracking.js      dinheiro, saúde, streak, medalhas
  js/views/           17 ecrãs (só DOM)
server/server.js      feed partilhado + push — zero dependências
tools/                servidor estático de dev, gerador de ícones
tests/                unitários + smoke Playwright
docs/                 alinhamento OMS, revisão de tradução, arquitetura
```

As camadas puras não tocam no DOM nem no armazenamento, o que as torna testáveis sem
browser e reutilizáveis num futuro port React Native. Ver
[`docs/architecture.md`](docs/architecture.md).

---

## Privacidade

Tudo fica em `localStorage`, no telemóvel. Sem conta, sem e-mail, sem número de telefone.
A única coisa que sai do dispositivo é o que a pessoa publica na comunidade — e mesmo aí,
apenas uma alcunha à escolha. Sem analytics, sem terceiros, sem CDN, sem fontes externas.
Exportar e apagar todos os dados estão em **Ha'u**, e ambos funcionam offline.

Texto de utilizador é sempre inserido com `textContent`, nunca com `innerHTML`.

---

## Estado

Funcional e testado (57 unitários + 79 asserções ponta-a-ponta, todos verdes).
Pendente antes de um piloto: **revisão do Tétum por falante nativo**, reconciliação da
biblioteca de mensagens com o handbook da OMS, e confirmação dos números dos serviços de
saúde. Ver [`docs/who-alignment.md`](docs/who-alignment.md) → "Lacunas conhecidas".

## Licença

MIT.
