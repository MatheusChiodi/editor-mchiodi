---
name: cena-bolha
description: Cena "bolha" do vídeo de música (forma orgânica que respira com o grave). Use como reserva dos trechos instrumentais médios ou para uma cena abstrata, sem narrativa.
---

# Cena: bolha

**Conta:** nada específico: só a música respirando. Forma orgânica que incha com o grave.

## Quando usar
- **Reserva:** trecho sem voz de energia `mid` vira `blob` (`FALLBACK.mid`); também é a cena única do plano sem `scenes`.
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif blob`.
- Fora da música: componente de overlay `OrganicBlob` (texto dentro).

## Onde está
`motion/src/music/motifs.tsx` → `Blob`; geometria em `motion/src/components/OrganicBlob.tsx` (`blobPoints`, `blobPath`).

## Como funciona
- 9 pontos em círculo; cada raio = `radius * (1 + wobble(frame, fps, 'blob'+seed+':'+i, amp, 0.35))` (ruído do `@remotion/noise`, suave e determinístico).
- Curva fechada Catmull-Rom convertida em Béziers cúbicas (`C`), sem pontas.
- `radius = 200 * (0.78 + 0.5*bass + 0.08*pulse)`; `amp = 0.1 + 0.2*bass`.

## Receita para mudar
Mais pontos = contorno mais detalhado; `speed` do ruído (0,35 Hz) = agitação. Manter `speed` constante: variar por quadro dá saltos de fase.

## Armadilhas
- Não variar a velocidade do ruído ao longo do tempo (descontinuidade visível).

## Validar
`tests/components-c4.test.ts` (raios dentro de radius ± amp, path fechado) + `tests/music-motifs.test.ts`.
