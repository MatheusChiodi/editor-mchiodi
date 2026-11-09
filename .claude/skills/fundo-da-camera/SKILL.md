---
name: fundo-da-camera
description: Remove ou troca o fundo da câmera de um vídeo da EDL (cor, imagem, vídeo, desfoque ou chroma key) com `background` na EDL e o sidecar RobustVideoMatting. Use quando o pedido for trocar/tirar/desfocar fundo, fundo verde, ou "pessoa sobre outro cenário".
---

# Fundo da câmera

Campo `background` da EDL (schema em `src/edl/schema.ts`, doc em `edl-reference`). Roda **sobre o corte já feito** (`cut.mkv`), no tempo de saída, antes de zoom, cor e gráficos.

## Modos
| `mode` | Precisa de máscara | Fundo novo |
|---|---|---|
| `color` | sim (RVM) | `color` `#RRGGBB` |
| `image` / `video` | sim | `file` em `assets/backgrounds/` (laço, cobre o quadro) |
| `blur` | sim | o próprio vídeo desfocado (`blur` 2–60) |
| `chroma` | **não** | `file` (imagem/vídeo pela extensão) ou `color` liso; remove `keyColor` (padrão `#00ff00`) com `similarity` 0,01–0,5, `edgeBlend`, `despill` |
`reason` é obrigatório. Refino da máscara: `matte.opening` 0–8 (tira respingos), `matte.feather` 0–10 (borda), `matte.downsample` (null = automático ≈ 512 px no maior lado).

## Pipeline
1. `src/render/matte.ts` chama `matting/matte.py` (RVM `mobilenetv3` fp32, torchscript, CUDA): lê quadros por ffmpeg, **mantém o estado recorrente** entre quadros (borda estável), **reinicia em corte seco** de cena (salto de luminância > 0,25), grava a máscara em cinza (ffv1).
2. `src/render/background.ts` monta o grafo (`buildBackgroundGraph`): `alphamerge` da frente com a máscara refinada (`erosion`/`dilation`/`gblur`) sobre o fundo novo, `overlay`. Áudio passa intacto (`-c:a copy`). Grafo vai por arquivo (`-/filter_complex`).
3. Modelo (15,5 MB) baixa na 1ª vez para `matting/models/` (ignorado pelo git). Ambiente: `cd matting ; uv sync` (PyTorch cu128).

## Receita
1. Escolher o modo; se for `chroma`, nem precisa do ambiente Python.
2. Pôr `background` na EDL (nova versão: `mce edl save`), com `reason`.
3. Renderizar com `mce render`; conferir borda do cabelo e mãos (se vazar, subir `opening`; se ficar duro, subir `feather`).

## Armadilhas
- `chroma`: a mesma `color` não serve para chave e fundo — são campos separados (`keyColor` × `color`).
- `mixHex`/ffmpeg exigem `#rrggbb`; no ffmpeg vira `0xRRGGBB`.
- Resolução ímpar quebra o filtro: o render usa dimensões pares.
- Halo claro na borda do cabelo sobre fundo escuro: subir `opening`.

## Validar
`tests/background.test.ts` (grafos) e `tests/background.integration.test.ts` (ffmpeg real: chroma, cor com máscara, blur) + `tests/matte.test.ts`; ver um quadro com pessoa de verdade.
