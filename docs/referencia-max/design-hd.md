# Design visual da referência — conferência em 720p

Fonte: `ref-hd.mp4` 1280x720, 29,97 fps, H.264 ~926 kbps. Revisa `analysis/design.md` (feito em 360p).
Método: frames extraídos um a um para `analysis/design-hd/` (`f<seg>.png`, zooms `z*.png`, folhas `ovA/ovB/ovC.jpg`, `end_sheet.jpg`); medidas por pixel com numpy (`hd.py`, `m*.py`): mediana de região, bordas por limiar, ajuste de raio de canto, regressão das bordas superior/inferior para ângulo.
Conversão: px@1080 = px@720 × 1,5. Erro típico: ±1 px@720 (±1,5 px@1080) em geometria, ±3 por canal em cor chapada, ±0,2° em ângulo.
"Tamanho de fonte" é derivado (altura-x ou altura de caixa alta ÷ proporção da família presumida); a medida dura é a altura-x / caixa alta, dada junto.

## 1. Afirmação original → 720p → veredito

### Paleta
| Afirmação (360p) | Medido em 720p | Veredito |
|---|---|---|
| Paper topo `#ede8e1` | `#ede8e1` no centro e topo-centro (35 s, 7 s, 83 s, 90 s) | confirmado |
| Paper base `#d9d4cd`, "degradê vertical de ~8 %" | Base-centro `#e0dad4`–`#e7e2db` (2,5–5 % mais escuro); `#d9d5cb` só no canto inferior esquerdo. Cantos superiores `#dfdad3`. É **vinheta radial (~6–9 % nos cantos) + leve escurecimento na base**, não degradê vertical puro | corrigido |
| Coluna direita `#d1ccc7→#dad5d0`, "emenda em x≈74 %" | Emenda existe em x=950@720 (74,2 %), mas é só um degrau de +2–3 níveis (`#f0ebe6` à direita vs `#ede8e1`). O tom escuro da coluna é a **sombra do cartão do apresentador** (até 26 % de escurecimento logo abaixo dele) | corrigido |
| Cremes das cenas de papel `#f4ede6`, `#f5ebe5`, `#eee5d8`, `#e0d7c2` | 21 s `#f4ede6`; 101 s `#ebe2d4`; 131 s `#e7ded1`–`#f3eae2`; 149 s `#ede4d7`–`#f2ebe1`; 237 s `#ece2d6`; 261 s `#fcf3e6`; 41 s `#fcf3e6` com chão pêssego `#ffe0be` | confirmado (faixa `#e7ded1`–`#fcf3e6`) |
| Cartão / pílula branca `#faf8f4`–`#fcfaf5` | `#faf8f4` (cartão, pílula, moldura do doc) | confirmado |
| Ladrilho do ícone `#f6efe8` | Borda do ladrilho `#f5ece3`, miolo `#ede3d1` (é a própria foto do recorte, não uma cor chapada) | corrigido |
| Janela mock `#131310`, lateral `#1a1816` | `#131310` / `#1a1816` | confirmado |
| Fundo da gravação `#19201f` → `#0d1211` | `#19201f` → `#0c1110` | confirmado |
| Janela gravada `#1e1e1c` | `#141414` (conteúdo), `#111111` (lateral) | corrigido |
| Ink `#131311` | `#13120e` (mediana do título), núcleo `#000` | confirmado |
| Coral `#e47d53` | `#e27e54` (preenchimento de 5 pílulas: `#e07e56`–`#e37e55`; itálico `#e47c50`) | confirmado |
| Vermelho `#cb4e36` | Pílula `#c84f37`, carimbo `#c44e3b`, tachado `#bd503a` | confirmado |
| Verde `#79865c` | `#78865c` | confirmado |
| Chip "EXEMPLO" `#44413a` | `#4a4640` sobre paper (some sobre janela escura → é translúcido) | confirmado |
| Azul do mock `~#5b8fe8` | não reamostrado | não verificável aqui |
| Sombra "preto 18–25 %" | Depende do componente: cartão de ícone 12 %, miniatura 22 %, janela 21 %, doc 25 %, cartão do apresentador 26 %, PIP 30 % (escurecimento logo abaixo da borda) | corrigido (ver §2.4) |
| Borda do apresentador `#ffffff`, "único branco puro" | `#fcf8f4`–`#fffaf5` (pico `#fffdf8`): **branco quente**, não puro | corrigido |
| Footage: parede `#211c1b`, cantos `#252427` / `#171717`, lâmpada `#fff` | `#252427` / `#171717` / `#ffffff` | confirmado |
| Sem scrim | Nada mensurável atrás das pílulas; canto do footage 58 s `#1f1e21` vs `#252427` no fim, mas o enquadramento muda | não verificável (provável) |

### Tipografia
| Afirmação (360p) | Medido em 720p | Veredito |
|---|---|---|
| Serifada transicional de alto contraste (Tiempos Headline / Newsreader) | Formas batem com Tiempos Headline: terminais em gota em "a", "r", "c"; "z" com diagonal fina; itálico cursivo verdadeiro. Peso semibold (romano) / medium–semibold (itálico) | confirmado como classe; família exata segue inferência |
| Palavra de canto ~185 px / 17 % | Altura-x 99 px (9,2 %), ascendente→linha de base 141 px (13,1 %), largura 502 px (26 %). Fonte derivada ≈ 205–210 px (19 %) | corrigido |
| Frase grande 110–128 px, entrelinha 1,02 | "Sem abrir / o terminal.": caixa alta 96 px, altura-x 66 px, passo de linha 132 px → fonte ≈ 140 px (13 %), entrelinha **0,94**. "6 exemplos / na prática": altura-x 57 px, passo 111 px → ≈ 121 px (11,2 %), entrelinha 0,92 | corrigido |
| Título de painel 78–90 px, entrelinha 1,03 | 3 cartões: caixa alta 65 px, altura-x 47 px, passo 94,5 px → ≈ 98 px (9,1 %), entrelinha **0,96**. 6 cartões: passo 82,5 px → ≈ 86 px (8 %) | corrigido |
| Eyebrow ~27 px, bold, tracking +0,18 em | Caixa alta 16–17 px → fonte ≈ 23 px (2,1 %); vão entre letras 5–7 px@720 → tracking ≈ **+0,25 a +0,30 em**; peso 600–700 | corrigido |
| Pílula 30–32 px semibold; pequena 27 px | Padrão: altura-x ≈ 17 px → ≈ 31–33 px (3 %). Compacta: ≈ 27 px. Mini lateral: ≈ 24 px. Árvore: ≈ 36 px. Peso parece 700 no zoom | confirmado (tamanho); peso incerto |
| Rótulo de cartão 30 px / 22 px, semibold | Caixa alta 22 px → 30 px; grade de 6: 21–22 px, passo de linha 27 px (1,23) | confirmado |
| Rótulo de miniatura 34 px bold | ≈ 33–34 px | confirmado |
| Chip de progresso 17–18 px | Caixa alta 15 px → ≈ 20 px (1,9 %) | corrigido |
| Mono 42 px na pílula "harness" | ≈ 42 px, bold | confirmado |
| Carimbo "serifada display pesada, serifas em cunha, Bold" | Serifada de alto contraste em caixa alta, **peso regular/medium**, serifas finas (parece a mesma família do título, não uma slab pesada) | corrigido |
| Texto grande "sem sombra visível" | Nenhuma sombra visível no zoom 2x | confirmado (difusa muito leve não dá para excluir) |

### Grade e margens
| Afirmação (360p) | Medido em 720p | Veredito |
|---|---|---|
| Margem esquerda 110 px (5,7 %) | 111–113 px (5,8 %) em título, eyebrow, cartões, pílulas | confirmado |
| Pílulas sobre cena de papel em 92 px | 90–93 px (4,8 %) | confirmado |
| Eyebrow y=94–113; título em y≈125–150 | Eyebrow (caixa alta) 106→122 (3 cartões) / 86→101 (6 cartões); topo da caixa alta do título em y=150 | confirmado |
| Cartão do apresentador x 1422→1882, y 58→1022, raio 36, borda 5, sombra `0 12px 32px .20` | x 1419→1885 (466 px, 24,3 %), y 54→1025 (971 px, 89,9 %), raio **33–35**, borda **4,5 px**, sombra muito maior: ≈ `0 33px 72px rgba(0,0,0,.30)` | corrigido (sombra, raio); resto confirmado |
| Janela mock x 70→1430, y 90→950, raio 18, sombra `0 30px 60px .25` | x 71→1428 (70,7 %), y 90→949 (79,6 %), raio 19, sombra ≈ `0 30px 90px rgba(0,0,0,.30)` | confirmado (sombra mais difusa) |
| PIP 408x388, x 1456→1864, y 636→1024, raio 40, borda 6, margens 56 | 410x391, x 1455→1865, y 634→1025, raio **32–33**, borda **4,5 px**, margens 55/55, folga janela→PIP 27 px | corrigido (raio, borda) |
| PIP espelhado x 58→466 | x 54→465, mesmo tamanho | confirmado |
| PIP "herói" 560x450 | 186 s: 512x432 em trânsito (estado intermediário) | não verificável como estado fixo |
| Gravação: PIP vertical x 1538→1893, y 280→800, raio 40, sem borda | x 1538→1893, y 279→791, raio ≈ 35, sem borda, feather ~3 px | confirmado (raio ±5) |
| Gravação: janela x 30→1510, y 145→935 | Muda com o zoom (600 s: y 270→926) | não verificável como valor único |

### Componentes
| Afirmação (360p) | Medido em 720p | Veredito |
|---|---|---|
| Pílula h 68–76 px, pad-x 26, raio 10–12 | Padrão **70–75 px**; compacta 60–63; mini lateral 51–56; árvore 81; mono preta 105. pad-x 27–30 (padrão), 24 (compacta), 21 (mini). Raio **≈ 8 px** | corrigido |
| Rotação −1,5°…+1,5°, alternando de sinal | **−1,5° em quase todas** (sobe para a direita): 1 s, 17 s, 21 s, 58 s, 113 s, 149 s, 237 s, 247 s. −1,0° em 35 s, 83 s, 153 s. **−2,5°** na coral de conclusão (113 s). **±2,05° alternando** só na coluna lateral (76 s). **0°** na variante árvore | corrigido |
| Sombra da pílula `0 6px 14px .18` | Duas camadas: aro escuro de 2–4 px colado na base (≈ 25 %) + sombra difusa de ~40 px (≈ 14 %); mais 1 px de realce claro no topo | corrigido |
| Tachado ~4 px vermelho | 3–4,5 px, `#bd503a`, pontas redondas, inclinado junto com a pílula, passa ~6 px do texto de cada lado | confirmado |
| Fantasma ~40 % | 45–50 % (verde sobre paper: alfa 0,46) | confirmado |
| Passo vertical 100–135 px "irregular" | **Regular: 100 px** (pílula 72 + vão 28); só antes da conclusão o vão sobe para 68 px (passo 140). Coluna lateral: passo 88 px | corrigido |
| Árvore: recuos +70 / +140 | +69 / +140 px; pílulas maiores (81 px) e sem rotação | confirmado + detalhe novo |
| Par "harness" 280x110 | 282x105, raio ≈ 13, pad-x 40; branca ao lado 73 px de altura | confirmado |
| Cartão 358x310, raio 16, ladrilho 200 a +26, sombra `0 10px 24px .12` | 355x309, raio 16–17, ladrilho 200x200 a +27 (cantos retos), vão 45; sombra ≈ `0 21px 45px rgba(0,0,0,.145)` | confirmado (sombra corrigida) |
| Cartão 2 linhas 378x340, vão 32 | 375x339, vão 37 | confirmado (vão corrigido) |
| Cartão pequeno 208x218/246, ladrilho 120, vão 20 | 205x215/243, ladrilho 117, vão 23, passo entre fileiras 291 | confirmado |
| Miniatura 560x330, raio 16 | 558x328, raio 16; sombra 22 % | confirmado |
| Doc: x 80→1400, y 165→795, ≈ −1°, moldura ~10 px | x 76→1401, y 166→791, **−0,86°**, moldura 12–13 px | confirmado |
| Fitas ~110x45, ±35°, "translúcidas" | **129x38 px, ±37°, alfa ≈ 0,8** (`#dc8f73` sobre paper, `#ad6041` sobre o print escuro), cantos retos | corrigido |
| Marca-texto coral ~40 % + sublinhado | Alfa **0,43** (`#653b2b` sobre `#09080b`), faixa de 45 px de altura cobrindo a linha inteira, sublinhado coral sólido de ~3 px | confirmado |
| Moldura de ilustração 1000x560, raio 14 | 1000x563 | confirmado (raio não remedido) |
| Indicador: rótulo 130x34, chips 36x36, vão 6, x=30, y=22 | Rótulo 132x33 em x=30, y=22; chips **inativos 33x33, passo 42 (vão 9)**; **chip ativo maior, ≈ 37x40**; raio ≈ 8 | corrigido |
| Carimbo ~520x170, −8°, borda 5, fundo creme | 562x130 no frame de 222 s, **−7,5°**, borda 4–5 px, raio ≈ 9, fundo `#d9d7d3` (cinza-creme, não creme quente) | corrigido |
| Ícone riscado 300x220, contorno 3, traço ~8 px | 297x217, contorno 3 px, caixa inclinada ≈ −2°, traço **≈ 13–14 px**, pontas redondas, ≈ −31° | corrigido (traço) |
| Seta 4 px x 130 px | Haste **6 px**, 51x126 px no total, ponta aberta de 2 traços | corrigido (espessura) |
| Modal: borda coral 2 px, raio 22, 3 botões | Borda 2–3 px, raio ≈ 21, 737x546 px no estado ampliado; botões neutro cheio / verde cheio `#78865a` / contorno vermelho | confirmado |
| Sem cartela de capítulo; sem chamada final | Folha 1034–1110 s em 720p: só talking head | confirmado |

## 2. Valores finais consolidados (prontos para especificação)

Tudo em px a 1920x1080 e, entre parênteses, % do quadro (largura para x/largura, altura para y/altura).

### 2.1 Cores
| Token | Hex | Uso |
|---|---|---|
| paper | `#ede8e1` | Fundo de painel e de cena janela+PIP. Chapado, sem grão. Vinheta radial: cantos `#dfdad3` (−6 %), cantos inferiores `#d8d4ca` (−9 %), base-centro `#e3ded7` (−4 %) |
| surface | `#faf8f4` | Cartão, pílula branca, moldura do doc, chip inativo |
| surface-edge | `#fcf8f4`–`#fffaf5` | Borda do vídeo do apresentador |
| tile | `#f5ece3` → `#ede3d1` | Fundo da foto do ícone |
| ink | `#13120e` | Texto, pílula preta |
| window | `#131310` / lateral `#1a1816` | Janela mock, miniatura |
| coral | `#e27e54` | Acento |
| red | `#c84f37` | Negação, tachado, carimbo |
| green | `#78865c` | Solução |
| label-chip | `#4a4640` | Rótulo "EXEMPLO" (ink ~78 % sobre paper) |
| rec-bg | `#19201f` → `#0c1110` | Fundo da gravação (degradê vertical) |
| rec-window | `#141414` | Janela gravada |
| ilustração | creme `#ebe2d4`–`#f3ece6`, coral `#d57f59`–`#e6946a`, grafite `#35322f`–`#454144`, kraft `#a78360`–`#b18d6a`, sálvia `#a4b0a2`–`#d2cfbe` | Cenas de papel |

### 2.2 Tipografia
| Papel | Família / peso | Medida dura | Fonte derivada | Entrelinha | Extra |
|---|---|---|---|---|---|
| Palavra de canto | serifada tipo Tiempos Headline, itálico medium | altura-x 99 (9,2 %) | ≈ 208 px (19 %) | — | coral, minúscula + ponto; x=96 (5 %), linha de base y=212 (19,6 %) |
| Frase grande | mesma, semibold + itálico na palavra-chave | caixa alta 96 (8,9 %), altura-x 66 | ≈ 140 px (13 %); variante 121 px | 0,92–0,94 | branco `#fbf9f5` + coral; x=113; bloco y 33–54 % |
| Título de painel | mesma | caixa alta 65 (6 %), altura-x 47 | ≈ 98 px (9,1 %); grade de 6: 86 px | 0,96 | ink + 1 itálico coral |
| Eyebrow | sans tipo Inter 600–700, CAIXA ALTA | caixa alta 16–17 | ≈ 23 px (2,1 %) | — | coral, tracking +0,25–0,30 em; 28 px acima da caixa alta do título |
| Pílula padrão | Inter 600–700 | altura-x 17 | ≈ 32 px (3 %) | 1 linha | minúscula |
| Pílula compacta / mini | idem | — | 27 px / 24 px | 1 linha | |
| Pílula árvore | idem | — | ≈ 36 px | 1 linha | prefixo "›" |
| Mono (pílula técnica) | mono bold | — | ≈ 42 px | — | branco no preto |
| Rótulo de cartão | Inter 600–700 | caixa alta 22 | 30 px; pequeno 21–22 px | 1,23 | centralizado, máx. 2 linhas |
| Rótulo de miniatura | Inter bold | caixa alta 24 | ≈ 33 px | — | alinhado à esquerda, 32 px abaixo da miniatura |
| Chip de progresso | Inter bold | caixa alta 15 | ≈ 20 px | — | tracking largo no rótulo |
| Carimbo | serifada de alto contraste, regular/medium, CAIXA ALTA | — | ≈ 110 px | — | vermelho |

### 2.3 Raios e bordas
| Elemento | Raio | Borda |
|---|---|---|
| Pílula | 8 px | nenhuma; realce de 1 px no topo e aro escuro na base |
| Pílula preta grande / árvore | 11–13 px | fio claro de 1 px (~10 %) na preta |
| Chip de progresso | 8 px | nenhuma |
| Cartão de ícone, miniatura | 16–17 px | nenhuma |
| Ladrilho do ícone | 0 | nenhuma |
| Janela mock | 19 px | fio claro de 1 px no topo |
| Modal | 21 px | coral 2–3 px |
| Cartão vertical do apresentador | 34 px | 4,5 px branco quente |
| PIP de canto | 33 px | 4,5 px branco quente |
| PIP da gravação | ≈ 35 px | nenhuma, feather ~3 px |
| Moldura do doc | 0–3 px | moldura `#faf8f4` de 12–13 px |
| Carimbo | ≈ 9 px | vermelho 4–5 px |
| Caixa do ícone riscado | ≈ 18 px | branco 3 px |

### 2.4 Sombras (estimadas pelo perfil de luminância: topo / lado / base)
| Elemento | Escurecimento topo · lado · base | CSS equivalente @1080 |
|---|---|---|
| Pílula | 4 % · — · 25 % (aro) depois 14 % | `0 3px 4px rgba(0,0,0,.22), 0 12px 36px rgba(0,0,0,.14)` |
| Cartão de ícone | 2,5 % · 6,5 % · 12 % | `0 21px 45px rgba(0,0,0,.145)` |
| Miniatura / moldura de ilustração | — · — · 16–22 % | `0 22px 50px rgba(0,0,0,.24)` |
| Doc com fita | — · 13 % · 25 % | `0 24px 60px rgba(0,0,0,.30)` |
| Janela mock | 8 % · 4–14 % · 21 % | `0 30px 90px rgba(0,0,0,.30)` |
| Cartão do apresentador | 5,5 % · 13,5 % · 26 % | `0 33px 72px rgba(0,0,0,.30)` |
| PIP de canto | 5 % · 19 % · 30 % | `0 24px 72px rgba(0,0,0,.35)` |

### 2.5 Geometria por componente
| Componente | Posição / tamanho |
|---|---|
| Margem de conteúdo | x=112 (5,8 %); sobre cena de papel x=92 (4,8 %) |
| Cartão vertical do apresentador | x 1419→1885 (73,9→98,2 %), y 54→1025 (5→94,9 %); 466x971 (24,3 % x 89,9 %); proporção 0,48 |
| Coluna de conteúdo no layout dividido | x 112→1310; fundo com degrau de tom em x=1425 |
| Janela mock | x 71→1428 (3,7→74,4 %), y 90→949 (8,3→87,9 %); 1357x859 |
| PIP de canto | x 1455→1865, y 634→1025; 410x391 (21,4 % x 36,2 %); margens 55 (2,9 % / 5,1 %); folga da janela 27 |
| PIP espelhado | x 54→465, mesma faixa y |
| PIP da gravação | x 1538→1893 (18,5 %), y 279→791 (47,4 %), centrado verticalmente |
| Pílula padrão | altura 72 (6,7 %), pad-x 28, raio 8, rotação −1,5° |
| Pílula compacta | altura 61 (5,6 %), pad-x 24, rotação −1,0° a −1,5° |
| Pílula mini (coluna lateral) | altura 51–56, pad-x 21, x=1450 (75,5 %), rotação ±2,05° alternada, passo 88 |
| Pílula de conclusão | altura 72, rotação −2,5°, coral |
| Pilha | x=112; topo da primeira em y=261 (24,2 %); passo 100 (vão 28); vão 68 antes da conclusão |
| Árvore | altura 81, sem rotação, recuo 69 por nível, passo ≈ 108 |
| Par técnico | preta mono 282x105 + branca 73 de altura, vão 31, base em y≈960 |
| Eyebrow + título | eyebrow caixa alta y 106→122; título caixa alta em y=150; 2ª linha de base em y=311 |
| Cartão 3 em linha | 355x309, vão 45, x 112→1267, y 432→741; ladrilho 200x200 a 27 do topo; linha de base do rótulo a 37 da base |
| Cartão 2 linhas | 375x339, vão 37, y 432→771 |
| Cartão pequeno (4+2) | 205x215 (1 linha) / 205x243 (2 linhas), vão 23, ladrilho 117, passo de fileira 291 |
| Miniatura | 558x328, x 111, y 400→728; rótulo com linha de base em y=786 |
| Moldura de ilustração | 1000x563, x 111→1110, y 138→701 |
| Doc com fita | x 76→1401 (69 %), y 166→791 (58 %), −0,86°; fitas 129x38 a ±37° nos cantos superiores; pílula-fonte compacta acima (x 93, y 70→122) |
| Marca-texto | faixa de 45 px de altura, alfa 0,43, sublinhado 3 px |
| Indicador de progresso | rótulo 132x33 em (30, 22); chips 33x33 com passo 42 a partir de x=168; ativo 37x40 |
| Carimbo | 562x130, −7,5°, x≈130, y≈290 (centro em 20 % x 33 %) |
| Ícone riscado | caixa 297x217 em (150, 250), traço vermelho 13–14 px a −31° sobrando ~30 px de cada lado |
| Seta | 51x126, haste 6 px, em x≈255, y 555→680 |
| Modal | 737x546, raio 21, borda coral 2–3 px |

## 3. Detalhes novos que o 360p escondia

1. **Pílulas têm relevo**: 1 px de realce claro no topo (`#ffe3d3` na coral), aro escuro na base (`#c97758`) e sombra em duas camadas. Parecem etiquetas com espessura, não retângulos chapados.
2. **A rotação não é aleatória**: quase tudo usa −1,5°; a conclusão ganha −2,5°; só a coluna lateral alterna ±2°; a árvore fica reta. A inclinação funciona como ênfase.
3. **O passo da pilha é regular** (100 px) e o vão maior antes da conclusão é intencional.
4. **Chip ativo do indicador é maior** que os outros (≈ 1,15–1,2x), além de coral. Chips inativos e o rótulo são translúcidos (viram cinza `#d0cdc8` sobre a janela escura).
5. **Raio da pílula é menor** do que parecia (8 px, não 10–12) e os dois vídeos do apresentador têm praticamente o **mesmo raio (33–34) e a mesma borda (4,5 px)** — a inconsistência "36 vs 40 / 5 vs 6" não existe.
6. **Borda do apresentador não é branco puro**, é o mesmo branco quente das superfícies.
7. **Sombras bem mais longas e fortes** nos elementos grandes (blur de 70–90 px, 30–35 %); o que parecia "coluna direita mais escura" é a sombra do cartão do apresentador.
8. **Fita adesiva quase opaca** (alfa ~0,8), com cantos retos; sobre o print escuro ela vira marrom `#ad6041`.
9. **O recorte da abertura** é um print de post com moldura branca, duas fitas e marca-texto na primeira linha, inclinado ≈ −2°, 600x314 px (31 % x 29 %).
10. **Janela mock com semáforo colorido** (vermelho/amarelo/verde reais), seletor "Chat | </> Code" com "Code" em mono, logo em estrela coral antes da saudação.
11. **Modal**: eyebrow coral com ícone de alerta e tracking largo, título sans bold, lista mono dentro de uma caixa mais escura, fundo da janela escurecido atrás; os ícones de arquivo da lista aparecem como glifo faltando (caixinha).
12. **Tachado segue a inclinação da pílula** e tem pontas redondas; a pílula preta tem um fio claro de 1 px.
13. **Ladrilho do ícone tem cantos retos** e é a foto do recorte com o próprio fundo creme, não um quadrado colorido.
14. **Paper dos painéis é totalmente chapado** (desvio 0,0 em área de 40x40 px); textura de fibra só existe nas cenas de papel recortado (desvio 1,5–2 de luminância, 8 nas áreas com sombra).
15. **Entrelinha dos títulos é apertada** (0,92–0,96), não ~1,02.
16. **Carimbo** tem fundo cinza-creme e letra serifada fina de alto contraste.

## 4. O que continua incerto

- Família exata da serifada, da sans e da mono (classe confirmada; nome não).
- Peso da sans em pílula/rótulo: 600 ou 700 (no zoom parece 700).
- Tamanhos de fonte em px são derivados de altura-x/caixa alta; a medida dura é a que está na tabela.
- Grão fino no paper dos painéis: a 926 kbps o codec apagaria; não dá para afirmar que não existe no original.
- Scrim atrás de texto sobre footage e sombra difusa no texto grande: nada mensurável, mas o enquadramento muda entre os frames comparáveis.
- Parâmetros de sombra são ajuste de um modelo de 1 camada ao perfil de luminância; opacidade ±5 pontos, blur ±20 %.
- Tamanho final do carimbo e do PIP "herói": os frames medidos podem estar no meio da animação.
- Geometria da janela na gravação real: muda com o zoom, sem valor único.
- Azul do mock e raio da moldura de ilustração não foram remedidos.
- Emenda de fundo em x=74,2 %: degrau de 2–3 níveis, no limite do ruído de compressão.
