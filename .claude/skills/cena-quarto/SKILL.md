---
name: cena-quarto
description: Cenário "quarto" do vídeo de música em história (janela, cama onde o personagem senta, mesa com abajur e notebook, quadro). Use para o primeiro ato (apresentação), celular, digitar/apagar mensagem, fotos, relógio, e ao pedir/ajustar planos dentro do quarto.
---

# Cenário: quarto

**Conta:** a intimidade e a solidão. Personagem sentado na beira da cama, de noite, com o celular.

## Quando usar
- Ato `setup` (≈7%–28% da música) é só quarto (`LOOK.setup.settings = ['bedroom']`); no ato `memory` aparece de novo (3º plano do ciclo).
- Palavras que preferem quarto se o ato permitir (`KEYWORD_SETTING` em `src/music/story.ts`): celular/mensagem, fotos, relógio, papel.
- Trocar à mão: o plano tem `shot.setting`; editar `scenes[n].shot` em `analysis/music.plan.json` (o preview atualiza sozinho).

## Onde está
`motion/src/music/story/Settings.tsx` → `Bedroom`. Ponto do personagem: `stageSpot('bedroom') = { x: -40, ground: 300, scale: 1.5 }`.

## Como funciona
- Palco 1920×1080, origem no centro. Parede tingida pelo céu do horário, piso a y=220, janela com céu e prédios (`Skyline`, parallax 0,3), luar no chão.
- Cama à direita (colchão, cabeceira, travesseiro, colcha vermelha) na altura do quadril do personagem **sentado** (`isSeated`: `bedroom`/`park` e pose ≠ `walk`).
- Mesa à esquerda com notebook azulado e abajur (`lamp` acende em `night`/`dusk`/`dawn`, brilho pulsando).
- Quadro na parede com montanhas.

## Receita para mudar
1. Mexer em `Bedroom`; manter a cama no nível do quadril (`ground - 60*scale` ≈ y 210) senão o personagem "flutua".
2. Para outro objeto, desenhar em coordenadas do palco e respeitar o `drift` (parallax) quando for camada de fundo.

## Armadilhas
- `clipPath id="bed-win"` é global.
- Mudar `scale` do spot exige rever a altura da cama; a conta é `hipY = ground - 112*scale` (em pé) e +52*scale sentado.

## Validar
`pnpm vitest run tests/music-motifs.test.ts` (todo cenário × horário × clima sem NaN) + quadro visto (script de stills do plano).
