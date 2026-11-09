---
name: corte-por-movimento
description: Corte automático que respeita o movimento da tela (gravação de tela, demonstração): pausa muda com a tela se mexendo não é cortada. Use ao editar vídeo com tela gravada, quando o corte automático comer uma ação visível, ou ao pedir `--motion`.
---

# Corte por movimento

Regra do auto-editor: só sai o trecho **sem som E sem movimento**. Opt-in: `pnpm mce analyze <video> --motion`.

## Como funciona
- `src/analyze/motion.ts` `detectStills(video, {width,height}, opts)`: ffmpeg em fluxo (`fps=10, scale=160xH, gray, gblur`) → `FrameDiffer` compara quadros consecutivos: **fração de pixels que mudaram além de `tolerance` (8/255)**. `stillSpans(valores, fps, {threshold, minStillSec})` junta trechos parados (≥ 0,8 s).
- Config (`src/config.ts`): `motion.stillThreshold` 0,002 · `minStillSec` 0,8 · `width` 160 · `sampleFps` 10; `cuts.minStillCoverage` 0,8.
- `analysis.stills` guarda os trechos. `autocut` (`src/edl/autocut.ts`) só encurta uma pausa muda se `coverage(pausa, stills) ≥ 0,8`; **sem `--motion` nada muda** (comportamento antigo).

## Quando usar
- Gravação de tela com ação durante a pausa da fala (digitando, rodando comando, animação).
- Rosto falando: a câmera "parada" também conta como parada (blur+tolerância absorvem ruído), então o efeito prático é pequeno.

## Armadilhas
- Análise roda sobre o **proxy** (720p); coordenadas de tempo são da fonte (mesma fps do proxy).
- Limiar baixo demais (0,0005) trata ruído de compressão como movimento.
- O primeiro quadro herda o movimento do segundo (não há anterior).

## Validar
`tests/motion.test.ts` (diferença, remontagem de quadros, trechos parados), `tests/motion.integration.test.ts` (vídeo sintético: 2 s parado + 2 s movimento) e `tests/autocut-motion.test.ts`.
