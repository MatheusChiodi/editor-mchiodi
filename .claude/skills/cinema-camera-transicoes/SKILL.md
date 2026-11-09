---
name: cinema-camera-transicoes
description: Movimentos de câmera por plano e transições entre cenas (fade, flash, cortina, zoom, glitch, whip, corte) do vídeo de música em modo cinema. Use ao ajustar o "movimento" do vídeo, criar nova câmera/transição ou depurar cena que aparece parada ou com salto na troca.
---

# Câmera e transições

Matemática pura em `motion/src/music/cinema-math.ts`; uso em `motion/src/music/MusicVideo.tsx`.

## Câmera (`cameraTransform(camera, progress, frame, fps, pulse)`)
Devolve `{ scale, x, y, rotate }` (x, y em unidades de 1080p). `camera` ∈ `push | pull | panL | panR | tilt | orbit | still` (`CAMERA_IDS`).
- `push` 1,04→1,17; `pull` inverso; `panL/panR` ±46 com escala 1,12; `tilt` y ±30; `orbit` rotação ±2,2° e x ±20.
- **Sempre** soma tremida de câmera na mão (`wobble` 2,2/1,8 px, 0,18°) e um tranco `+0,012*pulse` de escala a cada batida.
- Faixas garantidas por teste: escala 1–1,3; |x|,|y| ≤ 90; |rotate| ≤ 4°.

## Transições (`transitionState(kind, t)`, `TRANSITION_FRAMES = 14` ≈ 0,47 s)
`kind` ∈ `cut | fade | flash | wipe | zoom | glitch | whip` (`TRANSITION_IDS`). Devolve opacidade/escala/deslocamento de entrada e saída, `blur`, `flash`, `glitch`, `wipe`.
- `fade` cruza; `flash` estoura branco no meio; `wipe` revela a nova da esquerda para a direita (clipPath); `zoom` aproxima a velha e a nova vem de longe, com desfoque; `glitch` troca a meio com deslocamento; `whip` empurra uma para fora e a outra para dentro com desfoque de movimento (até 14 px).
- Nas pontas tudo é exatamente 0/1 (função `bump`, sem sobra de ponto flutuante).

## No render
Nos primeiros 14 quadros de uma cena, o `MusicVideo` desenha a **anterior** (continua animando além do fim) por baixo e a nova por cima com o estado da transição. Filtros `blurIn/blurOut` são dinâmicos em `CinemaDefs`; a cortina usa `<clipPath id="wipeClip">`.

## Receita: nova câmera ou transição
1. Adicionar o id em `types.ts` (`CAMERA_IDS` / `TRANSITION_IDS`).
2. Implementar o caso em `cameraTransform` / `transitionState` (o compilador acusa o `switch` sem o caso novo).
3. Cobrir em `tests/music-cinema.test.ts` (faixas válidas; fim limpo; começo com a cena antiga).
4. Escolher onde o diretor usa (`story.ts`).

## Armadilhas
- Câmera por plano usa `progress` da **cena**; em cena curta (< 2 s) o movimento é rápido: preferir `still`/`push` leve.
- Transição `cut` zera a saída desde o quadro 0.
- `whip` e `zoom` com muito `blur` custam render; manter < 15 px.

## Validar
`pnpm vitest run tests/music-cinema.test.ts` + quadros no meio de uma transição.
