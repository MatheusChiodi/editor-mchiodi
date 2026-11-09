---
name: diretor-de-historia
description: O diretor que transforma letra, seções e batidas em uma história em planos (arco, ritmo de montagem, cenário, pose, humor, câmera, transições, inserts). Use ao ajustar COMO a história é contada, ao adicionar um ato/cenário/pose, ou ao depurar planos fora do arco em `src/music/story.ts`.
---

# Diretor de história

`planStory({ lyrics, sections, durationSec, beats, downbeats })` → `PlannedScene[]` (contíguas, 0…duração). Substituiu o antigo `planScenes` (que continua exportado e testado como biblioteca de palavras-chave).

## Ritmo de montagem
- Alvo por energia da seção: `low 4,2 s`, `mid 3,3 s`, `high 2,5 s`; piso `1,6 s`; teto efetivo ≈ 1,5× o alvo.
- **A fronteira de cada seção é sempre um corte**; dentro dela, cortes no tempo forte mais próximo (±0,9 s), senão na batida (±0,5 s), senão no alvo.
- Música de 3 min dá ~60 cenas.

## Arco (por posição na música)
| Ato | % | Cenário | Horário/clima | Poses | Humor |
|---|---|---|---|---|---|
| intro | 0–7 | janela (sem personagem) | noite, chuva | — | triste |
| setup | –28 | quarto | noite | sit, lookDown, typing, phone | sad, neutral |
| conflict | –50 | rua | noite, chuva se não for `low` | walk, lookDown, phone, stand | sad → cry |
| climax | –74 | telhado (e rua) | noite, chuva | lookUp, faceHands, reach, back, stand | cry, angry |
| memory | –90 | praça (e quarto) | entardecer, neblina | sit, reach, lookDown, phone | sad |
| outro | 90– | colinas (e praia) | amanhecer, claro | walk, lookUp, stand | hopeful → smile |
O **último plano de história** é forçado: colinas, amanhecer, claro, `smile`.

## A letra manda (`applyKeyword`)
Palavra-chave do verso (`motifForText`) ajusta pose/objeto/clima/humor — o cenário só muda se o ato permitir (`KEYWORD_SETTING` ∩ `LOOK[ato].settings`). Ex.: mensagem → `typing` + celular; fotos → `lookDown` + foto; grito → `lookUp` (+ `angry` no clímax); noite → `back`.

## Inserts
Em planos pares (`i % 2 === 1`) com palavra-chave, entra a **ilustração** (`cena-<tipo>`) em vez do personagem; nunca duas seguidas.

## Câmera e transição
Câmera por ato (`LOOK[ato].cameras`; clímax = `push`/`orbit`); inserts alternam `push`/`pull`. Transição: 1ª = `fade`; seção nova = `wipe`; insert = `zoom`; mudou de cenário = `whip`; tempo forte em trecho forte = `flash`/`glitch` alternados; resto `fade` (e `cut` em 1 a cada 3 no trecho forte).

## Como mudar a história
- Outro arco: editar `LOOK` (e `actAt` para os limites).
- Nova palavra → motivo: `LEXICON` em `src/music/scenes.ts` (+ teste em `tests/music-scenes.test.ts`).
- Novo cenário/pose: ver `personagem-animado` e `cena-<cenário>`; adicionar o id em `motion/src/music/types.ts`.

## Validar
`tests/music-story.test.ts` (cobertura, ritmo, cortes nas batidas, arco, inserts, câmeras/transições variadas, determinismo, sem letra/sem batidas).
