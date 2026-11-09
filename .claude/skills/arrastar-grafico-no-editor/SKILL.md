---
name: arrastar-grafico-no-editor
description: Mover um gráfico (overlay) onde quiser no quadro, no preview do MChiodi Cut ou direto na EDL com `offset`. Use ao ajustar posição de gráfico, afastar do rosto à mão, ou mexer em overlays[].offset, GraphicDrag, /guard.
---

# Arrastar gráfico (offset)

## Como funciona
- `overlays[].offset: {x,y}` (fração do quadro, 0 = original, -1..1) em `src/edl/schema.ts`. SOMA com o shift automático do rosto (`planGuard`); nunca o remove. Soma em `shiftField` (`src/render/overlay-props.ts`) -> `OverlayItem.shift` -> `Shifted` em `motion/src/Overlay.tsx`. No Short o offset é ignorado.
- `planFit` (`src/edl/fit.ts`) desloca a caixa medida pelo offset antes de decidir zoom/shift (`moveBox`).
- Gravar = op `updateItem` (`offsetOp` em `cut/src/lib/graphic-drag.ts`); zero = `unset: ['offset']`. Nova versão, desfazer/refazer como as outras ops.

## No Cut
- `cut/src/components/GraphicDrag.tsx`: alça por gráfico no ar (footprints.json + shift + offset). Arrastar move; Alt solta o snap; duplo clique ou `R` reseta; `Alt+setas` empurra (Shift grosso); `Ctrl+D` duplica (`cut/src/graphics.ts`).
- Snap: margens seguras, terços, centro e bordas do rosto (`frameGuides`, `dragOffset`). Cobrir o rosto (`coversFace`, FACE_BOX_HALF) acende aviso coral.
- Offset provisório do arraste: `dragging` em `cut/src/store.ts`, aplicado em `cut/src/lib/preview-model.ts`.
- Rosto/shifts do render: `GET|POST /api/projects/<slug>/guard` (`src/cut/guard.ts`, `buildGuardPayload`), guardado em `store.guard` (`refreshGuard`).

## Receita
1. Editar posição: arrastar no preview e Ctrl+S; ou `updateItem` com `patch: { offset: { x, y } }`.
2. Gráfico com `presenter`, `scene:` ou camada fixa não arrasta.

## Armadilhas
- Edit em arquivos CRLF (Preview.tsx, fit.ts): normalize `\n` ao casar texto.
- `shift` do guard é calculado com o offset já aplicado; após soltar, ele é refeito (pode afastar do rosto de novo).

## Validar
`pnpm vitest run tests/cut-ui-graphic-drag.test.ts tests/cut-guard.test.ts tests/cut-server.integration.test.ts`, `pnpm typecheck`, e arrastar no `mce cut <slug>` (gráfico sem presenter, ex. PillStack).
