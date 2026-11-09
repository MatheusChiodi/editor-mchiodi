---
name: cena-rua
description: Cenário "rua" do vídeo de música em história (rua noturna com prédios, postes, calçada e faixa; personagem andando, de guarda-chuva ou com celular). Use para o conflito (segundo ato), caminhar, seguir, chuva na cidade.
---

# Cenário: rua

**Conta:** o personagem anda sem rumo pela cidade à noite; a chuva aperta quando a música sobe.

## Quando usar
- Ato `conflict` (≈28%–50%): único cenário. No `climax` volta como 3º plano do ciclo.
- Palavra `road` (caminho/seguir) → `pose walk` na rua.
- Em chuva (`weather rain`) e `pose walk` os planos pares levam **guarda-chuva** (`props ['umbrella']`).

## Onde está
`motion/src/music/story/Settings.tsx` → `Street`; `stageSpot('street') = { x: -80, ground: 262, scale: 1.55 }`.

## Como funciona
- Duas camadas de prédios (`Skyline`) com janelas acesas à noite; parallax 0,2 e 0,5 do `drift`.
- Calçada (y 214–262) e asfalto; faixa central tracejada **anda com o `drift`**; postes (parallax 0,9) com halo que pulsa; reflexo do poste no chão molhado quando chove.
- Em `walk`, `StoryShot` faz `x = spot.x + (progress-0.5)*260` e `drift = -(progress-0.5)*520`: o personagem atravessa o quadro enquanto o cenário corre para trás.

## Receita para mudar
Para a rua ficar viva: mais camadas com parallax diferente. Sempre derivar posição de `drift`, nunca de `frame` (senão o personagem anda sem o cenário).

## Armadilhas
- `Skyline` usa `mulberry32(seed)`: o `seed` da cena precisa ser estável, ou os prédios "mudam" entre quadros.
- Dashes da faixa usam módulo; manter o espaçamento em múltiplos da largura para não pular.

## Validar
`tests/music-motifs.test.ts` (andar atravessa o quadro; chuva só com clima chuva) + quadro visto.
