---
name: cena-chuva
description: Cena "chuva" do vídeo de música (nuvem, gotas caindo, ondas na poça). Use para chorar, lágrima, chuva, dor, "dói", sofrer, saudade.
---

# Cena: chuva

**Conta:** tristeza que cai. Nuvem pesada, gotas, poça com ondas.

## Quando usar
- `LEXICON.rain`: chorei, chorar, choro, lagrima, chuva, doi, dor, sofrer, sofro, saudade.
- Empate: perde para caminho/grito/papel etc. (`PRIORITY`); "dói" sozinho dá chuva.
- No diretor de história a palavra liga o clima `rain` no plano do personagem (`faceHands`, humor `cry` fora do primeiro ato).
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif rain`.

## Onde está
`motion/src/music/motifs.tsx` → `Rain`. (A chuva dos planos de história é outra: `Weather` em `story/Settings.tsx`.)

## Como funciona
- 34 gotas, velocidades 420–780 px/s, sorteadas por `mulberry32(seed+5)`; ciclo vertical de 470 px.
- Nuvem = círculos + retângulo arredondado em tom frio misturado com o destaque.
- 3 ondas elípticas na base, defasadas (`loopProgress` 1,6 s). Espessura da gota cresce com o grave.

## Receita para mudar
Mais gotas = mais carga de render; acima de ~60 vale usar `<line>` simples (já é). Ajustar `speed` para chuva fina ou pesada.

## Armadilhas
- Variável `glow`/`accent` vem da paleta da seção; chuva em seção quente fica estranha: preferir paleta fria.

## Validar
`tests/music-motifs.test.ts` + quadro visto.
