---
name: video-de-musica
description: Gera um vídeo ilustrado e cinematográfico a partir de um mp3 (e, opcionalmente, a letra) com `mce music`; conta uma história com personagem, cenários, câmera e transições. Use SEMPRE que o pedido for criar, refazer ou ajustar um vídeo a partir de música, ou um clipe, lyric video, ou "vídeo com a letra".
---

# Vídeo a partir de música (modo cinema)

Entrada: `.mp3` (+ letra em texto, opcional). Saída: `output/<projeto>/music.mp4` com a música original. **Sempre no modo cinema**: história com personagem, muitas cenas curtas, câmera, transições e acabamento (pedido permanente do Matheus). Não existe modo "simples".

## Fluxo (siga a ordem)
1. **Prévia ao vivo primeiro.** O hook (`scripts/ensure-preview.mjs`) sobe `http://localhost:5190/`; confira com `pnpm mce mv preview <projeto> --no-open --port 4880` + `pnpm music:dev` se não subiu. Diga a URL ao Matheus.
2. **Letra:** se ele passou, salve em arquivo `.txt` (um verso por linha; `[Verso]`/`(coro)` são ignorados). Sem letra, a transcrição vira a letra.
3. **Planejar:** `pnpm mce music "<arquivo.mp3>" [--lyrics letra.txt] --title "<nome>" --plan-only`. Gera `projects/<slug>/analysis/music.plan.json` (e `music.json`). A prévia atualiza sozinha.
4. **Revisar com ele** na prévia: cenas numeradas (#n). Editar com `pnpm mce mv set|split|merge <projeto> <n> ...` ou o JSON.
5. **Renderizar:** `pnpm mce mv render <projeto> --preview` (meia resolução, ~3 min a 3 min de música) e, aprovado, sem `--preview` (1920×1080). O plano salvo é usado; não reanalisa.
6. Entregar o caminho **completo** do arquivo (o Matheus abre pelo Explorer).

## Peças (skills a consultar)
`analise-de-musica` (tempo, batidas, seções) · `letra-e-karaoke` · `diretor-de-historia` (arco, ritmo, transições) · `personagem-animado` · `cena-<tipo>` (13 ilustrações + 7 cenários) · `cinema-camera-transicoes` · `cinema-acabamento` · `previa-ao-vivo`.

## Opções do `mce music`
`--lyrics`, `--no-transcribe` (instrumental), `--size 1920x1080|1080x1920|1080x1080` (letterbox só em quadro largo), `--fps`, `--title`, `--preview`, `--plan-only`, `-o`.

## Armadilhas já vividas
- Tempo (BPM) pouco confiável (confiança < 0,15): as batidas passam a vir dos golpes do grave (`bassOnsets`); o BPM exibido pode estar em outra oitava.
- A transcrição fica em cache (`analysis/words.json`); trocar só a letra não retranscreve.
- Vídeo sem áudio não serve (`mce analyze` recusa); aqui o áudio é a entrada.
- Música é do usuário e tem direitos autorais: nunca baixar faixa; só usar a que ele passou.
- Mídia e letras não vão para o git (`.gitignore`).

## Validar
`pnpm test` e `pnpm typecheck`; ver quadros (stills) de cada cenário e da transição; só então render completo.
