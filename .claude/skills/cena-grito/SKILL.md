---
name: cena-grito
description: Cena "grito" do vídeo de música (anéis expandindo e onda de voz reagindo ao grave). Use para gritar, mundo, nome, barulho, voz, falar, cantar, dizer.
---

# Cena: grito

**Conta:** a voz que sai. Anéis se expandem do centro; uma onda de áudio vibra com o grave.

## Quando usar
- `LEXICON.shout`: gritav*, grito, gritar, mundo, nome, barulho, voz, falar, fala, cantar, dizer, diz.
- No diretor de história: personagem olha para cima, humor `angry` no clímax, telhado.
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif shout`.

## Onde está
`motion/src/music/motifs.tsx` → `Shout`.

## Como funciona
- 4 anéis, defasados em 1/4 do ciclo de 1,4 s (`loopProgress`), raio de 40 a 340, espessura e opacidade caem ao expandir.
- Onda: 56 pontos, `sin(i*0.55 + t*9)` com amplitude `14 + bass*130`, envelope em seno nas pontas.
- Núcleo em `accent` aumenta com `pulse`.

## Receita para mudar
Amplitude e frequência da onda são os dois botões. Mais anéis = mais "eco".

## Armadilhas
- Velocidade da onda (`t*9`) alta demais vira ruído a 30 fps; manter < 12.
- A onda precisa de envelope nas pontas, senão corta seco.

## Validar
`tests/music-motifs.test.ts` (grave 0 e 1 em quadros alternados) + quadro visto.
