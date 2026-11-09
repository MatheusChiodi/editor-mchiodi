---
name: cena-telhado
description: Cenário "telhado" do vídeo de música em história (topo de prédio sobre a cidade acesa, parapeito, caixa-d'água; personagem de costas, olhando para cima ou de mãos no rosto). Use para o clímax (refrão forte), grito, solidão, noite.
---

# Cenário: telhado

**Conta:** o ponto mais alto da dor. O personagem de pé diante da cidade, sob chuva.

## Quando usar
- Ato `climax` (≈50%–74%): `['rooftop','rooftop','street']`; humor `cry`/`angry`; câmera `push`/`orbit`.
- Palavras: `shout` (grito/mundo/nome) e `night` (noite/silêncio) preferem o telhado; `night` põe `pose back` (de costas).

## Onde está
`motion/src/music/story/Settings.tsx` → `Rooftop`; `stageSpot('rooftop') = { x: 120, ground: 250, scale: 1.6 }`.

## Como funciona
- Duas camadas de prédios grandes abaixo do horizonte (base 420 e 540), parallax 0,2/0,45, janelas acesas à noite.
- Parapeito (y 236–262) com tijolinhos; caixa-d'água com luz vermelha piscando, parallax 0,9.
- O parapeito cobre as pernas do personagem: o quadril fica visível sobre ele.

## Receita para mudar
Para outro skyline mudar `min/max` (altura) e `seed`. Manter o parapeito: é ele que dá escala ao personagem.

## Armadilhas
- Sem o parapeito, o personagem parece flutuando no ar; com a escala 1.6 ele ocupa ~40% da altura do quadro.
- Chuva e `fog` ficam acima de tudo (`Weather`), então escurecem o parapeito: conferir contraste.

## Validar
`tests/music-motifs.test.ts` + quadro visto (a cena do clímax com `pose lookDown`/`faceHands`).
