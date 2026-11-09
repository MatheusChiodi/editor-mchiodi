---
name: exportar-para-editores
description: Exporta os cortes da EDL para editores visuais (Shotcut, Kdenlive, OpenShot, Premiere, Resolve) em MLT, Final Cut XML, CMX3600 EDL ou OpenTimelineIO com `mce nle`. Use quando o Matheus quiser abrir/ajustar a edição à mão em outro programa.
---

# Exportar para editores

`pnpm mce nle <projeto> [-f mlt|fcp7|edl|otio|all] [-v <versão da EDL>]` → `projects/<slug>/renders/nle/<slug>-v<N>.<ext>`.

| Formato | Arquivo | Abre em |
|---|---|---|
| `mlt` | `.mlt` | Shotcut (e `melt`); segue o molde que o Shotcut grava |
| `fcp7` | `.xml` (xmeml v4) | OpenShot, Kdenlive, Premiere, Resolve |
| `edl` | `.edl` (CMX3600) | OpenShot, Kdenlive e a maioria |
| `otio` | `.otio` | Kdenlive e editores com OpenTimelineIO |

## O que vai e o que não vai
**Só os cortes** (clipes em frames da fonte e da saída, vídeo + áudio ligados). Gráficos, zoom, cor, legenda e mixagem ficam no render do `mce` — o `mce` continua sendo o editor principal (a EDL é a fonte da verdade).

## Onde está
`src/nle/formats.ts` (`toNleInput`, `cmx3600`, `mlt`, `fcp7`, `otio`; tudo em frames inteiros) e `src/nle/index.ts` (`NLE_FORMATS`, `exportNle`). Código próprio, sem biblioteca.

## Armadilhas
- Caminho do arquivo com espaço ou `&` é escapado (XML e URL: `file://localhost/D:/...` no xmeml, `file:///` no OTIO).
- 29,97/23,976 fps: timebase inteira + `ntsc TRUE` no xmeml; timecode do EDL é sem queda (NDF).
- **Não foi aberto em Shotcut/Kdenlive/OpenShot** durante o desenvolvimento (não instalados): a estrutura foi validada por teste, não por abrir o programa. Se algo não abrir, comparar com o arquivo que o próprio editor grava.

## Validar
`tests/nle.test.ts` (timecodes, XML bem formado, escape, NTSC, JSON do OTIO).
