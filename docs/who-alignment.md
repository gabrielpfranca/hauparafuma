# Alinhamento com o handbook OMS/ITU mTobaccoCessation

Este documento mapeia cada elemento estrutural do guia **WHO/ITU "Be He@lthy, Be Mobile
— A handbook on how to implement mTobaccoCessation"** para onde ele está implementado
neste repositório, e declara honestamente o que **não** foi possível extrair da fonte.

---

## ⚠️ Limitação da fonte — leia primeiro

**O conteúdo deste app não foi extraído do PDF do handbook.**

A pasta "WHO mTobaccoCessation handbook" referida no pedido original não existia no
repositório, e nesta sessão de desenvolvimento os PDFs oficiais estavam inacessíveis:

| Fonte | Resultado |
|---|---|
| `iris.who.int/.../9789241550956-eng.pdf` | HTTP 403 (bloqueado pelo proxy) |
| `itu.int/.../BHBM-mTabaccoCessation.pdf` | HTTP 403 |
| `who.int/campaigns/world-no-tobacco-day/2021/quitting-toolkit/...` | HTTP 403 |

O que foi possível confirmar veio de páginas de catálogo da OMS/ITU e da literatura
sobre o mCessation da Índia (o maior programa implantado sob esta iniciativa): programa
de **~150 mensagens**, **bidirecional**, **gratuito**, **opt-in por registo**,
personalizado pelo **padrão de consumo e pela data de cessação escolhida**, com taxas de
abstinência relatadas de ~19% aos ≥30 dias e 4–6 meses.

**Consequência prática:** o cronograma e as categorias abaixo reproduzem a *estrutura*
descrita do programa; os **textos das mensagens são autorais**, escritos para o contexto
de Timor-Leste. Eles **não são as mensagens oficiais da OMS**.

**Antes de qualquer uso real**, a biblioteca deve ser reconciliada com o handbook e
aprovada pelo Ministério da Saúde. Isso é uma troca de ficheiro, não uma reescrita: toda
a biblioteca vive isolada em `app/js/content/messages.js`, e o motor
(`app/js/programme.js`) não assume nenhum texto em particular.

---

## Mapeamento estrutural

### 1. Registo (registration)

| Handbook | Implementação |
|---|---|
| Registo opt-in, gratuito, sem barreira | `app/js/views/onboarding.js` — 6 passos, sem conta, sem e-mail, sem telefone |
| Recolha do padrão de consumo | cigarros/dia, preço/maço, cigarros/maço |
| Escolha da data de cessação | 4 opções: hoje, +7 dias (recomendado), data própria, "já parei" |
| Motivações para personalização | 12 motivos + texto livre (`content/coping.js` → `REASONS`) |
| Consentimento para notificações | passo dedicado, **com justificação antes do prompt do browser** |

### 2. Faseamento e cronograma

O handbook define um programa de ~6 meses ancorado no dia D, com intensidade
decrescente. Implementado em `SCHEDULE` (`app/js/content/messages.js`) e aplicado por
`slotsFor()` / `isDeliveryDay()` (`app/js/programme.js`):

| Fase | Dias | Frequência | Mensagens |
|---|---|---|---|
| Preparação (pre-quit) | −7 … −1 | 2×/dia | 14 |
| Dia D (quit day) | 0 | 4×/dia | 4 |
| Semanas 1–2 | 1 … 14 | 2×/dia | 28 |
| Semanas 3–4 | 15 … 28 | 1×/dia | 14 |
| Semanas 5–8 | 29 … 56 | a cada 2 dias | 14 |
| Semanas 9–12 | 57 … 84 | a cada 3 dias | 10 |
| Meses 4–6 | 85 … 180 | semanal | 14 |

**Total entregue: ~98 mensagens agendadas**, mais os conjuntos sob demanda (15 de
craving, 8 de recaída, 5 de avaliação, 40 frases motivacionais). Fica abaixo das ~150 do
mCessation Índia — ver "Lacunas conhecidas".

Verificado por testes: `tests/unit.mjs` → *"delivery frequency tapers"*, *"every
scheduled slot from day −7 to 180 yields a message"*.

### 3. Categorias de mensagem

As dez categorias do handbook estão no campo `type` de cada mensagem e são mostradas ao
utilizador como etiqueta acima do balão (`app/js/views/messages.js`):

| `type` | Etiqueta em Tétum | Exemplo de uso |
|---|---|---|
| `motivation` | Forsa | reforço de auto-eficácia |
| `info` | Informasaun | o que a nicotina faz, quanto dura a vontade |
| `coping` | Oinsá hasoru | técnicas concretas para a vontade |
| `benefit` | Benefísiu | ganhos de saúde já alcançados |
| `relapse` | Fila fali | prevenção e recuperação de recaída |
| `reminder` | Hanoin-hetan | preparar a casa, marcar a data |
| `assess` | Pergunta | avaliação do estado de cessação |
| `social` | Apoiu sosiál | envolver família e amigos |
| `reward` | Prémiu | poupança, medalhas, marcos |
| `service` | Servisu saúde | encaminhamento para o CSC |

### 4. Interação bidirecional

O handbook trata o canal de retorno como essencial. Implementado em `detectIntent()` e
`replyTo()` (`app/js/programme.js`), com correspondência **insensível a maiúsculas e a
acentos** (`saúde` = `saude`):

| Palavra-chave (Tétum) | Intenção | Resposta |
|---|---|---|
| `HAKARAK` | vontade de fumar | técnica de coping + atalho para SOS |
| `FUMA TIHA` / `FUMA FALI` | recaída | mensagem sem julgamento + plano |
| `TULUN` | pedido de ajuda | menu de ferramentas |
| `OSAN` | dinheiro | **valor real poupado**, interpolado |
| `SAÚDE` | saúde | tempo sem fumar + próximo marco |
| `JOGU` / `DADA IIS` | distração | abre o jogo / a respiração |
| `DI'AK` | está bem | convite a partilhar na comunidade |

A ordem importa: recaída é testada **antes** de vontade genérica, para que um deslize
nunca seja tratado como simples craving (`tests/unit.mjs` → *"relapse is matched before
the generic craving keyword"*).

Para quem tem baixa literacia digital, cada intenção também é alcançável com **um toque**
em chips de resposta rápida acima do compositor.

### 5. Avaliação e seguimento

Perguntas de estado nos dias **7, 14, 30, 90 e 180** (`ASSESS_DAYS`), respondidas com dois
botões e registadas em `store.programme.assessments`.

> **Bug real encontrado e corrigido durante o desenvolvimento:** os dias 30, 90 e 180 caem
> *entre* dias de entrega das suas bandas (a cada 2 dias a partir do 29; semanal a partir
> do 85). Sem tratamento especial, **três das cinco avaliações nunca seriam feitas**.
> `isDeliveryDay()` agora força a entrega nos dias de avaliação. Coberto pelo teste
> *"assessment days override the band cadence that would skip them"*.

### 6. Recaída

O handbook trata a recaída como parte esperada do processo. A app nunca reinicia a
contagem sozinha: apresenta a escolha (`openRelapseSheet` em `app/js/app.js`).

- **"Foi só um cigarro"** → mantém a contagem. Zerar 60 dias por um deslize afasta a
  pessoa mais do que a motiva.
- **"Recomeçar"** → arquiva a tentativa, guarda o recorde de dias, incrementa o número da
  tentativa e **limpa o registo de entregas**, de modo que as mensagens das primeiras
  semanas — as mais úteis — voltem a chegar.

Implementado em `tracking.recordRelapse()`.

### 7. Encaminhamento para serviços

- Teste de Fagerström (`app/js/content/fagerstrom.js`); pontuação ≥6 encaminha
  explicitamente para o Sentru Saúde Komunidade.
- Ecrã de serviços (`app/js/views/services.js`) lista as estruturas que existem no país.
- **Nenhum número de telefone foi inventado.** Um número errado numa crise é pior do que
  nenhum: são um campo a preencher e confirmar localmente.

### 8. Princípios transversais

| Princípio | Como é cumprido |
|---|---|
| Gratuito | sem pagamentos, sem anúncios, sem dependências pagas |
| Funciona sem internet | PWA offline-first; toda a app no cache do service worker |
| Privacidade | tudo em `localStorage`; só sai do telemóvel o que a pessoa publica |
| Sem rastreamento | sem analytics, sem terceiros, sem CDN, sem fontes externas |
| Opt-out | notificações desligáveis; exportar e apagar todos os dados |
| Personalização | mensagens usam os números reais da pessoa |
| Adequação local | USD, metas de poupança locais, gatilhos locais (kafé, tuak, festa) |

---

## Lacunas conhecidas

1. **Textos não validados contra o handbook** — ver aviso no topo.
2. **~98 mensagens agendadas vs. ~150** no mCessation Índia. A fase de manutenção usa
   uma reserva temática rotativa em vez de mensagens únicas por dia. Ampliar é acrescentar
   entradas a `MAINTAIN_POOL`; nenhuma alteração de motor é necessária.
3. **Tétum por rever** — nenhuma string foi validada por falante nativo. Ver
   `docs/translation-review.md`. É a lacuna mais importante antes de qualquer piloto.
4. **Sem SMS.** O handbook assume SMS como canal primário, o que alcança telemóveis
   básicos. Esta implementação é uma app web, o que exclui quem não tem smartphone. Uma
   ponte SMS exigiria acordo com operadoras e um gateway — fora do âmbito, mas o motor
   (`programme.js`) é puro e serviria um emissor de SMS sem alterações.
5. **Sem integração com o sistema de saúde.** Não há encaminhamento eletrónico nem
   partilha de dados com o CSC, por opção de privacidade.
6. **Sem avaliação clínica.** Nenhuma alegação de eficácia é feita.

---

## Referências

- WHO/ITU — *Be He@lthy, Be Mobile: a handbook on how to implement mTobaccoCessation*
  (ISBN 9789241549813) — https://www.who.int/publications/i/item/9789241549813
- WHO — *Mobile Health for Tobacco Cessation (mTobaccoCessation)* —
  https://www.who.int/publications/i/item/978924154981-3
- WHO/ITU — *Be He@lthy, Be Mobile* —
  https://www.who.int/initiatives/behealthy
- Governo da Índia — *mCessation Programme*, National Tobacco Control Programme —
  https://ntcp.mohfw.gov.in/mcessation
- Cronologia de recuperação usada em `app/js/content/milestones.js`: OMS, *Tobacco: health
  benefits of smoking cessation*, e a cronologia do US Surgeon General / CDC.
- Teste de dependência: Heatherton et al. (1991), *Fagerström Test for Nicotine
  Dependence*.
- Estimativa de ~11 minutos de vida por cigarro: Shaw, Mitchell & Dorling, *BMJ* 2000 —
  média populacional, apresentada na app como estimativa, nunca como promessa.
