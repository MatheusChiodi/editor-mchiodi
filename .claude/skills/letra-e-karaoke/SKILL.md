---
name: letra-e-karaoke
description: Letra no vídeo de música — ler a letra fornecida, alinhar à voz (transcrição), gerar letra automática quando não há, e a legenda em karaokê. Use ao receber uma letra, quando versos saem com tempo errado, ou ao mexer em `src/music/lyrics.ts` e na tipografia da letra.
---

# Letra e karaokê

## Fluxo (`makeMusicVideo` em `src/music/index.ts`)
1. `parseLyrics(texto)`: um verso por linha; some linha vazia e marcação inteira entre `[...]` ou `(...)` (`[Chorus - ...]`, `(Fade out)`).
2. Transcrição por palavra (WhisperX, sidecar `transcriber/`); **cache** em `analysis/words.json` (vale se for mais novo que o áudio). Palavras com `score < 0.35` são descartadas (alucinação em trecho instrumental).
3. **Com letra:** `alignLyrics(versos, palavras)` — alinhamento Needleman–Wunsch com casamento aproximado (`tokenSimilarity`: Levenshtein; ≥0,99 vale 2, ≥0,6 vale 1). Cada palavra da letra herda o tempo da palavra ouvida.
   - **Palavra solta casada longe do verso** (> 2,5 s das outras do mesmo verso) é descartada; só fica o maior grupo.
   - Verso sem nenhuma palavra casada recebe tempo interpolado entre vizinhos, proporcional ao tamanho.
   - Se nada casar: `spreadLyrics` distribui os versos pelo tempo (sincronia aproximada; avisa).
4. **Sem letra:** `linesFromWords` agrupa o que foi ouvido em versos (quebra em pausa > 0,7 s ou 8 palavras).
5. `buildMusicPlan` converte para quadros (`lyrics[].words[]`).

## Karaokê (render: `motion/src/music/MusicVideo.tsx`)
- `lyricAt` mostra o verso de 8 quadros antes até 12 depois; `wordStates` dá `done | active | next`.
- Serifa (`theme.font.display`, Playfair 600), sombra forte para ler em qualquer fundo, palavra ativa na cor de brilho com leve aumento; entra com mola (`springAt`).
- Posição: acima da faixa preta cinemascope (`bottom = bar + 36*unit`); degradê escuro no pé do quadro para legibilidade.

## Armadilhas
- Letra do usuário pode ter direitos autorais: ela fica em arquivo local, **fora do git** (`.gitignore`: `letras/`, `lyrics/`, `**/letra*.txt`).
- Palavra repetida ("dói saber" três vezes) pode casar no verso errado; o aparo de 2,5 s corrige a maioria. Conferir versos com duração > 6 s ou < 0,8 s no `mce mv scenes`.
- Idioma da transcrição vem de `config.transcribe.language` (padrão `pt`).

## Validar
`tests/music-lyrics.test.ts` (parse, similaridade, alinhamento com erro/falta/verso não ouvido, aparo, spread) + olhar a lista `mce mv scenes` com os versos de cada cena.
