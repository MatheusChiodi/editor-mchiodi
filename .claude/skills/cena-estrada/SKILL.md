---
name: cena-estrada
description: Cena "estrada" do vídeo de música (estrada em S desenhada aos poucos, faixa tracejada animada, bolinha seguindo o caminho). Use para caminho, seguir, travar, estrada, além, jornada, rumo, partir.
---

# Cena: estrada

**Conta:** seguir em frente (ou travar no meio). A estrada se desenha, a bolinha avança por ela.

## Quando usar
- `LEXICON.road`: caminho, seguir, travei, estrada, alem, jornada, rumo, partir.
- No diretor de história: pose `walk` (rua; colinas no desfecho).
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif road`.

## Onde está
`motion/src/music/motifs.tsx` → `Road` (path `ROAD`).

## Como funciona
- `draw = outCubic(clamp(progress*1.5))`; `evolvePath(draw, ROAD)` (`@remotion/paths`) esconde o resto do traço.
- Ponta: `getPointAtLength(ROAD, draw*getLength(ROAD))` → bolinha com anel pulsando.
- Faixa central tracejada com `strokeDashoffset = -frame*1.2` (anda sempre). Sol amarelo no horizonte.

## Receita para mudar
Trocar `ROAD` por outro path SVG (mantenha `M ... C ... S ...` suave); o resto se adapta.

## Armadilhas
- `getPointAtLength` pode devolver `null`: sempre `?? { x: 0, y: 0 }`.
- Traço largo precisa de `strokeLinecap="round"`, senão a ponta fica serrilhada no início.

## Validar
`tests/music-motifs.test.ts` + quadro visto em `progress` ~0,6.
