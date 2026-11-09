---
name: cena-janela
description: Cenário "janela" do vídeo de música em história (close de janela com chuva escorrendo e luzes da cidade desfocadas; sem personagem). Use como abertura da música, para estabelecer clima e título.
---

# Cenário: janela

**Conta:** a abertura. A câmera olha uma janela chuvosa de noite; o título aparece sobre o bokeh da cidade.

## Quando usar
- Ato `intro` (primeiros ~7% da música): `settings ['window']`, `weather rain`, humor `sad`, câmera `push`. É o plano 1 da história.
- Qualquer plano que precise de **cenário sem personagem** (`stageSpot('window') = null`).

## Onde está
`motion/src/music/story/Settings.tsx` → `WindowSetting`. `StoryShot` pula o personagem quando não há `spot`.

## Como funciona
- Fundo escuro; 34 luzes desfocadas (círculos 14–52 px, 4 cores) pulsando com `sin(1.3 t)`; parallax 0,3.
- Moldura grossa e travessa central; 26 gotas escorrendo no vidro (`q` com curvinha) em velocidades diferentes.
- Parapeito escuro embaixo; só um tom do horário por cima.

## Receita para mudar
Mais luzes/gotas = mais "chuva na cidade". O título (`plan.title`) aparece de 14 a 108 quadros por cima: manter o centro do quadro livre.

## Armadilhas
- Sem personagem não há sombra nem objeto: o plano depende só da câmera (`push`) para não ficar parado.
- `Setting` não desenha céu/estrelas em cenários internos (`bedroom`, `window`).

## Validar
`tests/music-motifs.test.ts` ("o plano de janela não tem personagem") + quadro visto com o título.
