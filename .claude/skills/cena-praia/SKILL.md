---
name: cena-praia
description: Cenário "praia" do vídeo de música em história (mar com ondas animadas, reflexo do astro, areia; personagem em pé olhando o horizonte). Use para o desfecho, calma, libertação, aceitação.
---

# Cenário: praia

**Conta:** respirar depois da tempestade. Mar aberto, horizonte, o personagem parado olhando.

## Quando usar
- Ato `outro` (≥90%): `['hills','hills','shore']` — a praia é o 3º plano do ciclo (o último plano de história é sempre forçado para `hills`, ver `cena-colinas`).
- Qualquer horário; no desfecho é `dawn`.

## Onde está
`motion/src/music/story/Settings.tsx` → `Shore`; `stageSpot('shore') = { x: -140, ground: 322, scale: 1.55 }`.

## Como funciona
- Mar `mixHex(sky.bottom, '#06204a', 0.7)`; 3 faixas de onda (função `wave(offset, amp, y, color, speed)`) como `<path>` de 41 pontos com `sin(x*0.012 + t*speed + offset)`.
- Reflexo do astro: 9 barrinhas decrescentes sob a lua/sol (posição depende do horário).
- Areia com borda de espuma que pulsa (`0.3 + 0.15*sin(1.5 t)`).

## Receita para mudar
`wave` aceita amplitude e velocidade: mar calmo (amp 4–6, speed 0,6–0,9) para o desfecho; mar agitado para o clímax.

## Armadilhas
- Ondas animam por `t = frame/fps`: dependem do tempo local da cena, então reiniciam a cada plano (aceitável).
- A areia cobre a linha do chão; o personagem pisa em `ground 322`, abaixo do traço da areia: conferir que os pés não ficam na água.

## Validar
`tests/music-motifs.test.ts` + quadro visto.
