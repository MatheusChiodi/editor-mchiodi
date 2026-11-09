---
name: cinema-acabamento
description: Camadas de acabamento cinematográfico do vídeo de música (bloom, aberração cromática, glitch, grade de cor teal/laranja, vazamentos de luz, bokeh, raios, lens flare, grão, vinheta, faixas cinemascope). Use ao ajustar o "visual de cinema", quando o vídeo parecer chapado, ou ao render ficar lento.
---

# Acabamento de cinema

Em `motion/src/music/cinema.tsx` (componentes) e `cinema-math.ts` (`bokehParticles`, `letterboxBar`). Ordem de empilhamento em `MusicVideo.tsx`:

1. Cena (SVG) dentro de `filter ca` → `filter bloom` → `filter glitch` (aninhados; um `filter` por elemento).
2. `GodRays` (cônico girando, `screen`) · `LightLeaks` (elipses laranja/rosa cruzando, estouram no tempo forte) · `Bokeh` (34 luzes em camadas de profundidade) · `LensFlare` (só trechos não-`low`, no tempo forte).
3. Flash branco (transição `flash` e tempo forte em trecho `high`).
4. `Grade` (teal nas sombras, laranja nas luzes, `soft-light`) · `Vignette` · `Grain` (ruído fractal que muda por quadro, `overlay`).
5. Degradê escuro no pé do quadro (letra), `Letterbox`, espectro dentro da faixa de baixo, título, letra.

## Parâmetros que vale mexer
- **Aberração cromática:** `chroma = 0.6 + 3.6*pulse + glitch*7` px (canais R/B deslocados). Sobe na batida.
- **Bloom:** `feGaussianBlur 14` somado em `screen` com 50% de alfa.
- **Glitch:** `feTurbulence` + `feDisplacementMap` escala `glitch*70`; sobe nas transições `glitch` e +0,22 nos tempos fortes de trecho `high`.
- **Letterbox:** `letterboxBar(w,h)`: faixa 2,39:1 só se largura/altura ≥ 1,5 (zero em vertical e quadrado). Em 1920×1080 cada faixa tem ~138 px.
- **Grão:** opacidade 0,2; subir deixa mais "película".

## Receita: novo efeito
1. Componente em `cinema.tsx` recebendo `CinemaLayerProps` (`width, height, frame, fps, palette, pulse, downPulse, energy`).
2. Entrar em `MusicVideo.tsx` na ordem certa (efeitos de luz antes do grade; grão e vinheta por último antes das faixas).
3. Ver em quadro real; medir tempo de render (`mv render --preview`).

## Armadilhas
- `id` de `<filter>`/`<mask>`/`<clipPath>` é global na página: usar nomes únicos.
- `mix-blend-mode` não funciona dentro de `<foreignObject>`; usar divs irmãos como já está.
- Muito `feGaussianBlur` em 4K pesa: manter o bloom único e o desfoque só nas transições.
- Efeitos de CSS dependem do navegador do Remotion: confirmar em render, não só na prévia.

## Validar
Quadro de cenas escura, clara e em transição; `pnpm typecheck`; tempo do `mv render --preview` (≈ 3 min para 3 min de música a 960×540).
