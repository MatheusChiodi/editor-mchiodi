---
name: cena-fotos
description: Cena "fotos" do vídeo de música (três polaroides entrando e balançando). Use quando a letra falar de fotos, sorriso, imagem, retrato, lembrança, recentes.
---

# Cena: fotos

**Conta:** olhar o passado em imagens. Três polaroides sobem, uma a uma, e balançam de leve.

## Quando usar
- `LEXICON.photos`: foto, fotos, sorriso, imagem, retrato, recentes, lembranca.
- No diretor de história a palavra põe o personagem **olhando uma foto** (`pose lookDown`, `props ['photo']`).
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif photos`.

## Onde está
`motion/src/music/motifs.tsx` → `Photos`.

## Como funciona
- Entrada com mola atrasada 0,28 s por foto (`springAt(frame, fps, i*0.28)`), subindo 380 px.
- Ângulos por variante: `[-11,3,12]`, `[9,-6,4]`, `[-4,10,-12]` (`variant % 3`): quando a cena volta, o arranjo muda.
- Balanço = `wobble(frame, fps, 'photo'+seed+i, 3, 0.4)`.
- Cada polaroide: moldura clara, céu tingido pela paleta, sol, montanhas, figura clara e legenda cinza.

## Receita para mudar
Trocar o conteúdo da foto (sol/montanha/figura) mantendo a moldura e a ordem de entrada. Mais fotos = mais `angles`.

## Armadilhas
- A foto precisa ler bem pequena: contraste forte entre moldura e imagem.
- Sem `key` no `.map` o React avisa durante o render.

## Validar
`tests/music-motifs.test.ts` + quadro visto com as três fotos já dentro (`frame` > 1 s).
