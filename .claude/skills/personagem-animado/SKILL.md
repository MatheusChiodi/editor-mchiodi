---
name: personagem-animado
description: O personagem vetorial da história (esqueleto, poses, humores, rosto, objetos na mão) em estilo de desenho animado. Use ao criar/ajustar pose, expressão, roupa, ou ao depurar membro torto, mão fora do objeto ou personagem flutuando.
---

# Personagem animado

Dois arquivos: esqueleto puro `motion/src/music/story/rig.ts` (testável) e desenho `story/Character.tsx`; composição com cenário e objetos em `story/Shot.tsx`.

## Esqueleto (`rig(pose, mood, t, { seated, seed })` → `Joints`)
Origem no **quadril**; de frente para a direita. Ângulos em graus a partir de "apontando para baixo", positivos para a frente (braço 0 = caído, 90 = à frente, 180 = para cima). Cotovelo/joelho = flexão sobre o segmento de cima.
- Poses (`POSE_IDS`): `stand, sit, walk, phone, typing, faceHands, lookUp, lookDown, reach, back`.
- Humores (`MOOD_IDS`): `neutral, sad, cry, hopeful, angry, smile` → boca (−1…1), sobrancelha (−1…1), lágrima, olhos semicerrados.
- Vida: respiração (`sin(1.6 t)`), piscada a cada 3,4 s, balanço; `walk` = ciclo `sin(5.2 t)` com pernas e braços em oposição; `cry + faceHands` treme os ombros.
- `seated` baixa o corpo (+52), coxas à frente (~86°). `handPositions(joints)` dá as mãos (para pôr celular, foto, flor); o ombro gira com `torsoTilt` (`shoulderPosition`).

## Desenho (`<Character joints t colors back />`)
Contorno grosso (`#0b0f1a`, 3–3,5 px) = visual de desenho. Camadas: braço/perna do fundo (78–80% de opacidade), tronco, perna da frente, cabeça (cabelo atrás, rosto, cabelo na frente), braço da frente. Rosto: olho com olhar (`gaze`), sobrancelha (raiva = `brow ≤ −0,95` e boca > −0,5; tristeza = ponta interna para cima), nariz, boca (curva por `mouth`), bochecha corada ao chorar/sorrir, **lágrimas** animadas por `t`. `back`: cabelo cobre a cabeça, sem rosto.

## Em cena (`StoryShot`)
Posição = `stageSpot(setting)`: `hipY = ground − 112*scale`. Sombra elíptica no chão. Objetos: `phone` (tela acesa + halo), `photo`, `flower` na mão direita; `umbrella` sobre a cabeça. Cor da camisa = coral misturado 22% com o destaque da seção.

## Receita: nova pose
1. Id em `POSE_IDS` (`types.ts`).
2. Caso no `switch` de `rig` com ângulos de braço/perna (conferir `handPositions`).
3. Teste de limites em `tests/music-rig.test.ts` (já varre pose × humor × sentado) e, se a mão importar, uma asserção de posição.
4. Usar no diretor (`LOOK`/`applyKeyword`) e ver em quadro.

## Armadilhas
- Sentado sem assento no cenário = personagem no ar: o assento fica em `ground − 60*scale`.
- Alterar `SHOULDER` quebra posições de mão (testes acusam).
- Cor da pele/cabelo/roupa: `DEFAULT_COLORS`; não pintar o contorno de outra cor (perde o "desenho").

## Validar
`tests/music-rig.test.ts` (limites, determinismo, caminhada periódica, sentado, humor, piscada, mãos) + `tests/music-motifs.test.ts` (todas as poses × humores sem NaN) + quadro visto.
