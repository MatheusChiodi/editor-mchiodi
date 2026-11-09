---
name: palco-foco-e-sincronia
description: Enquadramento do rosto que segue o apresentador nos palcos (SplitExplainer, WindowStage, DocQuote, PhraseReveal, PillStack com `presenter`), tempos de entrada ajustados à duração do overlay (leitura mínima) e avisos de props do `mce motion add`. Use ao criar/ajustar um palco, quando o rosto sai cortado ou anda no cartão, ou quando itens entram tarde demais para ler.
---

# Palco: foco que segue o rosto e sincronia

## Foco que segue (`presenter.focus: "auto"`)
- Código: `src/render/stage-focus.ts` (`buildFocusTrack`, `trackCut`, `FOLLOW`, `applyStageTracks`), `motion/src/arsenal/stage.ts` (`FocusKey`, `focusAtSec`, `trackedTransform`, `endFocus`), `src/render/reframe.ts` (`trackExpr`).
- Só o ffmpeg move o footage: `stage.focusTrack` (chaves `{t, x, y}`, t em s desde o início do overlay) vira expressão linear por trecho. `transformAt` (Remotion/teste) interpola as TRANSFORMAÇÕES das chaves, não o foco: é o que faz as duas contas baterem e o footage nunca descobrir borda.
- Receita: `planStageFocus` agrupa as amostras do detector em trechos de 1 s (`FOLLOW.binSec`), leva a mediana ao foco, suaviza (média de 3), limita a velocidade (0,1 do quadro/s) e remove chaves redundantes. `render/index.ts` cola a trilha com `applyStageTracks` depois de `buildOverlayProps` (que não é tocado).
- Zona morta: se o foco anda menos que 0,04 do quadro, sem trilha (foco fixo é mais firme). Foco numérico na EDL nunca segue. Palco com `push` ignora a trilha. Slots `window*` não entram.
- Palco colado: `from.focus` do seguinte = foco de SAÍDA do anterior (sem salto na emenda).
- Log do render: `foco auto: ... seguindo o rosto em N chaves`. O corte (`cut`) de plano com trilha é o p90 do rosto fora do recorte ao longo do tempo.

## Sincronia (`motion/src/components/timing.ts`)
- `entryTimes(given, start, step, durationSec, readSec)`: `at/wordAt/revealAt` dados valem; o que não deixa `readSec` na tela antes da saída (8 f) é puxado para trás, anteriores recuam 0,25 s; cascata padrão comprime até 0,3 s/passo. Leitura mínima por texto: `readTimes` (1,2 s + 0,25 s/palavra, `read-time.ts`).
- Já ligado em PillStack, SplitExplainer (`titleTimes`, `cardTimes`, `noteEntry`), PhraseReveal (`phraseTimes`), DocQuote (`fitMarkStart`), WindowStage (linhas e notas). Sem duração, a conta é a antiga.

## Avisos antes de inserir (`src/motion/props-check.ts`)
`mce motion add` loga `aviso:` para excesso (5 pílulas, 6 cartões, 9 linhas, 4 notas), `wordAt/revealAt` fora do prazo, tom inexistente, citação sem `==marca==`, frase longa. Não bloqueia. Ao mudar um limite de componente, mude `LIMITS` (o teste confere).

## Armadilhas
- Não edite `overlay-props.ts` para passar a trilha: use `applyStageTracks`.
- Mexeu em `coverTransform`? Rode `tests/stage-focus-follow.test.ts` (compara ffmpeg × transformAt frame a frame).

## Validar
`pnpm test` (stage-focus-follow, stage-timing, props-check), `pnpm typecheck`, `pnpm mce motion still <Componente>`; no vídeo, `mce render` e olhar o cartão com o apresentador andando.

## Modelos (`motion/src/scenes/modelos/`)
- `fit-time.ts: fitSceneTimes(times, durationSec)` envolve a saída de `*Times` em cada modelo (array, objeto ou aninhado): o que não deixa 1,2 s de tela ao último é puxado para trás (vão 0,15 s), a ordem fica. Sem duração, não muda nada. Modelo novo: envolva o `const times = ...` do componente com `fitSceneTimes(..., durationInFrames / fps)`.
- `sequence`, `fillTimes`, `pickSec`, `timeOr` ignoram tempo negativo (usam o padrão).
