---
name: cena-coracao
description: Cena "coração" do vídeo de música (coração que bate e se parte, com linha de batimento). Use quando a letra falar de coração, peito, amor, amar, sentir, paixão, ciúme, ou ao pedir/ajustar essa cena.
---

# Cena: coração

**Conta:** o sentimento preso no peito. O coração bate no ritmo, vai rachando ao longo da cena e uma linha de batimento corre embaixo.

## Quando usar
- `LEXICON.heart`: coracao, peito, amor, amar, sentir, sente, paixao, ciume, amo.
- É o último critério de desempate (prioridade mais baixa em `PRIORITY`): palavras mais específicas (celular, fotos...) ganham dele.
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif heart`.

## Onde está
`motion/src/music/motifs.tsx` → `Heart`. Forma de `makeHeart({ height: 300 })` (`@remotion/shapes`), centrada pela caixa real (`getBoundingBox`).

## Como funciona
- Escala = `(1 + 0.14*bass + 0.08*pulse) * (0.7 + 0.3*springAt(frame))`: entra com mola e bate com o grave e a batida.
- Rachadura (`CRACK`, zigue-zague) desenhada por `evolvePath` entre `progress` 0,30 e 0,65.
- Linha de ECG (`ecg`) com bolinha percorrendo em 2,2 s (`loopProgress`).
- Brilho circular atrás cresce com o grave.

## Receita para mudar
1. Ajustar `CRACK` (path em coordenadas relativas ao centro) ou os limiares de `progress`.
2. Para outra forma (coração duplo, em pedaços), criar nova função e registrar como variante via `variant`.

## Armadilhas
- A rachadura usa o mesmo `scale` do coração; desenhe-a em um `<g>` com a mesma escala, senão ela escorrega.
- `makeHeart` devolve largura/altura do círculo circunscrito; centralizar pelo `getBoundingBox` do path, não por `width/height`.

## Validar
`tests/music-motifs.test.ts` (rachadura: `stroke-dashoffset` menor em `progress` 0,9 que em 0,1) + quadro visto.
