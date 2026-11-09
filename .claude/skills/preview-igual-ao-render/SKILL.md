---
name: preview-igual-ao-render
description: Use ao mexer no preview do MChiodi Cut (cut/) ou em qualquer conta de enquadramento do footage (palco, zoom, fit-*, efeitos de câmera, cor) para garantir que o preview mostre exatamente o que o render produz.
---

# Preview do Cut = render

## Regra
A mesma função pura serve render e Cut. Nunca reimplemente a conta no front. O que depende de Node (detector de rosto, footprints) vem do servidor.

## Onde está
- `src/render/footage-frame.ts`: `footageFrameAt(input, t)` = zoom (`zoomStateAt`) → efeitos de câmera (expressões do `buildEffectFilters` lidas por `cameraStep` e avaliadas por `evalFfmpeg`) → palco (`transformAt`, com a largura par do `scale`). `mapPoint` leva um ponto do quadro pelo caminho todo.
- `src/render/preview-props.ts`: `buildPreviewProps` = `buildOverlayProps` + foco `auto`, deslocamentos e trilha de foco (`applyStageTracks`), igual a `src/render/index.ts`.
- `src/cut/guard.ts` + rota `GET/POST /api/projects/<slug>/guard`: `planGuard` (zooms `fit-*`, `shifts`), `stageFocus`, `stageTracks`, `faces`. O Cut carrega em `store.guard` (`cut/src/graphics.ts`).
- `cut/src/lib/footage-css.ts`: quadro → CSS. Duas camadas em `Preview.tsx`: div `stage` (translate+scale sobre papel) e `<video>` (zoom + efeitos + filtro de cor `gradeCss`).
- Teste: `tests/preview-parity.test.ts` (Cut x expressões ffmpeg reais, < 1 px, em ~1300 instantes).

## Receita ao mudar algo
1. Mudou conta de zoom/palco/efeito? Altere a função compartilhada, não o front. O teste deve continuar verde.
2. Efeito de câmera novo: use o helper `reframe` de `src/arsenal/effects.ts` (scale+crop). Outro formato (ex.: `rotate`) fica "sem prévia" (chip no canto do Preview) e deve entrar na lista do teste.
3. `pnpm vitest run tests/preview-parity.test.ts && pnpm typecheck && pnpm cut:build`.

## Cobertura (o que o preview NÃO faz)
- Efeitos `filter` de cor/luz/glitch/textura e `camera-dutch-tilt` (giro): só aparece o chip "sem prévia".
- Cor: aproximação CSS (exposição, contraste, saturação). LUT, `colorbalance` e nitidez ficam de fora.
- Efeitos `overlay` (Fx) e transições stinger já saem pela composição `Overlay`. Transições `xfade` entre cortes não aparecem.
- Largura do `scale` do ffmpeg é par (`trunc(w/2)*2`): o preview aplica a mesma quantização.

## Validar com imagem
1. `pnpm mce cut <slug> --port 4871 --no-open` (processo próprio; o servidor antigo não tem a rota `/guard`).
2. Playwright em Chrome (`channel='chrome'`, o Chromium puro não toca H.264): abra `?p=<slug>`, chame `window.__cutSeek(segundosDaFonte)` (gancho em `cut/src/playback.ts`) e tire screenshot do quadro.
3. Render: extraia o frame de `renders/vN-preview/preview.mp4` em `t_saída + 2.5` (vinheta de abertura). Atenção: render antigo (antes de mudar `stage-focus.ts`) difere por motivo legítimo; re-renderize ou rode os filtros atuais (`reframeFilters` + `-copyts -ss t`) sobre `cut.mkv`.
4. Compare lado a lado (`ffmpeg hstack`). Validado em `20250914-105105` v9: palco `right` (11.9 s), `pip-br` com trilha de foco (85.7 s), `fit-aviso-nome` (100.2 s).

## Armadilhas
- Servidor do Cut rodando de antes do código novo responde "rota não existe": reinicie.
- Palco vence zoom no render só porque os dois se compõem (zoom primeiro, palco depois); no CSS o `stage` recorta o que o zoom estende.
- Com `graphics: off` o footage volta ao quadro cheio (sem buraco do palco).
