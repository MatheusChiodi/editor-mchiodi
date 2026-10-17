---
name: edl-reference
description: Referência do formato da EDL (edl.vN.json) do MChiodi Editor, com todos os campos e receitas prontas (cortes, legendas, gráficos, cenas, zooms, efeitos, transições, áudio, capítulos, Short). Use ao escrever ou corrigir uma EDL.
---

# EDL: referência

A EDL é a única fonte da verdade da edição. Fonte do schema: `src/edl/schema.ts` (Zod). Valide sem gravar com
`pnpm mce edl validate <arquivo>`; grave com `pnpm mce edl save <slug> <arquivo>` (vira `edl.v(N+1).json`).

## Regra de tempo

**Todo `at`, `start` e `end` é em segundos do arquivo FONTE** (os mesmos tempos do `takes.md` e do `mce words`).
`duration` é em segundos. O renderer converte para o vídeo final; por isso mexer nos cortes nunca dessincroniza nada.
Um `at` que caia num trecho cortado é recusado na validação: ancore numa palavra que ficou.

## Esqueleto

```jsonc
{
  "project": "<slug>",
  "notes": "o que mudou nesta versão e por quê",
  "level": "normal",  // limpa | normal | pro | max: escolha do Matheus, não mexer (pnpm mce level <slug> <nível> para trocar)
  "source": { "path": "...", "durationSec": 477.47, "fps": 60, "width": 1920, "height": 1080 },  // não mexer
  "output": { "fps": 30, "width": 1920, "height": 1080 },
  "clips": [ { "id": "c001", "start": 0.26, "end": 12.9, "quote": "...", "reason": "" } ],
  "removed": [ { "start": 12.9, "end": 13.4, "kind": "silence", "reason": "..." } ],
  "captions": { "enabled": true, "style": "long", "maxWordsPerPage": 5, "highlights": [], "replacements": {} },
  "overlays": [], "zooms": [], "effects": [], "transitions": [], "sfx": [],
  "music": null,
  "grade": { "preset": "neutral" },
  "audio": { "targetLufs": -14 },
  "chapters": [],
  "breathers": [],
  "shorts": null,
  "intro": false, "outro": false
}
```

`version` e `createdAt` são preenchidos pelo `edl save`. Ids em kebab-case, únicos na EDL inteira.

`level` define quanto de zoom, gráfico, cena, transição, efeito e SFX a avaliação aceita e cobra (STYLE.md §0).
`pnpm mce level <slug>` mostra o orçamento para a duração do vídeo; cena ilustrativa (`scene:...`) conta à parte dos
gráficos, e efeito de câmera conta como zoom. No `max` ele lista também os padrões obrigatórios (quantos há × mínimo).

## Cortes (`clips`, `removed`)

- Clipes em ordem crescente, sem sobreposição. O que não está em nenhum clipe está fora do vídeo.
- Borda de clipe sempre em pausa: confira com `pnpm mce view <slug> --from <s> --to <s>`.
- Restaurar um trecho que o corte automático tirou: estenda o clipe vizinho ou funda dois clipes; tire a entrada de `removed`.
- Cortar mais: divida o clipe em dois e registre em `removed` com `kind` (`silence | retake | filler | marker | manual`) e `reason`
  (é o que aparece no relatório).

## Legendas (`captions`)

- `style`: `long` (base da tela, até 5 palavras) ou `shorts`. É o formato (posição e tamanho base); o Short força `shorts`.
- `preset`: estilo visual, `padrao` (default, o de sempre) · `karaoke` (a palavra falada se preenche de coral) · `pop`
  (cada palavra surge com escala, até 4 por página) · `destaque-caixa` (pill coral atrás da palavra falada) · `minimal`
  (uma linha, sem contorno, sombra suave) · `bold-shorts` (caixa alta, enorme, até 3 palavras). O estilo só aperta a
  paginação (nunca passa do `maxWordsPerPage`) e o Short herda o preset da EDL. Catálogo: `pnpm mce arsenal captions`;
  prévia: `pnpm mce still Legendas-<preset>-long` (ou `-shorts`).
- `highlights`: palavras que ficam em coral (comparação sem acento/caixa). Poucas: termos técnicos e a palavra que carrega o sentido.
- `replacements`: corrige a grafia da transcrição, `"palavra ouvida": "Palavra certa"` (ex.: `"frontient": "front-end"`).
  A chave é a palavra como aparece no `takes.md`, sem pontuação.

## Gráficos e cenas (`overlays`)

```json
{ "id": "nome", "component": "LowerThird", "at": 28.4, "duration": 5,
  "props": { "title": "Matheus Chiodi", "subtitle": "Tech Lead Fullstack" },
  "hidesCaptions": true, "reason": "apresentação na primeira vez que diz o nome" }
```

- `component`: nome do arsenal (`pnpm mce arsenal components -v` mostra as props de cada um), `scene:modelos/<Nome>` (modelo de animação
  reutilizável; `pnpm mce arsenal models -v` mostra os slots e o trecho pronto) ou `scene:<slug>/<Nome>` (cena sob medida, exceção).
- `hidesCaptions: true` quando o gráfico ocupa a base da tela.
- Props de tempo (`revealAt`, `checkAt`) são segundos **relativos ao início do overlay**: para sincronizar com a fala,
  `revealAt[i] = (tempo da palavra na fonte) − at`. Se houver corte entre `at` e a palavra, desconte o trecho cortado.
- Texto solto com efeito de entrada: `"component": "TextReveal", "props": { "text": "...", "entrance": "words-rise" }`.
- `reason` é obrigatório na prática: sem motivo, a avaliação avisa.

### Palco e rasgo (linguagem do nível `max`, STYLE.md §0)

- `"presenter": { "slot": "right" | "left" | "pip-br" | "pip-bl" | "pip-tr" | "pip-tl", "focus": { "x": 0.5, "y": 0.4 }, "zoom": 1.3, "backdrop": "paper" }`:
  durante o overlay o footage encolhe para um cartão nesse slot e o resto do quadro vira papel; o componente desenha no papel.
  Entrada (0,5s) e saída (0,4s) são animadas junto com o footage. `focus` = onde está o rosto na fonte; `zoom` opcional (≥ 1).
  Vale para qualquer componente ou cena. Palcos colados (fim de um = início do outro) deslizam o cartão de um slot ao outro.
- `"wipe": "tear"`: o overlay entra por um rasgo de papel (0,4s); para cena de tela cheia.
- Componentes da linguagem: `PillStack` (`items[].text/tone/at/strikeAt/indent`, `title`, `corner`), `PhraseReveal` (`text` com `*itálico coral*`
  e `\n`, `eyebrow`, `side`, `wordAt`), `SplitExplainer` (`eyebrow`, `title`, `cards[].icon/label/caption`, `revealAt`, `note`, `presenter`),
  `WindowStage` (`title`, `kind: terminal|screen`, `lines[].text/tone/at`, `notes[]`, `push`), `DocQuote` (`source`, `title`, `text` com
  `==marca-texto==`, `markAt`, `note`). Tons de pílula: `paper | coral | ink | emerald | danger`.
- `hidesCaptions: true` em palco `right`/`left`, em `WindowStage` (qualquer slot) e em cena de tela cheia (`scene:*`); `false` sob `PillStack` e `PhraseReveal`.
- Sincronia (`pro`/`max`, aviso `fora-de-sincronia`): o `at` do overlay e cada cue (`items[].at`, `revealAt`, `wordAt`, `lines[].at`, `notes[].at`,
  `markAt`, `note.at`, `strikeAt`) caem no início de uma palavra: de 0,15s antes a 0,10s depois no `max` (0,30/0,25 no `pro`); o `at` pode adiantar
  mais 0,10s. Em `PhraseReveal`, `wordAt[i]` é o início da PRÓPRIA palavra dita. Entrada numa pausa de mais de 0,6s não é cobrada.
- Leitura (`max`, aviso `leitura-curta`): do cue de cada texto até o fim do overlay (ou até o `strikeAt`) sobram pelo menos 1,2s + 0,25s por palavra;
  a última palavra de uma frase com `wordAt` entra pelo menos 1s antes do fim.
- `WindowStage` com `"kind": "screen"` mostra `layout.screen` dentro da janela, sem precisar de `layout.segments`.

```json
{ "id": "com-mods", "component": "SplitExplainer", "at": 43.5, "duration": 9, "presenter": { "slot": "right" }, "hidesCaptions": true,
  "props": { "eyebrow": "Com mods", "title": "Muda o *ambiente* onde ele trabalha", "cards": [ { "icon": "lock", "label": "Decisões" } ], "revealAt": [3.1] },
  "reason": "contraste com o bloco anterior" }
```

## Zoom (`zooms`)

```json
{ "id": "z-conclusao", "at": 151.2, "duration": 3.5, "scale": 1.12, "focus": { "x": 0.5, "y": 0.4 }, "mode": "ease", "reason": "conclusão do argumento" }
```

`mode`: `ease` (entra e sai suave), `punch` (seco, bom logo depois de um corte), `ken-burns` (aproximação lenta e contínua).
O zoom termina no fim do clipe em que começou.

## Efeitos (`effects`)

```json
{ "id": "fx-flashback", "preset": "<id>", "at": 201.0, "duration": 4, "intensity": 0.6, "focus": { "x": 0.5, "y": 0.4 }, "reason": "lembrança" }
```

`pnpm mce arsenal effects` lista os 50 presets (cor, câmera, foco, luz, glitch, textura, moldura). Sem `duration`, vale a do preset;
os presets "de vídeo inteiro" (looks, vinheta, grão, letterbox) vão do `at` até o fim.

## Transições (`transitions`)

```json
{ "id": "t-cap2", "intoClip": "c014", "type": "wipe", "duration": 0.4, "reason": "troca de capítulo" }
```

A transição acontece na ENTRADA do clipe `intoClip` (nunca no primeiro). `type` é um dos 50 do `pnpm mce arsenal transitions`:
os `xfade` misturam a imagem dos dois lados; os `stinger` são cortinas nas cores da marca que cobrem o corte. O SFX certo entra sozinho.

## Áudio (`audio`, `music`, `sfx`)

- `audio`: `targetLufs` (-14), `truePeakDb` (-1.5), `denoise` (`off|light|medium|deepfilter`, padrão `light`), `deesser`, `cutFadeMs` (12).
  `light`/`medium` são o afftdn do ffmpeg. `deepfilter` limpa a voz com o DeepFilterNet (binário `deep-filter`) num pré-passo
  em cache (`analysis/denoise/`), alinhado amostra a amostra com a fonte, e aí o afftdn não entra. Use quando o ruído é
  ventilador/rua/teclado que o `medium` não tira sem deixar a voz "embaixo d'água". Sem o binário (`pnpm mce doctor` diz)
  o render avisa e cai para `light`; nada quebra.
- `music`: `{ "file": "<arquivo em assets/music>", "gainDb": -24, "duck": true, "fadeIn": 1.5, "fadeOut": 3 }`. Com `duck`, a trilha abaixa sozinha quando há fala.
- `sfx`: `{ "id": "s1", "file": "ding.wav", "at": 88.2, "gainDb": -12 }`. `whoosh` em transição e `pop` em entrada de gráfico já são automáticos.
  `pnpm mce assets list` mostra o que há na biblioteca.

## Cor (`grade`)

`preset`: `none | neutral | warm | cool | punchy`; ajustes finos `exposure` (-1..1), `contrast`, `saturation`, `sharpen` (0..1), `lut` (arquivo `.cube` em `assets/luts`).
Um grade só para o vídeo inteiro.

## Estabilização (`stabilize`)

`{ "enabled": false, "shakiness": 5, "smoothing": 15, "zoom": 0, "reason": "" }` (padrão desligado; EDL sem o campo = desligado).
- `shakiness` 1–10: quanto a câmera treme (calibra a detecção). `smoothing` 1–60: frames de cada lado na suavização
  (maior = câmera mais flutuante). `zoom` 0–20: % extra sobre o zoom fixo ótimo que esconde as bordas.
- Vidstab do ffmpeg em dois passos: `vidstabdetect` em pré-passo sobre o arquivo que o corte lê (proxy no preview, original
  no final), em cache em `analysis/stabilize/` (chave: caminho + tamanho + mtime + fps + `shakiness`); `vidstabtransform` entra
  no grafo de corte logo após o `fps`, antes de escala, recorte do Short, zooms, efeitos e reframe. Não muda frames nem áudio.
- Mudar `smoothing`/`zoom` não refaz a análise. Sem libvidstab no ffmpeg (`pnpm mce doctor`), avisa e renderiza sem estabilizar.
- Quando usar: STYLE.md §4. Diga o porquê em `reason`.

## Capítulos (`chapters`)

`[{ "title": "Gancho", "at": 0.5 }, ...]`: mínimo 3, o primeiro vira 0:00, pelo menos 10s entre eles. Saem em `capitulos.txt` pelo `pnpm mce report`.

## Respiros declarados (`breathers`)

`[{ "start": 310.2, "end": 338.0, "reason": "parte pessoal: ele conta a história olhando para a câmera" }]`, em segundos da
fonte; `end > start` e `reason` obrigatório. É o trecho que você ESCOLHEU deixar sem edição (apresentador sozinho, tela que
precisa ser vista inteira). No `max`, trecho de 8–40s sem evento que não está declarado aqui vira aviso `trecho-parado` (a
mensagem traz o `start`/`end` prontos). Declarar não isenta do resto: o respiro continua contando nos 20% sem edição
(`pouco-editado`), no teto de 40s (`tela-parada`) e na distância de 15s editados entre dois (`respiros-colados`).
`pnpm mce level <slug>` lista os declarados e os parados sem declarar.

## Vinhetas e Short

- `"intro": true` / `"outro": true` emendam a abertura (2,5s) e a tela final (8s) do canal.
- `"shorts": { "start": 201.0, "end": 262.0, "focusX": 0.5, "reason": "explicação completa em 55s" }`: trecho da fonte que vira o vertical
  (≤ 60s no vídeo final; `pnpm mce shorts <slug>` sugere candidatos). Render: `pnpm mce render <slug> --shorts`.

## Tela gravada (`layout`)

`"layout": { "screen": { "path": "<arquivo>", "offsetSec": 0 }, "segments": [ { "start": 40, "end": 95, "mode": "pip", "pipCorner": "bottom-right" } ] }`.
`mode`: `camera | screen | pip | split`. `offsetSec` é quanto a gravação de tela começa depois da câmera.
