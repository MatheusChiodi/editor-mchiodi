---
name: movimento-fluido
description: Tokens e regras de curva/duração dos componentes motion (entrada, saída, overshoot). Use ao criar ou ajustar animação de componente em motion/src/components ou scenes/modelos.
---

# Movimento fluido

## Onde
- `motion/src/theme.ts` -> `motion`: `enter` (expo-out), `exit` (ease-in suave 0.55,0,0.8,0.2), `pop` (overshoot ~4%), `move`, `stage`; durações `fast` 0.2, `leave` 0.28, `base` 0.4, `slow` 0.7.
- `motion/src/anim.ts` -> `presence`/`usePresence` (saída padrão = `motion.leave`), `springAt`, `stagger`, `chainStarts`.

## Tokens de consistência
- `motion.step`: `tight` 0.08 (itens densos), `list` 0.1 (linhas de lista/tabela), `base` 0.12 (blocos). Use em `stagger(i, motion.step.X, start)`, não números soltos.
- `theme.shadow.pill` (pílula elevada), `theme.shadow.stroke` (drop-shadow de traços SVG); `theme.radius.tile` 14, `chip` 12.
- Cena (`SceneBackground`, `LargoVersusFundo`): entra em `fast`, sai em `leave` via `presence`.
- Modelos de cena não entram em `mce motion still`; use `pnpm mce still Cena-modelos-<Nome> --frame N`.

## Receita
1. Entrada: `motion.enter` ou `motion.pop` (ícone/selo). Nunca `Math.random`/CSS animation; tudo por `useCurrentFrame()`.
2. Saída: sempre `usePresence` ou `motion.exit` com `motion.leave`; nada some de repente.
3. Lista: `stagger(i, 0.08-0.12)`; saída em bloco, não item a item.
4. Overshoot só em escala/posição curta; opacidade fica em `clamp`.

## Armadilhas
- Mudar `exit`/`pop` afeta todos os componentes: confira `tests/anim-flow.test.ts` (monotonia da saída, pico do pop < 8%).
- Não alterar props públicas nem footprint (`pnpm tsx scripts/measure-footprints.ts <Componente>` se mudar tamanho).

## Validar
`pnpm test`, `pnpm typecheck`, `pnpm mce motion still <Componente> --frame N` em entrada, meio e saída.
