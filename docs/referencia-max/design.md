# Design visual da referência (0–1110 s)

Fonte: `ref.mp4` 640x360 (AV1, 29,97 fps). Medidas tiradas de frames ampliados 3x (1920x1080) e dadas em px@1080p e % do quadro. Cores amostradas por pixel no 360p original (modo da região, quantizado) — erro esperado ±4 por canal por causa da compressão. Tudo que depende de detalhe menor que ~3 px@360p (raio exato, espessura de borda, família tipográfica) é **inferência** e está marcado.

Imagens de apoio: `analysis/design/f<seg>.jpg` (stills 1920), `z_*.png` (zooms), `odd*.jpg`/`end.jpg` (folhas de contato dos segundos ímpares; os pares estão em `sheets/s01..s19.jpg`).

## 0. Mapa: onde existe design

| Trecho | O que tem na tela | Densidade gráfica |
|---|---|---|
| 0–298 s | Todos os componentes abaixo, alternando footage cheio, layout dividido, janela mock + PIP, cenas de papel | Muito alta: troca de tela a cada 2–8 s |
| 298–1034 s | Gravação de tela real sobre fundo verde-petróleo escuro + PIP vertical. **Nenhuma pílula, título ou cartão** em ~12 min (só zoom na gravação e cursor) | Quase zero |
| 1034–1110 s | Talking head puro, sem gráfico, sem tela final, sem CTA desenhado | Zero |

Conclusão de design: o "nível max" da referência vale para os primeiros 27 % do vídeo. Os 73 % restantes não têm sistema visual aplicado.

## 1. Paleta medida

### Superfícies
| Papel | Hex medido | Onde |
|---|---|---|
| Paper topo | `#ede8e1` | Fundo do layout dividido e da cena janela+PIP (topo) |
| Paper base | `#d9d4cd` | Mesmo fundo, base: há degradê vertical de ~8 % de luminância (topo claro → base escura) + leve vinheta nos cantos |
| Paper coluna direita | `#d1ccc7`→`#dad5d0` | Faixa atrás do cartão do apresentador; existe uma emenda vertical visível em x≈74 % (duas placas de fundo com tons diferentes) |
| Paper cenas de recorte | `#f4ede6`, `#f5ebe5`, `#eee5d8`, `#e0d7c2` | Cada cena de papel tem seu próprio creme (varia de rosado a amarelado) |
| Cartão / pílula branca | `#faf8f4`–`#fcfaf5` | Nunca branco puro: branco-creme |
| Ladrilho do ícone | `#f6efe8` | Quadrado atrás da ilustração do cartão, um tom mais quente que o cartão |
| Janela mock (conteúdo) | `#131310` | Preto quente |
| Janela mock (lateral) | `#1a1816` | |
| Fundo da gravação real | `#19201f` (topo) → `#0d1211` (base) | Verde-petróleo quase preto, em degradê |
| Janela gravada | `#1e1e1c` | |

### Tinta e acentos
| Papel | Hex | Uso |
|---|---|---|
| Ink | `#131311` (texto mede `#000`–`#151514`) | Títulos, texto de pílula branca, pílula escura, chip "EXEMPLO" (`#44413a` sobre papel por transparência) |
| Coral (acento principal) | `#e47d53` (varia `#e37d53`–`#eb7b4c`) | Itálico do título, eyebrow, pílula de ênfase, chip ativo, fita adesiva, marca-texto, seta, bolinhas de status |
| Vermelho (negação/perigo) | `#cb4e36` | Pílula "padrão: exclusão definitiva", risco sobre o terminal, tachado, carimbo INÚTIL, contador "40 arquivos" |
| Verde-oliva (positivo) | `#79865c` | Pílulas "trabalha com documentos", "outro mod: manda para a lixeira", "mod ativo ✓", botão seguro no modal |
| Azul (só dentro do mock) | ~`#5b8fe8` | Quadradinhos do gráfico de uso; nunca usado nos gráficos do editor |
| Sombra | preto 18–25 % | Sombra da janela sobre paper mede `#a9a49d` contra `#d9d4cd` (≈22 % de escurecimento) |
| Borda do apresentador | `#ffffff` | Único branco puro do sistema |

Semântica de cor (consistente): **branco = contexto/afirmação neutra; coral = a ideia que importa; vermelho = o problema/o padrão ruim; verde = a solução; preto = termo técnico**.

### Tratamento do footage
- Low-key quente. Parede de fundo `#211c1b`, moldura/terracota `#5c342e`, pele `#df9085` (bem saturada, puxada para rosa), lâmpada prática estourada em `#ffffff` no canto superior direito.
- Pretos levantados: canto superior esquerdo `#252427`, inferior direito `#171717` (não chega a 0). Sombras neutras-frias, médios laranja → contraste de temperatura (teal/orange suave).
- Sem vinheta adicionada perceptível; fundo desfocado (profundidade rasa).
- **Sem scrim**: não há escurecimento nem degradê atrás dos gráficos sobre footage. A legibilidade depende do terço esquerdo do cenário ser escuro.
- Quando entra frase grande, o footage recebe punch-in e o apresentador é deslocado para a direita (em 58,5 s o rosto vai de x≈50 % para x≈58 %, escala ≈1,18x), liberando os 40 % da esquerda.
- O coral do sistema é a mesma família do terracota do cenário: o acento parece "sair" do set.

## 2. Tipografia

| Papel | Família aparente | Peso / estilo | Caixa | Tamanho (px@1080 / % altura) | Entrelinha | Cor |
|---|---|---|---|---|---|---|
| Palavra-título de canto ("mods.") | Serifada transicional de alto contraste (tipo Tiempos Headline / Newsreader Display — inferência) | Medium **itálico** | minúscula + ponto final | ~185 px / 17 % | — | Coral |
| Frase grande sobre footage | mesma serifada | Semibold romano + itálico na palavra-chave | Sentence case, ponto final só no itálico | 110–128 px / 10–12 % | ≈1,02 | Branco + coral |
| Título de painel (layout dividido) | mesma serifada | Semibold romano + 1 palavra itálico | Sentence case, sem ponto | 78–90 px / 7,2–8,3 % | ≈1,03 | Ink + coral |
| Eyebrow | Sans geométrica/grotesca (Inter — inferência) | Bold | CAIXA ALTA | ~27 px / 2,5 % | — | Coral, tracking ≈ +0,18 em |
| Pílula de anotação | Inter | Semibold (600) | minúscula inteira, sem ponto; ênfase pontual em CAIXA ALTA ("COMO", "TODAS", "SEU") | 30–32 px / 2,9 % (pílula pequena de contexto: 27 px) | 1 linha sempre | Ink no branco; branco no coral/verde/vermelho/preto |
| Rótulo de cartão | Inter | Semibold | Sentence case | 30 px (cartão grande) / 22 px (cartão pequeno) | ≈1,15, máx. 2 linhas, centralizado | Ink |
| Rótulo de miniatura ("Terminal") | Inter | Bold | Sentence case | 34 px | — | Ink, alinhado à esquerda sob a miniatura |
| Chip de progresso | Inter | Bold | "EXEMPLO" em caixa alta com tracking ≈ +0,2 em; numerais | 17–18 px / 1,6 % | — | Branco no escuro/coral; cinza `#706b64` no inativo |
| Mono | Mono humanista (JetBrains Mono — inferência) | Medium/Bold | minúscula | 42 px na pílula "harness"; 38 px no contador "40 arquivos"; 20–24 px dentro do mock | — | Branco |
| Carimbo | Serifada display pesada, serifas em cunha | Bold | CAIXA ALTA | ~110 px | — | Vermelho sobre creme |

Regras de composição:
- Título sempre alinhado à esquerda, 1–2 linhas, quebra manual; linha mais longa medida = 770 px (40 % da largura). Nunca centralizado.
- Exatamente **uma** palavra/expressão em itálico coral por título (às vezes numeral: "*6* exemplos"). O itálico é serifado verdadeiro (cursivo), não oblíquo.
- Tracking do título levemente negativo (≈ −1 %); kerning apertado entre itálico e romano.
- Legendas (subtitles) queimadas: **não existem**. Todo texto na tela é síntese editorial (2–5 palavras), nunca transcrição.
- Pílulas não quebram linha: máx. medido ≈ 660 px (34 % da largura), ~32 caracteres.

## 3. Grade e margens

Base 1920x1080.

- Margem esquerda de conteúdo: **110 px (5,7 %)** em todas as telas (título, pílulas sobre footage, cartões). Pílulas sobre cena de papel usam 92 px (4,8 %).
- Topo: eyebrow em y=94–113 px (8,7–10,5 %); título começa em y≈125–150.
- Indicador de progresso fora da margem de conteúdo: x=30 px (1,6 %), y=22 px (2 %).
- Base: pílulas de rodapé terminam em y≈1020 (margem inferior 5,5 %).

### Layout dividido (painel + apresentador)
```
0        5.7%                              68%   74%            98% 100%
|  m110  |<------ conteúdo, máx 1200 px ------>| gap |<- cartão 460 ->|38|
```
- Coluna de conteúdo: x 110→1310 (62,5 % da largura).
- Cartão vertical do apresentador: x 1422→1882 (**24 %** da largura), y 58→1022 (**89 %** da altura), proporção ≈ 9:19. Raio ≈ 36 px. Borda branca ≈ 5 px. Sombra suave ≈ `0 12px 32px rgba(0,0,0,.20)` (inferência). Recorte do footage: close no rosto (olhos a 38 % da altura do cartão), microfone na base.
- Proporção das colunas: ~72 / 28.

### Janela mock + PIP (sobre paper)
- Janela: x 70→1430 (**70,8 %**), y 90→950 (**79,6 %**), raio ≈ 18 px, sombra longa para baixo (≈ `0 30px 60px rgba(0,0,0,.25)`).
- PIP: x 1456→1864 (**21,3 %** = 408 px), y 636→1024 (**36 %** = 388 px), quase quadrado (1,05:1). Raio ≈ 40 px (10 % do lado). Borda branca ≈ 6 px. Margem direita 56 px (2,9 %), inferior 56 px (5,2 %). Folga janela→PIP: 26 px.
- Variação espelhada (ex. 4, 173–184 s): PIP em x 58→466, mesma altura; janela encosta à direita.
- Estado "zoom": a janela escala ~1,6–1,9x e sangra pela esquerda/topo; PIP não se move; a faixa de paper da direita (22 % da largura) vira coluna de pílulas (x=1450, y=145 / 222 / 340).
- PIP "herói" (transições, 60 s e 198 s): PIP cresce para ≈ 560x450 (29 % x 42 %) antes de virar tela cheia.

### Gravação real (298–1034 s)
- Janela gravada: x 30→1510 (77 %), y 145→935 (73 %), sem moldura desenhada, cantos ≈ 8 px.
- PIP vertical: x 1538→1893 (18,5 %), y 280→800 (48 %), raio ≈ 40 px, **sem borda branca**, borda com leve feather. Centrado verticalmente, não ancorado embaixo.
- Sobra ~13 % de faixa vazia em cima e embaixo.

## 4. Fichas de componente

### 4.1 Pílula de anotação
```
   ┌──────────────────────────────┐   h 68–76 px (6,3–7 %)
   │  você pede em linguagem natural │   pad-x ≈ 26 px, raio 10–12 px
   └──────────────────────────────┘   rotação −1,5°…+1,5°
```
- Não é cápsula: retângulo de canto pouco arredondado. Sombra curta ≈ `0 6px 14px rgba(0,0,0,.18)`.
- Sempre levemente torta (rotação alterna de sinal entre pílulas vizinhas) → aparência de etiqueta colada.
- Variantes de cor: branca (ink), coral (branco), vermelha (branco), verde (branco), preta (branco, sans ou mono).
- Estados: normal; **tachada** (linha vermelha de ~4 px atravessando o texto, pílula continua branca — 105–113 s); **fantasma** (opacidade ~40 % enquanto entra/sai — 76 s "mod ativo ✓", 291 s "› app desktop"); **com termo colorido** (uma palavra coral dentro da pílula branca: "definiam o *como* nos seus documentos", com seta "→" na frente — 35 s).
- Posições: sobre footage, x=110, primeira em y=25–32 %; sobre cena de papel, canto inferior esquerdo (y 80–92 %) ou superior esquerdo (y 10–20 %); ao lado da janela, coluna direita.

### 4.2 Pilha de pílulas
```
 x=110
 [ não programa ]  (tachada)        y≈27 %
 [ não faz vibe coding ] (tachada)  y≈36 %
 [ trabalha com documentos ] verde  y≈45 %
 [ o maior poder da atualização ] coral  y≈58 %
 [ no SEU fluxo de trabalho ] preta y≈79 %
```
- 2 a 5 pílulas, alinhadas à esquerda, larguras livres. Passo vertical 100–135 px, **irregular** (o espaço aumenta antes da pílula de conclusão).
- Ordem cromática narrativa: branco (contexto) → vermelho/verde (contraste) → coral (conclusão). No máximo 1 coral por pilha.
- Variante "árvore" (289–293 s): preta "Claude Code" → branca "› aba Code" recuada +70 px → coral "› app desktop" recuada +140 px. O recuo comunica hierarquia.
- Variante "par horizontal" (236–241 s): preta mono "harness" (280x110, maior) + branca explicativa na mesma linha, coral embaixo.

### 4.3 Palavra-título de canto
```
 mods.                 ← serifada itálica coral, 17 % da altura, x=100, topo y=7 %
 [ a maior atualização desde as skills ]   ← pílula branca a y≈31 %
 ┌ recorte de doc com fita ┐               ← y 45–70 %, 30 % da largura
```
- Usada só na abertura (0–3 s). Minúscula + ponto final. Sem sombra nem contorno.

### 4.4 Frase grande sobre footage
```
 [ o mais interessante ]          ← pílula pequena (27 px) como eyebrow, y≈24 %
 Sem abrir                        ← branco, 128 px
 o terminal.                      ← itálico coral
```
- x=112, bloco entre y=22 % e 56 %, largura máx. ≈ 34 % do quadro. Sem sombra visível no texto (inferência: talvez sombra muito difusa).
- Variantes: sem pílula ("*6* exemplos na prática", 115–119 s; "E agora, o que eu *faço?*", 185 s, 62 px — menor porque aparece sobre transição).

### 4.5 Eyebrow + título com itálico coral (cabeça do painel)
```
 ATÉ AQUI                         ← coral, 27 px, tracking largo, y=113
 Você personalizava               ← ink, 90 px
 como ele trabalha                ← "como" itálico coral
```
- Distância eyebrow→título ≈ 18 px. Título→primeira fileira de conteúdo ≈ 90–120 px.
- O eyebrow é o "capítulo interno": ATÉ AQUI / COM MODS / POUCOS MOSTRAM / SKILL × MOD / NO TRABALHO.

### 4.6 Cartão com ícone
```
 ┌──────────────┐  358 x 310 px (18,6 % x 28,7 %), raio ≈ 16 px
 │  ┌────────┐  │  ladrilho 200x200, topo +26 px, fundo #f6efe8
 │  │ ícone  │  │
 │  └────────┘  │
 │    Skills    │  rótulo 30 px semibold, centralizado
 └──────────────┘  sombra ≈ 0 10px 24px rgba(0,0,0,.12)
```
- Variante 2 linhas: 378 x 340 px, espaçamento 32 px.
- Variante pequena (grade de 6): 208 x 218 px (1 linha) ou 246 px (2 linhas), ladrilho 120 px, rótulo 22 px, espaçamento 20 px.
- Sem borda; a separação do fundo vem só da sombra e do tom mais claro.

### 4.7 Fileira / grade de cartões
```
 3 em linha:  [358] 44 [358] 44 [358]      x 110→1268, y 432→742
 6 em 4+2:    [208]20[208]20[208]20[208]   y 333
              [208]20[208]                 y 622
```
- Alinhada à esquerda (não centralizada na coluna); sobra à direita.
- Linha de rodapé opcional: pílula-conclusão a ~130 px abaixo da fileira.
- Na grade de 6, um recorte de tela com fita (380x260, torto −3°) ocupa o vazio à direita da segunda linha.

### 4.8 Janela de app mock
- Não é gravação: é uma interface redesenhada como gráfico (texto nítido, poucos elementos, tipografia maior que a real). Fundo `#131310`, lateral `#1a1816`, semáforo de 3 pontos, bolha de prompt cinza arredondada, linhas de ferramenta em mono com bolinha verde, painel lateral com cabeçalho em caixa alta coral e tracking largo ("● MOD · ESTATÍSTICAS").
- Estados: inteira (70,8 % x 79,6 %); ampliada (sangrando); com modal (borda coral 2 px, raio 22 px, título 44 px bold, lista mono, 3 botões: neutro / verde cheio / contorno vermelho); esmaecida a ~40 % durante troca.
- Miniaturas (88–92 s): 560 x 330 px, raio 16 px, com rótulo bold embaixo ("Terminal", "App desktop · aba Code" com o complemento em coral).

### 4.9 Cartão de documentação com marca-texto
```
 [ docs oficiais · code.claude.com ]         ← pílula-fonte, y=7 %
 ╲fita                                 fita╱  ← 2 fitas coral translúcidas, ~110x45, ±35°
 ┌─────────────────────────────────────────┐
 │ MODS                                    │  moldura creme de ~10 px (foto impressa)
 │ Mods overview                           │  x 80→1400, y 165→795, torto ≈ −1°
 │ ▓▓▓ frase marcada ▓▓▓ resto do texto    │  marca-texto coral ~40 % + sublinhado coral
 └─────────────────────────────────────────┘
 [ o agente muda o próprio sistema ]         ← pílula coral embaixo
```
- Screenshot real (tema escuro) tratado como objeto físico colado. O marca-texto cobre uma única frase.
- Versão miniatura sobre footage na abertura (0–3 s) e na grade de 6 cartões.

### 4.10 Cena de recorte de papel (tela cheia)
- Ocupa 100 % do quadro, sem apresentador. Objeto principal no centro/direita; canto inferior ou superior esquerdo reservado para 1–2 pílulas.
- Variante "em moldura": mesma arte dentro de um cartão 1000 x 560 px (52 % x 52 %), raio 14 px, no layout dividido (254–263 s), com eyebrow acima e 2 pílulas abaixo.
- Detalhes em §5.

### 4.11 Indicador de progresso "EXEMPLO 1–6"
```
 [EXEMPLO] [1] [2] [3] [4] [5] [6]      x=30, y=22
   130x34   36x36 cada, vão 6 px, raio 6–8 px
```
- Chip-rótulo escuro (ink ~85 %), branco bold com tracking. Chip ativo coral com numeral branco; inativos creme com numeral cinza.
- Persistente de 124 s a 240 s, por cima de qualquer tela (footage, janela, papel).

### 4.12 Carimbo
```
   ╔═══════════╗
   ║  INÚTIL   ║   ~520x170 px, torto −8°, borda vermelha 5 px, raio 10 px, fundo creme
   ╚═══════════╝
```
- Único uso (221–228 s), acompanhado depois de 1 pílula coral. Único elemento com rotação forte.

### 4.13 Ícone riscado
- Caixa preta 300x220 px, contorno branco 3 px, raio 18 px, prompt `>_`, atravessada por traço vermelho diagonal de ~8 px que ultrapassa a caixa (15–18 s). Pílula coral logo abaixo.

### 4.14 Seta
- Seta fina coral apontando para baixo (linha 4 px, 130 px de altura) sob a pílula "mods + prompts na descrição" (244–252 s). Única seta do vídeo.

### 4.15 Capítulo / seção
- **Não há cartela de capítulo.** As viradas são feitas por eyebrow + título no layout dividido, ou por frase grande sobre footage. Os capítulos do YouTube (285, 353, 452, 660, 814, 944, 1062 s) não têm nenhuma marca visual.

### 4.16 Chamada final
- **Não existe.** O vídeo termina em talking head limpo (1034–1110 s). A única chamada desenhada é a pílula "mods + prompts na descrição" + seta, aos 244 s.

## 5. Estilo de ilustração

### Cenas de tela cheia
- Aparência de **papel recortado em camadas fotografado**: cartolina fosca, fibras e granulação visíveis, bordas levemente irregulares, espessura real (camadas empilhadas com sombra de contato curta + sombra projetada suave à direita/baixo, luz vinda do alto-esquerda).
- Duas câmeras: vista de topo plana (engrenagens, pastas, notebook) e 3/4 com profundidade de campo (fichário, lixeira, degraus, motor). Fundo sempre creme contínuo, sem horizonte duro.
- Paleta fechada de **5 tons**: creme, coral/terracota, verde-sálvia (`#b9c4b0` aprox.), grafite (`#3a3d42` aprox.), kraft (`#b8946a` aprox.). Nunca azul, nunca gradiente digital.
- Objetos (metáfora literal do que é dito): balões de fala, engrenagens, janela de navegador, pastas e folhas, planilha, notebook, fichário grosso com triângulo de alerta, lixeira com papéis, degraus com checks, estrela-explosão de 10–12 pontas (a "faísca" que representa o agente, recorrente em 4 cenas), bonecos pixelados, mecanismo com mão e pinça, maquete de quarto.
- Uma cena (38–44 s) transforma o próprio apresentador e cenário em recorte de papel dentro de uma moldura de janela — o único momento em que a ilustração cita o footage.
- Qualidade/consistência indicam imagem/vídeo gerado e animado (inferência); a textura muda um pouco de cena para cena.

### Ícones dos cartões
- Mesmo idioma em miniatura: objeto único, recorte de papel em 2–3 camadas, vista frontal, sobre ladrilho creme quadrado. Paleta de 3–4 tons (coral, grafite, sálvia, creme). Contorno grafite grosso em alguns (escudo, medidor, monitor), sem contorno em outros (marcador de página, plugue).
- Objetos: marcador de página, plugue, chave inglesa, mão espalmada, monitor, peça de quebra-cabeça com "+", escudo, cadeado, olho, velocímetro, moedas, janela.

## 6. Consistência

### Regras que nunca quebram
1. Margem esquerda única (5,7 %) para todo texto; nada centralizado, nada à direita exceto a coluna de pílulas ao lado da janela.
2. Um único itálico coral por título; um único coral por pilha de pílulas.
3. Serifada só para título/frase; sans só para pílula/rótulo; mono só para termo técnico ou número de arquivo.
4. Pílula sempre em uma linha, sempre minúscula, sempre sem ponto final, sempre levemente torta.
5. Nenhum branco puro em superfície (só na borda do apresentador); nenhum preto puro.
6. Toda superfície flutuante tem sombra suave para baixo; nenhuma tem borda escura.
7. O apresentador nunca some por mais de ~8 s na parte editada: ou está em tela cheia, ou no cartão vertical, ou no PIP (exceto cenas de papel de 4–8 s).
8. Texto na tela = síntese de 2–5 palavras do que está sendo falado; nunca legenda corrida.
9. Vermelho = problema, verde = solução, em todos os usos.

### Inconsistências encontradas
- **Dois sistemas no mesmo vídeo**: 0–298 s totalmente desenhado; 298–1034 s gravação crua com outro fundo (`#19201f` em vez de paper), outro PIP (vertical, sem borda, centrado) e zero anotações.
- Emenda de fundo visível no layout dividido (x≈74 %): a coluna do apresentador tem outro tom de paper.
- Cartões da mesma fileira com alturas diferentes (rótulo de 1 linha = 218 px, 2 linhas = 246 px) → base desalinhada (275–285 s).
- Tamanho do título do painel varia (90 px com 3 cartões, 78 px com 6) sem regra aparente; eyebrow muda de y=113 para y=94.
- Passo vertical das pílulas irregular (100 a 135 px) e rotações sem padrão; alguns pares se tocam (296 s: coral e branca encostadas e sobrepostas 4 px).
- Creme das cenas de papel varia de rosado (`#f5ebe5`) a amarelado (`#e0d7c2`) e não bate com o paper dos painéis (`#ede8e1`).
- Raio de canto: 10 (pílula), 16 (cartão), 18 (janela), 36 (apresentador), 40 (PIP) — cinco raios sem escala clara; o cartão vertical e o PIP têm bordas de espessura diferente (5 vs 6 px).
- Chip "EXEMPLO" tem fundo escuro que some sobre footage/janela (vira só texto) e aparece sobre paper; em 173–178 s ele fica por cima do semáforo e das abas da janela mock (colisão).
- Pílula "painel do lado" (173–184 s) cobre itens da barra lateral da janela.
- Coral dentro da pílula branca ("como") e complemento coral no rótulo de miniatura quebram a regra "coral só em pílula cheia ou itálico de título".

## 7. Como fazer melhor

### Problemas e correção concreta
| Problema na referência | Correção |
|---|---|
| Branco sobre coral `#e47d53` = contraste 2,9:1 (abaixo de 4,5:1; texto de 30 px semibold não é "texto grande") | Pílula coral com texto **ink**: `#111827` sobre `#ff5555` = 5,7:1. Branco sobre `#ff5555` daria 3,1:1 — só usar branco em coral se ≥ 40 px bold |
| Eyebrow coral 27 px sobre paper = 2,3:1, some em tela pequena | Eyebrow em ink 60 % com um marcador coral (barra 4x24 px ou ponto) antes do texto; ou coral só no marcador. Tamanho mínimo 30 px (2,8 %) |
| Sem scrim: pílula branca funciona, mas frase branca grande depende do cenário escuro | Degradê lateral ink 0→55 % cobrindo os 45 % da esquerda sempre que houver frase grande; garante leitura em qualquer footage |
| 73 % do vídeo sem nenhum gráfico | Levar o sistema para a gravação de tela: mesmo paper de fundo, mesma moldura de janela, mesmo PIP com borda, pílula a cada ação relevante (clique, comando, resultado), marca-texto animado sobre o trecho lido, chip de progresso por capítulo |
| Sem cartela de capítulo e sem tela final | Cartela de 1,5–2 s por capítulo (eyebrow "CAPÍTULO 03" + título serifado com itálico coral, sobre paper) e chamada final com 2 cartões (próximo vídeo / link da descrição) |
| Indicador de progresso minúsculo (34 px, 1,6 % de texto) e colidindo com a janela | Chips de 48 px, texto 24 px, dentro da margem de 5,7 %; janela desce 20 px quando o indicador está ativo |
| Cartões com alturas desiguais | Altura fixa calculada para 2 linhas; rótulo ancorado ao topo da área de texto |
| Pílulas sobrepostas e passo irregular | Passo fixo = altura + 24 px; rotação de um conjunto pequeno e determinístico (−1,2°, +0,8°, −0,6°…) por índice |
| Cinco raios de canto | Escala de 3: 12 (pílula/chip), 20 (cartão/janela/miniatura), 40 (vídeo do apresentador) |
| Emenda de fundo e cremes diferentes | Um único paper sólido `#f8f8f2` + vinheta radial única (ink 6 % nas bordas); cenas ilustradas usam o mesmo paper como chão |
| Rótulos de cartão em 22 px na grade de 6 | Mínimo 28 px; se não couber, 3+3 em vez de 4+2 |
| Carimbo, seta e ícone riscado aparecem 1 vez cada (não viram linguagem) | Promover a componentes com regra de uso: carimbo = veredito, seta = "olhe aqui/na descrição", riscado = "não precisa mais de X" |
| Pílula-fantasma a 40 % fica ilegível por ~0,5 s | Entrada por máscara/deslocamento com opacidade ≥ 85 % desde o 2º frame |

### Tradução para os tokens MChiodi
Tokens: paper `#f8f8f2`, ink `#111827`, coral `#ff5555`, Playfair Display 600 (título), Inter (apoio). Derivados sugeridos: paper-2 `#efefe6` (ladrilho), ink-80 `rgba(17,24,39,.8)`, verde `#5f7a4a` e vermelho `#c8321e` só como semânticos (branco sobre eles ≥ 4,5:1), mono JetBrains Mono.

| Componente | Especificação com tokens (1080p) |
|---|---|
| Pílula neutra | fundo paper, texto ink, Inter 600 32 px, h 72, pad-x 28, raio 12, sombra `0 6px 16px rgba(17,24,39,.18)`, rotação por índice |
| Pílula de ênfase | fundo coral, texto **ink** (não branco), mesmas medidas |
| Pílula técnica | fundo ink, texto paper, JetBrains Mono 500 34 px |
| Pílula solução / problema | verde / vermelho com texto paper; tachado = linha coral 4 px sobre pílula neutra |
| Pilha | x=110, primeira em y=27 %, passo 96 px, máx. 4, 1 coral no fim; variante árvore com recuo 64 px por nível |
| Palavra de canto | Playfair Display 600 itálico, coral, 180 px, x=100, y=7 %, com sombra `0 2px 24px rgba(17,24,39,.35)` para footage claro |
| Frase grande | Playfair 600, paper, 120 px, entrelinha 1,04, máx. 2 linhas e 36 % da largura; palavra-chave em itálico coral; scrim lateral ink |
| Eyebrow + título | eyebrow Inter 700 30 px caixa alta, tracking .16 em, ink-80 com barra coral; título Playfair 600 88 px ink + 1 itálico coral; tamanho fixo |
| Cartão com ícone | fundo paper (nunca branco puro) com borda ink 8 % 1 px + sombra `0 10px 28px rgba(17,24,39,.10)`; raio 20; ladrilho paper-2; rótulo Inter 600 30 px; altura fixa |
| Fileira | 3x (360 px, vão 40) ou 3+3 (360 px) — nunca 4+2 com cartão de 208 px |
| Layout dividido | conteúdo x 110→1310; apresentador 460x964, raio 40, borda paper 6 px, sombra `0 16px 40px rgba(17,24,39,.22)`; fundo paper único |
| Janela + PIP | janela 1360x860 raio 20 com barra ink; PIP 408x388 raio 40 borda paper 6 px, margem 56; mesmo PIP na gravação real (trocar o vertical sem borda) |
| Cartão de doc | screenshot com moldura paper 10 px, rotação −1°, 2 fitas coral 45 % opacidade, marca-texto coral 35 % com `mix-blend: multiply` em doc claro / `screen` em doc escuro, pílula-fonte neutra acima |
| Indicador de progresso | rótulo ink/paper Inter 700 22 px tracking .18 em; chips 48 px raio 12; ativo coral com numeral ink; feitos em ink 20 %; a fazer em paper |
| Carimbo | Playfair 800 caixa alta 110 px, coral-escuro `#c8321e` sobre paper, borda 6 px, rotação −8° |
| Cena ilustrada | chão paper, paleta de 5: paper, coral, ink, sálvia `#b9c4b0`, kraft `#b8946a`; sombra de contato + projetada à direita; reservar canto inferior esquerdo (40 % x 25 %) livre para pílulas |
| Cartela de capítulo (novo) | paper cheio, eyebrow "CAPÍTULO NN", título Playfair 600 110 px, barra coral 6x120 px à esquerda; 1,5–2 s |
| Chamada final (novo) | layout dividido, eyebrow "A SEGUIR", 2 cartões 16:9 de 520 px com rótulo, pílula coral "link na descrição" + seta |
