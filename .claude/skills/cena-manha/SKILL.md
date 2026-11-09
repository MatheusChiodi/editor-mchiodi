---
name: cena-manha
description: Cena "manhã" do vídeo de música (janela com o sol nascendo e raios girando). Use para bom dia, manhã, amanhecer, nascer, sol, aurora, esperança; também para o fecho de uma música triste.
---

# Cena: manhã

**Conta:** um novo dia. O sol sobe atrás da janela, os raios giram, a luz esquenta o quadro.

## Quando usar
- `LEXICON.morning`: "bom dia" (frase, vale 2), manha, amanhec*, sol, nascer, aurora, alvorada.
- "bom dia" **ganha de "dói"** (frase pesa mais): `Dói saber que o seu 'bom dia' agora é de outro alguém` vira manhã de propósito.
- No diretor de história, `morning` empurra o plano para `hills` + `dawn` + `lookUp`, se o ato permitir.
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif morning`.

## Onde está
`motion/src/music/motifs.tsx` → `Morning`.

## Como funciona
- Janela 300×380 com recorte (`<clipPath id="window-clip">`); céu = mistura do fundo com o destaque.
- Sol: `sunY = 150 - outCubic(clamp(progress*1.4)) * 190` (sobe até o meio da janela); 12 raios giram `t*12`°/s.
- Silhueta de colinas escura na base e peitoril claro.

## Receita para mudar
Mexer em `sunY` (altura final), cor do sol (`#ffe08a`) ou número de raios. Manter o recorte: sem ele o sol vaza da janela.

## Armadilhas
- `clipPath id` global: não repetir.
- O aquecimento do céu usa `outCubic(progress)`; se `progress` ficar parado em 0, a cena parece apagada.

## Validar
`tests/music-motifs.test.ts` (sem NaN em qualquer progresso) + quadro visto em `progress` ~0,5.
