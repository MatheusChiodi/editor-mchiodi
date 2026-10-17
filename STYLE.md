# Guia de estilo — canal MChiodi

O diretor segue este guia em toda edição. Os números entre `crases` são os mesmos de
`mce.config.json` / padrões da EDL: mudou aqui, mude lá.

## 0. Níveis de edição

Cada vídeo tem um nível (`level` na EDL), escolhido pelo Matheus: `pnpm mce draft <slug> --level pro`, pasta
`inbox/pro/` no modo autônomo, ou `edit.level` em `mce.config.json` como padrão. O nível muda **quanto** entra, não o
gosto: as regras de corte, legenda, identidade, áudio e cor valem em todos. A fonte dos números é `src/edl/levels.ts`
(`pnpm mce levels <nível>` mostra a ficha; `pnpm mce level <slug>` mostra quanto falta ou sobra no projeto).

| Por minuto de vídeo | `limpa` | `normal` | `pro` | `max` |
|---|---|---|---|---|
| zooms (inclui efeito de câmera) | até 1 | até 3 | 2–6 | 2–9 |
| gráficos | até 0,5 | até 4 | 3–6 | 6–12 |
| cenas ilustrativas | nenhuma | até 1 | 0,75–2 | 1,5–3 |
| transições | até 0,25 | até 1,5 | 0,5–2 | 0,5–3,5 |
| efeitos | até 0,2 | até 1,5 | 0,5–2 | 0,5–3 |
| SFX | até 0,5 | até 4 | 2–8 | 4–12 |
| distância mínima: zoom / gráfico / cena / transição / meme | 45 / 30 / — / 60 / — s | 20 / 12 / 60 / 20 / 90 s | 10 / 6 / 30 / 10 / 60 s | 6 / 4 / 20 / 6 / 40 s |
| transições diferentes / de energia alta | 1 / 0 | 3 / 3 | 6 / 6 | 10 / 10 |
| trilha e vinhetas | opcionais | opcionais | sempre | sempre |
| tela parada (sem nada novo) | — | — | — | até 8 s |
| vídeo editado (fora de trecho parado) | — | — | — | pelo menos 80% |
| cada trecho sem edição (respiro) | — | — | — | até 40 s |
| parte editada entre dois respiros | — | — | — | pelo menos 15 s |
| sincronia: entrada em relação ao início da palavra | — | — | −0,30 a +0,25 s | −0,15 a +0,10 s |
| leitura de cada item de texto | — | — | — | 1,2 s + 0,25 s por palavra |
| padrões obrigatórios | — | — | — | 7 (abaixo) |

- `limpa`: só cortes, legendas, áudio e cor. Gráfico apenas para informação que falta na fala.
- `normal`: o padrão deste guia; os números das seções 4 a 6 são os dele.
- `pro`: apoio visual constante. Nenhum bloco de 20s sem gráfico, zoom ou destaque; cena ilustrativa em cada conceito
  abstrato; stinger + `SectionTitle` + whoosh em toda troca de capítulo; trilha, SFX e vinhetas.
- `max`: a linguagem do vídeo de referência (abaixo): algo novo na tela a cada 2–4s, troca de layout a cada ~8–10s, o
  apresentador em cartão sobre papel sempre que a tela for de conteúdo, e os 7 padrões obrigatórios.

Em `pro` e `max` o mínimo também é cobrado: a avaliação avisa `abaixo-do-nivel`. Mesmo assim, nos quatro níveis,
um gráfico por vez e todo item com `reason`. Em `pro`/`max` o motivo pode ser "dá ritmo"; em `normal` precisa ser "ajuda a entender".

### Padrões obrigatórios do nível max

Quando o Matheus pede edição `max`, ele quer a linguagem de "A Maior Atualização do Claude Code Desde as Skills"
(youtube.com/watch?v=Q5vEzupdjpc), feita com os tokens MChiodi e **melhor** onde a referência falha. Só a linguagem:
nada de arte, texto ou marca de lá. A avaliação avisa `padrao-obrigatorio` para cada padrão abaixo do mínimo e
`pouco-editado` quando menos de 80% do vídeo está editado e `tela-parada` para cada trecho sem edição acima de 40s;
`pnpm mce level <slug>` mostra a conta.

**Cobertura (decisão do Matheus, diferente da referência).** A referência só edita os primeiros 27% e depois vira tela
gravada crua. No `max` daqui, **pelo menos 80% do vídeo é editado ao máximo, do começo ao fim**. Um trecho conta como
"sem edição" quando passa de 8s sem nada novo na tela. Esses trechos são respiros escolhidos, não sobra: o Matheus falando
sozinho numa parte pessoal ou de opinião, ou mostrando algo na tela que precisa ser visto inteiro. Cada respiro tem até 40s,
somados não passam de 20% do vídeo, e não se colam dois (pelo menos 15s editados entre eles: aviso `respiros-colados`).
**Respiro se declara**: `"breathers": [{ "start": 310.2, "end": 338.0, "reason": "parte pessoal" }]` na EDL (segundos da fonte). Trecho
de 8–40s sem evento que não está declarado vira aviso `trecho-parado`; o declarado passa calado, mas continua contando nos 20% e
no teto de 40s. Tela gravada entra na conta dos 80% quando é editada (dentro de
`WindowStage`, com zoom no que é citado, pílulas e o apresentador no canto); tela crua é respiro.

**O que foi medido na referência** (só os primeiros 5 dos 18,5 min são editados; o resto é tela gravada crua):

- 28–33 eventos visuais por minuto (um a cada ~2s); layout dura em média 8s (4–25s); maior trecho parado 11s.
- Tempo de tela: talking head cheio 28%, janela + apresentador no canto 30%, tela dividida 18%, cena de papel 23%.
- O apresentador nunca é cortado para dentro de um cartão: o próprio footage encolhe (0,4–0,9s, desacelerando) e cresce de volta.
- Cena de papel entra por rasgo (0,3–0,4s, da esquerda para a direita). Saídas são corte seco. Não há legenda palavra a palavra:
  todo texto na tela é síntese de 2–5 palavras. Quase não há zoom nem transição de corte: o movimento é a troca de layout.

| Padrão | Mínimo | Quando | Como |
|---|---|---|---|
| pílulas de resumo | 1,5/min | sobre o talking head, a cada ideia | `PillStack` |
| frase serifada | 0,5/min | tese do bloco, anúncio do que vem | `PhraseReveal` |
| apresentador em cartão | 1/min | toda tela de conteúdo que não seja cena | `presenter` no overlay |
| explicação dividida | 0,4/min | enumeração, comparação, definição | `SplitExplainer` + `presenter: right` |
| janela flutuante | 0,4/min | demonstração: comando, resposta, tela gravada | `WindowStage` + `presenter: pip-br` |
| rasgo de papel | 0,5/min | entrada de cena ilustrativa | `wipe: "tear"` na cena |
| citação com marca-texto | 1/vídeo | fonte oficial de uma afirmação | `DocQuote` |

Mínimo por minuto arredonda para baixo e nunca é menos que 1. Stamp, `Callout`, `Counter` e o resto do arsenal continuam valendo por cima disso.

**Palco (`presenter`)**: qualquer overlay pode levar `"presenter": { "slot": ..., "focus": { "x": 0.5, "y": 0.4 }, "zoom": 1.3 }`.
Durante o overlay o footage encolhe para um cartão (borda paper, raio 40, sombra) e o resto do quadro vira papel, onde o
componente desenha. Slots: `right`/`left` (cartão vertical, 23,5% × 88%) e `pip-br`/`pip-bl`/`pip-tr`/`pip-tl` (quadro de 21% × 36%).
`focus` é onde está o rosto no footage (`pnpm mce frame <slug> --at <s>` para conferir); `zoom` aproxima. Dois palcos colados
(um termina no frame em que o outro começa) viram um movimento só: o cartão desliza de um slot para o outro. `backdrop`:
`paper` (padrão), `night` ou `none`.

```json
{ "id": "ate-aqui", "component": "SplitExplainer", "at": 23.3, "duration": 13.5,
  "presenter": { "slot": "right", "focus": { "x": 0.48, "y": 0.42 } }, "hidesCaptions": true,
  "props": { "eyebrow": "Até aqui", "title": "Você personalizava *como* ele trabalha",
    "cards": [ { "icon": "bolt", "label": "Skills" }, { "icon": "cloud", "label": "Conectores" }, { "icon": "gear", "label": "Ferramentas" } ],
    "revealAt": [6.9, 8.1, 9.6], "note": { "text": "tudo definido nos seus documentos", "at": 11.2 } },
  "reason": "enumeração do que já existia, antes de apresentar a novidade" }
```

```json
{ "id": "demo-mod", "component": "WindowStage", "at": 60.5, "duration": 16,
  "presenter": { "slot": "pip-br" }, "hidesCaptions": true,
  "props": { "title": "Claude Code", "kind": "terminal",
    "lines": [ { "text": "cria um mod que abre um painel", "tone": "prompt", "at": 0.9 }, { "text": "Painel adicionado", "tone": "ok", "at": 6.2 } ],
    "notes": [ { "text": "em linguagem natural", "at": 2.1 }, { "text": "mod ativo", "tone": "emerald", "at": 6.6 } ],
    "push": { "at": 6.0, "scale": 1.2, "x": 0.2, "y": 0.3 } },
  "reason": "mostra o pedido e o resultado que a fala descreve" }
```

Com gravação de tela (`layout.screen`), `"kind": "screen"` põe a gravação dentro da janela (sem `lines`/`push`); não é preciso
declarar segmento em `layout.segments`.

```json
{ "id": "docs", "component": "DocQuote", "at": 77.6, "duration": 7.5, "presenter": { "slot": "pip-br" },
  "props": { "source": "docs oficiais · code.claude.com", "title": "Mods overview",
    "text": "Add panes and commands with a mod. ==A mod is a plugin that changes how Claude Code looks and behaves.==",
    "markAt": 2.5, "note": { "text": "o agente muda o próprio sistema", "at": 4.4 } },
  "reason": "prova que a definição vem da documentação" }
```

**Sobre o talking head**:

```json
{ "id": "resumo-1", "component": "PillStack", "at": 102.0, "duration": 12,
  "props": { "items": [ { "text": "precisa programar", "at": 1.6, "strikeAt": 3.4 }, { "text": "trabalha com documentos", "tone": "emerald", "at": 6.3 },
                         { "text": "o maior poder da atualização", "at": 9.8 } ] },
  "reason": "resume as três ideias do trecho" }
```

```json
{ "id": "tese", "component": "PhraseReveal", "at": 56.8, "duration": 3.6,
  "props": { "text": "Sem abrir\no *terminal.*", "eyebrow": "o mais interessante", "wordAt": [0.4, 0.7, 1.1, 1.3] },
  "reason": "a tese do bloco" }
```

Com a frase, dê um zoom `ease` de 1,12–1,18 com `focus.x` ≈ 0,35 no mesmo intervalo: o rosto vai para a direita e libera o lado do texto.

**Cena ilustrativa**: `"component": "scene:<slug>/<Nome>", "wipe": "tear", "hidesCaptions": true`. Depois de 5s de cena,
devolva o rosto: divida em duas, a segunda com `presenter: pip-br`.

Regras do `max` (onde fazemos melhor que a referência):

- **Cor tem significado**: pílula `paper` = contexto, `coral` = a ideia que importa (uma por pilha, a última), `emerald` = solução,
  `danger` = problema, `ink` = termo técnico. Uma só palavra em itálico coral por título ou frase (`*assim*`).
- **Sincronia**: todo `at`/`revealAt`/`wordAt` é o início da palavra que motiva o elemento menos 2 frames (0,07s); nunca antes
  da palavra anterior. Troca de layout 0,15–0,25s antes da primeira palavra da frase. Use `pnpm mce words`. A avaliação avisa
  `fora-de-sincronia` para a entrada fora de [−0,15s; +0,10s] do início de uma palavra (o `at` do overlay pode adiantar até 0,25s; em
  `PhraseReveal`, cada `wordAt` é cobrado contra a própria palavra dita); entrada numa pausa de mais de 0,6s não conta.
- **Leitura**: nada fica menos de 1,2s + 0,25s por palavra na tela, contado do cue do item até o fim do overlay ou até o `strikeAt`
  (aviso `leitura-curta`); pílula tem 40 px, rótulo de cartão 34 px (a referência usa 28 e 22).
- **Sem buraco**: no trecho editado (pelo menos 80% do vídeo), no máximo 8s sem evento (o ideal é 2–4s); se o layout precisa ficar, acrescente pílula, item ou `push`. Respiro sem edição: até 40s cada.
- **Variedade**: alterne o lado do cartão por bloco (`right`/`left`, `pip-br`/`pip-bl`); o mesmo palco no máximo 2 vezes seguidas.
- **Legenda**: continua ligada no talking head, inclusive sob `PillStack` e `PhraseReveal` (ficam no alto e na lateral). Esconde-se
  (`hidesCaptions: true`) em palco de cartão lateral (`right`/`left`), em `WindowStage` (em qualquer slot) e em cena de tela cheia: ali o texto do
  layout já resume a fala e a base do quadro é dele. A avaliação avisa `legenda-sobre-palco` nos três casos.
- **Look**: um `look-warm-editorial` discreto no vídeo todo aproxima o footage do papel.
- O que a referência não tem e o canal mantém: `SectionTitle` em troca de capítulo, CTA, trilha e SFX (§10).

## 1. Princípio

Vídeo didático de tecnologia, com humor e referências de games/filmes/séries. A edição serve à
explicação: cada corte, zoom ou animação precisa responder "isso ajuda a entender, destaca algo
ou dá ritmo?". Se a resposta for "é bonito", não entra. O espectador não pode perceber a edição.

## 2. Ritmo de cortes

- Pausa no meio da frase: encurtar acima de `0.40s`. Pausa entre frases: encurtar acima de `0.65s`.
- Respiro mantido: `0.09s` antes da primeira palavra, `0.16s` depois da última, `0.26s` depois de fim de frase.
- Nunca cortar dentro de palavra. Na dúvida, abrir a `mce view` do trecho e conferir a forma de onda.
- Não picotar: se uma frase tem 3+ cortes em menos de 4s, devolver pausas até soar natural.
- Pausa dramática, risada e reação ficam. Antes de um ponto importante, uma pausa de até 0.8s é ritmo, não erro.
- Retake: fica a última versão completa. Se a última for pior (gaguejo, sem energia), ficar com a anterior e registrar o motivo.
- Hesitação ("ééé", "hum") sai quando isolada por pausas; fica quando está colada na fala e o corte criaria salto.

## 3. Estrutura

- Gancho nos primeiros 15s: a promessa ou a pergunta investigativa vem antes de qualquer apresentação.
- Capítulos: um a cada 1–4 min, título curto (até 40 caracteres), primeiro em 0:00, mínimo de 3.
- CTA de inscrição: uma vez, depois de entregar o primeiro valor (nunca nos primeiros 30s), mais o do encerramento.

## 4. Zoom e enquadramento

- Punch-in só em ênfase real: conclusão, piada, "preste atenção nisso". Máximo de 1 a cada 20s (nível `normal`; outros níveis no §0).
- Escala entre 1.08 e 1.18; acima de 1.25 só em piada. Foco no rosto (`y ≈ 0.4`).
- Zoom entra no corte ou com easing de 0.4s; nunca entra e sai em menos de 1.5s.
- Alternar escala entre clipes vizinhos disfarça jump cut: usar quando o corte ficaria visível.
- Short 9:16: o recorte não pode cortar o rosto. Apresentador sentado e parado → foco fixo (`focusX` número ou `"auto"`,
  que decide sozinho); quem anda pelo quadro → `"auto"` faz pan suave (zona morta 80 px, no máximo 240 px/s, sem
  tremedeira). Pan nunca atravessa corte: no corte o foco reposiciona seco. Gesto de mão não é motivo para pan;
  se o detector errar (fundo com pele/movimento), corrija em `analysis/focus-track.json` e rode `pnpm mce shorts focus <slug>`.
- Gráficos no Short: o que reforça a fala no longo reforça no Short, re-diagramado (`shorts.graphics: "auto"`). Cartão em cima
  do rosto, inserto (`full`) só para o que precisa ser lido (código, diagrama); legenda nunca coberta. CTA de inscrição e lower
  third ficam de fora: o app já mostra o canal. Gráfico que começa antes do trecho não entra; ancore um novo dentro, se fizer falta.
- `stabilize` só em câmera na mão com tremor visível (externa, celular); em tripé ou tela gravada fica desligado: o vidstab corta as bordas (zoom fixo) e pode "nadar" em fundo sem textura.

## 5. Animações e gráficos

- Densidade (nível `normal`; outros no §0): no máximo 1 gráfico a cada 12s em trecho denso e nenhum por 30s+ em trecho de conversa.
- Um gráfico por vez na tela (legenda não conta). Duração mínima: tempo de ler duas vezes.
- O arsenal tem 50+ componentes (`pnpm mce arsenal components -v`). Os mais usados:
  - `LowerThird`: nome/cargo na primeira aparição; link ou fonte quando citados.
  - `SectionTitle`: troca de capítulo.
  - `Callout`: apontar algo que está na imagem (tela gravada, objeto).
  - `CodeCard`: sempre que código for dito em voz alta; nunca mais de 12 linhas.
  - `Diagram`: relação entre partes (cliente → servidor → banco); aparecer na ordem em que é explicado.
  - `BulletList`: enumeração de 3+ itens; cada item entra quando é falado.
  - `Counter` / `BarChart`: número citado que merece peso.
  - `MemeInsert`: no máximo 1 a cada 90s, só quando a piada já está na fala.
  - Cena ilustrativa (`scene:<projeto>/<Nome>`): quando a fala explica algo que só se entende vendo. Tela cheia, 5–8s,
    no máximo 1 a cada 60s; a voz continua por baixo. Kit papel por padrão; kit voxel para analogias e momentos lúdicos.
  - Modelo de animação (`scene:modelos/<Nome>`, `pnpm mce arsenal models`): a cena ilustrativa reutilizável. Toda animação nova nasce
    como modelo (nome pela forma, tudo em props) para servir nos próximos vídeos; cena presa a um vídeo é exceção e declara o seu `MODEL`.
- Todo overlay na EDL tem `reason` explicando o que ele reforça.

### B-roll

- Quando: a fala cita algo concreto que se vê (objeto, lugar, ação: "pego o celular", "num escritório", "programando") num trecho
  sem gráfico, de preferência longo (o loop de retenção mostra que trecho sem gráfico perde mais). Não quando a frase é opinião,
  conceito abstrato ou história pessoal em que o rosto é o conteúdo; nunca no gancho (primeiros 5 s).
- Duração e frequência por nível (`src/edl/levels.ts`, `broll`): `limpa` nenhum; `normal` até 0,75/min, 3 s, 25 s entre eles;
  `pro` 1,5/min, 3,5 s, 15 s; `max` 2,5/min, 4 s, 10 s.
- Um quadro por vez: b-roll não entra sobre gráfico, palco ou tela gravada. Começa na palavra que ele ilustra; a voz continua, o som do
  b-roll nunca. Um bom lugar é por cima de um corte: esconde o salto.
- Literal demais cansa: o mesmo termo no máximo 2 vezes por vídeo, e o mesmo arquivo não se repete se houver outro.
- Arquivo: biblioteca local `assets/broll/` (`pnpm mce broll index`); do Pexels, só curto e HD, com origem e licença no índice.
- `reason` diz o que a imagem reforça, como todo overlay.

## 6. Transições

O arsenal tem 50 (`pnpm mce arsenal transitions`), de dois tipos: `xfade` (mistura a imagem dos dois lados do corte)
e `stinger` (cortina nas cores da marca que cobre o corte). Cada uma traz `energy` e `tone`; escolha por eles.

- Os limites abaixo são do nível `normal`; os dos outros níveis estão no §0.
- Padrão é corte seco. Transição só em mudança de assunto, de cenário ou de tempo.
- `calm` + `sober` (ex.: `cross-dissolve`, `fade-slow`): passagem de tempo, tom mais sério.
- Stinger `paper`/`ink` (ex.: `paper-curtain`, `ink-curtain`): troca de capítulo, junto do `SectionTitle`.
- `high` (ex.: `whip-pan`, `zoom-blur`, `double-bar`): mudança de energia; no máximo 3 por vídeo.
- `glitch` e afins: só em contexto de bug/erro/hack; no máximo 2 por vídeo.
- Nunca duas transições em menos de 20s. Não repita a mesma mais de 2 vezes seguidas; no máximo 3 tipos diferentes por vídeo.

## 6.1 Efeitos de vídeo

50 presets (`pnpm mce arsenal effects`) em 7 famílias. Efeito é tempero: no máximo 1 ativo por vez (fora os de vídeo inteiro).

- `look`: um só por vídeo, do começo ao fim; trocar de look só em flashback, citação ou "modo demonstração".
- `camera`: contam como zoom (mesmos limites do §4).
- `focus`: para esconder algo (dado sensível na tela) ou apontar uma área; nunca só por enfeite.
- `light`: `dip` em passagem de tempo; `flash` no máximo 2 por vídeo.
- `glitch`: só em assunto de bug/erro; até 1,5s.
- `texture` e `frame` (vinheta, grão, letterbox): discretos, vídeo inteiro ou um bloco; intensidade até 0.5.

## 6.2 Efeitos de entrada

50 presets (`pnpm mce arsenal entrances`), usados pelo `TextReveal` e pelos componentes. Padrão: `fade-up`.
`words-*`/`chars-*` para frases de impacto; `pop*`/`stamp` só para uma palavra e no máximo 1 por cena; os de `mask` para títulos.

## 7. Legendas

- Estilo `long`: até 5 palavras por página, base da tela, branco com contorno `ink`, Inter 800.
- Estilo `shorts`: até 3 palavras, caixa alta, maiores e mais altas na tela.
- Estilo visual (`captions.preset`, `pnpm mce arsenal captions`): `padrao` no 16:9 e `bold-shorts` no Short; `karaoke` em tutorial falado, `pop` só em trecho enérgico, `destaque-caixa` sobre fundo agitado/claro, `minimal` em vídeo sóbrio ou tela gravada densa. Um estilo por vídeo.
- Destaque (`highlights`, em coral): termos técnicos e a palavra que carrega o sentido; no máximo 1 a cada 2 páginas.
- Grafia de termos técnicos vai em `replacements` (ex.: `"riact" → "React"`).
- Legenda se esconde quando um gráfico ocupa a base da tela (`hidesCaptions`); nos palcos do nível `max`, ver §0.

## 8. Identidade visual

- Cores (design system MChiodi): `paper #f8f8f2`, `ink #111827`, acento `coral #ff5555` em doses pequenas, `emerald #34d399` para "certo/funcionando".
- Fontes: Playfair Display 600 em títulos, Inter no resto, JetBrains Mono em código.
- Superfícies: cartão claro (`paper`) com raio 24 e sombra suave; texto solto sobre vídeo é branco com contorno.
- Movimento: tudo entra desacelerando e sai acelerando, com as curvas de `motion/src/theme.ts`. Sem bounce exagerado, sem emoji.
- Margem segura: 96px nas laterais, 64px em cima/embaixo.

## 9. Tom: humor ou sobriedade

- Humor: comparações, erros clássicos de dev, referências. Meme reforça piada que já existe; não cria piada.
- Sóbrio: segurança, dinheiro, carreira, erro que causa prejuízo, assunto pessoal. Sem meme, sem glitch, sem SFX cômico.
- Tom investigativo no gancho: música mais baixa, zoom lento (`ken-burns`), sem gráficos chamativos.

## 10. Áudio

- Alvo: `-14 LUFS` integrado, pico real até `-1.5 dBTP`.
- Voz: redução de ruído leve, de-esser, compressão suave. Fade de `12 ms` em cada corte.
- Música: `-24 dB` sob a voz com ducking; sobe em transições e no encerramento; sem música em trecho sóbrio se atrapalhar.
- SFX: `whoosh` em transição, `pop` em entrada de texto, sempre abaixo da voz (`-12 dB`); nunca dois SFX no mesmo segundo.

## 11. Cor

- Preset `neutral` por padrão; o mesmo grade no vídeo inteiro.
- Corrigir exposição só se o rosto estiver escuro ou estourado; nitidez leve (`sharpen ≤ 0.3`).
