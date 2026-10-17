# Movimento — conferência em 720p (`ref-hd.mp4`, 1280x720 @ 29,97)

Revisão de `analysis/movimento.md` (feito em 360p). Tudo remedido quadro a quadro com numpy sobre frames crus;
scripts e imagens em `analysis/movimento-hd/` (`morph.py` bordas do retângulo, `fitlib.py` ajuste de curva,
`tear.py`, `words.py`, `auto.py`, `zoomhd.py`, `dissolve.py`, `scalematch.py`, `panel.py`).

Convenções: frame `fN` = N/29,97 s. px em 720p salvo indicação; **1080p = 720p x 1,5**. % é do quadro.
"Nominal" = duração da curva ajustada; "visível" = frames em que o movimento passa de 1% e fica abaixo de 99%
(uma curva ease-in-out de 27 f parece ter ~23 f).
Curva `B` = `cubic-bezier(0.65, 0, 0.35, 1)` (equivale a easeInOutCubic; em Remotion `Easing.bezier(0.65,0,0.35,1)`).

---

## 1. Afirmação original → 720p → veredito

### Layouts

| Afirmação original | Valor em 720p | Veredito |
|---|---|---|
| Janela da gravação x 3,8–74,4% / y 8,3–87,8% | x 46–953 px, y 59–633 px = 3,6–74,5% / 8,2–87,9% (907x574) | confirmado |
| PIP 21% L x 35,5% A, margem direita 3,1%, inferior 5,5% | externo (com borda) x 970–1244, y 426–684 = 274x258 px = 21,4% x 35,8%; **margens iguais de 36 px** (2,8% L / 5,0% A) | corrigido (margens) |
| PIP: borda ~2 px, raio ~8 px (360p) | borda branca 4 px, raio ~17 px (720p) = 6 px / ~26 px em 1080p | confirmado |
| Cartão x 74,2–97,8% / y 5,5–94,5%, proporção ~0,475 | esse é o retângulo interno do vídeo (949–1252 / 40–680). Externo com borda: x 945–1256, y 36–684 = 311x648 px = 24,3% x 90,0%; margem direita 24 px, topo/base 36 px | confirmado (faltava a borda) |
| Proporção 1,78 → 1,05 (PIP) com "recorte tipo cover" | PIP **não é cover**: o footage está em escala 0,53–0,58 do original (cover seria 0,347), ou seja zoom extra de ~1,6x centrado no rosto (centro do recorte em 55–58% x, 31–33% y do footage). Cartão é cover puro (escala 0,90, recorte centrado em x≈60%) | corrigido |
| Layout espelhado: PIP no canto inferior esquerdo | PIP x 36–310 (mesma margem de 36 px), janela x 333–1240; o PIP fica **por cima** do canto da janela | confirmado |

### Troca de layout (retângulo do apresentador)

| Afirmação original | Valor em 720p | Veredito |
|---|---|---|
| #4 FULL→TELA+PIP 4,10–4,87, 23 f | visível f123–f147 (4,10–4,90 s); nominal **27 f** começando em f120 (4,00) | corrigido (duração nominal) |
| Curva `cubic-bezier(0.4,0,0.2,1)`, pico de velocidade a ~40% | **`cubic-bezier(0.65,0,0.35,1)`**, simétrica, pico a 50%. RMSE 0,003–0,006 contra 0,025–0,027 da (0.4,0,0.2,1), em 7 ocorrências | corrigido |
| T1 21–23 f; T3 22 f; T4 19–26 f; T5 20 f | **todas 27 f nominais** (0,9 s): T1 em 4,0 / 60,3 / 133,3; T3 em 23,3 / 43,5 / 253,5; T4 em 37,0 / 52,9 / 277,3; T5 em 85,3. Séries idênticas quadro a quadro | corrigido |
| T6 espelhamento 22 f | PIP desliza 933 px (72,9% L) em **30 f** nominais (visível ~26), mesma curva B | corrigido |
| #8/T2 TELA+PIP→FULL: janela e pílula somem em corte em 13,51 com PIP em 34% | corte em f405 (13,51), 10 f depois do início (f395); PIP com 34% L | confirmado |
| "Overlays do FULL somem em corte seco no frame 1; janela já aparece no lugar" | Não é no frame 1. O retângulo já encolhe por **5–9 frames** com os overlays ainda na tela (parados, não encolhem junto) sobre paper liso; só então overlays somem e a janela aparece, no mesmo frame (f129 em 4,3 s, com o retângulo em x=11,6%) | corrigido |
| "B-ROLL → FULL (corte seco) → morph" (#15, #23, #45): 1 frame de FULL | **Não existe frame de FULL.** O corte do b-roll já cai com o morph em andamento: x1 = 3,4% (23,3 s), 4,4% (43,5 s), 11,3% (133,3 s). O b-roll é uma camada que cobre os primeiros 5–9 f do morph | corrigido |
| T5: "conteúdo anterior some em corte seco no frame 1" | PIP já cresce 3–4 f com o conteúdo antigo presente; corte em f2559 | corrigido |
| Sem overshoot, sem blur, sem fade no apresentador | confirmado em todas as ocorrências medidas | confirmado |
| Raio 0 ↔ ~24 px (1080p) | PIP ~26 px, cartão ~31 px, janela ~16 px (1080p) | confirmado |
| Borda do PIP presente durante o morph (inf.) | a borda **cresce com o progresso**: 0 px no início, 1,1 / 1,9 / 2,5 / 3,0 / 3,6 px nos frames 11/13/15/17/19, 4 px no fim | detalhe novo |

### Rasgo de papel (T8)

| Afirmação original | Valor em 720p | Veredito |
|---|---|---|
| #13: 10 f, frente 5,11,20,34,52,68,82,92,98,100% | f549–f559: 0,7 / 4,8 / 11,3 / 20,7 / 33,6 / 51,4 / 68,6 / 82,0 / 91,4 / 97,8 / 100% = **11 f**, easeInOutQuad (RMSE 0,012) | confirmado |
| Dente da borda ~40–60 px (6–9% L) | amplitude pico a pico **62 px em 720p = 4,8% L** (93 px em 1080p) | corrigido |
| #57 (230,56): ~13 f | idêntico ao de 18,3 valor por valor: 11 f (f6911–f6922) | corrigido |
| #39/#48: conteúdo some, 3–5 f de paper vazio, wipe ~10 f | 92,0: corte em f2754, wipe f2758–f2768; 141,4: corte em f4238, wipe f4242–f4252. Sempre 4 f de vazio + 11 f de wipe | confirmado |
| Borda "serrilhada" | polígono em zigue-zague de segmentos retos, borda dura (sem feather, sem sombra, sem filete branco); máscara rígida que translada (correlação 0,99 entre frames) | confirmado + detalhe |

### Texto palavra a palavra

| Afirmação original | Valor em 720p | Veredito |
|---|---|---|
| 7 f por palavra | 8–9 f visíveis; nominal **10 f** com curva B (RMSE 0,006) | corrigido |
| Stagger 3–4 f | inícios f1701/1705/1708/1712 (56,8 s) e f3464/3468/3471/3475 (115,6 s): **4, 3, 4** = 3,5 f fixos (~0,117 s) | confirmado |
| translateY +33 px (frase) / +20 px (título) em 1080p | frase: +21 a +25 px em 720p = **~36 px em 1080p (3,3% A)**; título no paper: +13 px = **~20 px (1,8% A)** | confirmado |
| Curva ease-in-out (quad) | opacidade: curva B em 10 f. Y fica parado ~2 f e depois desce (série 21, 21, 20, 14, 7, 3, 1, 0) | corrigido |
| "Palavras parecem entrar desfocadas" (inf.) | **confirmado**: blur visível nos 3 primeiros frames de cada palavra (crops `blur_terminal_x2.jpg`, `blur_personalizava_x2.jpg`) | confirmado |
| Estado "fantasma" | Não há segundo estágio: o núcleo da letra chega à cor final em 7 f. O "fantasma" é só a palavra a 5–25% de opacidade, borrada e deslocada para baixo, nos 3 primeiros frames. O cinza de transição é opacidade parcial | corrigido |
| #27 frase 56,77–57,32 | f1701–f1719 = 56,76–57,36 s (19 f para 4 palavras) | confirmado |
| #43 frase em 114,37–115,6, lead −0,5 s sobre a fala | Em 114,41 o que acontece é a **saída** das 4 pílulas (fade de 8 f). A frase começa em **115,58 s**, colada em "exemplos"@115,55 (lead +0,03 s) e termina em 116,18 | corrigido |
| Cascata de tempo fixo, não segue a fala | confirmado: 23,62–24,39 (fala só diz "personalizava" em 24,26, "como" em 25,98, "trabalhar" em 27,53) | confirmado |
| Eyebrow entra primeiro | eyebrow f705–f714 (10 f, só fade), 1ª palavra em f708 (3 f depois) | confirmado |

### Entradas de elemento

| Afirmação original | Valor em 720p | Veredito |
|---|---|---|
| Pílula 9 f | 9–11 f (11,92 / 63,58 / 34,60) | confirmado |
| Pílula +7 a +9 px (360p) = +24 px em 1080p | +16 a +18 px em 720p = **~26 px em 1080p (2,4% A)** | confirmado |
| Pílula escala 0,93–0,96 → 1 (inf.) | largura medida 0,89–0,94 → 1,00 | **confirmado** (0,92 → 1) |
| Cartão de grade 7–8 f | **10 f** (f905–f915; idem 31,2 e 33,3; grade pequena 9–10 f) | corrigido |
| Cartão +13/+14 px (360p) = +40 px em 1080p | +31 px no 1º frame visível, ~+34 px total em 720p = **~51 px em 1080p (4,7% A)**; sem escala | corrigido |
| Cartão grande / documento +19–20 px (360p) | +40 px no 1º frame visível, ~+44 px total = **~66 px em 1080p (6,1% A)**; 9–10 f | corrigido |
| Mola `stiffness 170, damping 26` sem overshoot | Sem overshoot confirmado. A série de opacidade (0,06 0,21 0,37 0,52 0,67 0,75 0,84 0,93 0,96 1) ajusta igual (RMSE 0,016–0,022) a easeOutQuad 10 f, `ease` (0.25,0.1,0.25,1) 12–13 f e easeInOutSine 10 f. A mola não ajusta melhor que as curvas | não verificável (qual curva exata) |
| #1 título "mods." 7 f, +16 px (360p) | 6–7 f, +21 px no 1º frame visível (~+24 total, 3,3% A) | confirmado |
| #9 ícone 8 f | 10 f, com escala ~0,85 → 1 | corrigido |
| Pílula entra "~f25+" depois do morph (T1) | em 294,2 a pílula entra com o morph a ~50%, **por baixo** do retângulo do apresentador | corrigido |

### Saídas

| Afirmação original | Valor em 720p | Veredito |
|---|---|---|
| 7 f, só opacidade, todos juntos | 7–8 f visíveis, só opacidade (dy 0, escala 1,00), todos juntos: 17,93 / 60,29 / 114,41 / 291,29 | confirmado |
| Curva "quase linear" | ease-in-out: 0,97 0,92 0,83 0,65 0,40 0,20 0,09 0,04 (curva B, 11 f nominais) | corrigido |
| #49 pílula sai em 153,5 com fade de 8 f e y −3 | não há fade: as duas pílulas ficam até f4618 (154,02) e somem em corte, já dentro do morph | corrigido |
| #63 saída de 3 pílulas 293,55–294,12, 17 f, linear | a saída é em **291,29–291,56**, 8 f, mesma receita das outras. Em 293,5 só há o morph T1 | corrigido |

### Zooms na janela

| Afirmação original | Valor em 720p | Veredito |
|---|---|---|
| Fatores 1,30 / 1,22 / 1,30 / 1,26 / 1,26 / 1,26 | 1,30 / 1,22 / 1,30 / 1,25 / 1,25 / 1,25 | confirmado |
| Zoom-in 31–49 f, "sino simétrico" | **todos 36 f nominais** (27–29 visíveis), curva B (RMSE 0,003–0,010) | corrigido |
| #5: 9,90–11,37 (44 f) | 10,19–11,39 nominal (visível 10,38–11,24) | corrigido |
| #52: 174,97–176,61 (49 f) | 175,42–176,62 nominal, 36 f | corrigido |
| Zoom-out 18–27 f | ~27 f nominais (24–25 visíveis) em 12,7 e 74,3; em 140,7 é cortado ainda em 1,02 | corrigido (18 → ~27) |
| Foco: deslocamento de 15–22 px (360p), "centro quase no meio" | o deslocamento é consequência de um `transform-origin` fora do centro: (81%, 28%), (50%, 29%), (49%, 44%), (81%, 34%), (84%, 38%), (81%, 32%) da janela | corrigido |
| Só a janela escala; PIP e pílulas fixos | confirmado | confirmado |

### Carimbo, troca de janela, dissolves

| Afirmação original | Valor em 720p | Veredito |
|---|---|---|
| Carimbo: escala ~1,5 → 0,97 → 1,0, 6–7 f + 3 f | escala **~2,3 → 0,979 → 1,0**: 1,18 (f6646), 1,13, 1,075, 1,036, 1,009, 0,992, 0,983, 0,979 (f6653), volta a 1,000 em f6663. Ajuste: mola `stiffness 100, damping 16, mass 1` partindo de 2,3 em f6638 (RMSE 0,005) | corrigido |
| Rotação fixa ~−6° | **−9,3°** constante (±0,05°) | corrigido |
| Opacidade 0→1 em 4 f | ~10 f: 0,14 0,26 0,37 0,52 0,66 0,78 0,87 0,94 0,98 (f6642–f6650) | corrigido |
| Único overshoot do vídeo | confirmado: é o único lugar com mola subamortecida | confirmado |
| 1,19 s antes de "inútil"@222,82 | começa em 221,49; atinge escala ~1 em 221,89 (0,93 s antes da palavra) | confirmado |
| T7 saída da janela 8 f, encolhe ~0,9 (inf.) | 8–9 f, fade + escala **1 → 0,73** | corrigido |
| T7 vazio de 11 f | 8 f (f2267–f2275) | corrigido |
| T7 entrada 7 f, escala 0,94 → 1, +8 px (360p) | 9–10 f, escala 0,90 → 1, +21 px em 720p (~36 px em 1080p) | corrigido |
| T6: janela nova em fade de 8 f | 8–9 f visíveis, só fade | confirmado |
| #22 match-dissolve ~14 f em 2 estágios | um estágio só, ~11 f (f1137–f1148, 37,9–38,3 s). O "1º estágio" era o fim do morph T4 | corrigido |
| #64 dissolve longo 28 f linear | 26–27 f (298,70–299,57), acelerando (easeInQuad) | confirmado (curva corrigida) |
| #65 / #66 dissolves de 5–6 f | 6 f cada: 0,04 0,17 0,34 0,73 0,88 0,98 e 0,11 0,27 0,46 0,83 0,95 | confirmado |

---

## 2. Valores finais consolidados (especificação)

### 2.1 Geometria dos layouts

| Elemento | % do quadro | px em 1920x1080 |
|---|---|---|
| Janela da gravação | x 3,6–74,5% (70,9% L), y 8,2–87,9% (79,7% A) | x 69–1430, y 88–950 (1361x861); raio ~16; sombra suave |
| PIP (externo, com borda) | x 75,8–97,2% (21,4% L), y 59,2–95,0% (35,8% A) | x 1455–1866, y 639–1026 (411x387); borda branca 6; raio ~26; margem direita e inferior 54 |
| PIP espelhado | x 2,8–24,2%, mesmo y | x 54–465 |
| Janela espelhada | x 26,0–96,9% | x 500–1860 |
| Cartão vertical (externo) | x 73,8–98,1% (24,3% L), y 5,0–95,0% (90% A) | x 1418–1884, y 54–1026 (466x972); borda 6; raio ~31; margem direita 36, topo/base 54 |
| Recorte do PIP | escala 0,55 do footage (1,6x além do cover), centro em (56%, 32%) do footage | — |
| Recorte do cartão | cover (escala 0,90), centro em x≈60% do footage | — |
| Vão janela → PIP | 1,3% L | 26 |

Paper: não é chapado. Centro ≈ rgb(237,232,225), caindo para ≈ rgb(208,203,196) nas bordas (vinheta radial).

### 2.2 Morph do apresentador (T1–T5)

- **27 frames (0,9 s), `Easing.bezier(0.65, 0, 0.35, 1)`**, um único progresso `p` para left/top/width/height, raio, espessura da borda (0 → 6 px) e escala do recorte.
- Progresso por frame (medido, f0..f27): 0 · 0,001 · 0,003 · 0,009 · 0,019 · 0,032 · 0,050 · 0,072 · 0,102 · 0,140 · 0,190 · 0,253 · 0,332 · 0,429 · 0,534 · 0,635 · 0,720 · 0,788 · 0,842 · 0,884 · 0,917 · 0,942 · 0,962 · 0,976 · 0,988 · 0,994 · 0,998 · 1.
- Velocidade máxima no frame 13–14: 8,0% L por frame (153 px/frame em 1080p no T1).
- Camada antiga (overlays, b-roll, janela, pílulas): fica **parada e inteira** até o frame 5–10 do morph (p ≈ 0,05–0,15) e some em corte seco; a camada nova aparece no mesmo frame, já no lugar.
  - Overlays sobre FULL → T1: corte no frame 9 (ou 6–7 em 154,0).
  - B-roll → T1/T3: o b-roll cobre os frames 0–5 (T3) ou 0–8 (T1). Não há frame de FULL.
  - T2 (PIP → FULL): janela e pílulas somem no frame 10 (PIP em 34% L).
  - T5 (PIP → cartão): conteúdo some no frame 4.
- T4 (cartão → FULL): o cartão cresce por cima do conteúdo, que fica parado e é coberto.
- T6 (espelhamento): PIP desliza 72,9% L (1400 px) em **30 frames**, mesma curva; janela antiga em corte, nova em fade de 8–9 f.
- Folha de conteúdo do layout PAPER+CARTÃO: borda vertical em x = 74,1% que entra da esquerda para a direita com a mesma curva de 27 f. No T3 ela coincide com a borda esquerda do cartão; no T5 ela varre sozinha de 0 a 74,1% enquanto o PIP vira cartão.

### 2.3 Rasgo de papel (T8)

- **11 frames**, frente média: 0,7 · 4,8 · 11,3 · 20,7 · 33,6 · 51,4 · 68,6 · 82,0 · 91,4 · 97,8 · 100% L → `Easing.inOut(Easing.quad)` em 11 f.
- Máscara rígida esquerda → direita, borda poligonal dura. Amplitude dos dentes 4,8% L (93 px em 1080p); ~11 dentes na altura (passo médio 9% A = 98 px, irregular de 25 a 47 px em 720p); saltos de 17–54 px entre vértices; o padrão se repete a cada 73% A (790 px em 1080p).
- A máscara precisa percorrer 100% + 4,8% para os dentes saírem do quadro.
- Partindo de PAPER ou TELA: conteúdo some em corte, 4 frames de paper vazio, depois o wipe.

### 2.4 Texto serif palavra a palavra

- Por palavra: **10 frames nominais** (8–9 visíveis), `opacity 0 → 1` com `Easing.bezier(0.65,0,0.35,1)`.
- `translateY`: frase sobre footage **+36 px (3,3% A)**, título no paper **+20 px (1,8% A)**; fica parado ~2 f e desce (série normalizada 1 · 1 · 0,95 · 0,65 · 0,33 · 0,15 · 0,05 · 0).
- `blur`: presente nos 3 primeiros frames, zero a partir do 4º (valor inicial estimado em 8–10 px em 1080p).
- **Stagger 3,5 frames** (0,117 s) entre palavras, ordem de leitura, cruzando a quebra de linha. 4 palavras = 19 f; 5 palavras = 24 f.
- Eyebrow: fade de 10 f, começa 3 f antes da 1ª palavra.
- Gatilho: 1ª palavra no início da frase falada ou na palavra-chave (115,58 vs "exemplos"@115,55); o resto é cascata fixa.
- Saída: fade de 8 f, tudo junto.

### 2.5 Entradas e saídas de elemento

| Elemento | Duração | translateY (1080p) | Escala | Opacidade |
|---|---|---|---|---|
| Pílula | 9–11 f | +26 px (2,4% A) | 0,92 → 1 | 0 → 1 |
| Cartão de grade | 10 f | +51 px (4,7% A) | 1 | 0 → 1 |
| Cartão grande / documento | 9–10 f | +66 px (6,1% A) | 1 | 0 → 1 |
| Ícone-cartão | 10 f | pequeno | 0,85 → 1 | 0 → 1 |
| Título serif único | 7 f | +36 px (3,3% A) | 1 | 0 → 1 |
| Janela (troca T7) | 9–10 f | +36 px | 0,90 → 1 | 0 → 1 |

- Um progresso só para opacidade, Y e escala. Curva sugerida: `Easing.out(Easing.quad)` em 10 f (alternativa equivalente: `Easing.bezier(0.25,0.1,0.25,1)` em 12 f). Sem overshoot.
- Opacidade típica por frame: 0,06 · 0,21 · 0,37 · 0,52 · 0,67 · 0,75 · 0,84 · 0,93 · 0,96 · 1.
- Pílula: inclinação estática de ~1,5°, sombra; a nova entra abaixo e as anteriores não se mexem.
- Gatilho: 1–4 f antes da palavra-chave (não remedido; mantido do relatório original).
- **Saída padrão: 8 f, só opacidade, curva B (11 f nominais)**, todos juntos, quando o fundo continua. Se o layout troca, corte seco dentro do morph (2.2).
- Saída da janela (T7): 8–9 f, fade + escala 1 → 0,73; 8 f de paper vazio; entrada da nova.

### 2.6 Zoom na janela

- **Entrada: 36 frames (1,2 s), `Easing.bezier(0.65,0,0.35,1)`**, escala 1 → 1,22–1,30 (padrão 1,25).
- **Saída: ~27 frames (0,9 s)**, mesma curva, terminando no corte (às vezes cortada em ~1,02).
- `transform-origin` no ponto de interesse, em % da janela: (81, 28), (50, 29), (49, 44), (81, 34), (84, 38), (81, 32). Fixo durante a espera.
- Só a janela escala; PIP e pílulas ficam por cima.

### 2.7 Carimbo

- `scale`: mola de 2,3 → 1 com `{stiffness: 100, damping: 16, mass: 1}`; passa por 1,0 no frame 12, mínimo 0,979 no frame 15, assenta no frame 25.
- `opacity` 0 → 1 em ~10–12 f; `rotate` fixo em −9,3°.
- Tamanho final 27,8% L x 11% A (534x119 px em 1080p), centro em (21,3%, 33,5%).

### 2.8 Dissolves

- Longo (TELA+PIP → FULL): 27 f, acelerando.
- Curto (entrada/saída da gravação crua): 6 f.
- Match-dissolve para b-roll do mesmo cenário: ~11 f.

---

## 3. Detalhes que o 360p escondia

1. **Uma curva só no vídeo inteiro**: morphs, zooms, fades de saída e palavras usam `cubic-bezier(0.65,0,0.35,1)`; só mudam as durações (10 / 11 / 27 / 30 / 36 f). O relatório original tinha quatro curvas diferentes.
2. **Durações redondas em segundos**: 0,9 s (morph, zoom-out), 1,0 s (espelhamento), 1,2 s (zoom-in). As variações de 19–26 f do original eram ruído de limiar.
3. **Overlays ficam parados enquanto o footage encolhe** nos primeiros frames do morph (o título "mods." fica sobre o paper em f128). Não escalam junto.
4. **Não existe o frame de FULL** entre b-roll e morph.
5. **A borda branca do PIP/cartão cresce de 0 a 6 px** junto com o morph.
6. **O PIP tem zoom próprio de ~1,6x no rosto**; o cartão é cover puro.
7. **Folha de conteúdo** com borda em 74,1% que varre da esquerda no T5.
8. **Blur real** na entrada das palavras e leve na entrada das pílulas.
9. **Stagger de 3,5 f** (alternando 4, 3, 4).
10. **Zoom com `transform-origin` deslocado** (até 84% x), não zoom central com pan.
11. **Carimbo** entra de 2,3x (não 1,5x), a −9,3°, com mola subamortecida identificável.
12. **Rasgo**: polígono duro e periódico, sem textura de fibra, sem sombra.
13. **Pílula pode entrar no meio do morph**, por baixo do apresentador (294,2 s).
14. **Pílulas riscadas** (linha sobre o texto) no grupo de 102–114 s; indicador "EXEMPLO 1–6" fixo no canto superior esquerdo, visto de 133 a 222 s por cima de todos os layouts (início e fim exatos não medidos).
15. **Paper com vinheta**, não cor chapada.

---

## 4. O que continua incerto

- **Curva exata de pílulas e cartões**: easeOutQuad, `ease` e easeInOutSine ajustam igual; só está descartado overshoot.
- **Quantidade de blur** das palavras (estimativa visual; a compressão impede medir). Blur nas pílulas só no 1º frame, sem número.
- **Carimbo nos 4 primeiros frames** (f6638–f6645): escala inicial 2,3 vem do ajuste da mola e do olho, não de medida direta; opacidade ali é aproximada.
- **Zoom-out**: duração nominal entre 26 e 30 f (os três medidos têm ruído maior, correlação 0,5–0,6).
- **Escala exata do recorte do PIP** (0,53 e 0,58 em duas medidas) e como ela evolui durante o morph (assumido: mesmo progresso).
- **Raios** medidos pelo perfil do canto, ±3 px em 1080p.
- **Frame exato do corte da camada antiga** varia de 4 a 10 sem regra clara (pode depender de cada cena).
- Não remedidos em 720p (valem os números do original): leads de pílulas/cartões contra a fala, risco coral (#10), moldura de b-roll (#60), cadência dos b-rolls (#14, #22, #44), trecho 301–1035 s e 1035–1110 s além dos dois dissolves, ângulo da inclinação das pílulas (estimado em ~1,5°).
- Áudio/SFX: não mensurável por frame.
