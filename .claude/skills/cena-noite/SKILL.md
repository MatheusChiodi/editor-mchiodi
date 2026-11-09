---
name: cena-noite
description: Cena "noite" do vídeo de música (lua crescente, estrelas piscando, colinas). Use para silêncio, escuro, solidão, ausência, madrugada, lua, covardia, vazio; também é o motivo padrão dos trechos instrumentais calmos.
---

# Cena: noite

**Conta:** silêncio e solidão. Lua sobe, estrelas piscam, uma colina fria ao fundo.

## Quando usar
- `LEXICON.night`: noite, silenc*, escur*, sozinh*, ausent*, madrugad*, lua, covard*, vazio, solidao.
- **Reserva:** trecho sem voz e de energia `low` vira `night` (`FALLBACK.low` em `src/music/scenes.ts`).
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif night`.

## Onde está
`motion/src/music/motifs.tsx` → `Night`.

## Como funciona
- 46 estrelas sorteadas por `mulberry32(seed + 11)`: o `seed` da cena muda o céu entre usos. Cada uma pisca com `sin(t*speed + phase)`.
- Lua crescente = círculo claro com máscara (`<mask id="moon-cut">`) que recorta um círculo deslocado. Sobe nos primeiros ~45% da cena (`rise`), deriva 40 px.
- Colina em `accent` com 22% de opacidade.

## Receita para mudar
1. Mudar densidade/tamanho das estrelas ou a fase da lua nos números do componente.
2. Id de máscara é global no SVG: se criar outra máscara, use id diferente.

## Armadilhas
- Dois `<mask>` com o mesmo `id` na mesma página fazem o segundo usar o primeiro.
- No plano de **história**, a noite é cenário (céu `night` em `story/Settings.tsx`); esta cena é só a ilustração.

## Validar
`tests/music-motifs.test.ts` (determinístico; seeds diferentes mudam o desenho) + quadro visto.
