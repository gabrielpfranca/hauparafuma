# Revisão de tradução — Tetun Dili

> **ESTADO: POR REVER.**
> Toda a app está em Tétum, mas **nenhuma string foi validada por um falante nativo**.
> Este documento é o instrumento dessa revisão. Enquanto não estiver feita, a app **não
> deve ser usada com pessoas reais**.

Não há segunda língua na interface por decisão de produto (Tétum apenas), o que significa
que **não existe rede de segurança**: um erro de tradução não é apanhado por comparação
com outro idioma. Daí a importância desta revisão.

---

## Como fazer a revisão

Todo o texto visível ao utilizador está em **sete ficheiros**. Não é preciso ler código.

| Ficheiro | O que contém | Volume |
|---|---|---|
| `app/js/i18n.js` | toda a interface: botões, títulos, etiquetas, erros | ~430 strings |
| `app/js/content/messages.js` | mensagens do programa de 6 meses | ~145 textos |
| `app/js/content/quotes.js` | frases motivacionais | 40 |
| `app/js/content/coping.js` | motivos, gatilhos, sintomas de abstinência | ~90 |
| `app/js/content/milestones.js` | marcos de recuperação da saúde | 13 |
| `app/js/content/fagerstrom.js` | perguntas do teste de dependência | 6 + opções |
| `app/js/content/rewards.js` | metas de poupança | 14 |
| `app/js/content/badges.js` | conquistas e textos de partilha | 16 |

Para ver as strings em contexto, no ecrã: `npm start` e abrir <http://localhost:8080>.

### O que verificar, por ordem de importância

1. **Segurança e clareza clínica** — as mensagens sobre recaída, abstinência e
   encaminhamento para o Sentru Saúde Komunidade. Um mal-entendido aqui tem custo real.
2. **Tom.** O programa deve soar como um apoiante, nunca como um julgador. Verificar
   sobretudo `RELAPSE_POOL` em `messages.js`: nenhuma linha pode envergonhar.
3. **Registo e tratamento.** A app trata o utilizador por **`ita`** (cortês) em todo o
   lado, nunca por `ó`. Confirmar que é a escolha certa e que é consistente.
4. **Ortografia INL.** Grafia do Instituto Nacional de Linguística: apóstrofo para a
   oclusiva glotal (`ha'u`, `di'ak`, `ne'e`), `k` e não `c`, `j`/`x` conforme INL.
5. **Naturalidade.** Marcar tudo o que soe a tradução literal do português. Preferir a
   forma que uma pessoa em Díli usaria a falar.
6. **Empréstimos.** Há vários empréstimos do português (`sigarru`, `pulmaun`, `saúde`,
   `parabéns`, `motivu`). Confirmar quais são de facto correntes e quais devem ser
   substituídos por termos tétum.

### Como registar as correções

Editar diretamente os ficheiros acima — são texto simples, uma string por linha. Depois:

```bash
npm test          # confirma que nada estrutural quebrou
npm run test:smoke   # confirma que a app continua a funcionar
```

Os testes verificam **estrutura**, não gramática: comprimento mínimo das mensagens,
ausência de chaves de tradução em falta, ausência de números de telefone e de marcas de
tabaco no conteúdo.

---

## Glossário dos termos usados

Termos-chave, para que a revisão possa verificar consistência de uma só vez em vez de
string a string.

### Núcleo do domínio

| Tétum usado | Português | Inglês | Nota para o revisor |
|---|---|---|---|
| fuma | fumar | to smoke | do port. *fumar* |
| para fuma | parar de fumar | to quit smoking | |
| sigarru | cigarro | cigarette | |
| tabaku | tabaco | tobacco | |
| nikotina | nicotina | nicotine | |
| hakarak fuma | vontade de fumar | craving | **termo central da app** — confirmar |
| fila fali (fuma) | recair | relapse | lit. "voltar atrás" |
| abstinénsia | abstinência | withdrawal | |
| loron para fuma | dia de parar | quit day | |
| dependénsia | dependência | dependence | |

### Corpo e saúde

| Tétum | Português | Inglês |
|---|---|---|
| saúde | saúde | health |
| isin | corpo | body |
| fuan | coração | heart |
| pulmaun | pulmão | lung |
| iis | respiração / fôlego | breath |
| dada iis | respirar (inspirar) | to breathe |
| soe iis | expirar | to exhale |
| sangue | sangue | blood |
| tensaun sangue | tensão arterial | blood pressure |
| kanser | cancro | cancer |
| tose | tosse | cough |
| moras | doente / dor | ill / pain |
| lian-nanál | língua (órgão) | tongue |
| inus | nariz | nose |
| todan | peso | weight |
| kolen | cansado | tired |

### Tempo

| Tétum | Português | Nota |
|---|---|---|
| loron | dia | **a unidade vem antes do numeral: "loron 3", não "3 loron"** |
| oras | hora | |
| minutu | minuto | |
| segundu | segundo | |
| semana | semana | |
| fulan | mês | |
| tinan | ano | |
| ohin loron | hoje | |
| horiseik | ontem | |
| aban | amanhã | |
| oras ne'e | agora | |
| … liu ba | … atrás | ex.: "minutu 5 liu ba" |

Sem marca de plural no nome — `loron 1` e `loron 20` usam a mesma forma. Ver
`app/js/format.js`.

### Meses e dias da semana

`Janeiru, Fevereiru, Marsu, Abríl, Maiu, Juñu, Jullu, Agostu, Setembru, Outubru,
Novembru, Dezembru`

`Domingu, Segunda, Tersa, Kuarta, Kinta, Sesta, Sábadu`

### App e interação

| Tétum | Português | Inglês |
|---|---|---|
| mensajen | mensagem | message |
| notifikasaun | notificação | notification |
| komunidade | comunidade | community |
| ferramenta | ferramenta | tool |
| jogu | jogo | game |
| konkista | conquista | achievement |
| konfigurasaun | configurações | settings |
| privasidade | privacidade | privacy |
| rai | guardar | save |
| hasai | apagar / retirar | delete |
| haruka | enviar | send |
| hatán | responder | reply |
| publika | publicar | post |
| hili | escolher | choose |
| loke | abrir | open |
| taka | fechar | close |
| troka | mudar / editar | change |
| hahú | começar | start |
| kontinua | continuar | continue |
| fila fali | voltar | back |

⚠️ **`fila fali` aparece com dois sentidos**: "voltar" (botão) e "recair" (`fila fali
fuma`). Verificar se isso causa confusão e se o botão deve usar outra palavra.

### Dinheiro e vida quotidiana

| Tétum | Português | Nota |
|---|---|---|
| osan | dinheiro | moeda: **USD** (moeda de Timor-Leste) |
| folin | preço | |
| pakote | maço / pacote | |
| sosa | comprar | |
| salva | poupar | do port. *salvar* — confirmar se `rai osan` seria melhor |
| meta | meta | |
| pulsa | saldo de telemóvel | termo corrente? |
| tuak | bebida alcoólica local | gatilho |
| kafé | café | gatilho |
| belun | amigo | |
| familia | família | |
| oan | filho / criança | |
| uma | casa | também o nome do separador "Início" |

### Pessoas e apoio

| Tétum | Português |
|---|---|
| ita | você (cortês) — **tratamento usado em toda a app** |
| ha'u | eu |
| ema | pessoa |
| belun | amigo |
| apoiu | apoio |
| tulun | ajudar |
| doutór | médico |
| Sentru Saúde Komunidade (CSC) | Centro de Saúde Comunitário |
| Ministériu Saúde | Ministério da Saúde |

### Emoção e motivação

| Tétum | Português |
|---|---|
| forsa | força |
| kbiit | força / capacidade |
| motivu | motivo |
| fiar | acreditar / confiar |
| hakmatek | acalmar |
| laran manas | zangado |
| triste | triste |
| kontente | contente |
| hakfodak | assustar-se |
| parabéns | parabéns |
| obrigadu / obrigada | obrigado / obrigada |
| susar | difícil |
| manán | vencer |
| la mesak | não sozinho |

⚠️ **`obrigadu` / `obrigada` flete com o género de quem fala.** A app usa `obrigadu` de
forma fixa (é a app a falar). Confirmar se está correto ou se deve ser evitado.

---

## Pontos específicos a decidir

Lista curta de decisões que um falante nativo deve tomar; estão marcadas para não se
perderem.

1. **`hakarak fuma`** para *craving* — é a forma natural? Aparece dezenas de vezes,
   incluindo no botão vermelho de emergência (`sos.button`).
2. **`osan salva`** para *dinheiro poupado* — ou `osan rai`, ou outra construção?
3. **`fila fali`** — mesmo termo para "voltar" e "recair" (ver acima).
4. **Botão SOS: "Hakarak fuma!"** — é imediatamente compreensível para alguém em pânico?
   É a string mais importante da app.
5. **`Bemvindu`** — grafia INL, ou `Benvindu`?
6. **`Ita la mesak`** ("não estás sozinho") — o slogan da app. Soa bem?
7. **Nomes dos separadores**: `Uma`, `Mensajen`, `Komunidade`, `Ferramenta`, `Ha'u`.
   Cabem em ~10 caracteres e devem ser óbvios sem ícone.
8. **`Loron ida-idak`** ("um dia de cada vez") — construção correta?
9. **Termos de saúde**: `pulmaun`, `kanser`, `tensaun sangue` — são os usados nos
   materiais do Ministério da Saúde? Idealmente alinhar com eles.
10. **Regras da comunidade** (`com.rules`) — são lidas por todos os utilizadores; a
    clareza importa mais aqui do que a elegância.

---

## Checklist de aceitação

- [ ] `app/js/i18n.js` revisto integralmente
- [ ] `messages.js` — mensagens D−7 a D28 (as de maior risco) revistas
- [ ] `messages.js` — reserva de manutenção, coping e recaída revistas
- [ ] `quotes.js`, `coping.js`, `milestones.js`, `fagerstrom.js`, `rewards.js`, `badges.js` revistos
- [ ] As 10 decisões acima resolvidas
- [ ] Ortografia INL confirmada em todo o lado
- [ ] Tratamento (`ita`) consistente
- [ ] Terminologia de saúde alinhada com o Ministério da Saúde
- [ ] `npm test` e `npm run test:smoke` verdes após as edições
- [ ] Segunda leitura por um profissional de saúde timorense
