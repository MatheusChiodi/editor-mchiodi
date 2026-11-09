---
name: cena-celular
description: Cena "celular" do vídeo de música (ilustração de mensagem digitada e apagada, nunca enviada). Use quando a letra falar de mensagem, mandar, enviar, apagar, celular, WhatsApp, ligação, ou quando for pedido trocar/ajustar essa cena com `mce mv`.
---

# Cena: celular

**Conta:** alguém tenta falar e desiste. O celular aparece, a mensagem é digitada e apagada de novo; o rascunho sobe e some.

## Quando usar
- Palavras que chamam a cena (`LEXICON.phone` em `src/music/scenes.ts`): mensag*, mandar, enviar, apago, celular, whatsapp, digit*, ligacao, telefon*, chamada.
- No diretor de história (`src/music/story.ts`) a mesma palavra põe o **celular na mão do personagem** (pose `typing`/`phone`, prop `phone`); esta ilustração entra como *insert* entre os planos.
- Trocar à mão: `pnpm mce mv set <projeto> <n> --motif phone`.

## Onde está
`motion/src/music/motifs.tsx` → componente `Phone` (registrado em `MOTIFS.phone`). Desenha em ±330×±300, centrado em (0,0); o `MusicVideo` escala por `unit*1.15`.

## Como funciona
- Ciclo de 3,4 s: digita 0–1,5 s (largura de 0 a 160), segura até 2,1 s, apaga 2,1–2,7 s. Cursor pisca a cada 8 quadros.
- Rascunho (balão laranja) sobe 90 px e some entre 2,1 e 2,9 s.
- Botão de enviar pulsa com `pulse` (batida). Cores vêm da `palette` da seção (`[fundo, destaque, brilho]`).
- Props: `MotifProps` (`frame` da cena, `fps`, `progress`, `palette`, `bass`, `pulse`, `variant`, `keyword`, `seed`).

## Receita para mudar
1. Mexer só em `Phone` (coordenadas em unidades de 1080p). Texto = barras, nunca texto real (some em tela pequena).
2. Manter o ciclo digita→apaga: é o sentido da cena.
3. Conferir na prévia ao vivo (`http://localhost:5190/`) e fixar um quadro com `mce motion still` ou o script de stills.

## Armadilhas
- Largura da barra digitada é lida pelo teste (`<rect x="-100" y="207" width=...>`); mudar a posição exige ajustar `tests/music-motifs.test.ts`.
- Elemento sem `key` em `.map` gera aviso do React no render; use sempre `key`.

## Validar
`pnpm vitest run tests/music-motifs.test.ts` (digita e apaga: largura 0 → >100 → 0) e ver um quadro da cena.
