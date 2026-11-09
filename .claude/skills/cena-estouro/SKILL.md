---
name: cena-estouro
description: Cena "estouro" do vídeo de música (partículas explodindo do centro a cada 1,4 s, com onda de choque). Use como reserva dos trechos instrumentais fortes ou para marcar clímax e comemoração.
---

# Cena: estouro

**Conta:** energia liberada. Partículas saem do centro numa explosão que se repete.

## Quando usar
- **Reserva:** trecho sem voz de energia `high` vira `burst` (`FALLBACK.high` em `src/music/scenes.ts`).
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif burst`.
- Fora da música, o componente de overlay `Burst` (`motion/src/components/Burst.tsx`) é o irmão para vídeos de EDL.

## Onde está
`motion/src/music/motifs.tsx` → `Burst` (usa `burstParticles` e `particleState` do componente de overlay).

## Como funciona
- Período de 42 quadros: `age = frame % 42`, `round = floor(frame/42)`; cada rodada usa `burstParticles(seed + round, 26)`, então cada explosão é diferente e determinística.
- Posição por `particleState(p, age/42, 330)` (desacelera com `Easing.out(cubic)`, some no fim).
- Onda de choque: círculo que cresce e some com `exp(-age/10)`; núcleo pulsa com `pulse`.

## Receita para mudar
`count` (26) e raio (330) definem a densidade; período (42) define o ritmo — alinhar a ~1 tempo forte (a 120 BPM, 60 quadros).

## Armadilhas
- Num quadro avançado do ciclo só resta o núcleo (partículas já sumiram): não é erro, confira outro `age`.

## Validar
`tests/components-c4.test.ts` (partículas determinísticas) e `tests/music-motifs.test.ts` + quadro com `age` < 20.
