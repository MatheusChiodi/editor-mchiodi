# Movimento e transições — referência max (0–1110 s)

Fonte: `ref.mp4` 640x360 @ 29,97 fps. Tudo medido quadro a quadro com numpy sobre os frames crus
(scripts em `analysis/movimento/*.py`), não só no olho:
- `auto.py` / `m2.py`: opacidade = energia do elemento / energia final; deslocamento = correlação cruzada do perfil de linhas/colunas com o estado final (precisão ±1 px em 360p).
- `m3.py` / `m5.py`: caixa do retângulo do apresentador por frame.
- `misc.py`: progresso de dissolve, frente do wipe, posição do PIP. `zoom.py`: fator de escala por correlação de fase.
- `fit.py`: ajuste da série medida contra curvas candidatas (RMSE).

Convenções: 1 frame = 1/30 s. Pixels são em 360p; **multiplique por 3 para 1080p**. % é do quadro (largura 640 / altura 360).
"Lead" = início da animação menos início da palavra em `ref.words.json` (negativo = entra antes da palavra).
Inferências por causa do 360p estão marcadas com (inf.).

## 0. Mapa de movimento do vídeo

| Trecho | O que acontece em termos de movimento |
|---|---|
| 0–301 s (27%) | Bloco editado: 5 layouts, ~40 trocas de layout, ~60 entradas de elemento, 6 zooms de tela, 8 b-rolls |
| 298,7–301,1 | Dissolve longo para tela cheia e depois dissolve curto para a gravação crua |
| 301–1035 s (66%) | Gravação de tela + PIP fixo. **Zero motion design**: nenhum zoom, nenhuma pílula, nenhum corte com transição. Só 8 rajadas de mudança (trocas de janela do próprio app) |
| 1035,4 | Dissolve de 5 frames para tela cheia |
| 1035–1110 s (7%) | Apresentador em tela cheia, sem nenhum gráfico nem punch-in |

Layouts (medidos):
- **FULL**: footage 100%.
- **TELA+PIP**: janela da gravação x 3,8–74,4% / y 8,3–87,8% sobre fundo paper; PIP 134x128 px = 21% L x 35,5% A, canto inferior direito (margem direita 3,1%, inferior 5,5%), borda clara ~2 px, raio ~8 px. Pílulas empilham na coluna direita (x 75–96%, y 15–30%).
- **TELA+PIP espelhado** (169,8–186): janela à direita, PIP no canto inferior esquerdo.
- **PAPER+CARTÃO**: cartão vertical do apresentador x 74,2–97,8% (23,7% L) / y 5,5–94,5% (89% A), proporção ~0,475; conteúdo (eyebrow, título, cartões, pílula) em x 5–69%.
- **B-ROLL**: clipe ilustrado em tela cheia, pílulas no canto (inferior esquerdo ou superior esquerdo).

## 1. Tabela de eventos medidos

| # | t (s) | Tipo | Dur. frames / s | Propriedades animadas | Distância | Curva | Stagger / gatilho |
|---|---|---|---|---|---|---|---|
| 1 | 0,30 | Título serif grande "mods." sobre footage | 7 / 0,23 | opacidade 0→1; y | +16 px (4,4% A) → 0 | ease-in-out (easeInOutQuad, RMSE 0,02); série dy 16,15,11,6,3,1,0 | lead +0,09 s sobre "mods"@0,21 |
| 2 | 1,03 | Pílula branca abaixo do título | 9 / 0,30 | opacidade; y; escala (inf.) | +9 px (2,5% A) | desacelera suave, sem overshoot | lead −0,04 s sobre "atualização"@1,07; 22 frames depois do título |
| 3 | 1,45 | Cartão escuro com fita (recorte de tela) | 10 / 0,33 | opacidade; y | +19 px (5,3% A) | desacelera (19,16,14,10,7,5,3,2,1) | 12 frames depois da pílula |
| 4 | 4,10–4,87 | **FULL → TELA+PIP** | 23 / 0,77 | retângulo do apresentador: posição + tamanho + proporção 1,78→1,05 (recorte tipo cover); cantos arredondam | x1 0→486 px, y1 0→212 px | cubic-bezier(0.4,0,0.2,1); pico de velocidade a ~40% | overlays do FULL somem em corte seco no frame 1; janela já aparece no lugar |
| 5 | 9,90–11,37 | Zoom-in na gravação | 44 / 1,47 | escala 1→1,30 da janela (PIP e pílulas não escalam) | foco deslocado (−21,+21) px | ease-in-out simétrico (sino) | começa em "mudar o sistema"@9,98 |
| 6 | 11,92 | Pílula coral na coluna direita | 9 / 0,30 | opacidade; y | +7 px | desacelera | lead −0,10 s sobre "personalizada"@12,02 |
| 7 | 12,63–13,5 | Zoom-out na gravação | 27 / 0,90 | escala 1,30→1 | — | ease-in-out | segurou só 1,25 s; termina no corte |
| 8 | 13,3–14,08 | **TELA+PIP → FULL** | ~23 / 0,77 | PIP cresce ancorado no canto inferior direito até 100%; janela e pílula somem em corte seco em 13,51, com o PIP já em 34% | largura 134→640 px | cubic-bezier(0.4,0,0.2,1); incrementos 30,36,46,52,53,47,37,30,24,19,15,10,8,7,4,3,1 | começa no fim de "você."@12,98 |
| 9 | 14,90 | Ícone-cartão "terminal" sobre footage | 8 / 0,27 | opacidade; y pequeno | ~+6 px | desacelera | lead −0,50 s sobre "abrir"@15,40 |
| 10 | 15,87 | Risco coral atravessando o ícone | 8 / 0,27 | traço desenhado da esquerda p/ direita (máscara/stroke-dashoffset) | ~110 px em diagonal | quase linear, leve desaceleração | lead +0,03 s sobre "terminal"@15,84 |
| 11 | 15,93 | Pílula coral sob o ícone | 11 / 0,37 | opacidade; y | +8 px | desacelera | 2 frames depois do início do risco |
| 12 | 17,93 | Saída de ícone + pílula (juntos) | 7 / 0,23 | só opacidade 1→0 | 0 | quase linear | sem stagger; termina 6 frames antes do wipe |
| 13 | 18,37–18,67 | **Wipe papel rasgado FULL → B-ROLL** | 10 / 0,33 | máscara com borda serrilhada varrendo esquerda→direita | 100% L; dente da borda ~40–60 px (6–9% L) | ease-in-out (5,11,20,34,52,68,82,92,98,100%) | em "Basta"@18,42 |
| 14 | 18,8–23,2 | B-roll "stop motion" | — | clipe atualiza a cada 5 frames (6 fps) | — | degraus | pílulas entram por cima em 30 fps |
| 15 | 23,30–24,00 | **B-ROLL → FULL (corte seco) → PAPER+CARTÃO** | 22 / 0,73 | retângulo do apresentador: x1 22→475 px; altura 100%→89%; proporção 1,78→0,475 | 453 px (71% L) | cubic-bezier(0.4,0,0.2,1), RMSE 0,035 | em "Até aqui"@23,32 |
| 16 | 23,63–24,4 | Título serif no paper, palavra a palavra | 7 por palavra; frase toda ~23 / 0,77 | por palavra: opacidade + y | +6 a +8 px | ease-in-out | stagger 3–4 frames entre palavras; começa com o morph a ~50% |
| 17 | 30,23 | Cartão 1 (ícone + rótulo) | 7 / 0,23 | opacidade; y | +14 px (3,9% A) | desacelera (14,10,8,5,4,2,1) | lead −0,08 s sobre "skills"@30,31 |
| 18 | 31,23 | Cartão 2 | 7 / 0,23 | idem | +13 px | idem | lead −0,04 s sobre "conectores"@31,27 |
| 19 | 33,33 | Cartão 3 | 8 / 0,27 | idem | +13 px | idem | lead 0,00 s sobre "ferramentas"@33,33 |
| 20 | 34,60 | Pílula-resumo sob os cartões | 11 / 0,37 | opacidade; y; escala ~0,93→1 (inf.); texto parece entrar desfocado (inf.) | +8 px | desacelera | lead −0,23 s sobre "definia"@34,83 |
| 21 | 37,10–37,75 | **PAPER+CARTÃO → FULL** | ~20 / 0,67 | cartão cresce para a esquerda cobrindo o conteúdo, que fica parado (sem saída) | x1 469→0 px | mesma bezier (acelera suave, cauda longa) | em "documentos."@37,09 |
| 22 | 37,73–38,2 | Dissolve "match" FULL → b-roll 3D do mesmo cenário | ~14 / 0,47 | cross-fade em 2 estágios (0→65% em 5 frames, platô, →100%) | — | irregular | b-roll roda a ~4,3 fps (passo de 7 frames) |
| 23 | 43,51–44,07 | **B-ROLL → FULL (corte) → PAPER+CARTÃO** | ~20 / 0,67 | idem #15 | idem | idem | em "Pode"@43,52 |
| 24 | 46,32 | Cartão 2 da 2ª grade | 9–13 | opacidade; y | +17 px | desacelera | lead −0,05 s sobre "alterar"@46,37 |
| 25 | 48,42 | Cartão 3 da 2ª grade | 9 / 0,30 | opacidade; y | +16 px | desacelera | lead −0,09 s sobre "criar"@48,51 |
| 26 | 52,93–53,85 | **PAPER+CARTÃO → FULL** | ~26 / 0,87 | idem #21 | x1 474→0 | bezier, entrada mais lenta | em "desktop, por exemplo" |
| 27 | 56,77–57,32 | Frase grande em 2 linhas sobre footage, palavra a palavra | 7 por palavra; total 16 / 0,53 | por palavra: opacidade + y; última palavra em itálico coral | +11 px (3% A) | ease-in-out | stagger 2,5–4 frames; **termina 0,27 s antes de "abrir"@57,54 e 0,67 s antes de "terminal"@57,94** |
| 28 | 60,33 | Saída do texto grande + pílula | 7 / 0,23 | só opacidade | 0 | quase linear | sai tudo junto, 4 frames antes do morph |
| 29 | 60,46–61,16 | **FULL → TELA+PIP** | ~21 / 0,70 | idem #4 | idem | idem | em "Na aba do Code"@60,74 |
| 30 | 63,58 | Pílula 2 empilhando na coluna direita | 9 / 0,30 | opacidade; y; escala ~0,93→1 (inf.) | +9 px | desacelera | lead −0,12 s sobre "descrever"@63,70; pílula 1 não se mexe |
| 31 | 68,70–69,74 | Zoom-in na gravação | 31 / 1,03 | escala 1→1,22 | foco (+15,+15) px | sino simétrico | em "o próprio sistema"@68,63 |
| 32 | 74,27–75,18 | Zoom-out | 27 / 0,90 | 1,22→1 | — | sino | segurou 4,5 s |
| 33 | 75,35–75,61 | Janela da gravação sai | 8 / 0,27 | opacidade 1→0 + encolhe (~0,9, inf.) | — | acelera | PIP e pílulas ficam |
| 34 | 75,98–76,22 | Nova janela entra | 7 / 0,23 | opacidade; escala 0,94→1; y | +8 px | desacelera | 11 frames de paper vazio entre as duas |
| 35 | 77,61 | Corte seco: janela + 3 pílulas somem | 0 | — | — | corte | PIP permanece |
| 36 | 77,82 | Cartão "documento" com fita entra | 9 / 0,30 | opacidade; y | +20 px (5,5% A) | desacelera | lead −0,09 s sobre "É um pedido"@77,91 |
| 37 | 85,38–86,05 | **PIP → CARTÃO vertical** | 20 / 0,67 | retângulo 134x128 @ (486,212) → 152x320 @ (475,20) | topo sobe 192 px (53% A) | bezier (3,4,6,7,9,11,15,18,20,20,17,14,11,9,7,5,4,3,2,2,1) | conteúdo anterior some em corte seco no frame 1 |
| 38 | 89,08 / 90,58 | Dois cartões comparativos | 9 / 0,30 cada | opacidade; y | +13 / +12 px | desacelera | leads −0,06 ("terminal"@89,14) e −0,12 ("app"@90,70) |
| 39 | 91,89→92,03→92,4 | Conteúdo some em corte seco; 5 frames de paper vazio; **wipe rasgado** | 0 + 5 + ~10 | máscara serrilhada esq.→dir.; cartão é o último a ser coberto | 100% L | ease-in-out | — |
| 40 | 94,78 | Pílula sobre b-roll | 9 / 0,30 | opacidade; y | +8 px | desacelera | — |
| 41 | 102,00 | **B-ROLL → FULL** | 0 | corte seco | — | — | sempre assim (também 151,18; 217,98; 242,31) |
| 42 | 102,98 / 105,32 / 106,9 / 108,15 | 4 pílulas empilhando à esquerda sobre footage | 9 / 0,30 cada | opacidade; y | +9 a +10 px | desacelera | uma por frase; as anteriores não se mexem |
| 43 | 114,37–115,6 | Frase grande "N exemplos / na prática" | 8 por palavra | opacidade (+ y pequeno) | — | ease-in-out | lead −0,5 s sobre "Vou dar alguns exemplos"@114,91 |
| 44 | 127,49 | **FULL → B-ROLL** | 0 | corte seco (sem wipe) | — | — | b-roll a 10 fps (passo de 3 frames) |
| 45 | 133,30–134,0 | B-ROLL → FULL (corte) → TELA+PIP | ~20 | idem #4 | — | bezier | — |
| 46 | 134,50–135,57 | Zoom-in | 32 / 1,07 | 1→1,30 | foco (+22,+7) px | sino | lead 0,00 s sobre "ação"@134,50 |
| 47 | 140,67–141,27 | Zoom-out | 18 / 0,60 | 1,30→1 | — | sino | segurou 5,1 s; acaba 4 frames antes do corte |
| 48 | 141,41→141,5→141,8 | Janela some em corte; PIP fica sobre paper; wipe rasgado cobre tudo | 0 + ~3 + 10 | máscara | — | — | — |
| 49 | 151,33 / 153,5 | Pílula entra / sai sobre footage | 9 entra; 8 sai | entra: opacidade + y +7; sai: opacidade + y −3 | — | entra desacelera; sai acelera | — |
| 50 | 157,86–158,93 | Zoom-in | 32 / 1,07 | 1→1,26 | (−17,+14) px | sino | lead +0,5 s sobre "histórico"@157,37 |
| 51 | 169,80–170,57 | **Espelhamento do layout**: janela antiga some em corte, nova entra em fade (8 frames) à direita; PIP desliza p/ o canto esquerdo | 22 / 0,73 | PIP: x | 480 px (75% L) | bezier (16,23,28,33,40,42,44,40,32,26,20,18,12,11,9,7,4,3,3,1) | PIP começa a andar junto do fade |
| 52 | 174,97–176,61 | Zoom-in | 49 / 1,63 | 1→1,26 | (−55,+10) px | sino | lead +0,06 s sobre "painel"@174,91 |
| 53 | 185,99–186,7 | TELA+PIP (esq.) → FULL | 22 / 0,73 | PIP cresce do canto inferior esquerdo | — | bezier | — |
| 54 | 186,67–187,0 | Pergunta grande palavra a palavra | 7 por palavra; ~10 total | opacidade + y | — | ease-in-out | lead +0,4 s sobre "e agora"@186,28 (aqui chega atrasada) |
| 55 | 200,67–201,74 | Zoom-in | 32 / 1,07 | 1→1,26 | (−17,+16) px | sino | lead +0,2 s sobre "definindo"@200,47 |
| 56 | 221,63–222,03 | **Carimbo** vermelho inclinado (~−6°) | 6–7 de impacto + 3 de assentamento | escala ~1,5→0,97→1,0; opacidade 0→1 nos 4 primeiros frames; rotação fixa | — | acelera na queda + pequeno undershoot (único overshoot do vídeo) | **1,19 s antes** de "inútil"@222,82 (cai em "esdrúxulo"@221,72) |
| 57 | 230,56–231,0 | Wipe rasgado FULL → B-ROLL | ~13 / 0,43 | máscara | — | ease-in-out | — |
| 58 | 245,62 | Pílula 2 + seta para baixo | 9 / 0,30 | opacidade; y | +8 px | desacelera | — |
| 59 | 253,33 | Saída das pílulas | 7 / 0,23 | só opacidade | 0 | quase linear | 1 frame antes do morph |
| 60 | 253,59–254,3 | FULL → PAPER+CARTÃO + moldura de b-roll à esquerda | 22 + 12 | cartão: bezier; moldura: opacidade + escala (inf.) | — | — | moldura entra com o morph a ~50% |
| 61 | 268,41 … 276,56 | Grade de 6 cartões pequenos | 8 / 0,27 cada | opacidade; y | +16 a +17 px | desacelera | leads −0,21 / +0,09 / −0,05 / +0,03 / −0,08 / −0,05 s sobre a palavra de cada item |
| 62 | 277,48–277,75 | PAPER+CARTÃO → FULL | ~19 | idem #21 | — | bezier | — |
| 63 | 293,55–294,12 | Saída de 3 pílulas | 17 / 0,57 | só opacidade (lenta) | 0 | linear | juntas |
| 64 | 298,70–299,6 | **Dissolve longo** TELA+PIP → FULL | 28 / 0,93 | cross-fade | — | linear | único dissolve longo |
| 65 | 300,90–301,07 | Dissolve FULL → gravação crua | 5–6 / 0,18 | cross-fade (0,19 0,36 0,72 0,90 0,98) | — | — | em "ver isso"@300,69 |
| 66 | 1035,40–1035,53 | Dissolve gravação crua → FULL | 5 / 0,17 | cross-fade (0,13 0,27 0,43 0,83 0,95) | — | — | — |

## 2. Gramática de movimento

Tudo no vídeo sai de quatro receitas. Valores em 1080p / 30 fps.

**A. Entrada de elemento (pílula, cartão, ícone, moldura)** — a mesma para tudo, só muda a distância:
- Pílula: **9 frames**, `translateY +24 px → 0`, `opacity 0 → 1`, `scale 0,93–0,96 → 1` (inf.), rotação estática ~−1°.
- Cartão de grade: **7–9 frames**, `translateY +40 px → 0` (cartões pequenos +48), `opacity 0 → 1`.
- Cartão grande (recorte de tela, documento): **9–10 frames**, `translateY +57–60 px → 0`.
- Curva: um único progresso dirige opacidade e posição. Ajusta melhor a uma mola criticamente amortecida, **sem overshoot**: `spring({frame, fps, config:{mass:1, stiffness:170, damping:26}})` (RMSE 0,03) para 8 frames; `stiffness:120, damping:20` para 11 frames. Aproximação com easing: `interpolate(f,[0,9],[0,1],{easing:Easing.bezier(0.25,0.1,0.25,1)})`. Série típica de opacidade: 0,07 0,20 0,36 0,53 0,66 0,78 0,87 0,94 1; de y: 13 11 9 7 5 3 2 1 0 px (360p).
- Gatilho: começa **1–4 frames antes** do início da palavra-chave (mediana −0,06 s), então está ~40% visível quando a palavra começa.
- Irmãos não têm stagger fixo: cada um espera a própria palavra (intervalos reais de 1,0–2,2 s). Quando entram na mesma frase, a defasagem é 12–22 frames.
- Empilhamento: a pílula nova entra abaixo; as anteriores **não se reposicionam**.

**B. Texto serif (título no paper e frase grande sobre footage)** — por palavra:
- **7 frames por palavra**, `opacity 0 → 1`, `translateY +33 px → 0` (frase grande) ou `+20 px` (título no paper), easing `Easing.inOut(Easing.quad)`.
- **Stagger 3–4 frames** entre palavras (0,10–0,13 s). Frase de 4 palavras completa em ~16 frames; título de 5 palavras em ~23.
- A palavra de ênfase muda de cor e fonte (itálico coral), não de movimento.
- Não segue a fala: é uma cascata de tempo fixo disparada no começo da frase.

**C. Saída de elemento:**
- **7 frames**, só `opacity 1 → 0`, sem deslocamento (um caso com −9 px), todos juntos, 1–6 frames antes da troca de layout.
- Só existe quando o fundo continua (footage segue). Se o fundo troca, os elementos **somem em corte seco** no primeiro frame da transição.

**D. Troca de layout (o retângulo do apresentador):**
- **20–23 frames (0,67–0,77 s)**, `cubic-bezier(0.4, 0, 0.2, 1)`, interpolando `left/top/width/height` do contêiner com o vídeo em `object-fit: cover` (a proporção muda continuamente: 1,78 ↔ 1,05 ↔ 0,475) e o raio dos cantos 0 ↔ ~24 px.
- Sem overshoot, sem blur, sem fade no apresentador.

**Não há no vídeo:** mola com overshoot (só o carimbo), blur de movimento, rotação animada, parallax, entrada lateral, stagger de letras, contadores numéricos.

## 3. Catálogo de transições

O apresentador nunca corta entre layouts: **ele é sempre o mesmo retângulo que muda de forma**. Tudo o mais aparece ou some em volta dele. O estado FULL funciona como "hub": b-roll → cartão passa por 1 frame de FULL.

**T1. FULL → TELA+PIP** (4,10; 60,46; 133,30; 153,95; 198,70; 294,16) — 21–23 frames
1. f−7…f−1 (quando há overlay): overlays fazem fade-out de 7 frames.
2. f0: fundo paper + janela da gravação aparecem em corte seco, já no lugar, atrás do apresentador.
3. f0–f22: retângulo do apresentador encolhe ancorado no canto inferior direito: 100% → 21% L x 35,5% A; ganha borda clara e cantos arredondados; proporção 1,78 → 1,05.
4. ~f25+: primeira pílula entra na coluna direita.
Uso: sempre que vai mostrar o app.

**T2. TELA+PIP → FULL** (13,3; 185,99) — ~23 frames
1. f0: PIP começa a crescer por cima da janela.
2. ~f6 (PIP em ~34% L): janela e pílulas somem em corte seco.
3. até f22: PIP chega a 100%, cantos voltam a 0.
Uso: volta para fala direta. Em 185,99 o PIP parte do canto esquerdo.

**T3. FULL → PAPER+CARTÃO** (23,30; 43,51; 253,59) — 22 frames
1. f0: paper aparece atrás.
2. f0–f22: retângulo recorta para a direita: x1 0 → 74% L; altura 100% → 89%; proporção → 0,475.
3. f10 (morph a ~50%): eyebrow e primeira palavra do título começam; título completo em ~f33.
4. Cartões entram depois, um por palavra-chave.
Uso: blocos de conceito/lista.

**T4. PAPER+CARTÃO → FULL** (37,10; 52,93; 277,48) — 19–26 frames
Cartão cresce para a esquerda e **cobre** título e cartões, que ficam parados (nenhuma saída). Uso: fim do bloco de lista.

**T5. PIP → CARTÃO** (85,38) — 20 frames
f0: janela e pílulas somem em corte seco. PIP cresce para cima: 134x128 → 152x320 px, topo sobe 53% A. Depois entram eyebrow, título e cartões. Uso: da tela direto para um conceito, sem passar por FULL.

**T6. Espelhamento TELA+PIP** (169,80) — 22 frames
f0: janela antiga some em corte. f1–f8: janela nova entra em fade à direita. f1–f22: PIP desliza 75% L para o canto inferior esquerdo. Uso: quando o conteúdo importante da tela está no lado onde o PIP ficaria.

**T7. Troca de conteúdo da janela, mesmo layout** (75,35 → 76,22) — 8 + 11 + 7 frames
Janela sai (fade + encolhe) em 8 frames; 11 frames de paper vazio com PIP e pílulas parados; janela nova entra (fade + escala 0,94→1 + y +24 px) em 7 frames. Uso: trocar de gravação.

**T8. Wipe de papel rasgado → B-ROLL** (18,37; 92,03; 141,5; 230,56) — 10–13 frames
Máscara com borda serrilhada varre da esquerda para a direita com ease-in-out; o que estiver na direita (cartão, PIP) é coberto por último. Quando parte de PAPER ou TELA, o conteúdo some em corte seco 3–5 frames antes e o wipe passa sobre paper vazio. Uso: entrada de b-roll ilustrado (4 de 8).

**T9. Corte seco**
- FULL → B-ROLL em 127,49 e 207,51 (sem wipe).
- B-ROLL → FULL **sempre** (102,00; 151,18; 217,98; 242,31) e B-ROLL → FULL → morph (23,30; 43,51; 133,30; 198,70).
- Remoção de conteúdo antes de T5/T8.

**T10. Dissolves**
- Match-dissolve FULL → b-roll 3D do mesmo cenário (37,73), ~14 frames.
- Dissolve longo de 28 frames TELA+PIP → FULL (298,70).
- Dissolves de 5 frames entrando e saindo da gravação crua (300,90 e 1035,40).

**Resposta direta:** o apresentador **encolhe/cresce animado** em todos os casos (T1–T6), nunca corta e nunca faz cross-fade entre layouts. Corte seco só aparece ao voltar de b-roll, e dissolve só nas bordas do bloco de gravação crua.

## 4. Zooms e reenquadramentos

Só existem no bloco editado (0–301 s). Seis zooms, todos na janela da gravação; **nenhum no footage do apresentador** (sem punch-in em todo o vídeo).

| t in | Fator | Dur. in | Segura | Dur. out | Gatilho |
|---|---|---|---|---|---|
| 9,90 | 1,30 | 44 f | 1,25 s | 27 f (cortado pela transição) | resposta aparece na tela |
| 68,70 | 1,22 | 31 f | 4,5 s | 27 f | "o próprio sistema" |
| 134,50 | 1,30 | 32 f | 5,1 s | 18 f | modal abre ("ação") |
| 157,86 | 1,26 | 32 f | 10,0 s | 23 f | painel lateral ("histórico", +0,5 s) |
| 174,97 | 1,26 | 49 f | 8,7 s | 18 f | "painel" |
| 200,67 | 1,26 | 32 f | 5,0 s | 18 f | "definindo" (+0,2 s) |

- Padrão: **escala 1,25–1,30, 32 frames (1,07 s) para entrar, 18–27 para sair**, curva em sino simétrica (`Easing.inOut(Easing.sin)` ou `quad`).
- Só a janela escala; PIP e pílulas ficam fixos por cima. A janela zoomada passa por baixo do PIP e sai do quadro.
- Foco: deslocamento de apenas 15–22 px (2–6% do quadro) em direção à área ativa. **Não segue o cursor** e não reenquadra durante a espera.
- O zoom-out termina 0,1–0,6 s antes de sair da cena: quase 1 s de movimento gasto logo antes do corte.
- Em 301–1035 s (gravação crua, 12 minutos) não há nenhum zoom nem destaque, com texto de interface minúsculo.
- B-rolls: sem pan/zoom adicionado; o movimento é do próprio clipe, em cadência de degraus (6 fps em 18,8 s; ~4,3 fps em 38 s; 10 fps em 127, 190, 207 e 231 s).

## 5. Texto

- **Título no paper** (23,6; 43,9; 86,7; 260,6): eyebrow pequeno em caixa alta entra primeiro; depois as palavras em cascata, 7 frames cada, stagger 3–4 frames, `opacity + translateY 20 px`. A palavra em itálico coral entra na ordem normal. Título de 5 palavras pronto em ~0,77 s.
- **Frase grande sobre footage** (56,8; 114,4; 186,7): mesma cascata com `translateY 33 px`; 2 linhas; última palavra em itálico coral. As palavras parecem entrar levemente desfocadas (inf.; em 360p não dá para separar blur de transparência).
- **Sem máscara de linha, sem letra a letra, sem digitação.**
- **Relação com a fala:** a cascata tem tempo fixo e é disparada no começo da frase, então **o texto termina antes de ser dito**:
  - 56,77–57,32 completo; a fala só diz "abrir" em 57,54 e "terminal" em 57,94.
  - 23,63–24,40 completo; a fala diz "personalizava" em 24,26, "como" em 25,98 e "trabalhar" em 27,53 (até 3 s de antecedência).
  - 186,67: aqui chega 0,4 s **depois** de "e agora"@186,28.
- Pílulas e cartões, ao contrário, são sincronizados palavra a palavra (lead mediano −0,06 s).
- Texto digitado dentro da gravação (5,8–8,5 s) é do próprio app, a cada ~14 frames, não é efeito de edição.
- Saída do texto: fade de 7 frames, tudo junto.

## 6. Como fazer melhor

1. **66% do vídeo sem movimento (301–1035 s).** É o trecho mais difícil de ler e o menos tratado. Melhoria: aplicar a própria gramática do bloco inicial — zoom 1,3–1,6 seguindo o cursor a cada ação, realce da área clicada, pílula de passo ("passo 2 de 5"), cartão de capítulo nas 5 viradas (353, 452, 660, 814, 944 s) e 1 b-roll ou tela cheia a cada ~60 s.
2. **Texto grande fora de sincronia com a fala** (adianta 0,3–3 s; uma vez atrasa 0,4 s). Melhoria: cada palavra entra em `words[i].start − 2 frames`, mantendo os 7 frames; se o intervalo entre palavras for menor que 3 frames, cair no stagger fixo.
3. **Carimbo 1,19 s antes da palavra** (221,63 vs "inútil"@222,82). Melhoria: impacto no frame de início da palavra, com 2 frames de antecipação no máximo.
4. **Elementos que somem em corte seco** (4,07; 13,51; 77,61; 85,39; 91,89; 141,41). Melhoria: saída de 5 frames com stagger invertido de 2 frames (último a entrar sai primeiro), `opacity → 0`, `translateY −16 px`, `scale → 0,97`, `Easing.in(Easing.cubic)`, terminando no frame anterior ao morph.
5. **Buracos de paper vazio**: 11 frames entre duas janelas (75,61–75,98) e 3–5 frames antes de cada wipe. Melhoria: sobrepor saída e entrada em 4 frames (janela nova entra por cima escalando de 0,96), e começar o wipe no mesmo frame em que o conteúdo sai.
6. **Volta do b-roll sempre em corte seco**, enquanto a ida tem wipe. Melhoria: wipe invertido (direita → esquerda, 8 frames) ou cortar no acento da fala e iniciar o morph no mesmo frame.
7. **Uma única receita de entrada para tudo** (fade + subida, sem overshoot): depois de 60 repetições fica mecânico. Melhoria: 3 níveis — (a) pílula: como está, 9 frames; (b) cartão: mola com 4–6% de overshoot (`damping 14, stiffness 180`) e sombra crescendo; (c) elemento-herói (carimbo, número, frase): escala + máscara de linha, 12 frames.
8. **Cartões cobertos sem saída em T4.** Melhoria: grade sai em cascata de 2 frames enquanto o cartão cresce, ou o conteúdo desliza 5% para a esquerda com fade junto do morph.
9. **Pílulas empilhadas não reagem** à nova. Melhoria: ao entrar uma pílula, as anteriores cedem 4–6 px e caem para 70% de opacidade, deixando claro qual é a atual.
10. **Zoom sem foco real**: fator fixo ~1,26, centro quase no meio, não segue cursor. Melhoria: âncora do zoom no ponto de interesse (transform-origin no bounding box do elemento ativo), fator escolhido para o alvo ocupar ~60% da largura, e pan suave quando o foco muda durante a espera.
11. **Zoom-out desperdiçado antes do corte** e espera curta (1,25 s no primeiro). Melhoria: cortar ainda em zoom (sem zoom-out) quando a cena acaba; espera mínima de 2,5 s.
12. **Sem punch-in no apresentador.** 75 s finais e vários trechos de FULL sem nenhum reenquadramento. Melhoria: punch-in 1,00 → 1,08 em corte seco nas frases de ênfase, e push lento 1,00 → 1,04 em falas acima de 8 s.
13. **Saídas lineares e desiguais** (7 frames na maioria, 17 frames em 293,55). Melhoria: saída padrão única de 6 frames com ease-in.
14. **Duas transições seguidas em 2,3 s** (dissolve de 28 frames em 298,70 e outro em 300,90), a primeira lenta e lavada. Melhoria: um único morph T2 seguido de corte no acento.
15. **Cadência do b-roll inconsistente** (6, ~4,3 e 10 fps). Melhoria: padronizar em 12 fps ("em dois") para parecer estilo e não engasgo.
16. **Layout fixo durante o morph**: o apresentador é o único a se mover. Melhoria: a janela da gravação entra junto, escalando 0,96 → 1 com 6 frames de atraso, e as pílulas existentes acompanham com 2 frames de stagger.
