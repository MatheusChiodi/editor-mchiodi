---
name: cena-praca
description: Cenário "praça" do vídeo de música em história (parque ao entardecer com árvores, banco, poste de luz e neblina; personagem sentado). Use para o ato de memória (verso das lembranças, fotos), saudade e calma.
---

# Cenário: praça

**Conta:** a memória. Entardecer, neblina leve, o personagem sentado no banco vendo o que passou.

## Quando usar
- Ato `memory` (≈74%–90%): `['park','park','bedroom']`, horário `dusk`, clima `fog` (ou `clear` em trecho forte).
- Poses `sit`, `reach`, `lookDown`, `phone`; com `lookDown` leva a foto na mão (`props ['photo']`).

## Onde está
`motion/src/music/story/Settings.tsx` → `Park`; `stageSpot('park') = { x: -60, ground: 280, scale: 1.5 }`; sentado por `isSeated`.

## Como funciona
- Colina distante, 4 árvores (tronco + 3 copas) com parallax 0,35–0,5, gramado, caminho claro em diagonal.
- Banco (assento y 214) na altura do quadril sentado; poste à direita com halo que pulsa.
- Cores do gramado = `mixHex(sky.bottom, '#12351f', 0.7)`: o horário tinge o parque.

## Receita para mudar
Mais árvores = mais profundidade, mas manter `drift * (0.35 + i*0.05)` para cada uma andar numa velocidade.

## Armadilhas
- Banco e personagem têm que concordar: assento ≈ `ground - 60*scale` (sentado).
- `mixHex` com cor curta (`#fff`) já é aceito, mas preferir `#rrggbb`.

## Validar
`tests/music-motifs.test.ts` + quadro visto (`dusk` + `fog`).
