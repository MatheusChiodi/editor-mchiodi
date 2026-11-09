---
name: cena-colinas
description: Cenário "colinas" do vídeo de música em história (camadas de colinas com parallax, sol nascendo grande, pássaros, capim ao vento; personagem andando ou olhando o céu). Use para o desfecho esperançoso, amanhecer, seguir em frente.
---

# Cenário: colinas ao amanhecer

**Conta:** a esperança no fim. Sol nascendo, pássaros, o personagem seguindo caminho com sorriso.

## Quando usar
- Ato `outro`. **O último plano de história da música é sempre forçado** (em `planStory`): `setting hills`, `time dawn`, `weather clear`, `mood smile`, sem objeto na mão. É o fecho emocional.
- Palavra `morning` (amanhecer/nascer/sol) leva para cá, se o ato permitir.

## Onde está
`motion/src/music/story/Settings.tsx` → `Hills`; `stageSpot('hills') = { x: -100, ground: 330, scale: 1.55 }`.

## Como funciona
- 3 camadas de colinas (`tone(0.45/0.62/0.8)` do tom do céu) com parallax 0,15/0,4/0,8 do `drift`.
- 4 pássaros (V que bate asa com `sin(t*7)`), cruzando o quadro; 36 fios de capim com balanço (`wobble`).
- Sol baixo grande (do `Celestial` do cenário), halo largo.
- `pose walk`: o personagem atravessa o quadro e as colinas correm atrás.

## Receita para mudar
Para amanhecer mais forte, aumentar a opacidade do halo do sol em `Celestial` (horário `dawn`/`dusk` = `low`).

## Armadilhas
- Forçar `hills` no último plano só vale se o plano cair no ato `outro`; música curta demais pode não ter esse ato.
- O capim usa `wobble(frame, fps, 'g'+i, ...)`: chamar sempre com `Math.round(t*30)` para o ruído ser estável (já feito).

## Validar
`tests/music-story.test.ts` (último plano é `hills`/`dawn` com humor `hopeful`/`smile`) + quadro visto.
