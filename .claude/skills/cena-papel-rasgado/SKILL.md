---
name: cena-papel-rasgado
description: Cena "papel rasgado" do vídeo de música (folha se partindo ao meio, pedaços caindo). Use para rasgar, orgulho, papel, manual, frase, escrever, carta, bilhete.
---

# Cena: papel rasgado

**Conta:** romper algo escrito (orgulho, carta, a frase perfeita que nunca foi dita).

## Quando usar
- `LEXICON.paper`: rasgar, orgulho, papel, manual, frase, escrev*, carta, bilhete.
- No diretor de história: personagem com as mãos no rosto (`faceHands`).
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif paper`.

## Onde está
`motion/src/music/motifs.tsx` → `Paper` (borda irregular em `JAG_L`).

## Como funciona
- `q = outCubic(clamp((progress - 0.15) * 1.6))`: a folha só começa a rasgar depois de 15% da cena.
- Duas metades (`left`/`right`) compartilham a mesma borda `JAG_L`; afastam `6 + 130*q` px e giram `±9*q`°.
- Linhas de texto e uma etiqueta colorida em cada metade; 14 pedaços caem com giro (`spin * t`).

## Receita para mudar
Trocar `JAG_L` muda o rasgo (lista de pontos `x,y` de cima para baixo). Metades devem usar a *mesma* lista, senão aparece folga.

## Armadilhas
- Pedaços usam `transform="rotate(a cx 0)"` com `cx` do próprio pedaço; origem errada faz eles girarem em órbita.

## Validar
`tests/music-motifs.test.ts` + quadro visto em `progress` ~0,6.
