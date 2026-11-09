---
name: cena-relogio
description: Cena "relógio" do vídeo de música (ponteiros girando para trás, cada vez mais rápido, com rastro). Use quando a letra falar de tempo, voltar, atrás, passou, hora, passado, relógio.
---

# Cena: relógio

**Conta:** querer desfazer o tempo. Os ponteiros rodam ao contrário e aceleram.

## Quando usar
- `LEXICON.clock`: tempo, voltar, atras, passou, relogio, hora, horas, passado, final.
- No diretor de história: personagem de cabeça baixa no quarto (`pose lookDown`).
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif clock`.

## Onde está
`motion/src/music/motifs.tsx` → `Clock`.

## Como funciona
- Minuto: `-(progress*900 + t*30 + 360*progress²*2)` graus (rotação negativa = para trás, acelerando). Hora = minuto/12.
- Três ponteiros-fantasma (`glow`, opacidade 0,12–0,22) deixam rastro; ponteiro do minuto em `accent`, hora em papel.
- 12 marcas (as de 3/6/9/12 mais grossas); aro externo pulsa com `pulse`.

## Receita para mudar
Alterar a aceleração (termo `progress²`) ou o número de fantasmas. Manter o sentido negativo: é o significado.

## Armadilhas
- Ponteiros usam `transform="rotate(deg)"` em torno de (0,0); não deslocar a origem do `<g>`.
- Rastro com opacidade alta come o ponteiro principal.

## Validar
`tests/music-motifs.test.ts` + quadro visto.
