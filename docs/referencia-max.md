# Referência do nível max — guia definitivo

Análise completa do vídeo que serve de padrão para o nível `max` do MChiodi Editor
("A Maior Atualização do Claude Code Desde as Skills", youtube.com/watch?v=Q5vEzupdjpc, 18:30),
com tudo o que foi medido, como reproduzir no editor e onde fazer melhor.

Só a **linguagem** interessa: nada de arte, texto ou marca do vídeo entra nos nossos. Os trechos citados entre aspas
servem apenas para localizar um momento.

**Como ler os números**

- Tempos em segundos do vídeo. Frames a 30 fps (1 f = 0,033 s). Pixels em 1920×1080, salvo indicação; % é do quadro
  (largura para x, altura para y).
- Fonte de cada número entre colchetes: `[T1]`…`[T6]` = `trecho-1.md`…`trecho-6.md`; `[M]` = `movimento.md` (360p);
  `[M-HD]` = `movimento-hd.md` (720p); `[D]` = `design.md` (360p); `[D-HD]` = `design-hd.md` (720p);
  `[TR]` = transcrição; `[INFO]` = metadados. Os relatórios brutos estão em `docs/referencia-max/`.
- **Quando 360p e 720p divergem, vale o 720p.** As divergências aparecem como "360p: X → 720p: Y (adotado)".
- `(inf.)` = inferência do analista ou minha, não medida direta.
- Δ (defasagem) = início do elemento menos início da palavra que o dispara. Negativo = o elemento chega antes da fala.

## Sumário

1. [Resumo em uma página](#s1)
2. [Ficha do vídeo](#s2)
3. [Linha do tempo](#s3)
4. [Catálogo de layouts](#s4)
5. [Catálogo de elementos](#s5)
6. [Gramática de movimento](#s6)
7. [Transições](#s7)
8. [Efeitos no footage e na tela gravada](#s8)
9. [Design](#s9)
10. [Como fazer melhor](#s10)
11. [Como montar no editor](#s11)
12. [Implementado × falta](#s12)
13. [Checklist final do nível max](#s13)
14. [Apêndice: limites da análise e relatórios brutos](#s14)

---

<a id="s1"></a>
## 1. Resumo em uma página

### 1.1 A descoberta: só 27% do vídeo é editado

| Faixa | Duração | Fatia | O que é |
|---|---|---|---|
| 0–301 s | 301 s | 27% | Bloco editado: 5 layouts, ~40 trocas de layout, ~60 entradas de elemento, 6 zooms de tela, 8 cenas ilustradas `[M §0]` |
| 301–1035 s | 734 s | 66% | Tela gravada crua + cartão do apresentador, um layout fixo, **zero gráfico de edição** `[T3][T4][T5][M §0]` |
| 1035–1110 s | 75 s | 7% | Apresentador em tela cheia, sem gráfico, sem CTA desenhado, sem tela final `[T6]` |

O "nível max" da referência vale para os primeiros 5 minutos. Os outros 13,5 minutos têm de 0,4 a 1,5 decisão de edição por
minuto e trechos de até 74,5 s sem nenhuma mudança `[T3–T6]`. **Por isso o `max` daqui cobra 80% do vídeo editado: copiar a
linguagem do começo e aplicá-la até o fim já é fazer melhor.**

### 1.2 O estilo em 15 afirmações medidas

1. **Ritmo**: 83 eventos visuais em 150 s (33/min, um a cada 1,8 s) no primeiro trecho e 71 em 150 s (28/min) no segundo
   `[T1 §5][T2 §5]`. Maior intervalo parado do bloco editado: 11,2 s `[T1]`.
2. **Layout troca a cada ~8 s**: média 7,9 s (19 blocos em 150 s), de 4,3 s a 25,5 s `[T1 §5]`.
3. **Tempo de tela no bloco editado** (300 s): talking head cheio 28%, janela + apresentador no canto 28% (30% com o recorte de
   documentação), cena de papel 22%, tela dividida 17%, transições 2% `[T1 §1][T2 §1]` (conta na seção 2.3).
4. **O apresentador nunca é cortado para dentro de um cartão**: é sempre o mesmo retângulo de vídeo que encolhe, cresce ou
   desliza. 16 dessas trocas em 300 s, todas com 27 f (0,9 s) e a mesma curva `[M-HD §2.2]`.
5. **Uma curva só no vídeo inteiro**: `cubic-bezier(0.65, 0, 0.35, 1)`. Mudam só as durações: 10 f (palavra), 11 f (saída),
   27 f (troca de layout, zoom-out), 30 f (espelhamento), 36 f (zoom-in) `[M-HD §3.1]`.
6. **O elemento mais usado é a pílula**: 50 em 300 s (10/min, em ~28 grupos), 2 a 6 palavras, uma linha, 72 px de altura e
   texto de ~32 px, levemente torta (−1,5°) `[T1 P1][T2 P1][D-HD]`.
7. **Cor tem significado fixo**: branca = contexto (20×), coral = a ideia que importa (21×), verde = solução (4×),
   vermelha = problema (2×), escura/mono = termo técnico ou fecho (3×) `[T1 P1][T2 P1][D §1]`.
8. **Sincronia com a fala**: pílulas e cartões entram 1–4 f antes da palavra-chave (mediana −0,06 s) `[M §2A]`; 33 de 44
   elementos caem a ±0,3 s da palavra `[T1 §5]`; toda troca de layout começa 0,1–0,3 s antes da primeira palavra da frase
   (13 de 13) `[T1 §3]`.
9. **Texto serifado palavra a palavra**: 10 f por palavra, defasagem fixa de 3,5 f, blur nos 3 primeiros frames, exatamente
   uma palavra em itálico coral por frase `[M-HD §2.4][D §2]`. É uma cascata de tempo fixo: chega até 1,75 s fora da fala
   `[T1 §5]`.
10. **Entrada única para tudo**: fade + subida (26 px na pílula, 51 px no cartão, 66 px no documento) em 9–11 f, sem
    ultrapassar o alvo. O único elemento com mola é o carimbo `[M-HD §2.5][M-HD §2.7]`.
11. **Entradas animadas, saídas em corte**: 9 de 13 grupos de pílulas morrem no corte `[T2 P1]`; quando o fundo continua, a
    saída é um fade coletivo de 8 f `[M-HD §2.5]`.
12. **Cena de papel recortado**: 8 em 300 s, de 4,7 a 11,4 s, em stop-motion (4,3 a 10 fps); 5 entram por rasgo de papel de
    11 f, todas saem em corte seco `[T1 P5][T2 P5][M-HD §2.3]`.
13. **Quase não há zoom**: 6 em 300 s, todos na janela da tela (escala 1,22–1,30, 36 f para entrar). Nenhum desfoque, tremor
    ou zoom por palavra `[M-HD §2.6][T1 §4]`.
14. **Não existe legenda**: todo texto na tela é síntese editorial de 2–5 palavras, nunca transcrição `[T2][D §2]`.
15. **Design**: fundo papel `#ede8e1` com vinheta, tinta `#13120e`, coral `#e27e54`, margem esquerda única de 5,8% (112 px),
    serifada para títulos, sans para pílulas e rótulos, mono para termo técnico `[D-HD §2]`.

---

<a id="s2"></a>
## 2. Ficha do vídeo

### 2.1 Dados

| Item | Valor | Fonte |
|---|---|---|
| Duração | 1110 s (18:30) | `[INFO]` |
| Publicação | 11/10/2026 | `[INFO]` |
| Cópias analisadas | 640×360 e 1280×720, ambas a 29,97 fps | `[M][M-HD]` |
| Fala | ~2,9 palavras por segundo, contínua | `[T6 §5]` |
| Câmera | ~18% de quadros repetidos: gravada a ~24/25 fps e conformada para 29,97 | `[T5 §4]` |

### 2.2 Capítulos e estrutura narrativa

| # | Início | Capítulo `[INFO]` | O que acontece `[TR]` | Tratamento |
|---|---|---|---|---|
| 1 | 0 s | O que são os mods | Gancho (0–18 s), antes × agora (23–53 s), tese (54–60 s), demonstração simulada (60–77 s), prova na documentação (78–85 s), para quem serve (85–115 s), 6 exemplos (115–242 s), resumo e CTA de descrição (230–253 s), skill × mod e benefícios (253–278 s) | Editado ao máximo |
| 2 | 285 s | Onde criar mods | Recorte do assunto e gancho para a demonstração (até 301 s); conferir aba e versão do app | Editado até 301 s; depois tela crua |
| 3 | 353 s | Mod 1: faixa da sessão | Cola o prompt, envia, comenta enquanto processa, mostra o resultado | Tela crua |
| 4 | 452 s | Instalando e conferindo | Reinicia o app, mostra a faixa, explica cache, contexto, limites, `/doctor` | Tela crua |
| 5 | 660 s | Mod 2: cofre de chaves | Risco de expor chaves, cola o prompt, confirma, história do repositório público | Tela crua |
| 6 | 814 s | Testando o comando | Reinicia, chama o comando, painel lateral, os dois tipos de mod | Tela crua |
| 7 | 944 s | Mods oficiais e outros usos | Tabela de 4 mods no repositório, digressão sobre plano concorrente; volta ao rosto em 1035 s | Tela crua, depois talking head |
| 8 | 1062 s | O que criar | Recapitulação, pedido de like e inscrição, despedida | Talking head sem nada |

Nenhuma das 7 viradas de capítulo (285, 353, 452, 660, 814, 944, 1062 s) tem marca visual `[D §4.15][T3–T6]`. Dentro do bloco
editado, a função de "capítulo interno" é feita pelo rótulo em caixa alta acima do título da tela dividida `[D §4.5]`.

Estrutura do bloco editado, que é a que vale copiar: **gancho com palavra-título → demonstração curta → conceito por contraste
(antes × agora) → tese em frase grande → demonstração → prova (fonte oficial) → para quem é → série numerada de exemplos →
resumo → comparação final e lista de benefícios → gancho para a parte prática**.

### 2.3 Tempo de tela por layout

Bloco editado (0–300 s), somando as tabelas de `[T1 §1]` e `[T2 §1]`:

| Layout | 0–150 s `[T1]` | 150–300 s `[T2]` | Total | Fatia |
|---|---|---|---|---|
| Talking head em tela cheia (com ou sem sobreposição) | 40,8 s | ≈ 44 s | ≈ 84,8 s | 28% |
| Janela flutuante + apresentador no canto | 33,8 s | ≈ 49 s | ≈ 82,8 s | 28% |
| Cena de papel recortado em tela cheia | 34,1 s | ≈ 33 s | ≈ 67,1 s | 22% |
| Tela dividida (papel + apresentador em cartão) | 27,9 s | ≈ 24 s | ≈ 51,9 s | 17% |
| Recorte de documentação + apresentador no canto | 7,5 s | — | 7,5 s | 2,5% |
| Em transição | ~6 s | (embutido) | ~6 s | 2% |

O `STYLE.md §0` registra 28% / 30% / 18% / 23%: é a mesma medida com a documentação somada à janela e arredondamentos
diferentes (ver seção 12.2).

Vídeo inteiro (1110 s), usando os limites de `[M §0]`:

| Layout | Tempo | Fatia |
|---|---|---|
| Tela gravada crua + cartão do apresentador (fundo escuro) | ≈ 734 s | 66% |
| Talking head em tela cheia | ≈ 160 s (85 s no bloco editado + 75 s no fim) | 14% |
| Janela flutuante + apresentador no canto | ≈ 83 s | 7,5% |
| Cena de papel recortado | ≈ 67 s | 6% |
| Tela dividida | ≈ 52 s | 4,7% |
| Recorte de documentação | 7,5 s | 0,7% |

### 2.4 Ritmo por faixa de análise

Os relatórios cortam o vídeo em 6 faixas que não coincidem com os capítulos; a coluna "capítulos" diz a quais correspondem.

| Faixa | Capítulos | Eventos visuais/min | Eventos de edição/min | Maior trecho sem mudança | Fonte |
|---|---|---|---|---|---|
| 0–150 s | 1 | 33 | 33 | 11,2 s (116,3–127,5: frase parada sobre o rosto) | `[T1 §5]` |
| 150–300 s | 1, início do 2 | 28 (23 sem as microanimações da interface simulada) | 28 | 7,8 s (278,1–285,9: rosto puro) | `[T2 §5]` |
| 300–520 s | 2, 3, início do 4 | 4,9 (contando ações do app) | 1,1 | 54 s (466,1–520,0) | `[T3 §5]` |
| 520–760 s | 4, início do 5 | 3,0–3,8 | 0,75–1,5 (só cortes) | 43,6 s (557,6–601,2) | `[T4 §5]` |
| 760–944 s | 5, 6 | 6,5 | 0,65 (1,3 com os cortes prováveis) | ≈ 67 s (859–925) | `[T5 §5]` |
| 944–1110 s | 7, 8 | 2,9 | 0,36 | 74,5 s (1035,6–1110,1) | `[T6 §5]` |

Detalhe por janela de 30 s no primeiro trecho: 42, 32, 40, 30 e 22 eventos/min `[T1 §5]`. O ritmo cai ao longo do próprio
bloco editado.

Maior trecho parado por capítulo (lido das linhas do tempo):

| Capítulo | Maior trecho sem mudança | Observação |
|---|---|---|
| 1 (0–285) | 11,2 s | Segundo maior: 7,1 s (246,2–253,3) com 2 pílulas e seta congeladas `[T2]` |
| 2 (285–353) | 12 s (327,7–339,7) | E mais 17,9 s (339,8–357,7) que atravessam a virada para o capítulo 3 `[T3]` |
| 3 (353–452) | 42 s (381,4–423,4) | Só linhas de log surgindo `[T3]` |
| 4 (452–660) | 54 s medidos (466,1–520,0); ≈ 69 s se emendar com 520–534,9, parado até o primeiro corte `(inf., junção de [T3] e [T4])` | Outro de 43,6 s `[T4]` |
| 5 (660–814) | 24 s (704,8–728,8) | E 21 s (738,9–760) `[T4]` |
| 6 (814–944) | ≈ 67 s (859–925) | 57% do trecho 760–944 é tempo parado `[T5]` |
| 7 (944–1062) | 42,6 s (976,0–1018,6) | Seleção de texto esquecida durante uma digressão `[T6]` |
| 8 (1062–1110) | 48 s (o capítulo inteiro) | Parte dos 74,5 s finais `[T6]` |

Duração média dos elementos `[T1 §5][T2 §5]`: pílula 4,6–5,1 s (mediana 3,8–4 s; de 0,3 s a 16,6 s); frase serifada 6,4 s;
cartão de ícone ~5 s.

---

<a id="s3"></a>
## 3. Linha do tempo

Siglas de layout: **FT** = talking head em tela cheia · **JAN** = janela flutuante + apresentador no canto · **SPLIT** = tela
dividida · **CENA** = papel recortado em tela cheia · **DOC** = recorte de documentação · **CRU** = tela gravada crua +
cartão.

Tempos de `[T1]` e `[T2]` (15 fps, ±0,07 s); onde o 720p corrigiu, vale `[M-HD]` e está indicado.

### 3.1 Bloco editado, 0–150 s

| # | t (s) | O que entra / sai | Layout | Fala que dispara | Δ (s) |
|---|---|---|---|---|---|
| 1 | 0,2–0,5 | Palavra-título gigante em serifada itálica coral, canto superior esquerdo | FT | "Os **mods**" 0,2 | 0 a +0,2 |
| 2 | 1,07–1,27 | Pílula branca sob o título (resumo do gancho) | FT | "maior atualização" 0,8 | +0,25 (`[M]`: −0,04 sobre "atualização") |
| 3 | 1,47–1,75 | Mini-recorte de documento com fita, torto | FT | "do Claude Code" 1,9 | −0,4 |
| 4 | 2,9–3,9 | Push-in lento no footage (~1,00→1,10, inf.) | FT | fim da frase | — |
| 5 | 4,00–4,90 `[M-HD]` | Footage encolhe para o canto inferior direito; papel e janela aparecem por baixo; título, pílula e recorte somem em corte no frame 9 da troca | FT→JAN | "**Agora** você pode" 4,6 | −0,65 |
| 6 | 5,2–8,35 | Prompt digitado caractere a caractere dentro da janela | JAN | "pedir para… mudar" 5,3 | −0,1 |
| 7 | 8,35–8,5 | Prompt enviado, resposta aparece | JAN | "interface" 8,4 | 0 |
| 8 | 10,0–10,2 | Linha de ferramenta + painel de estatísticas abre na janela | JAN | "**mudar** o sistema" 10,0 | 0 |
| 9 | 10,19–11,39 `[M-HD]` | Zoom-in na janela (1,30), origem no painel; canto e pílulas não escalam | JAN | "para trabalhar" 10,9 | −0,35 `[T1]` |
| 10 | 11,6 | Linha verde de confirmação | JAN | — | — |
| 11 | 11,9–12,1 | Pílula coral colada à direita da janela | JAN | "**personalizada**" 12,0 | −0,1 |
| 12 | 12,7–13,5 | Zoom-out (segurou só 1,25 s) | JAN | "para você." 12,8 | +0,2 |
| 13 | 13,3–14,08 | Apresentador cresce até a tela cheia; janela e pílula somem em corte em 13,51, com o canto já em 34% da largura | JAN→FT | "**Inclusive**" 13,6 | −0,13 |
| 14 | 14,97–15,2 | Ícone de terminal em cartão escuro, à esquerda | FT | "abrir um **terminal**" 15,4 | −0,4 a −0,8 |
| 15 | 15,9–16,1 | Risco diagonal desenhado sobre o ícone | FT | "terminal" 15,8 | +0,1 |
| 16 | 16,1–16,3 | Pílula coral sob o ícone ("sem abrir…") | FT | reforço | +0,3 |
| 17 | 17,93 | Ícone + pílula saem juntos, fade de 7–8 f | FT | fim da frase 17,9 | — |
| 18 | 18,3–18,67 | Rasgo de papel da esquerda para a direita, 11 f | FT→CENA | "**Basta**" 18,4 | −0,1 |
| 19 | 18,6–23,3 | Cena 1: balões → engrenagens → janela (stop-motion ~6 fps) | CENA | "pedir em linguagem natural…" | — |
| 20 | 19,43–19,63 | Pílula branca, canto inferior esquerdo (premissa) | CENA | "**linguagem** natural" 19,5 | 0 |
| 21 | 20,8–21,0 | Pílula coral empilha abaixo (conclusão) | CENA | "**configura**" 21,0 | −0,2 |
| 22 | 23,3–24,2 | Corte da cena já com a troca em andamento: footage vira cartão vertical à direita sobre papel | CENA→SPLIT | "**Até aqui**" 23,3 | 0 |
| 23 | 23,5–23,8 | Rótulo em caixa alta coral (fade de 10 f) | SPLIT | "Até aqui" 23,3 | +0,45 `[T1]` |
| 24 | 23,62–24,39 | Título serifado em 2 linhas, palavra a palavra (5 palavras) | SPLIT | "personalizava" 24,3; "**como**" 26,0 | −0,4; **−1,7** |
| 25 | 30,2–30,45 | Cartão de ícone 1 | SPLIT | "**skills**" 30,3 | −0,1 |
| 26 | 31,0–31,3 | Cartão 2 | SPLIT | "**conectores**" 31,3 | −0,3 (`[M]`: −0,04) |
| 27 | 33,25–33,55 | Cartão 3 | SPLIT | "**ferramentas**" 33,3 | 0 |
| 28 | 34,65–34,85 | Pílula-resumo com seta e uma palavra coral | SPLIT | "**definia**" 34,8 | −0,15 |
| 29 | 37,0–37,9 | Cartão do apresentador cresce e cobre o conteúdo, que fica parado | SPLIT→FT | "documentos." 37,1 | 0 |
| 30 | 37,9–38,3 | Dissolve de ~11 f: footage real → versão ilustrada do mesmo enquadramento | FT→CENA | "**Os mods**" 38,0 | 0 |
| 31 | 38,6–41,0 | Câmera recua (~4,3 fps): o quadro vira o conteúdo de uma janela de papel | CENA | "um passo além…" | — |
| 32 | 42,0–42,15 | Pílula coral, canto inferior esquerdo | CENA | "**ambiente**" 42,0 | 0 |
| 33 | 43,5–44,4 | Corte + footage vira cartão vertical | CENA→SPLIT | "**Pode** mudar" 43,5 | 0 |
| 34 | 43,85–44,65 | Rótulo + título palavra a palavra (resume a frase **anterior**) | SPLIT | frase de 40,2–43,4 | **+1,8** |
| 35 | 44,5–44,8 | Cartão 1 (rótulo de 2 linhas) | SPLIT | "**decisão**" 44,4 | +0,1 |
| 36 | 46,33–46,55 | Cartão 2 | SPLIT | "**alterar**" 46,4 | −0,05 |
| 37 | 48,4–48,6 | Cartão 3 | SPLIT | "**criar**" 48,5 | −0,1 |
| 38 | 52,9–53,8 | Cartão cresce até a tela cheia; footage fica ~1,25× mais fechado | SPLIT→FT | "por exemplo" 52,9 | 0 |
| 39 | 54,67–54,87 | Pílula branca pequena (faz de rótulo da frase) | FT | "mais **interessante**" 54,4 | +0,25 |
| 40 | 56,76–57,36 | Frase serifada branca em 2 linhas, palavra a palavra (4 palavras, 19 f) | FT | "não precisa **abrir**" 57,5 | termina 0,27 s antes de "abrir" e 0,67 s antes de "terminal" `[M]` |
| 41 | 60,29–60,5 | Pílula + frase saem juntas, fade de 8 f | FT | fim da frase 60,3 | — |
| 42 | 60,3–61,2 | Footage vira canto; janela aparece | FT→JAN | "**Na aba** do Code" 60,7 | −0,2 |
| 43 | 61,0–61,2 | Pílula branca à direita da janela (onde estamos) | JAN | "aba do **Code**" 61,4 | −0,4 |
| 44 | 61,7–62,0 | Cursor clica numa aba (minúsculo, sem destaque) | JAN | "aplicativo para desktop" 61,8 | 0 |
| 45 | 63,5–63,7 | Pílula coral empilha abaixo | JAN | "descrever" 63,7; "**linguagem**" 64,5 | −0,2 / **−1,0** |
| 46 | 63,5–67,4 | Prompt digitado | JAN | "descrever em linguagem natural" | 0 |
| 47 | 67,5–68,0 | Prompt enviado; resposta e linha de ferramenta | JAN | "passa a" 67,1 | +0,4 |
| 48 | 68,7–69,9 | Zoom-in (1,22) na conversa | JAN | "o próprio **sistema**" 69,1 | −0,2 |
| 49 | 70,0–73,5 | Bloco de código entra linha a linha | JAN | "**criar o código**" 69,9 | +0,1 |
| 50 | 73,3 | Linha final em coral | JAN | "passa a valer" 73,3 | 0 |
| 51 | 74,3–75,2 | Zoom-out (segurou 4,5 s) | JAN | "a partir do momento" 74,4 | 0 |
| 52 | 75,35–75,6 | Janela sai: fade + encolhe até 0,73 (8–9 f) | JAN | "**fecha**" 75,4 | −0,05 |
| 53 | 75,9–76,25 | Janela nova entra: fade + cresce de 0,90 (9–10 f); 8 f de papel vazio no meio | JAN | "**abre**" 75,8 | +0,1 |
| 54 | 76,6–76,8 | Pílula verde com "✓" (3ª da pilha lateral) | JAN | "novamente o aplicativo" 76,4 | +0,2 |
| 55 | 77,6 | Corte: janela + 3 pílulas somem em 1 frame; fica papel + canto por 0,25 s | JAN→DOC | fim da frase 77,5 | — |
| 56 | 77,82–78,2 | Recorte de documentação com fita + pílula-fonte acima: fade + subida | DOC | "**É um pedido**" 77,9 | −0,05 |
| 57 | 80,1–81,0 | Marca-texto coral varre a primeira frase (~0,9 s) | DOC | "mudar o seu próprio **sistema**" | +0,8 no início; termina na palavra |
| 58 | 83,5–83,7 | Pílula coral sob o recorte (conclusão) | DOC | "personalizar a interface" 82,8 | +0,7 |
| 59 | 85,3–86,2 | Recorte + pílulas somem em corte no frame 4; o canto quadrado cresce e vira cartão vertical | DOC→SPLIT | "**O que poucas**" 85,5 | −0,1 |
| 60 | 85,9 | Rótulo em caixa alta | SPLIT | "poucas pessoas" 85,7 | +0,2 |
| 61 | 86,85–87,4 | Título palavra a palavra | SPLIT | "**não só** no terminal" 88,6 | **−1,75** |
| 62 | 89,13–89,4 | Miniatura 1 (janela escura de terminal) com rótulo embaixo | SPLIT | "**terminal**" 89,1 | 0 |
| 63 | 90,6–90,9 | Miniatura 2 (app), com contorno coral | SPLIT | "**app** para desktop" 90,7 | −0,1 |
| 64 | 91,1–91,3 | Selo coral no canto da miniatura 2 | SPLIT | "também" 89,8 / "desktop" 91,2 | +1,3 / 0 |
| 65 | 91,87–92,4 | Conteúdo some em corte; 4 f de papel vazio; rasgo de 11 f engole o cartão do apresentador por último | SPLIT→CENA | "**O que é muito**" 92,0 | −0,1 |
| 66 | 92,3–102,0 | Cena 2: papéis voam para dentro de um notebook (9,7 s contínuos) | CENA | "pessoas não técnicas…" | — |
| 67 | 95,0–95,2 | Pílula branca | CENA | "não são **técnicas**" 94,9 | +0,1 |
| 68 | 100,4–100,6 | Pílula coral | CENA | "**arquivos**" 100,7 | −0,3 |
| 69 | 102,0 | Corte seco para o footage + push-in lento até 114,9 (~1,00→1,08) | CENA→FT | "**se você**" 102,3 | −0,3 |
| 70 | 103,07–103,3 | Pílula branca 1 | FT | "não trabalha com **código**" 104,7 | **−1,6** |
| 71 | ~104,8–105,0 | Risco horizontal sobre a pílula 1 | FT | "código" 104,7 | +0,1 |
| 72 | 105,4–105,6 | Pílula branca 2 | FT | "não faz **vibe**" 105,6 | −0,2 |
| 73 | 106,05–106,2 | Risco sobre a pílula 2 | FT | "**mas**" 106,4 | −0,3 |
| 74 | 107,0–107,2 | Pílula verde (a alternativa) | FT | "trabalha com **documentos**" 107,0 | 0 |
| 75 | 108,33–108,55 | Pílula coral de conclusão, mais torta (−2,5°) e com vão maior | FT | "**maior poder**" 108,2 | +0,1 |
| 76 | 113,6–113,8 | Pílula escura com uma palavra em caixa alta | FT | "**seu** fluxo" 113,4 | +0,2 |
| 77 | 114,41 `[M-HD]` | As 5 pílulas saem juntas, fade de 8 f (`[T1]`: 114,6) | FT | fim da frase 114,6 | 0 |
| 78 | 114,9 | Jump cut: footage volta ao plano aberto | FT | "**Vou dar**" 114,9 | 0 |
| 79 | 115,58–116,18 `[M-HD]` | Frase serifada com numeral em itálico coral | FT | "alguns **exemplos**" 115,55 | +0,03 |
| — | 116,3–127,47 | **Nada muda por 11,2 s** | FT | frase longa de transição | — |
| 80 | 127,47 | Corte seco para a cena 3 + indicador "EXEMPLO 1…6" no topo esquerdo | FT→CENA | "**Então** imagina" 127,7 | −0,2 |
| 81 | 129,5–129,7 | Pílula branca (a situação) | CENA | "**apagar**" 129,5 | 0 |
| 82 | 130,93–131,6 | Chip vermelho mono com contador 0→40 em 0,65 s | CENA | "**40** arquivos" 130,9 | 0 |
| 83 | 133,3–134,2 | Corte + footage vira canto; janela por baixo | CENA→JAN | "mod que **interrompe**" 133,5 | −0,2 |
| 84 | 133,8–134,1 | Modal abre dentro da janela + pílula coral | JAN | "interrompe" 133,5 | +0,3 |
| 85 | 134,5–135,7 | Zoom-in (1,30) no modal | JAN | "e **mostre**" 135,2 | 0 |
| 86 | 136–140 | Lista rola dentro do modal | JAN | "todos os arquivos…" 136,6 | 0 |
| 87 | 140,7–141,3 | Zoom-out, cortado ainda em 1,02 | JAN | "excluir tudo aquilo" 140,5 | +0,3 |
| 88 | 141,2–141,8 | Janela + pílula somem em corte; indicador avança; 4 f de vazio; rasgo engole o canto | JAN→CENA | "**Você** pode ter um outro" 141,5 | −0,3 |
| 89 | ~144,9–145,1 | Pílula verde (a solução) | CENA | "**lixeira**" 144,8 | +0,1 |
| — | 145,1–150 | Cena segue em loop, sem elemento novo (4,9 s) | CENA | — | — |

### 3.2 Bloco editado, 150–300 s

| # | t (s) | O que entra / sai | Layout | Fala que dispara | Δ (s) |
|---|---|---|---|---|---|
| 1 | 150,0–151,2 | Cena (lixeira) com pílula verde herdada; indicador no 2 | CENA | "Por padrão…" | — |
| 2 | 151,20 | Corte seco para o apresentador; pílula morre no corte | FT | "faz" 150,89 | +0,3 |
| 3 | 151,33–151,47 | Pílula **vermelha** (o padrão ruim) | FT | "exclusão" 151,29 | +0,05 |
| 4 | 153,47–153,67 | Pílula **verde** empilha (a solução); fica só 0,4 s | FT | "enviar para a lixeira" 153,21 | +0,25 |
| 5 | 154,00–154,9 | Footage vira canto; as 2 pílulas somem em corte dentro da troca; indicador → 3 | FT→JAN | "E você pode ter ainda" 154,25 | −0,25 |
| 6 | 154,9–157,0 | Interface simulada "digita" 3 linhas, uma a cada ~0,7 s | JAN | acompanha a frase | — |
| 7 | 157,33 | Painel lateral desliza da direita dentro da janela | JAN | "histórico" 157,37 | 0 |
| 8 | 157,53–157,73 | Pílula coral torta na margem direita | JAN | "histórico" | +0,15 |
| 9 | 157,9–159,1 | Zoom-in (1,25) na janela | JAN | "das ações" 158,22 | +0,5 `[M]` |
| 10 | 158,6–165,0 | Itens do painel entram um a um (~1 a cada 1,3 s) | JAN | cada item na palavra | 0 |
| 11 | 165,93–166,10 | Pílula branca + bloco em itálico com barra coral na interface | JAN | "pensamentos" 165,96 | 0 |
| 12 | 169,20–169,73 | Zoom-out (segurou 10,0 s) | JAN | fim da frase | — |
| 13 | 169,80–170,8 | Troca de exemplo: janela antiga some em corte, nova entra em fade à direita, o canto desliza 72,9% da largura para a esquerda em 30 f; indicador → 4 | JAN espelhado | "Agora pense na interface" 169,98 | −0,2 |
| 14 | 170,5–173,5 | Interface digita 2 linhas | JAN | "termina uma tarefa" | — |
| 15 | 174,87–175,07 | Pílula coral (canto superior esquerdo) + painel abre | JAN | "painel" 174,91 | 0 |
| 16 | 175,42–176,62 `[M-HD]` | Zoom-in (1,25) | JAN | "do lado ali mesmo" | — |
| 17 | 177,0–183,5 | Painel enche em 3 blocos, um por palavra; o último destacado em coral | JAN | 179,3 / 181,3 / 182,5 | 0 |
| 18 | 185,40–185,93 | Zoom-out (segurou 8,7 s) | JAN | "perguntando" 185,03 | — |
| 19 | 186,00–186,9 | Janela + pílula somem em corte; o canto cresce até a tela cheia | JAN→FT | "e agora" 186,18 | −0,2 |
| 20 | 186,33–186,87 | Pergunta serifada branca, palavra a palavra, última em itálico coral, ainda durante a troca | FT | cada palavra | ~+0,1 (`[M]`: +0,4) |
| 21 | 188,60 | Pergunta some em ≤ 2 frames | FT | "passos" 188,18 | — |
| 22 | 188,80–189,13 | Rasgo de papel; indicador → 5 | FT→CENA | "em um projeto maior?" 188,9 | 0 |
| 23 | ≈ 192,3 | Pílula branca (superior esquerda) | CENA | "várias etapas" 192,56 | ≈ −0,2 |
| 24 | 197,13–197,33 | Pílula coral empilha | CENA | "perdido" 197,22 | 0 |
| 25 | 198,67–199,6 | Corte + footage vira canto; pílulas cortadas | CENA→JAN | "Você pode ter um mod" 198,75 | 0 |
| 26 | 199,3–200,9 | Interface digita; painel abre (≈ 200,1) e fases entram uma a uma | JAN | "vai definindo" 200,5 | — |
| 27 | 200,7–201,9 | Zoom-in (1,25) | JAN | "definindo" 200,47 | +0,2 |
| 28 | ≈ 202,4 | Pílula coral | JAN | "todas as etapas" 202,79 | ≈ −0,3 |
| 29 | 201,5–206 | 5 fases listadas, a 3ª com contorno coral | JAN | "o que está sendo feito" | — |
| 30 | 206,53–206,67 | Pílula branca; fica só 0,9 s | JAN | "plano" 206,53 | 0 |
| 31 | 206,87–207,47 | Zoom-out | JAN | fim da frase | — |
| 32 | 207,53 | Corte seco para cena; indicador → 6 | JAN→CENA | "Teve um exemplo" 207,61 | 0 |
| 33 | ≈ 211,4 | Pílula branca | CENA | "jogo multiplayer" 211,69 | ≈ −0,3 |
| 34 | ≈ 213,9 | Pílula coral | CENA | "trabalhando" 214,18 | ≈ −0,3 |
| 35 | 218,00 | Corte seco para o apresentador no meio da frase | CENA→FT | "elas esperam" 218,26 | — |
| 36 | 221,49–221,9 `[M-HD]` | **Carimbo** de veredito bate na tela, torto | FT | cai em "esdrúxulo" 221,72 | **0,93–1,19 s antes** de "inútil" 222,82 |
| 37 | 222,07–222,20 | Punch-in seco no footage (~1,08×) | FT | 0,3 s depois do carimbo | — |
| 38 | ≈ 226,4 | Pílula coral (esquerda, y ≈ 62%) | FT | "poder" 226,38 | 0 |
| 39 | 230,27–230,40 | Carimbo + pílula saem em fade; footage volta ao plano normal | FT | "disso." 230,25 | — |
| 40 | 230,56–230,93 | Rasgo de papel | FT→CENA | "Em resumo" 230,67 | 0 |
| 41 | 234,47–234,60 | Pílula escura mono (o termo), canto inferior esquerdo | CENA | termo 234,53 | 0 |
| 42 | 235,27–235,40 | Pílula branca ao lado, na mesma linha (a definição) | CENA | "o motor" 235,17 | +0,1 |
| 43 | 239,53–239,67 | Pílula coral abaixo | CENA | "descrever a mudança" 237,9–238,8 | **+1,0 a +1,5** |
| 44 | 242,33 | Corte seco para o apresentador; indicador some de vez | CENA→FT | "Inclusive" 242,45 | −0,1 |
| 45 | 243,40–243,60 | Pílula branca | FT | "exportar" 243,33 | +0,1 |
| 46 | 245,67–245,87 | Pílula coral (o que está na descrição) | FT | "na descrição" 245,53 | +0,15 |
| 47 | 246,00–246,20 | Seta fina coral para baixo, sob as pílulas | FT | idem | — |
| 48 | 246,2–253,3 | **Nada muda por 7,1 s** | FT | frase longa | — |
| 49 | 253,33–253,47 | Pílulas + seta saem em fade | FT | "do seu jeito." 253,20 | — |
| 50 | 253,5–254,4 | Footage vira cartão vertical; moldura com cena ilustrada + rótulo surgem em fade | FT→SPLIT | "E é por isso" 253,68 | −0,15 |
| 51 | 256,53–256,70 | Pílula branca sob a moldura | SPLIT | "Uma skill" 256,43 | +0,1 |
| 52 | ≈ 261,0 | Pílula coral; a cena na moldura evolui | SPLIT | "Já o mod" 260,65 | ≈ +0,3 |
| 53 | 264,13–264,47 | Todo o lado esquerdo sai em fade simultâneo (0,33 s); o cartão fica | SPLIT | "acontecem." 263,83 | — |
| 54 | 264,80–265,40 | Rótulo + título palavra a palavra (cadência fixa) | SPLIT | "Para quem usa… no trabalho" | — |
| 55 | 268,47–268,67 | Cartão pequeno 1 | SPLIT | "proteger" 268,66 | 0 (0,8 s antes do rótulo ser dito) |
| 56 | ≈ 270,4 | Cartão 2 | SPLIT | "segurança" 270,56 | ≈ −0,15 |
| 57 | ≈ 271,4 | Cartão 3 | SPLIT | "acompanhar" 271,40 | 0 |
| 58 | ≈ 273,4 | Cartão 4 | SPLIT | "limites" 273,42 | 0 |
| 59 | 275,73–276,00 | Recorte de tela "colado com fita" + cartão 5 | SPLIT | "gastos" 275,80 | 0 |
| 60 | 276,53–276,73 | Cartão 6 | SPLIT | "janela" 276,61 | 0 |
| 61 | 277,3–278,2 | Cartão do apresentador cresce e cobre tudo; o 7º cartão nasce em 277,73 e é coberto antes de ser lido | SPLIT→FT | "de cache" 277,61 | — |
| 62 | 278,07–285,9 | **Apresentador puro por 7,8 s** | FT | — | — |
| 63 | ≈ 286,0 | Pílula branca | FT | "recorte" 286,11 | ≈ 0 |
| 64 | ≈ 287,9 | Pílula escura, recuada | FT | nome do produto 288,07 | ≈ −0,1 |
| 65 | 289,53–289,73 | Pílula branca com "›", mais recuada | FT | "aba" 289,58 | 0 |
| 66 | 291,00–291,13 | Pílula coral com "›", mais recuada ainda; fica 0,3 s | FT | "desktop" 290,96 | +0,05 |
| 67 | 291,29–291,56 `[M-HD]` | As 4 pílulas saem juntas, fade de 8 f | FT | — | — |
| 68 | ≈ 291,8 | Punch-in seco no footage (~1,1×) | FT | "que é nesse ambiente" 291,70 | — |
| 69 | 293,5–294,4 | Footage vira canto; pílula coral ("a seguir…") entra por baixo dele com a troca a ~50% | FT→JAN | "demonstração" 293,76 | +0,2 |
| 70 | ≈ 296,3 | Pílula branca | JAN | "problemas" 296,60 | ≈ −0,3 |
| 71 | 298,70–299,57 | Dissolve longo (26–27 f) do layout inteiro para o apresentador | JAN→FT | "Mas a melhor forma" 299,64 | −0,2 |

### 3.3 Restante do vídeo, por blocos

| Faixa (s) | Layout | O que acontece na imagem | O que a fala pedia e não recebeu | Fonte |
|---|---|---|---|---|
| 300,0–300,93 | FT | Apresentador olha para o computador | — | `[T3]` |
| 300,93–301,10 | FT→CRU | Dissolve de 5–6 f; o rosto não encolhe, apaga grande e reaparece pequeno (fantasma por 2 frames) | Troca com elemento compartilhado | `[T3][M-HD]` |
| 301,1–339,7 | CRU | Cliques em abas, menu, modal de configurações; cursor como único guia; 12 s parado no modal | Zoom no número da versão; trilha de passos | `[T3]` |
| 339,74 | CRU | Dissolve de 3 f só dentro do cartão de tela (salto de tomada) | — | `[T3]` |
| 339,8–381,4 | CRU | 17,9 s parado; prompt colado em 2 saltos (ilegível, com sublinhado do corretor) por 24 s | Cartela de capítulo em 353 s; prompt redesenhado | `[T3]` |
| 381,4–423,4 | CRU | 42 s com a conversa quase vazia, só linhas de log | Rótulos para os termos citados | `[T3]` |
| 423,36 | CRU | Corte seco que esconde ~10 min de processamento | Sinal de salto de tempo | `[T3]` |
| 423,4–466,1 | CRU | Resultado em texto denso; seleção azul nativa no caminho da pasta; app fecha (papel de parede colorido) e reabre em corte | Caminho da pasta em destaque; capítulo em 452 s | `[T3]` |
| 466,1–534,9 | CRU | A faixa criada aparece (1,5% da altura do quadro) e a tela fica parada | 6 números falados (60 min, 10×, 20×, 500 mil, 30%, versão) | `[T3][T4]` |
| 534,9–601,2 | CRU | 2 cortes secos de limpeza; cursor passeia sobre a faixa | "três vezes mais", "1 milhão", "8%", "acima de 20" | `[T4]` |
| 601,2–613,0 | CRU | Menu de comandos abre 1,13 s depois da palavra e fica 10 s, ilegível | Zoom no menu | `[T4]` |
| 613–660 | CRU | Parado 29 s; popover de uso abre 1,2 s depois de "embaixo" e fica 3 s | Destaque das duas barras | `[T4]` |
| 660,2–704,8 | CRU | Virada de capítulo sem marca; prompt colado (parede de texto), enviado, resposta, confirmação | Cartela "Mod 2"; prompt redesenhado | `[T4]` |
| 704,8–760 | CRU | 56 s de fala sobre o risco de vazar chave, com a tela parada num texto de status | Diagrama de 3 passos | `[T4]` |
| 760–823 | CRU | Rolagens nativas, 2 cortes secos (787,92 e 817,92), app fecha e reabre | Capítulo em 814 s | `[T5]` |
| 823–859 | CRU | 23 s parado; lista de comandos abre ~3 s antes da palavra; painel lateral abre 0,8–1,0 s antes de "abrir" | Zoom na lista e no painel | `[T5]` |
| 859–925 | CRU | **≈ 67 s sem mudança de imagem**, a fala mais rica do trecho | Rótulos nos campos, comparação "fixo × chamado", passos | `[T5]` |
| 926–944 | CRU | Troca para o navegador (tabela de 4 itens) 0,9 s antes da fala | Reenquadrar a tabela | `[T5]` |
| 944–1035,4 | CRU | 3 seleções de texto nativas (0,9 s, 3,1 s e 42,6 s esquecida numa digressão); balão de extensão vazado por ~64 s | Marca-texto de pós, placar dos 4 itens, comparação "258 mil × um terço" | `[T6]` |
| 1035,40–1035,57 | CRU→FT | Dissolve de 5–6 f, na pausa entre frases | Cartão crescer até a tela cheia | `[T6][M-HD]` |
| 1035,6–1110,1 | FT | **74,5 s sem nenhuma mudança**: recapitulação, like, inscrição, despedida; fim em corte seco | Resumo, CTA sincronizado, tela final | `[T6]` |

---

<a id="s4"></a>
## 4. Catálogo de layouts

Medidas de geometria de `[D-HD §2.5]` e `[M-HD §2.1]` (720p), convertidas para 1920×1080. A referência **não tem legenda em
nenhum layout** `[T2][D §2]`; a linha "legenda" de cada ficha diz o que isso implica para nós.

### 4.1 Talking head com sobreposições (FT)

```
0        112 px (5,8%)                                          1920
+----------------------------------------------------------------+
| [EXEMPLO][1][2][3]...   <- indicador em (30, 22), fora da margem|
|                                                                 |
|  Palavra.     <- serifada itálica coral, x 96, base y 212 (19,6%)|
|                                                                 |
|  [ pílula 1 ]     topo y 261 (24,2%)            .---------.     |
|  [ pílula 2 ]     +100 px                       |  rosto  |     |
|  [ pílula 3 ]     +100 px                       |  (centro |     |
|                                                 |  ou 58%) |     |
|  [ conclusão ]    vão de 68 px antes            '---------'     |
|                                                                 |
|  Frase grande     bloco y 33-54%, x 113, largura <= 40%         |
|  em duas linhas.                                                |
+----------------------------------------------------------------+
```

| Item | Valor |
|---|---|
| Quando usar | Fala direta: gancho, opinião, transição entre blocos, resumo de 2–5 ideias seguidas |
| Quanto dura | 2 a 11 s por bloco em `[T2]`; o maior bloco contínuo de talking head tem 25,5 s (102,0–127,5 s, com um jump cut no meio) `[T1 §5]` |
| O que vai por cima | Coluna de até 5 pílulas, palavra-título, frase serifada, carimbo, ícone riscado, seta. Tudo na coluna esquerda (x = 112 px); nada centralizado, nada à direita `[D §6]` |
| Como entra | Vindo de outro layout: o cartão ou o canto do apresentador cresce até a tela cheia (27 f). Vindo de cena: corte seco |
| Como sai | Elementos em fade coletivo de 8 f, 1–6 f antes da troca; ou cortados dentro da troca `[M-HD §2.2]` |
| Footage | 3 enquadramentos do mesmo take: aberto, fechado (~1,15–1,25×) e push-in lento. Com frase grande, o rosto vai de x ≈ 50% para ≈ 58% e a escala sobe para ≈ 1,18× `[D §1]`. Sem escurecer, sem desfocar |
| Legenda | A referência não tem. No editor a legenda **fica ligada** aqui: as pílulas ocupam o alto e a lateral |

### 4.2 Tela dividida: papel + apresentador em cartão vertical (SPLIT)

```
0     112                                    1310   1419        1885 1920
+------------------------------------------------------------------+
|                                                    .-----------.  | y 54 (5%)
|      RÓTULO EM CAIXA ALTA   (caixa alta y 106-122) |           |  |
|      Título serifado em     (topo y 150)           |           |  |
|      duas linhas *itálico*  (2a base y 311)        | apresen-  |  |
|                                                    | tador     |  |
|      +--------+ +--------+ +--------+              | 466x971   |  |
|      | ícone  | | ícone  | | ícone  |  y 432-741   | (24,3% x  |  |
|      | Rótulo | | Rótulo | | Rótulo |  355x309     |  89,9%)   |  |
|      +--------+ +--------+ +--------+  vão 45      |           |  |
|                                                    |           |  |
|      [ pílula de conclusão ]  ~130 px abaixo       '-----------'  | y 1025 (95%)
+------------------------------------------------------------------+
        coluna de conteúdo: x 112 -> 1310 (62,5%)     margem direita 35 px
```

| Item | Valor |
|---|---|
| Cartão do apresentador | x 1419→1885 (73,9–98,2%), y 54→1025; 466×971 px (24,3% × 89,9%); proporção 0,48; raio 33–35 px; borda branco-quente 4,5 px `[D-HD]` (6 px em `[M-HD]`); sombra ≈ `0 33px 72px rgba(0,0,0,.30)` |
| Recorte do footage | "Cover" puro, sem zoom extra: escala 0,90, centro em x ≈ 60% do footage `[M-HD §2.1]`; olhos a ~38% da altura do cartão `[D §3]` |
| Variantes da coluna de conteúdo | 3 cartões grandes em linha; 6 cartões pequenos em 4+2 (y 333 e 622) com um recorte de tela torto no vazio à direita; 2 miniaturas de janela de 558×328 com rótulo embaixo; moldura de cena ilustrada de 1000×563 (x 111→1110, y 138→701) com 2 pílulas abaixo |
| Quando usar | Enumeração, comparação, definição: "antes × agora", "A × B", lista de benefícios `[T1 P2][T2 P7]` |
| Quanto dura | 13,1 s, 8,8 s, 6,0 s `[T1]` e 24 s em duas fases `[T2]` |
| Como entra | O footage desliza e recorta para a direita (27 f). Rótulo começa com a troca a ~50%, título palavra a palavra em seguida, cartões um por palavra falada |
| Como sai | O cartão cresce para a esquerda e **cobre** o conteúdo, que fica parado (3×); ou conteúdo some em corte + rasgo (1×) |
| Troca de fase interna | Lado esquerdo sai em fade simultâneo de 0,33 s, 0,3 s de papel vazio, título novo `[T2 P7]` |
| Footage | Continua vivo dentro do cartão; nunca some |
| Legenda | Escondida no editor (`hidesCaptions: true`): o texto do layout já resume a fala |

### 4.3 Janela flutuante + apresentador no canto (JAN)

```
0  71                                              1428 1455      1865 1920
+------------------------------------------------------------------+
|                                                       [ pílula ]  | x 1450, y 145
|  .-------------------------------------------------.  [ pílula ]  | passo 88 px
|  | o o o   título                                  |  [ pílula ]  | rotação +-2,05
|  |-------------------------------------------------|              |
|  |                                                 |              |
|  |   interface simulada (ou gravação de tela)      |              | y 634
|  |   1357 x 859 px  (70,7% x 79,6%)                | .----------. |
|  |   raio 19, sombra 0 30px 90px .30               | | apresen- | |
|  |                                                 | | tador    | |
|  |                                                 | | 410x391  | |
|  '-------------------------------------------------' '----------' | y 1025
+------------------------------------------------------------------+
   y 90 -> 949                              folga 27 px   margens 55 px
```

| Item | Valor |
|---|---|
| Janela | x 71→1428 (3,7–74,4%), y 90→949 (8,3–87,9%); raio 19 `[D-HD]` (~16 em `[M-HD]`); fio claro de 1 px no topo |
| Canto do apresentador | x 1455→1865, y 634→1025; 410×391 px (21,4% × 36,2%); raio 33 `[D-HD]` (~26 em `[M-HD]`); borda branco-quente 4,5–6 px; margens iguais de 55 px; sombra ≈ `0 24px 72px rgba(0,0,0,.35)` |
| Recorte do canto | **Não é "cover"**: zoom extra de ~1,6× no rosto (escala 0,55 do footage; centro em 56% x, 32% y) `[M-HD §2.1]` |
| Variante espelhada | Canto em x 54→465, janela em x 500→1860 (26,0–96,9%); o canto fica por cima da quina da janela. Usada quando o conteúdo importante está do lado onde o canto ficaria (169,8–186 s) |
| Coluna de pílulas | Faixa de papel acima do canto: x 1450 (75,5%), pílulas "mini" de 51–56 px de altura, até 3 |
| Dentro da janela | Interface **redesenhada como gráfico**, não captura bruta: texto maior e nítido, poucas linhas, digitação de ~0,7 s por linha, painel que desliza, itens entrando a cada ~1,3 s, item destacado com contorno ou fundo coral `[T2 P2][D §4.8]` |
| Quando usar | Demonstração: "você pede → ele faz", "imagina um mod que…", gancho "a seguir" |
| Quanto dura | 9,5 / 16,6 / 7,7 s `[T1]`; 15,8 / 16,2 / 8,9 / 5,0 s `[T2]` |
| Como entra | O footage encolhe para o canto (27 f); papel e janela aparecem **já no lugar**, em corte, no frame 5–9 da troca |
| Como sai | Zoom-out, depois: canto cresce até a tela cheia (janela some em corte no frame 10); ou corte + rasgo; ou dissolve de 27 f |
| Zoom | 1 por bloco: só a janela escala (1,22–1,30); canto, pílulas e indicador ficam por cima |
| Legenda | Escondida no editor |

### 4.4 Recorte de documentação + apresentador no canto (DOC)

```
+------------------------------------------------------------------+
|  [ fonte · dominio ]      <- pílula compacta, x 93, y 70-122      |
|   \fita                                     fita/                 |
|  +-----------------------------------------------+                |
|  | TÍTULO DA PÁGINA                              |  x 76 -> 1401  |
|  | #### frase marcada ####  resto do parágrafo   |  y 166 -> 791  |
|  | ...                                           |  torto -0,86   |
|  +-----------------------------------------------+   .---------.  |
|  [ pílula coral: a conclusão ]                       | apresen.|  |
|                                                      '---------'  |
+------------------------------------------------------------------+
```

| Item | Valor |
|---|---|
| Recorte | Captura real da página (tema escuro) tratada como foto colada: moldura creme de 12–13 px, 2 fitas de 129×38 px a ±37° nos cantos de cima (alfa ≈ 0,8), inclinação −0,86°, sombra ≈ `0 24px 60px rgba(0,0,0,.30)` `[D-HD]` |
| Marca-texto | Faixa coral de 45 px de altura, alfa 0,43, com sublinhado coral sólido de ~3 px; cobre **uma** frase `[D-HD]` |
| Quando usar | Provar que a afirmação vem da fonte oficial |
| Quanto dura | 7,5 s (1 vez); versão miniatura na abertura (600×314 px, −2°) e na grade de 6 cartões |
| Como entra | Fade + subida de 66 px em 9–10 f; pílula-fonte junto |
| Como sai | Corte de 1 frame dentro da troca seguinte |
| Legenda | No editor: escondida se ocupar a base; o `DocQuote` reserva 150 px embaixo |

### 4.5 Cena de papel recortado em tela cheia (CENA)

```
+------------------------------------------------------------------+
| [EXEMPLO][1][2]...                                                |
|  [ pílula ]  <- variante no alto: y 10-20%                        |
|                                                                   |
|                    objeto principal no centro ou à direita        |
|                    (papel em camadas, luz do alto-esquerda)       |
|                                                                   |
|  [ pílula branca ]   <- x 92 (4,8%), y 80-92%                     |
|  [ pílula coral  ]      canto reservado: ~40% x 25%               |
+------------------------------------------------------------------+
```

| Item | Valor |
|---|---|
| Quando usar | Conceito abstrato sem tela para mostrar; uma metáfora literal por frase `[T1 P5]` |
| Quanto dura | 4,7 / 5,5 / 9,7 / 5,8 / 8,4+ s `[T1]`; 9,6–11,4 s `[T2]` |
| Como entra | Rasgo de papel (5×), corte seco (2×), dissolve com o mesmo enquadramento (1×) |
| Como sai | **Sempre corte seco** |
| Animação | Stop-motion: 6 fps em 18,8 s, ~4,3 fps em 38 s, 10 fps nas demais `[M §4]`; as pílulas por cima rodam a 30 fps |
| Footage | Some por completo, inclusive o canto. É o único layout sem o rosto |
| Sobreposições | 1–3 pílulas no canto + indicador de exemplo |
| Variante emoldurada | A mesma arte dentro de uma moldura de 1000×563 na tela dividida (254–263 s) |
| Legenda | Escondida no editor |

### 4.6 Tela gravada crua + cartão do apresentador (CRU)

```
+------------------------------------------------------------------+   fundo #19201f -> #0c1110
|                  faixa vazia de 13%                               |
| +-------------------------------------------------+               |
| |                                                 | .----------.  | y 279
| |  janela inteira do app (tema escuro)            | |          |  |
| |  x 29 -> 1507 (77%), y 140 -> 940 (74%)         | | apresen- |  |
| |  sem moldura, sem sombra, canto quase reto      | | tador    |  |
| |                                                 | | 355x512  |  |
| |                                                 | '----------'  | y 791
| +-------------------------------------------------+               |
|                  faixa vazia de 13%                               |
+------------------------------------------------------------------+
                                              x 1538 -> 1893 (18,5%)
```

| Item | Valor |
|---|---|
| Janela | x 1,5–78,5% (77% da largura), y 13–87% (74%); canto quase reto; sem borda desenhada nem sombra; cor `#141414` sobre fundo `#19201f`→`#0c1110`: quase não se lê como cartão `[T3][T4][T5][D-HD]` |
| Cartão do apresentador | x 1538→1893 (18,5%), y 279→791 (47,4%), proporção ~2:3, **centrado na vertical**, raio ≈ 35 px, **sem borda**, com feather de ~3 px `[D-HD]` |
| Calha | 1,6% entre os cartões; margem direita 1,4% |
| Texto da interface | 0,9 a 1,4% da altura do quadro (≈ 10–15 px em 1080p): ilegível em celular `[T3][T5]` |
| Quanto dura | 734 s contínuos, sem variação de posição ou tamanho |
| Como entra / sai | Dissolve de 5–6 f nas duas pontas, sem movimento do rosto |
| O que vale manter | Rosto sempre visível; cortes secos caem 0,06–0,2 s antes da primeira palavra e somem porque o cartão é pequeno `[T4][T5]` |
| O que não copiar | Todo o resto: é outro sistema visual dentro do mesmo vídeo (outro fundo, outro cartão, zero anotação) `[D §6]` |

### 4.7 Encerramento

Talking head em tela cheia, enquadramento fixo (olhos a ~33% da altura, cabeça ~30% da altura do quadro), 74,5 s sem nenhum
elemento, sem zoom medido, fim em corte seco 0,2 s depois da última palavra. **Não há tela final nem chamada desenhada**
`[T6 P5]`. Não é um layout a copiar: é o maior espaço para superar (seção 10, item 9).

---

<a id="s5"></a>
## 5. Catálogo de elementos

Geometria de `[D-HD]`; contagens de `[T1]` e `[T2]` (bloco editado, 300 s).

### 5.1 Pílula

| Aspecto | Medido |
|---|---|
| Forma | Retângulo de canto pouco arredondado, **não é cápsula**: raio ≈ 8 px (360p estimava 10–12 → 720p: 8, adotado) |
| Tamanho padrão | Altura 72 px (6,7%), espaçamento lateral interno 28 px, largura pelo texto (15–35% do quadro) |
| Outras alturas | Compacta 61 px (rótulo de frase, fonte de documento); mini 51–56 px (coluna ao lado da janela); "árvore" 81 px; mono escura grande 105 px |
| Texto | Sans tipo Inter 600–700, ≈ 32 px (3% da altura); compacta 27 px; mini 24 px; árvore 36 px; mono 42 px. 360p de `[T1]` estimava 28 px → 720p: 32 px (adotado) |
| Regras de texto | 2 a 6 palavras (`[D]`: 2–5; `[T1]`: 3–5; `[T2]`: 2–6); uma linha sempre; minúsculas; sem ponto final; ênfase pontual em CAIXA ALTA numa palavra; largura máxima medida ≈ 660 px (~32 caracteres) `[D §2]` |
| Inclinação | −1,5° em quase todas; −1,0° em algumas; **−2,5° na coral de conclusão**; ±2,05° alternando só na coluna lateral; 0° na variante árvore `[D-HD]`. A inclinação funciona como ênfase |
| Relevo | 1 px de realce claro no topo, aro escuro de 2–4 px colado na base e sombra difusa: ≈ `0 3px 4px rgba(0,0,0,.22), 0 12px 36px rgba(0,0,0,.14)`. Parece etiqueta com espessura `[D-HD §3.1]` |
| Permanência | Média 4,6–5,1 s; mediana 3,8–4 s; de 0,3 s a 16,6 s. Fica até o fim do bloco de fala, não por tempo fixo `[T1][T2]` |
| Footage por baixo | Não muda (sem escurecer nem desfocar) |
| Contagem | **50 em 300 s** (25 + 25) |

Tons e significado (regra que nunca quebra `[D §6]`):

| Tom | Fundo / texto medidos | Significado | Contagem |
|---|---|---|---|
| Branca | `#faf8f4` / tinta `#13120e` | Contexto, premissa, o assunto | 20 |
| Coral | `#e27e54` / branco | A ideia que importa, a conclusão. No máximo 1 por pilha | 21 |
| Verde | `#78865c` / branco | A solução, o estado bom | 4 |
| Vermelha | `#c84f37` / branco | O problema, o padrão ruim, número de perda | 2 |
| Escura | tinta / branco (sans ou mono) | Termo técnico, nome de produto, fecho | 3 |

Variações observadas: riscada (linha vermelha de 3–4,5 px, pontas redondas, inclinada junto, sobra ~6 px de cada lado; a
pílula continua branca) 2×; com uma palavra interna em coral 1×; com "→" na frente 1×; com "✓" no fim 1×; com "›" (árvore) 2×;
pílula-fonte acima de documento 1×; selo pequeno no canto de um cartão 1×.

### 5.2 Pilha de pílulas

| Aspecto | Medido |
|---|---|
| Posição | x = 112 px; topo da primeira em y = 261 px (24,2%) |
| Passo | Regular, 100 px (pílula 72 + vão 28). 360p dizia "irregular, 100–135" → 720p: regular, com **vão de 68 px só antes da conclusão** (adotado) |
| Quantas | 2 a 5; pico de 5 simultâneas em 113,6–114,7 s, cobrindo ~40% da altura da esquerda `[T1]` |
| Ordem cromática | Branca (contexto) → vermelha/verde (contraste) → coral (conclusão) |
| Comportamento | A nova entra abaixo; as anteriores **não se mexem**. Sai tudo junto |
| Cadência | Governada pela fala (0,8 a 5 s entre pílulas), não por stagger fixo `[T2]` |
| Variante árvore | 3 pílulas de 81 px, sem rotação, recuo de 69 px por nível, passo ≈ 108: comunica caminho ou hierarquia (1×) |
| Variante par técnico | Mono escura grande (282×105) + branca explicativa na mesma linha (vão 31 px), coral embaixo: termo + definição (1×) |
| Variante lateral | Coluna de até 3 pílulas mini ao lado da janela, passo 88 px, rotação alternada |
| Contagem | ~28 grupos em 300 s (13 em `[T2]`; 15 em `[T1]` por contagem minha da linha do tempo, inf.) |

### 5.3 Palavra-título

Uma palavra em serifada itálica coral, minúscula com ponto final, altura-x de 99 px (fonte derivada ≈ 208 px, 19% da altura;
360p estimava 185 px), em x = 96 px com a linha de base em y = 212 px. Sem sombra nem contorno. Entra em 6–7 f com subida de
36 px. Vem acompanhada de uma pílula branca e de um mini-recorte de documento. **Usada 1 vez, só na abertura (0,2–4 s)**
`[D-HD][M-HD]`.

### 5.4 Frase serifada palavra a palavra

| Aspecto | Medido |
|---|---|
| Texto | 4–5 palavras em 2 linhas, quebra manual; linha mais longa 770 px (40% da largura) `[D §2]` |
| Tipo | Serifada de alto contraste, semibold; branco `#fbf9f5`; **uma** palavra ou numeral em itálico coral, com ponto final só no itálico |
| Tamanho | Caixa alta 96 px, altura-x 66 px, fonte derivada ≈ 140 px (13%); variante menor ≈ 121 px. Entrelinha 0,92–0,94 (360p dizia 110–128 px e 1,02 → 720p adotado) |
| Posição | x = 113 px, bloco entre 33% e 54% da altura |
| Rótulo | Opcional: pílula compacta branca logo acima (1 de 3) |
| Proteção de leitura | Nenhuma medida: sem sombra e sem escurecimento atrás; depende de o terço esquerdo do cenário ser escuro `[D §1][D-HD §4]` |
| Uso | Tese do bloco, anúncio do que vem, pergunta do espectador |
| Permanência | 3,5 s, 11,8 s e 2,3 s `[T1 P6][T2 P6]` |
| Contagem | 3 (56,8 s; 115,6 s; 186,3 s) |

### 5.5 Rótulo + título com itálico coral (cabeça da tela dividida)

| Aspecto | Medido |
|---|---|
| Rótulo | Sans 600–700 em CAIXA ALTA, coral, caixa alta de 16–17 px (fonte ≈ 23 px, 2,1%), espaçamento entre letras +0,25 a +0,30 em; 28 px acima do título (360p dizia 27 px e +0,18 em → 720p adotado) |
| Título | Serifada semibold em tinta, 1–2 linhas, fonte ≈ 98 px (9,1%) com 3 cartões e ≈ 86 px com 6; entrelinha 0,96; **uma** palavra em itálico coral, sem ponto |
| Função | O rótulo é o "capítulo interno" do bloco (1–3 palavras) |
| Contagem | 4 títulos (23,6 s; 43,9 s; 86,9 s; 264,8 s) e 5 rótulos |

### 5.6 Cartão com ícone e fileira

| Aspecto | Medido |
|---|---|
| Cartão grande | 355×309 px (1 linha de rótulo) ou 375×339 (2 linhas); raio 16–17; fundo `#faf8f4`; sem borda; sombra ≈ `0 21px 45px rgba(0,0,0,.145)` |
| Ícone | Ilustração de papel recortado em 2–3 camadas sobre um ladrilho quadrado de 200×200 px, cantos retos, 27 px abaixo do topo |
| Rótulo | Sans 600–700, 30 px, centralizado, até 2 linhas, entrelinha 1,23; linha de base a 37 px da base |
| Fileira | 3 em linha, vão 45 px, x 112→1267, y 432→741, **alinhada à esquerda** (sobra à direita) |
| Cartão pequeno | 205×215 (1 linha) ou 205×243 (2 linhas); ladrilho 117 px; rótulo 21–22 px; vão 23 px; grade 4+2 com passo de fileira 291 px |
| Miniatura comparativa | Janela escura de 558×328, raio 16, rótulo de ≈ 33 px embaixo, alinhado à esquerda; a segunda com contorno coral e selo |
| Entrada | Um por item, **no instante em que o item é dito** (Δ entre −0,3 e +0,1 s: a melhor sincronia do vídeo `[T1 P3]`) |
| Saída | Nenhuma: são cobertos pelo cartão do apresentador |
| Contagem | 12 cartões de ícone (3 + 3 + 6) + 2 miniaturas + 1 cartão abortado, em 4 fileiras |

### 5.7 Indicador de exemplo

Rótulo escuro translúcido com a palavra em caixa alta (132×33 px, texto ≈ 20 px) em (30, 22) + 6 chips numerados de 33×33 com
passo 42; o ativo é coral, com numeral branco, e **maior** (≈ 37×40). Raio 8. Fica **por cima de qualquer layout** de 127,5 s
a 242,3 s `[T1][T2]` (`[D]` diz 124–240 s; adotado o medido a 15 fps). A troca de número é seca e ele some sem animação.
Contagem: 1 elemento, 5 avanços.

### 5.8 Carimbo

Placa de fundo cinza-creme `#d9d7d3` com borda vermelha de 4–5 px e raio ≈ 9, palavra única em serifada de alto contraste
(peso regular/medium, não pesada), CAIXA ALTA, vermelha, ≈ 110 px. Tamanho final: 534×119 px `[M-HD]` (562×130 num frame de
`[D-HD]`, possivelmente ainda em animação). Centro em ≈ (21%, 33%) do quadro. Inclinação: **−9,3° constante** `[M-HD]` (−7,5°
em `[D-HD]`; os relatórios em 360p diziam −6° e −8°; adotado −9,3°, medido ao longo de toda a animação). É o único elemento
com mola e o único com rotação forte. Fica 8,6 s, é seguido 0,3 s depois por um punch-in seco no footage. Contagem: 1.

### 5.9 Risco

- **Sobre ícone**: cartão escuro de 297×217 px (contorno branco de 3 px, raio ≈ 18, inclinado ≈ −2°) com um símbolo de
  terminal, atravessado por um traço vermelho de 13–14 px a −31°, pontas redondas, sobrando ~30 px de cada lado. Desenhado em
  8 f exatamente na palavra negada; pílula coral 2 f depois. 1×.
- **Sobre pílula**: descrito em 5.1. 2×.

### 5.10 Contador

Chip vermelho com texto mono branco de ≈ 38 px ("N arquivos"): conta de 0 a 40 em 0,65 s, em ~10 passos de valor fixo, e
trava no valor final. Dispara exatamente no número falado (Δ 0). 1× `[T1 P10]`.

### 5.11 Seta

Seta fina coral apontando para baixo, 51×126 px, haste de 6 px (360p dizia 4 px), ponta aberta, em x ≈ 255, y 555→680. Entra
em ~0,2 s logo depois da pílula que manda para a descrição e fica parada. 1× `[T2 P11][D-HD]`.

### 5.12 Marca-texto

Ver 4.4. Varre da esquerda para a direita em ~0,9 s, velocidade quase constante, e **termina na palavra-chave falada**. Fica
até o fim do layout. 1× animado `[T1 P9]`.

### 5.13 Fita e recorte "colado"

Qualquer captura de tela é tratada como objeto físico: moldura creme, duas fitas coral quase opacas (alfa 0,8) nos cantos de
cima, leve inclinação, sombra. 3× (mini na abertura, documentação grande, print na grade de cartões).

### 5.14 O que não existe na referência

Legenda, lower-third com nome, cartela de capítulo, gráfico de barras ou número grande, cursor destacado, seta ou caixa
desenhada sobre a interface, tela final, botão de inscrição, meme `[D §4.15][D §4.16][T3–T6]`.

---

<a id="s6"></a>
## 6. Gramática de movimento

### 6.1 Tabela única

Valores de `[M-HD §2]` (720p), em frames a 30 fps e px a 1080p. Curva **B** = `cubic-bezier(0.65, 0, 0.35, 1)`.
"Nominal" é a duração da curva ajustada; "visível" é o intervalo entre 1% e 99% do movimento.

**Entradas**

| Tipo | Duração | Propriedades | Distância | Curva | Stagger / gatilho |
|---|---|---|---|---|---|
| Pílula | 9–11 f (0,30–0,37 s) | opacidade 0→1, Y, escala 0,92→1, leve blur no 1º frame | +26 px (2,4%) | desacelera, sem ultrapassar; equivale a `Easing.out(Easing.quad)` em 10 f | 1–4 f antes da palavra-chave (mediana −0,06 s); irmãs esperam a própria palavra (12–22 f quando caem na mesma frase) |
| Cartão de fileira | 10 f (0,33 s) | opacidade, Y; sem escala | +51 px (4,7%) | idem | na palavra de cada item (Δ −0,21 a +0,09 s) |
| Cartão grande / documento | 9–10 f | opacidade, Y | +66 px (6,1%) | idem | 1–3 f antes da frase |
| Ícone em cartão | 10 f | opacidade, Y pequeno, escala 0,85→1 | pequena | idem | até 0,5–0,8 s antes da palavra (fraqueza) |
| Palavra-título única | 6–7 f (0,2 s) | opacidade, Y | +36 px (3,3%) | ease-in-out | na palavra (Δ +0,09 s) |
| Palavra de frase serifada | 10 f nominais (8–9 visíveis) | opacidade (curva B); Y fica parado ~2 f e desce; blur nos 3 primeiros frames (≈ 8–10 px, estimado) | +36 px (frase sobre footage) ou +20 px (título no papel) | B | **3,5 f fixos entre palavras** (alternando 4, 3, 4), em ordem de leitura, cruzando a quebra de linha |
| Rótulo em caixa alta | 10 f | só opacidade | 0 | — | 3 f antes da 1ª palavra do título |
| Janela nova (troca de conteúdo) | 9–10 f | opacidade, escala 0,90→1, Y | +36 px | desacelera | 8 f depois de a antiga sair |
| Moldura de cena na tela dividida | ~12 f | opacidade + escala (inf.) | — | — | com a troca de layout a ~50% `[M]` |
| Carimbo | impacto em ~12 f, assenta no f 25 | escala 2,3→0,979→1 (mola); opacidade em 10–12 f; rotação fixa | — | mola `{stiffness: 100, damping: 16, mass: 1}` | deveria cair na palavra; caiu 0,93 s antes |
| Risco sobre ícone | 8 f (0,27 s) | traço desenhado da esquerda para a direita | ~330 px em diagonal | quase linear | na palavra negada (Δ +0,03 s) `[M]` |
| Risco sobre pílula | ~0,15–0,2 s `(inf., [T1])` | traço | largura do texto | — | na palavra que nega |
| Marca-texto | ~27 f (0,9 s) | largura da faixa | 1 linha de texto | quase linear | termina na palavra-chave |
| Contador | ~20 f (0,65 s) | valor, ~10 passos iguais | 0→40 | linear, trava no fim | no número falado |
| Seta | ~6 f (0,2 s) | opacidade | — | — | logo após a pílula |
| Linha digitada na interface | ~0,7 s por linha | caracteres | — | linear | acompanha a frase |
| Item de lista na interface | ~1 a cada 1,3 s | aparece | — | — | na palavra do item |

**Saídas**

| Tipo | Duração | Propriedades | Curva | Regra |
|---|---|---|---|---|
| Grupo, quando o fundo continua | 8 f visíveis (11 nominais) | só opacidade; sem deslocamento, sem escala | B | todos juntos, sem stagger, 1–6 f antes da troca seguinte |
| Grupo, quando o layout troca | 0 f | corte seco | — | a camada antiga fica parada e inteira até o frame 4–10 da troca e some |
| Janela (troca de conteúdo) | 8–9 f | opacidade + escala 1→0,73 | acelera | seguida de 8 f de papel vazio |
| Lado esquerdo da tela dividida | 10 f (0,33 s) | opacidade, simultâneo | — | seguido de 0,3 s vazio `[T2]` |
| Cartões e título ao fim da tela dividida | — | nenhuma | — | são cobertos pelo cartão do apresentador |
| Carimbo | ~6 f | opacidade | — | junto com a pílula `[T2]` |

**Trocas e câmera**

| Tipo | Duração | Propriedades | Distância | Curva |
|---|---|---|---|---|
| Troca de layout (retângulo do apresentador) | **27 f (0,9 s)** em todas (360p: 19–26 f → 720p: 27 f, adotado) | left/top/width/height, raio 0↔33 px, borda 0→4,5–6 px, escala do recorte: um único progresso | até 74% da largura | **B** (360p: `(0.4,0,0.2,1)` → 720p: B com erro 5–8× menor, adotado) |
| Espelhamento do canto | 30 f (1,0 s) | X do canto | 1400 px (72,9%) | B |
| Zoom-in na janela | 36 f (1,2 s) (360p: 31–49 f → 720p: 36 f) | escala 1→1,22–1,30 (padrão 1,25) com `transform-origin` no ponto de interesse | — | B |
| Zoom-out na janela | ~27 f (0,9 s), entre 26 e 30 | escala →1 | — | B |
| Rasgo de papel | 11 f (0,37 s) | máscara rígida da esquerda para a direita | 104,8% da largura | `Easing.inOut(Easing.quad)` |
| Dissolve longo | 26–27 f | mistura | — | acelera (easeInQuad) |
| Dissolve curto | 6 f | mistura | — | — |
| Dissolve no mesmo enquadramento | ~11 f | mistura | — | — |
| Push-in lento no footage | 1 s (+10%) e 12,9 s (+8%) | escala | — | contínuo `(inf., [T1])` |
| Punch-in seco no footage | 2–3 quadros a 15 fps | escala →1,08–1,10 | — | corte `[T2]` |

### 6.2 Regra de sincronia com a fala

| Regra | Medido | Fonte |
|---|---|---|
| Pílula e cartão entram na palavra que os motiva | 1–4 f antes; mediana −0,06 s; a pílula está ~40% visível quando a palavra começa | `[M §2A]` |
| Quantos acertam | 33 de 44 elementos a ±0,3 s `[T1]`; 19 de 25 pílulas entre −0,3 e +0,25 s `[T2]` | |
| Troca de layout | Começa 0,1–0,3 s antes da primeira palavra da frase nova (13 de 13 `[T1]`; 0,15–0,25 s `[T2]`) | |
| Animação que encena o verbo | Janela sai em "fecha" (−0,05 s) e entra em "abre" (+0,1 s) | `[T1 P12]` |
| Corte seco de limpeza | 0,06–0,2 s antes da primeira palavra, na respiração | `[T4][T5]` |
| Onde a referência erra | Frases e títulos serifados são cascata de tempo fixo: −1,7 s, +1,8 s, −1,75 s; carimbo −0,93 a −1,19 s; pílulas a −1,6 s, −1,0 s e +1,0 a +1,5 s; ações na tela crua de −1,2 a +1,2 s | `[T1][T2][T3][T4]` |

### 6.3 Equivalente em código (Remotion)

Curvas do canal em `motion/src/theme.ts`: `motion.enter = bezier(0.16, 1, 0.3, 1)`, `motion.exit = bezier(0.7, 0, 0.84, 0)`,
`motion.move = bezier(0.45, 0, 0.55, 1)`, `motion.pop = bezier(0.34, 1.56, 0.64, 1)`. **A curva B da referência não existe no
tema**; a mais próxima é `motion.move`. Para reproduzir com fidelidade seria preciso acrescentá-la (seção 12).

```ts
import { Easing, interpolate, spring } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const B = Easing.bezier(0.65, 0, 0.35, 1); // a curva única da referência

// Troca de layout: 27 f, um progresso para tudo (retângulo, raio, borda, recorte)
const morph = (frame: number, start: number) => interpolate(frame, [start, start + 27], [0, 1], { ...clamp, easing: B });
// left = lerp(0, 1419, p); top = lerp(0, 54, p); width = lerp(1920, 466, p); height = lerp(1080, 971, p)
// radius = 33 * p; border = 5 * p

// Pílula: 10 f, sobe 26 px, escala 0,92 -> 1, sem ultrapassar
const pill = (frame: number, start: number) => {
  const p = interpolate(frame, [start, start + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  return { opacity: p, translateY: (1 - p) * 26, scale: 0.92 + 0.08 * p };
};

// Cartão de fileira: mesma receita, 10 f, 51 px, sem escala. Documento: 66 px.

// Frase serifada: palavra i começa em start + i * 3.5 f
const word = (frame: number, start: number, i: number, travel = 36) => {
  const t0 = start + i * 3.5;
  const opacity = interpolate(frame, [t0, t0 + 10], [0, 1], { ...clamp, easing: B });
  const y = interpolate(frame, [t0 + 2, t0 + 8], [travel, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const blur = interpolate(frame, [t0, t0 + 3], [9, 0], clamp);
  return { opacity, translateY: y, filter: `blur(${blur}px)` };
};

// Saída de grupo: 11 f nominais, só opacidade
const leaveGroup = (frame: number, end: number) => interpolate(frame, [end - 11, end], [1, 0], { ...clamp, easing: B });

// Zoom na janela: 36 f para entrar, 27 f para sair, origem no ponto de interesse
const windowZoom = (frame: number, inAt: number, outAt: number, scale = 1.25) =>
  1 + (scale - 1) * (interpolate(frame, [inAt, inAt + 36], [0, 1], { ...clamp, easing: B })
                   - interpolate(frame, [outAt, outAt + 27], [0, 1], { ...clamp, easing: B }));
// style={{ scale: String(z), transformOrigin: '81% 28%' }}

// Rasgo: 11 f; a borda percorre 104,8% para os dentes saírem do quadro
const tear = (frame: number, start: number) =>
  interpolate(frame, [start, start + 11], [0, 1.048], { ...clamp, easing: Easing.inOut(Easing.quad) });

// Carimbo: única mola do vídeo (parte de 2,3x, passa de 1, assenta)
const stamp = (frame: number, start: number, fps: number) =>
  2.3 - 1.3 * spring({ frame: frame - start, fps, config: { stiffness: 100, damping: 16, mass: 1 } });
```

A curva exata de pílulas e cartões não foi decidida pela medição: `Easing.out(Easing.quad)` em 10 f,
`Easing.bezier(0.25, 0.1, 0.25, 1)` em 12–13 f e `Easing.inOut(Easing.sin)` em 10 f ajustam igual. Só está descartado o
overshoot `[M-HD §4]`.

---

<a id="s7"></a>
## 7. Transições

O apresentador é sempre o mesmo retângulo que muda de forma. Tudo o mais aparece ou some em volta dele `[M §3]`. Contagens no
bloco editado.

### 7.1 Tela cheia → janela + canto (6×: 4,0 / 60,3 / 133,3 / 154,0 / 198,7 / 293,5 s)

| Frame | O que acontece |
|---|---|
| −8…−1 | Se o fundo continuava: sobreposições em fade de 8 f. Em 4,0 s e 154,0 s elas ficam e são cortadas adiante |
| 0 | O retângulo do apresentador começa a encolher, ancorado no canto inferior direito, sobre papel liso |
| 0–9 | Sobreposições antigas (ou a cena, até o frame 8) continuam **paradas e inteiras**; não encolhem junto |
| 5–9 | Corte: sobreposições somem e a janela aparece no mesmo frame, já no lugar (em 4,3 s, com o retângulo em x = 11,6%) |
| 11–19 | Borda branca cresce: 1,1 / 1,9 / 2,5 / 3,0 / 3,6 px (em 720p) |
| 13–14 | Velocidade máxima: 8% da largura por frame (153 px/frame) |
| 27 | Pousa em 21,4% × 36,2%, com raio e zoom de 1,6× no rosto |
| ~13 em diante | A primeira pílula pode entrar com a troca a ~50%, por baixo do apresentador (294,2 s) |

Uso: sempre que vai mostrar o app.

### 7.2 Janela + canto → tela cheia (2×: 13,3 / 186,0 s)

Frame 0: o canto começa a crescer por cima da janela. Frame 10 (canto em 34% da largura): janela e pílulas somem em corte.
Frame 27: tela cheia, canto sem raio. Em 186,0 s parte do canto esquerdo, e a frase serifada já começa a entrar com o cartão
crescendo. Uso: volta para a fala direta.

### 7.3 Tela cheia → tela dividida (3×: 23,3 / 43,5 / 253,5 s)

Frame 0: papel atrás. Frames 0–27: o retângulo recorta para a direita (x 0→74%, altura 100→90%, proporção 1,78→0,48). Uma
"folha" de conteúdo com borda vertical em x = 74,1% entra da esquerda com a mesma curva `[M-HD §2.2]`. Frame ~10–13: rótulo e
primeira palavra do título. Título completo ~24 f depois. Cartões em seguida, um por palavra. Quando vem de cena, a cena cobre
os frames 0–5 e **não existe frame de tela cheia** no meio (360p dizia que sim → 720p: não, adotado).

### 7.4 Tela dividida → tela cheia (3×: 37,0 / 52,9 / 277,3 s)

O cartão cresce para a esquerda e cobre título e cartões, que ficam parados, sem saída própria. 27 f.

### 7.5 Canto → cartão vertical (1×: 85,3 s)

O canto quadrado já cresce por 3–4 f com o conteúdo antigo presente; corte do conteúdo no frame 4; o canto sobe e vira cartão
(411×387 → 466×972) enquanto a folha de conteúdo varre sozinha de 0 a 74,1%. 27 f. Uso: da demonstração direto para um
conceito, sem passar pela tela cheia.

### 7.6 Espelhamento (1×: 169,8 s)

Frame 0: janela antiga some em corte. Frames 1–9: janela nova em fade, já do lado direito. Frames 1–30: o canto desliza 72,9%
da largura para a esquerda. Uso: trocar de exemplo sem sair do layout.

### 7.7 Troca de conteúdo da janela (1×: 75,35 s)

Janela sai (fade + escala até 0,73) em 8–9 f; 8 f de papel vazio com canto e pílulas parados; janela nova entra (fade +
escala de 0,90 + subida de 36 px) em 9–10 f. Encena os verbos "fecha" e "abre".

### 7.8 Rasgo de papel → cena (5×: 18,3 / 92,0 / 141,4 / 188,8 / 230,6 s)

`[M]` lista 4; `[T2]` mediu o de 188,8 s a 15 fps. Adotado: 5.

| Frame | Frente do rasgo (% da largura) |
|---|---|
| 0–10 | 0,7 · 4,8 · 11,3 · 20,7 · 33,6 · 51,4 · 68,6 · 82,0 · 91,4 · 97,8 · 100 |

- Máscara rígida que translada; borda em zigue-zague de segmentos retos, **dura** (sem suavização, sem sombra, sem filete).
- Dentes: amplitude de 4,8% da largura (93 px); ~11 na altura (passo médio de 98 px, irregular); o padrão se repete a cada
  790 px.
- Partindo da tela dividida ou da janela: o conteúdo some em corte, ficam 4 f de papel vazio, e só então o rasgo passa. O que
  está à direita (cartão, canto) é engolido por último.
- Só é usado para **entrar** em cena. Três rasgos partem do talking head, um da tela dividida e um da janela.

### 7.9 Corte seco

| Onde | Contagem |
|---|---|
| Cena → talking head (sempre assim) | 4 (102,0 / 151,2 / 218,0 / 242,3) |
| Cena → troca de layout já em andamento | 4 (23,3 / 43,5 / 133,3 / 198,7) |
| Talking head ou janela → cena, sem rasgo | 2 (127,5 / 207,5) |
| Conteúdo da janela → recorte de documentação | 1 (77,6) |
| Jump cut que devolve o enquadramento aberto | 1 (114,9) |
| Cortes de limpeza na tela crua | 7 confirmados + 6 prováveis em 800 s `[T3–T6]` |

### 7.10 Dissolves

| Tipo | Duração | Onde | Contagem |
|---|---|---|---|
| Mesmo enquadramento (real → ilustrado) | ~11 f (360p: 14 f em 2 estágios → 720p: 1 estágio) | 37,9 s | 1 |
| Longo, layout inteiro → talking head | 26–27 f, acelerando | 298,7 s | 1 |
| Curto, entrada e saída da tela crua | 6 f | 300,9 e 1035,4 s | 2 |
| Interno ao cartão de tela (salto de tomada) | 3 f | 339,74 s | 1 |

Resumo: **16 trocas com o apresentador como elemento compartilhado, 5 rasgos e 12 cortes secos de layout** no bloco editado,
mais **5 dissolves** no vídeo inteiro. Nenhuma transição "de catálogo" (chicote, glitch, zoom-blur, cortina).

---

<a id="s8"></a>
## 8. Efeitos no footage e na tela gravada

### 8.1 Look do footage

Low-key quente: parede `#211c1b`, moldura terracota `#5c342e`, pele `#df9085`, lâmpada estourada em branco no canto superior
direito. Pretos levantados (cantos em `#252427` e `#171717`, nunca 0). Sombras neutras-frias, médios laranja. Fundo
desfocado por lente, sem vinheta adicionada perceptível `[D §1]`. O coral dos gráficos é da mesma família do terracota do
cenário: o acento parece sair do set.

### 8.2 Reenquadramentos do apresentador

Há divergência entre relatórios: `[M §4]` afirma que não existe punch-in no apresentador em todo o vídeo; `[T1]`, `[T2]` e
`[D]` descrevem reenquadramentos de forma independente. `[M-HD]` não remediu. **Adotado: existem, com valores inferidos**
(o script de `[M]` media só a janela).

| Tipo | Onde | Valor `(inf.)` | Fonte |
|---|---|---|---|
| Push-in lento | 2,9–3,9 s; 102–114,9 s (com reset em jump cut) | ~+10%; ~+8% | `[T1]` |
| Plano fechado em bloco | 53,5–60,5 s; 186,6–188,8 s | ~1,25×; ~1,15× | `[T1][T2]` |
| Rosto deslocado para liberar o texto | 58,5 s | x 50%→58%, ≈ 1,18× | `[D]` |
| Punch-in seco | 222,1 s; 291,8 s | ~1,08×; ~1,10×, em 2–3 quadros | `[T2]` |
| Nos 74,5 s finais | — | **nenhum** (medido pela posição da lâmpada: ±0,5 px) | `[T6]` |

A volta ao enquadramento normal é sempre escondida numa saída de elementos, num jump cut ou numa troca de layout.

### 8.3 Zoom na janela

| Início (s) | Escala | Origem (% da janela) | Segura | Gatilho |
|---|---|---|---|---|
| 10,19 | 1,30 | (81, 28) | 1,25 s | resposta aparece |
| 68,7 | 1,22 | (50, 29) | 4,5 s | "o próprio sistema" |
| 134,5 | 1,30 | (49, 44) | 5,1 s | modal abre |
| 157,9 | 1,25 | (81, 34) | 10,0 s | painel lateral (+0,5 s) |
| 175,4 | 1,25 | (84, 38) | 8,7 s | "painel" |
| 200,7 | 1,25 | (81, 32) | 5,0 s | "definindo" (+0,2 s) |

Fonte: `[M §4][M-HD §2.6]`. Só os inícios de 10,19 s e 175,4 s foram remedidos em 720p; os outros são os de `[M]`, que
tendem a adiantar ~0,3 s. Os relatórios por trecho estimaram 1,35–1,45 e `[D]` 1,6–1,9; valem os medidos por correlação de
fase em 720p. Só a janela escala; ela sangra para fora do quadro e passa por baixo do canto. A origem fica fixa durante a
espera: **não segue o cursor**. O zoom-out termina 0,1–0,6 s antes de sair da cena.

Destaque dentro da interface simulada: contorno ou fundo coral no item, barra coral no bloco citado. O apontador é a pílula
colada ao lado da janela, não uma seta sobre a interface `[T1 §4][T2 §4]`.

### 8.4 O que não é usado

Desfoque de fundo, escurecimento atrás de texto, mudança de cor por trecho, tremor, zoom rápido por palavra, cursor com halo
ou anel de clique, seta ou caixa sobre a interface, blur de movimento, rotação animada, paralaxe, entrada lateral, letra a
letra `[T1 §4][M §2]`. Na tela crua (301–1035 s): nenhum zoom, nenhum reenquadramento, nenhum destaque.

---

<a id="s9"></a>
## 9. Design

### 9.1 Paleta medida (720p)

| Papel | Hex | Uso |
|---|---|---|
| Papel (fundo) | `#ede8e1` | Fundo da tela dividida e da janela. Chapado, sem grão; **vinheta radial**: cantos de cima `#dfdad3` (−6%), cantos de baixo `#d8d4ca` (−9%), base-centro `#e3ded7` (−4%). 360p dizia "degradê vertical" → 720p: vinheta (adotado) |
| Superfície | `#faf8f4` | Cartão, pílula branca, moldura do recorte, chip inativo. Nunca branco puro |
| Borda do vídeo | `#fcf8f4`–`#fffaf5` | Branco quente (360p dizia `#ffffff` → corrigido) |
| Ladrilho do ícone | `#f5ece3` → `#ede3d1` | É a própria foto do recorte, não cor chapada |
| Tinta | `#13120e` | Texto, pílula escura |
| Janela simulada | `#131310`, lateral `#1a1816` | Preto quente |
| Coral | `#e27e54` (pílulas `#e07e56`–`#e37e55`; itálico `#e47c50`) | Acento: itálico do título, rótulo, pílula de conclusão, chip ativo, fita, marca-texto, seta |
| Vermelho | `#c84f37` (carimbo `#c44e3b`; risco `#bd503a`) | Negação, perigo |
| Verde-oliva | `#78865c` | Solução |
| Rótulo do indicador | `#4a4640` sobre papel | Tinta a ~78%, translúcido |
| Azul | ~`#5b8fe8` (não remedido) | Só dentro da interface simulada; nunca nos gráficos |
| Fundo da tela crua | `#19201f` → `#0c1110` | Degradê vertical verde-petróleo |
| Janela gravada | `#141414` | (360p dizia `#1e1e1c` → corrigido) |
| Cenas de papel | creme `#e7ded1`–`#fcf3e6`, coral `#d57f59`–`#e6946a`, grafite `#35322f`–`#454144`, kraft `#a78360`–`#b18d6a`, sálvia `#a4b0a2`–`#d2cfbe` | Paleta fechada de 5 tons |

Contraste medido `[D §7]`: branco sobre o coral da referência = 2,9:1; rótulo coral de 23 px sobre papel = 2,3:1. Os dois
ficam abaixo de 4,5:1.

### 9.2 Tipografia

| Papel | Família aparente | Medida dura | Fonte derivada | Entrelinha |
|---|---|---|---|---|
| Palavra-título | Serifada transicional de alto contraste (tipo Tiempos Headline; nome exato é inferência), itálico medium | altura-x 99 px | ≈ 208 px (19%) | — |
| Frase grande | Mesma, semibold + itálico na palavra-chave | caixa alta 96 px | ≈ 140 px (13%); variante 121 px | 0,92–0,94 |
| Título de painel | Mesma | caixa alta 65 px | ≈ 98 px (9,1%); com 6 cartões 86 px | 0,96 |
| Rótulo em caixa alta | Sans tipo Inter 600–700 | caixa alta 16–17 px | ≈ 23 px (2,1%), +0,25–0,30 em | — |
| Pílula | Inter 600–700 (no zoom parece 700) | altura-x 17 px | ≈ 32 px (3%); 27 / 24 / 36 px nas variantes | 1 linha |
| Termo técnico | Mono bold | — | ≈ 42 px | — |
| Rótulo de cartão | Inter 600–700 | caixa alta 22 px | 30 px; pequeno 21–22 px | 1,23 |
| Rótulo de miniatura | Inter bold | caixa alta 24 px | ≈ 33 px | — |
| Chip do indicador | Inter bold | caixa alta 15 px | ≈ 20 px | — |
| Carimbo | Serifada de alto contraste, regular/medium, CAIXA ALTA | — | ≈ 110 px | — |

Regras de composição `[D §2][D §6]`: título sempre à esquerda, 1–2 linhas, nunca centralizado; **exatamente um** itálico coral
por título (itálico cursivo verdadeiro, não oblíquo); espaçamento do título levemente negativo (≈ −1%); serifada só em título
e frase, sans só em pílula e rótulo, mono só em termo técnico ou número de arquivo.

### 9.3 Grade e margens

| Item | Valor |
|---|---|
| Margem esquerda de todo conteúdo | 112 px (5,8%) |
| Margem das pílulas sobre cena | 92 px (4,8%) |
| Indicador de exemplo | (30, 22): fora da margem de conteúdo |
| Margem inferior das pílulas de rodapé | ≈ 60 px (5,5%) |
| Tela dividida | Conteúdo 62,5% (x 112→1310) + vão + cartão 24,3%; proporção ~72/28 |
| Janela + canto | Janela 70,7% × 79,6%; canto 21,4% × 36,2%; folga 27 px; margens 55 px |
| Regra de alinhamento | Nada centralizado; nada à direita, exceto a coluna de pílulas ao lado da janela |

### 9.4 Cantos, bordas e sombras

| Elemento | Raio | Borda | Sombra (CSS equivalente, ±5 pontos de opacidade) |
|---|---|---|---|
| Pílula, chip | 8 px | realce de 1 px no topo, aro escuro na base | `0 3px 4px rgba(0,0,0,.22), 0 12px 36px rgba(0,0,0,.14)` |
| Pílula escura grande, árvore | 11–13 px | fio claro de 1 px | idem |
| Cartão de ícone, miniatura | 16–17 px | nenhuma | `0 21px 45px rgba(0,0,0,.145)`; miniatura `0 22px 50px rgba(0,0,0,.24)` |
| Janela | 19 px | fio claro no topo | `0 30px 90px rgba(0,0,0,.30)` |
| Modal | 21 px | coral 2–3 px | — |
| Cartão vertical do apresentador | 34 px | 4,5 px branco quente | `0 33px 72px rgba(0,0,0,.30)` |
| Canto do apresentador | 33 px | 4,5 px branco quente | `0 24px 72px rgba(0,0,0,.35)` |
| Recorte de documentação | 0–3 px | moldura creme 12–13 px | `0 24px 60px rgba(0,0,0,.30)` |
| Carimbo | ≈ 9 px | vermelha 4–5 px | — |

Regra: toda superfície flutuante tem sombra suave para baixo; nenhuma tem borda escura `[D §6]`. O 360p acusava cinco raios e
duas bordas diferentes nos vídeos do apresentador; em 720p os dois têm praticamente o mesmo raio (33–34) e a mesma borda.

### 9.5 Textura

O papel dos painéis é **totalmente chapado** (desvio 0,0 numa área de 40×40 px). Fibra e granulação só existem nas cenas de
papel recortado `[D-HD §3.14]`. Não é possível afirmar que não há grão fino no original: o codec o apagaria.

### 9.6 Ilustração e ícone

- **Cenas**: aparência de papel recortado em camadas fotografado: cartolina fosca, fibras visíveis, bordas levemente
  irregulares, sombra de contato curta + sombra projetada à direita e abaixo (luz do alto-esquerda). Duas câmeras: vista de
  topo plana e 3/4 com profundidade de campo. Fundo creme contínuo. Paleta fechada de 5 tons; nunca azul, nunca gradiente
  digital. Metáfora literal do que é dito, com um motivo recorrente (uma estrela de pontas que representa o agente, em 4
  cenas). A textura varia um pouco de cena para cena, o que sugere imagem gerada e animada `(inf., [D §5])`.
- **Ícones de cartão**: o mesmo idioma em miniatura: objeto único, 2–3 camadas, vista frontal, 3–4 tons, sobre ladrilho creme
  quadrado.

### 9.7 Tradução para os tokens MChiodi

Tokens: papel `#f8f8f2`, tinta `#111827`, coral `#ff5555`, Playfair Display 600 (títulos), Inter (apoio), JetBrains Mono
(código). A tradução abaixo parte de `[D §7]` corrigida pelos valores de 720p.

| Referência | No canal | Observação |
|---|---|---|
| Papel `#ede8e1` com vinheta | `#f8f8f2` com vinheta radial única (tinta a 6% nas bordas) | Um papel só, inclusive como chão das cenas |
| Superfície `#faf8f4` | `#f8f8f2` (ou branco com borda de tinta a 8%) | A referência nunca usa branco puro |
| Tinta `#13120e` | `#111827` | |
| Coral `#e27e54` com texto branco | `#ff5555` com texto **tinta** | Branco sobre `#ff5555` = 3,1:1; tinta sobre `#ff5555` = 5,7:1 `[D §7]` |
| Vermelho `#c84f37` | `#ca3434` (`coralDeep` do tema) com texto branco | |
| Verde-oliva `#78865c` | `#34d399` (`emerald`) com texto tinta | O tema não tem o verde escuro; `[D]` sugeria `#5f7a4a` |
| Serifada tipo Tiempos | Playfair Display 600 + itálico 600 | Carimbo pediria Playfair em peso maior (o tema só carrega 600) |
| Sans | Inter 500/600/800 | |
| Mono | JetBrains Mono 500/700 | |
| Margem 112 px | 96 px laterais, 64 px em cima e embaixo (margem segura do canal) | Divergência pequena e intencional |
| Raios 8 / 16–19 / 33–34 | 12 / 24 / 40 no que já existe | `[D]` propunha a escala 12 / 20 / 40 |
| Pílula 72 px, texto 32 px | Texto 40 px (mínimo de leitura em celular) | Fazer melhor: seção 10, item 8 |
| Rótulo coral 23 px | Inter 800, 30 px, cinza-ardósia, com barra coral antes | Corrige o contraste de 2,3:1 |
| Paleta de cena: creme, coral, grafite, sálvia, kraft | papel, coral, tinta, sálvia `#b9c4b0`, kraft `#b8946a` | Reservar o canto inferior esquerdo (40% × 25%) para pílulas |

---

<a id="s10"></a>
## 10. Como fazer melhor

Todas as fraquezas apontadas pelos 10 relatórios, agrupadas e sem repetição, em ordem de impacto. Cada uma traz a melhoria
concreta e uma regra que dá para verificar. A coluna "no editor" de cada item está na seção 12.

### 10.1 73% do vídeo sem edição

- **Medido**: 734 s de tela crua (0,4–1,5 decisão de edição por minuto) + 75 s finais sem nada `[T3–T6][M #1][D §7]`.
- **Melhoria**: levar a gramática do bloco inicial para o vídeo todo: mesmo papel de fundo, mesma moldura de janela, mesmo
  canto com borda, pílula a cada ação relevante, zoom no que é citado, cena ou tela cheia do rosto a cada ~60 s.
- **Regra**: pelo menos 80% da duração fora de intervalos com mais de 8 s sem evento; cada respiro com até 40 s; meta de 6–8
  eventos de edição por minuto na demonstração (contra 0,36) `[T6]`.

### 10.2 Tela gravada ilegível e sem foco

- **Medido**: texto da interface com 0,9–1,4% da altura do quadro; coluna útil em 31% da largura; a faixa que é o assunto de
  um capítulo tem 1,5% da altura e nunca é ampliada; cursor de ~1,5% sem halo; zoom do bloco editado é só 1,22–1,30 e não
  isola nada `[T3 #1 #3 #4][T4 #6 #9][T5 #1 #6][T6 #5 #14][T1 #8][T2 #8][M #10]`.
- **Melhoria**: zoom dirigido pela fala a cada "aqui / nesse / aparece / do lado": escala 1,6–2,4×, origem no alvo, 10–12 f
  desacelerando, segura enquanto a frase fala do alvo, volta em 8 f. Recortar a barra lateral por padrão (~20% de ganho).
  Somar foco: resto da janela a 35–45% de brilho, contorno coral desenhado em 10 f no elemento, marca-texto de pós em 8 f
  sobre a cifra. Cursor com halo só quando aponta; anel de clique que expande e some em 8 f; cursor escondido quando parado
  por mais de 2 s. Para um detalhe muito pequeno: lupa (cópia ampliada 3–4× num cartão, ligada ao original por uma linha).
- **Regra**: todo texto citado pela fala tem pelo menos 2,5% da altura do quadro (27 px) no instante em que é dito; alvo 3,5%
  `[T3][T5]`. Todo clique tem anel. O alvo do zoom ocupa ~60% da largura da janela `[M #10]`.

### 10.3 Trechos parados

- **Medido**: 11,2 s e 7,8 s no bloco editado; 43,6 s, 54 s, 67 s e 74,5 s no resto `[T1 #1][T2 #4][T3 #2][T4 #2][T5 #2][T6]`.
- **Melhoria**: quando o layout precisa ficar, acrescentar pílula de palavra-chave, item revelado, push-in lento
  (1,00→1,05) ou animar o que já está na tela (seta pulsando, contador de itens). No caso dos 11,2 s: a frase sai em 3 s e
  entram os chips numerados dos exemplos, que depois viram o indicador de progresso.
- **Regra**: no trecho editado, nenhum intervalo acima de 8 s sem evento; alvo de 2–4 s. Os relatórios divergem no teto
  (4 s em `[T1][T2]`, 8 s em `[T3][T4]`, 10 s em `[T5]`); adotado 8 s como limite e 4 s como alvo sobre talking head.

### 10.4 Números, termos e conceitos só falados

- **Medido**: seis números ditos em 54 s sem nada na tela; "258 mil × um terço" sem apoio; termos novos sem rótulo; 56 s de
  história de risco com a tela num texto de status; a promessa do segundo mod ("sem expor a chave") passa em branco
  `[T3 #2 #12][T4 #1 #8 #12][T5 #5 #7][T6 #8 #9 #12]`.
- **Melhoria**: cartela de número (valor em serifada grande + rótulo curto) ao lado da janela ou na faixa vazia; pílula de
  termo na primeira menção; caminho de pasta como trilha animada, um nível por palavra; diagrama de 3 passos para história
  com sequência; comparação em duas barras com contagem; placar que acende item a item quando há vereditos em série.
- **Regra**: todo número dito vira elemento que entra 2–3 f antes da palavra e fica pelo menos 1,8 s; todo termo técnico novo
  recebe pílula na primeira vez; toda sequência narrada (antes → depois → consequência) vira diagrama, um passo por palavra.

### 10.5 Sincronia irregular

- **Medido**: títulos e frases serifadas em cascata fixa (−1,7 s, +1,8 s, −1,75 s; a frase termina 0,67 s antes da palavra
  de ênfase); carimbo 0,93–1,19 s antes da palavra; pílulas a −1,6 s, −1,0 s e +1,0 a +1,5 s; ícone a −0,8 s; cartão
  disparado por um verbo 0,8 s antes do rótulo; na tela crua, ação 1,2 s antes da fala e menus 1,1–1,2 s depois
  `[T1 #3 #9][T2 #5][M #2 #3][T4 #5][T5 #11]`.
- **Melhoria**: âncora única no início da palavra-chave do `words.json`, menos 2 frames; nunca antes da palavra anterior.
  Em frase serifada, cada palavra entra no próprio início; se o intervalo entre duas for menor que 3 f, cai no stagger fixo.
  A palavra de ênfase só fica coral quando é dita. Na tela gravada, ancorar o gráfico na palavra e não na ação: a pílula
  entra antes da palavra e fica até o menu abrir; se a ação antecipa a fala, atrasar a tela 10–25 f com congelamento.
- **Regra**: nenhum elemento fora de [−0,15 s; +0,10 s] da sua palavra-gatilho `[T2 #5]`, validado por teste automático sobre
  `words.json`. Troca de layout 0,15–0,25 s antes da primeira palavra da frase.

### 10.6 Elementos que somem antes de serem lidos

- **Medido**: pílulas com 0,3 s, 0,4 s, 0,8 s, 0,9 s, 1,1 s e 1,5 s na tela; um cartão nasce já coberto; seleção nativa de
  1,5 s `[T1 #7][T2 #1][T3]`.
- **Melhoria**: se o corte vem antes, adiantar a entrada ou atrasar a transição.
- **Regra**: nenhuma pílula fica menos que **1,2 s + 0,25 s por palavra** depois de totalmente visível (`[T1 #7]`, adotada no
  editor). `[T2 #1]` propõe `max(1,2 s; 0,35 s × palavras)`, que só é mais rígida acima de 12 palavras. Nenhuma entrada
  começa a menos de 1 s de uma transição.

### 10.7 Saídas em corte e buracos de papel vazio

- **Medido**: 9 de 13 grupos de pílulas morrem no corte; conteúdo some em 1 frame em 4,3 / 13,5 / 77,6 / 85,4 / 91,9 / 141,4
  s; sobram 4 f de papel vazio antes de cada rasgo, 8 f entre duas janelas, 0,3 s na troca de fase; cartões cobertos sem
  saída; saídas com durações desiguais `[T1 #4][T2 #2 #9][M #4 #5 #8 #13]`.
- **Melhoria**: saída padrão única, espelhada: 4–8 f, opacidade → 0, subida de 16 px (ou 1,5% no sentido contrário ao da
  entrada), escala → 0,97, acelerando, com stagger invertido de 2 f (a última a entrar sai primeiro), terminando 1–2 f antes
  da troca. Saída e entrada sobrepostas em 4 f. Rasgo começando no mesmo frame em que o conteúdo sai. Fileira de cartões
  saindo em cascata enquanto o cartão do apresentador cresce.
- **Regra**: zero frame de papel vazio entre dois conteúdos; todo elemento tem saída de 4 a 8 f.

### 10.8 Texto pequeno e contraste fraco

- **Medido**: pílula 32 px; rótulo em caixa alta 23 px; rótulo de cartão pequeno 21–22 px; chip do indicador 20 px; branco
  sobre coral 2,9:1; rótulo coral sobre papel 2,3:1; pílula coral e seta fina quase somem sobre cenário âmbar; frase branca
  grande sem proteção atrás; pílula a 45–50% de opacidade por ~0,5 s na entrada `[T1 #2][T2 #3 #7][D §7]`.
- **Melhoria**: pílula coral com texto tinta; rótulo em cinza com marcador coral; degradê escuro lateral (tinta 0→55% nos 45%
  da esquerda) atrás de toda frase grande e escurecimento local (20–30%) atrás da coluna de pílulas; seta com traço de pelo
  menos 6 px e contorno claro; entrada já legível no segundo frame (opacidade ≥ 85%).
- **Regra**: nenhum texto abaixo de 28 px (2,6% da altura); pílula ≥ 40 px (3,6%); rótulo de cartão ≥ 3% (`[T1]`; `[D]`
  aceita 28 px) e, se não couber, 3+3 em vez de 4+2; rótulo em caixa alta ≥ 30 px; contraste ≥ 4,5:1 em todo texto.

### 10.9 Sem capítulo, sem resumo, sem CTA, sem tela final

- **Medido**: 7 viradas de capítulo sem marca; recapitulação sem imagem; "deixa o like" e "se inscreva" só falados; o vídeo
  acaba em corte seco 0,2 s depois da última palavra `[T3 #6][T4 #4][T5 #3][T6 #1 #2 #3 #10][D §7]`.
- **Melhoria**: cartela de capítulo de 0,8–2 s (rótulo "capítulo NN" + título serifado com itálico coral), cobrindo o próprio
  corte, e depois um rótulo persistente pequeno no topo; cartão de resumo com os itens construídos, cada um na sua menção;
  botão de like "pressionado" na palavra e pílula de inscrição na palavra (entrada de 8–10 f, 2,5–3 s na tela, lado oposto ao
  rosto); nos últimos 8–12 s o rosto encolhe para um cartão e abrem os espaços dos vídeos sugeridos.
- **Regra**: toda virada de capítulo tem marca visual; todo pedido falado (like, inscrição, link) tem elemento a ±0,1 s da
  palavra; o vídeo termina com tela final.

### 10.10 Repetição: mesma transição, mesma coreografia, mesma entrada

- **Medido**: footage encolhendo sempre para a direita 9× em 150 s; janela + canto 4× com a mesma sequência (encolhe, digita,
  pílula, zoom, zoom-out); ~60 entradas com a mesma receita de fade + subida `[T1 #5 #10][T2 #6 #12][M #7]`.
- **Melhoria**: manter o footage como elemento compartilhado, mas alternar o lado do cartão por bloco e variar a âncora;
  variar a 2ª e a 3ª demonstração (painel já em destaque, ou 50/50 com o item construído em tamanho grande); três níveis de
  entrada: pílula como está (ou "colando", com rotação −6°→−2° e mola curta), cartão com 4–6% de overshoot e sombra
  crescendo, elemento-herói (carimbo, número, frase) com escala + máscara em 12 f; termo técnico "digitado"; documento com
  as fitas entrando 3 f depois.
- **Regra**: o mesmo palco e a mesma transição no máximo 2 vezes seguidas; lado do cartão alterna a cada bloco.

### 10.11 Pilha de pílulas que não reage

- **Medido**: 5 pílulas cobrindo ~40% da altura por até 11,6 s; as riscadas continuam em destaque total; as anteriores não
  cedem à nova; duas pílulas sobrepostas em 4 px (296 s) `[T1 #6][M #9][D §6]`.
- **Melhoria**: ao riscar, a pílula encolhe para 85% e cai a 45% de opacidade; a nova faz as anteriores cederem 4–6 px e
  caírem a 70%; a 4ª expulsa a 1ª (reflow de 6 f); passo fixo e rotação determinística por índice.
- **Regra**: no máximo 3 pílulas em destaque ao mesmo tempo; no máximo 1 coral por pilha; nenhuma sobreposição.

### 10.12 Footage passivo

- **Medido**: sob pílula ou frase nada muda; push-in em 2 momentos; 74,5 s finais com a câmera imóvel `[T1 #11][M #12][T6 #4]`.
- **Melhoria**: punch-in de 1,00→1,08 em corte seco na frase de ênfase; push lento 1,00→1,04 em falas longas; alternar duas
  escalas (100% e 108–112%) em cortes de frase a cada 8–15 s; micro punch-in de 3–4% no frame de cada corte seco para
  disfarçá-lo `[T5 #10]`.
- **Regra**: nenhuma fala de mais de 8 s em talking head sem mudança de escala; no máximo 15 s no mesmo enquadramento.

### 10.13 Um layout só por minutos, rosto pequeno na opinião

- **Medido**: 734 s com o rosto num cartão de 18,5% da largura, inclusive nos trechos de pura opinião `[T3 #10][T4 #10][T5 #8]`.
- **Melhoria**: três estados conforme o tipo de fala: tela + cartão (demonstra), tela cheia com o rosto pequeno (leitura de
  detalhe), rosto grande com cartão de conceito (opinião ou tela parada). Troca em 10–14 f com os dois cartões deslizando.
- **Regra**: na demonstração, troca de estado a cada 15–25 s `[T5 #8]`; trecho de opinião usa o rosto em tela cheia ou 50/50,
  nunca o cartão pequeno `[T4 #10]`.

### 10.14 Cenas longas, em loop, com cadência irregular e volta em corte

- **Medido**: cenas de 9,7 s e 8,4 s em que a metáfora se esgota em ~4 s; 6, ~4,3 e 10 fps em cenas diferentes; ida com
  rasgo, volta sempre em corte seco; o rosto some por até 11,4 s `[T1 #12][M #6 #15]`.
- **Melhoria**: cena com 3 batidas ligadas a palavras; canto do apresentador depois de 5 s; cadência única de 12 fps ("em
  dois"); volta por rasgo invertido (direita → esquerda, 8 f) ou corte no acento da fala com a troca começando no mesmo frame.
- **Regra**: cena de mais de 5 s tem pelo menos 3 eventos e devolve o rosto; uma cadência só por vídeo.

### 10.15 Zoom sem foco e zoom-out desperdiçado

- **Medido**: origem fixa que não segue o cursor; primeira espera de 1,25 s; quase 1 s de zoom-out logo antes de cada corte
  `[M #10 #11]`.
- **Melhoria**: origem no elemento ativo, com pan suave quando o foco muda; cortar ainda em zoom quando a cena acaba.
- **Regra**: espera mínima de 2,5 s; quando a cena acaba, corta-se ainda em zoom, sem zoom-out.

### 10.16 Saltos de tempo sem sinal e ruído da gravação

- **Medido**: ~10 min cortados em 1 frame; reabertura do app cortada; prompt colado ilegível por 24 s com sublinhado do
  corretor; popup de área de transferência; balão de extensão por ~64 s; flashes claros (modal, papel de parede); seleção
  esquecida por 42,6 s; barra lateral com nomes de conversas exposta `[T3 #5 #11 #13][T4 #7 #11][T6 #6 #7]`.
- **Melhoria**: micro-cartela de salto ("10 min depois") com 6–8 f de avanço rápido; prompt redesenhado em 3–5 linhas-chave
  com realce progressivo e a gravação desfocada atrás; cobrir, desfocar ou cortar o ruído; limpar o destaque quando o assunto
  muda.
- **Regra**: todo salto de tempo que esconde espera tem sinal; nenhum bloco de texto colado fica na tela sem redesenho em
  3–5 linhas; nenhum dado pessoal ou elemento estranho ao conteúdo visível.

### 10.17 Lista que fecha incompleta

- **Medido**: 7 itens falados, 6 mostrados, e o layout é coberto no instante do último `[T2 #10]`.
- **Melhoria**: segurar o layout 1 s depois do último item, com um pulso em todos os cartões, e só então expandir o rosto.
- **Regra**: número de cartões = número de itens falados; o layout fica pelo menos 1 s depois do último.

### 10.18 Indicador de progresso mudo e minúsculo

- **Medido**: 33 px de altura, texto de 20 px, fora da margem; troca seca; some sem aviso; colide com a barra da janela
  `[T1 #2][T2 #3 #11][D §7]`.
- **Melhoria**: chips de 48 px com texto de 24 px, dentro da margem, com o nome do exemplo ao lado do número; troca animada
  (o ativo desliza, 6 f, com pulso); no fim da série, preencher todos e recolher; a janela desce 20 px quando ele está ativo.
- **Regra**: indicador com pelo menos 4% da altura; nenhuma colisão com outro elemento.

### 10.19 Inconsistências de design

- **Medido**: dois sistemas no mesmo vídeo; cartões da mesma fileira com alturas diferentes (215 e 243 px); cremes das cenas
  variando de rosado a amarelado e diferentes do papel dos painéis; degrau de tom em x = 74%; título de painel com dois
  tamanhos sem regra; uma palavra coral dentro de pílula branca quebrando a regra do coral; carimbo, seta e ícone riscado
  usados uma vez cada, sem virar linguagem; tela escura sobre fundo escuro, com 26% de faixas vazias e cantos retos ao lado
  de um cartão arredondado `[D §6][T3 #9][T4 #3][T5 #9 #12][T6 #13]`.
- **Melhoria**: um papel só; altura de cartão fixa, calculada para 2 linhas; escala de 3 raios; mesmo canto com borda na
  gravação real; janela com raio, fio claro de 1 px e sombra longa, ocupando a altura útil; promover os elementos únicos a
  componentes com regra de uso (carimbo = veredito, seta = "olhe aqui / na descrição", riscado = "não precisa mais de X").
- **Regra**: uma cor de papel, três raios, uma altura por fileira, um estilo de cartão de apresentador no vídeo inteiro.

### 10.20 Transições de borda fracas

- **Medido**: entrada e saída da tela crua em dissolve com o rosto fantasma; duas transições em 2,3 s (dissolve de 27 f em
  298,7 s e outro em 300,9 s), a primeira lavada `[T3 #8][T6 #11][M #14]`.
- **Melhoria**: usar o rosto como elemento compartilhado também aqui (14–16 f, a tela entrando com 3–6 f de atraso); uma
  única troca seguida de corte no acento.
- **Regra**: o apresentador nunca troca de tamanho por dissolve; nunca duas transições em menos de 6 s (o limite do nível
  `max` no editor).

---

<a id="s11"></a>
## 11. Como montar no editor

### 11.1 De cada coisa da referência para o que já existe

Ids reais de `pnpm mce arsenal components`, `effects` e `transitions`, e campos de `src/edl/schema.ts`.

| Na referência | No editor | Como |
|---|---|---|
| Talking head com pilha de pílulas | `PillStack` | overlay sem `presenter`; `props.items[]` com `text`, `tone`, `at`, `strikeAt`, `indent`; `corner`; `size` |
| Palavra-título de abertura | `PillStack` com `props.title` | serifada itálica coral acima das pílulas |
| Tons de pílula | `tone`: `paper`, `coral`, `ink`, `emerald`, `danger` | sem `tone`, a última da pilha vira coral |
| Pílula riscada | `strikeAt` | risca e recua (opacidade 50%, escala 88%) |
| Pilha em árvore | `indent` (0–2) | recuo de 64 px e prefixo "›" |
| Frase serifada palavra a palavra | `PhraseReveal` | `text` com `*itálico coral*` e `\n`; `eyebrow`; `side`; `wordAt[]` sincroniza cada palavra |
| Rosto deslocado sob a frase | `zooms` com `mode: "ease"`, `scale` 1,12–1,18, `focus.x` ≈ 0,35 | no mesmo intervalo da frase |
| Tela dividida com cartões | `SplitExplainer` + `presenter: { slot: "right" \| "left" }` | `eyebrow`, `title`, `cards[]` (`icon`, `label`, `caption`), `revealAt[]`, `note` |
| Ícones dos cartões | `cards[].icon` | `server`, `database`, `browser`, `phone`, `code`, `gear`, `bolt`, `lock`, `user`, `cloud`, `check`, `x`; sem ícone, sai o número |
| Janela flutuante + canto | `WindowStage` + `presenter: { slot: "pip-br" }` | `kind: "terminal"` com `lines[]`, `notes[]`, `push`; ou `kind: "screen"` com `layout.screen` |
| Recorte de documentação com marca-texto | `DocQuote` + `presenter: { slot: "pip-br" }` | `source`, `title`, `text` com `==trecho==`, `markAt`, `note` |
| Cena de papel recortado | `scene:<slug>/<Nome>` | criada pelo sub-agente `motion-designer` com o kit papel; `hidesCaptions: true` |
| Rasgo de papel | `wipe: "tear"` no overlay da cena | 0,4 s, da esquerda para a direita |
| Apresentador que encolhe e cresce | `presenter` em qualquer overlay | entrada 0,5 s, saída 0,4 s, junto com o footage (ffmpeg) |
| Canto que vira cartão sem passar pela tela cheia | dois overlays com `presenter` colados (o fim de um é o início do outro, tolerância de 2 frames) | o cartão desliza de um slot para o outro |
| Carimbo | `Stamp` | `text`, `tone` (`coral`, `ink`, `emerald`), `rotate` |
| Contador | `Counter` | `to`, `suffix`, `label` |
| Seta, círculo, caixa, sublinhado | `Callout` | `shape`: `arrow`, `circle`, `box`, `underline`; `x`, `y`, `width`, `label` |
| Número com contexto | `StatCard`, `KeywordPop`, `BarChart` | — |
| Indicador de progresso | `ChapterProgress`, `StepByStep`, `ProgressBar` | parcial: duram segundos, não atravessam layouts |
| Capítulo | `SectionTitle` + transição `wipe` ou stinger | a referência não tem; o canal mantém |
| CTA e encerramento | `SubscribeCTA`, `LikeReminder`, `LinkCard`, `"outro": true` | a referência não tem |
| Look quente | `effects` com `preset: "look-warm-editorial"` | um só, do começo ao fim |
| Punch-in seco | `zooms` com `mode: "punch"` ou `effects` `camera-punch-in` | conta como zoom |
| Push-in lento | `zooms` com `mode: "ken-burns"` ou `camera-slow-push` | termina num corte |
| Zoom na janela | `WindowStage.props.push` | só com `kind: "terminal"` |
| Destacar área da tela gravada | `focus-dim-outside`, `focus-spotlight`, `Callout` | manual |
| Esconder ruído ou dado sensível | `focus-blur-region`, `focus-pixelate-region` | manual |
| Dissolve | `transitions` com `type: "cross-dissolve"` ou `"fade-fast"` | na entrada do clipe |
| Corte seco | padrão | — |
| Tela gravada crua | `layout.segments` (`pip`, `split`, `screen`) | só como respiro |

### 11.2 Exemplos de EDL

Todo tempo em segundos do arquivo **fonte**. Os textos abaixo são de um tema inventado, só para mostrar a forma.

**Abertura: palavra-título + pílulas sobre o rosto**

```json
{ "id": "gancho", "component": "PillStack", "at": 0.15, "duration": 4.4,
  "props": { "title": "cache.", "corner": "top-left",
    "items": [ { "text": "a mudança mais barata do projeto", "at": 0.9 },
               { "text": "três linhas de configuração", "at": 2.4 } ] },
  "reason": "nomeia o assunto e a promessa do gancho" }
```

**Bloco de ideias com negação e conclusão**

```json
{ "id": "para-quem", "component": "PillStack", "at": 102.1, "duration": 12.4,
  "props": { "items": [ { "text": "precisa de servidor novo", "at": 0.9, "strikeAt": 2.6 },
                         { "text": "precisa reescrever a API", "at": 3.3, "strikeAt": 4.1 },
                         { "text": "só muda um cabeçalho", "tone": "emerald", "at": 4.9 },
                         { "text": "resposta dez vezes mais rápida", "at": 6.2 } ] },
  "reason": "duas objeções negadas, a alternativa e a conclusão" }
```

**Tese do bloco + rosto deslocado**

```json
{ "id": "tese", "component": "PhraseReveal", "at": 56.7, "duration": 3.8,
  "props": { "text": "Sem tocar\nno *servidor.*", "eyebrow": "o mais interessante", "side": "left",
             "wordAt": [0.1, 0.45, 0.8, 1.2] },
  "reason": "a tese do bloco" }
```

```json
{ "id": "z-tese", "at": 56.7, "duration": 3.8, "scale": 1.15, "focus": { "x": 0.35, "y": 0.4 },
  "mode": "ease", "reason": "leva o rosto para a direita e libera o lado da frase" }
```

**Enumeração em tela dividida**

```json
{ "id": "antes", "component": "SplitExplainer", "at": 23.15, "duration": 13.8,
  "presenter": { "slot": "right", "focus": { "x": 0.5, "y": 0.4 } }, "hidesCaptions": true,
  "props": { "eyebrow": "Antes", "title": "Toda resposta vinha do *banco*",
    "cards": [ { "icon": "browser", "label": "Navegador pede" },
               { "icon": "server", "label": "Servidor processa" },
               { "icon": "database", "label": "Banco responde" } ],
    "revealAt": [7.0, 8.0, 10.1],
    "note": { "text": "em toda requisição", "at": 11.5 }, "presenter": "right" },
  "reason": "enumera o caminho antigo antes de apresentar a mudança" }
```

**Demonstração em janela, seguida da fonte oficial, com o canto parado**

```json
{ "id": "demo", "component": "WindowStage", "at": 60.5, "duration": 17.1,
  "presenter": { "slot": "pip-br", "focus": { "x": 0.5, "y": 0.38 } }, "hidesCaptions": true,
  "props": { "title": "Terminal", "kind": "terminal",
    "lines": [ { "text": "curl -I https://api.exemplo.dev/produtos", "tone": "prompt", "at": 0.9 },
               { "text": "HTTP/2 200", "at": 3.2 },
               { "text": "cache-control: max-age=3600", "tone": "accent", "at": 4.0 },
               { "text": "resposta servida do cache", "tone": "ok", "at": 9.4 } ],
    "notes": [ { "text": "um cabeçalho só", "at": 4.2 },
               { "text": "vale por uma hora", "tone": "coral", "at": 6.8 },
               { "text": "cache ativo", "tone": "emerald", "at": 9.6 } ],
    "push": { "at": 3.8, "scale": 1.25, "x": 0.3, "y": 0.35 } },
  "reason": "mostra o comando e a resposta que a fala descreve" }
```

```json
{ "id": "fonte", "component": "DocQuote", "at": 77.6, "duration": 7.6,
  "presenter": { "slot": "pip-br", "focus": { "x": 0.5, "y": 0.38 } }, "hidesCaptions": true,
  "props": { "source": "documentação oficial · developer.mozilla.org", "title": "Cache-Control",
    "text": "The Cache-Control header holds directives that control caching. ==max-age tells the browser for how long a response stays fresh.==",
    "markAt": 2.4, "note": { "text": "o navegador nem pergunta de novo", "at": 5.0 } },
  "reason": "prova que a definição vem da documentação" }
```

`demo` termina em 77,6 s e `fonte` começa em 77,6 s: os dois palcos ficam colados e o canto não volta à tela cheia.

Na cena abaixo, a divisão em duas metades é a recomendação do `STYLE.md §0`; hoje ela dispara o aviso `cena-frequente`
(seção 12.1, linha 38).

**Cena com rasgo, devolvendo o rosto depois de 5 s**

```json
{ "id": "cena-fila-a", "component": "scene:meu-video/FilaDePedidos", "at": 92.0, "duration": 5.0,
  "wipe": "tear", "hidesCaptions": true, "reason": "metáfora do servidor sobrecarregado" }
```

```json
{ "id": "cena-fila-b", "component": "scene:meu-video/FilaDePedidosAlivio", "at": 97.0, "duration": 4.8,
  "presenter": { "slot": "pip-br", "backdrop": "none" }, "hidesCaptions": true,
  "reason": "segunda batida da metáfora, com o rosto de volta" }
```

**Veredito, número e seta**

```json
{ "id": "veredito", "component": "Stamp", "at": 222.75, "duration": 2.6,
  "props": { "text": "Mito", "tone": "coral", "rotate": -9 }, "reason": "veredito sobre a afirmação anterior" }
```

```json
{ "id": "n-pedidos", "component": "Counter", "at": 130.85, "duration": 4,
  "props": { "to": 40, "label": "requisições por segundo" }, "reason": "dá peso ao número dito" }
```

```json
{ "id": "olha-aqui", "component": "Callout", "at": 246.0, "duration": 4,
  "props": { "shape": "arrow", "x": 0.14, "y": 0.6, "label": "link na descrição", "labelSide": "top" },
  "reason": "aponta para onde o espectador deve ir" }
```

**Look e transição de borda**

```json
{ "id": "look", "preset": "look-warm-editorial", "at": 0.3, "intensity": 0.4,
  "reason": "aproxima o footage do papel" }
```

```json
{ "id": "t-demo", "intoClip": "c031", "type": "cross-dissolve", "duration": 0.4,
  "reason": "passagem para a parte prática" }
```

**Tela gravada dentro da janela (demonstração real)**

```json
{ "id": "tela-1", "component": "WindowStage", "at": 301.0, "duration": 14,
  "presenter": { "slot": "pip-br" }, "hidesCaptions": true,
  "props": { "title": "Aplicativo", "kind": "screen",
    "notes": [ { "text": "aba de código", "at": 9.8 }, { "text": "versão em configurações", "tone": "coral", "at": 12.2 } ] },
  "reason": "a demonstração real, com a anotação do que importa" }
```

Requer `"layout": { "screen": { "path": "<gravação>", "offsetSec": 0 } }`. Com `kind: "screen"`, `lines` e `push` são
ignorados (seção 12).

### 11.3 Receita de direção: da transcrição à EDL

1. **Preparar**: `pnpm mce analyze "<arquivo>"`, `pnpm mce draft <slug> --level max`, `pnpm mce levels max`. Ler
   `projects/<slug>/analysis/takes.md` inteiro e o `STYLE.md §0`.
2. **Fatiar em blocos de 8–10 s** pelo tipo de fala e dar um layout a cada um:

   | A fala… | Layout | Componente |
   |---|---|---|
   | abre o vídeo, dá opinião, faz a ponte entre blocos, lista 2–5 ideias rápidas | talking head com pílulas | `PillStack` |
   | crava a tese, anuncia o que vem, cita a pergunta do espectador | frase serifada | `PhraseReveal` + zoom `ease` |
   | enumera, compara, define ("antes × agora", "A × B", "serve para…") | tela dividida | `SplitExplainer` + `presenter` lateral |
   | demonstra ("você pede → ele faz", "imagina que…"), mostra comando ou tela | janela + canto | `WindowStage` + `presenter: pip-*` |
   | cita uma fonte | recorte com marca-texto | `DocQuote` + `presenter: pip-*` |
   | explica um conceito abstrato sem tela para mostrar | cena de papel | `scene:` + `wipe: "tear"` |
   | conta algo pessoal ou precisa mostrar a tela inteira | respiro | nada, ou `layout.segments` |

3. **Ordenar para variar**: o mesmo palco no máximo 2 vezes seguidas; alternar `right`/`left`; cena a cada ~30 s; respiros com
   até 40 s cada, somando no máximo 20% do vídeo, nunca dois colados. Colar palcos vizinhos (fim = início) quando o rosto deve
   ficar no cartão.
4. **Escrever os textos**: pílula com 2–5 palavras, minúsculas, sem ponto; ordem branca → verde/vermelha → coral, uma coral
   por pilha e por último; frase com 4–5 palavras em 2 linhas e uma palavra em `*itálico coral*`; título de painel em 1–2
   linhas; rótulo de 1–3 palavras; cartões com rótulo de 1–3 palavras, tantos cartões quantos itens falados (até 6). Texto é
   síntese, nunca transcrição.
5. **Ancorar na fala** com `pnpm mce words <slug> --from <s> --to <s>`:
   - `at` do overlay = início da primeira palavra da frase − 0,15 a 0,25 s;
   - cada `items[].at`, `revealAt[]`, `wordAt[]`, `notes[].at`, `markAt` = (início da palavra-chave − 0,07 s) − `at` do
     overlay; nunca antes da palavra anterior;
   - se houver corte entre o `at` e a palavra, descontar o trecho cortado.
6. **Dar tempo de leitura**: cada item fica pelo menos 1,2 s + 0,25 s por palavra antes de o overlay acabar; nenhuma entrada a
   menos de 1 s do fim; lista segura 1 s depois do último item.
7. **Conferir o rosto no cartão**: `pnpm mce frame <slug> --at <s>` e ajustar `presenter.focus` (e `zoom`, se preciso).
8. **Criar as cenas**: uma por conceito, delegadas ao `motion-designer` em paralelo. Para **ver as cenas enquanto são criadas**,
   subir antes o visor: `pnpm mce scenes watch <slug>` (Remotion Studio no navegador, com recarga automática; a composição
   `Roteiro-<slug>` toca todas em sequência). `pnpm mce scenes sync` depois de gravar uma cena nova.
9. **Preencher os vazios**: rodar `pnpm mce level <slug>` e fechar cada intervalo acima de 8 s com pílula, item, `push`, zoom
   ou troca de layout. Na tela gravada, usar `WindowStage` com `kind: "screen"` + `notes`, `Callout` e efeitos de foco.
10. **Camada do canal** (a referência não tem): `SectionTitle` em cada capítulo, `SubscribeCTA` depois do primeiro valor e no
    fim, `LinkCard` quando manda para a descrição, trilha com ducking, SFX, `look-warm-editorial`, `intro`/`outro`.
11. **Gravar e medir**: `pnpm mce edl validate <arquivo>`, `pnpm mce edl save <slug> <arquivo>`, `pnpm mce render <slug>`,
    `pnpm mce eval <slug>`. Corrigir `padrao-obrigatorio`, `pouco-editado`, `tela-parada`, `trecho-parado`, `respiros-colados`,
    `fora-de-sincronia`, `leitura-curta`, `legenda-sobre-palco`,
    `abaixo-do-nivel`. Olhar um frame de cada palco. No máximo 3 voltas; depois `render --final` e `report`.

### 11.4 Mínimos e limites do nível max

De `src/edl/levels.ts` (`pnpm mce levels max`). Mínimo por minuto arredonda para baixo e nunca é menos que 1.

| Padrão obrigatório | Mínimo | Em 10 min | Medido na referência (bloco editado) |
|---|---|---|---|
| Pílulas de resumo (`PillStack`) | 1,5/min | 15 | ~5,6 grupos/min (10 pílulas/min) |
| Frase serifada (`PhraseReveal`) | 0,5/min | 5 | 0,6/min (0,8 com a palavra-título) |
| Apresentador em cartão (`presenter`) | 1/min | 10 | 2,4–2,8/min (12 entradas de palco por contagem minha; `levels.ts` registra 2,8) |
| Explicação dividida (`SplitExplainer`) | 0,4/min | 4 | 0,8/min |
| Janela flutuante (`WindowStage`) | 0,4/min | 4 | 1,2–1,4/min |
| Rasgo de papel (`wipe: "tear"`) | 0,5/min | 5 | 1/min |
| Citação com marca-texto (`DocQuote`) | 1 por vídeo | 1 | 1 grande + 2 miniaturas |

| Orçamento por minuto | Faixa | Em 10 min |
|---|---|---|
| Zooms (inclui efeito de câmera) | 2–9 | 20–90 |
| Gráficos | 6–12 | 60–120 |
| Cenas ilustrativas | 1,5–3 | 15–30 |
| Transições | 0,5–3,5 | 5–35 |
| Efeitos | 0,5–3 | 5–30 |
| SFX | 4–12 | 40–120 |

| Limite | Valor |
|---|---|
| Distância mínima entre zooms / gráficos / cenas / transições / memes | 6 / 4 / 20 / 6 / 40 s |
| Tela parada no trecho editado | até 8 s |
| Vídeo editado | pelo menos 80% |
| Cada respiro | até 40 s |
| Leitura mínima de um overlay | 1,2 s |
| Leitura mínima de cada item de texto | 1,2 s + 0,25 s por palavra |
| Sincronia de cada entrada com o início da palavra | de −0,15 s a +0,10 s |
| Parte editada entre dois respiros | pelo menos 15 s |
| Transições diferentes / de energia alta | até 10 / até 10 |
| Trilha e vinhetas | sempre |

---

<a id="s12"></a>
## 12. Implementado × falta

### 12.1 Tabela

Estado: **sim** = reproduz; **parcial** = reproduz com diferença relevante ou só à mão; **não** = não existe.
Prioridade: P0 = muda o resultado de todo vídeo; P1 = fidelidade e acabamento; P2 = repertório.

| # | O que a referência faz (ou a melhoria da seção 10) | Estado | Onde | O que falta | Prioridade |
|---|---|---|---|---|---|
| 1 | Pílula com 5 tons de significado fixo | sim | `stage-kit.tsx` (`pillColors`) | — | — |
| 2 | Pilha de pílulas que entram na fala, riscada, árvore, palavra-título | sim | `PillStack` | Variantes "par técnico" (termo + definição na mesma linha) e pílula com palavra coral interna, seta ou check | P2 |
| 3 | Frase serifada com uma palavra em itálico coral | sim | `PhraseReveal`, `RichText` | — | — |
| 4 | Tela dividida com rótulo, título e cartões um por palavra | sim | `SplitExplainer` | Variantes da coluna: miniaturas comparativas com selo, moldura com cena, recorte de tela com fita | P2 |
| 5 | Janela flutuante com terminal digitado, pílulas ao lado e zoom | sim | `WindowStage` | Interface simulada genérica (chat, painel que desliza, modal, item destacado) | P2 |
| 6 | Recorte de documentação com fita e marca-texto | sim | `DocQuote` | Usa texto redesenhado, não captura real; sem sublinhado sob a marca | P2 |
| 7 | Apresentador encolhe para cartão e cresce de volta, junto com o footage | sim | `stage.ts`, `StageLayer.tsx`, `reframe.ts`, `presenter` no schema | Curva e duração diferentes das medidas (12.2) | P1 |
| 8 | Canto que desliza de um palco para outro | sim | `linkStages` | — | — |
| 9 | Rasgo de papel | sim | `tearPolygon`, `wipe: "tear"` | Progresso linear em vez de ease-in-out; sem rasgo de saída | P1 |
| 10 | Cor com significado, um coral por pilha, texto tinta sobre coral | sim | `stackItems`, `pillColors` | — | — |
| 11 | Proteção de leitura atrás de pílulas e frase (melhoria 10.8) | sim | `PillStack` (radial), `PhraseReveal` (degradê lateral) | — | — |
| 12 | Tamanhos mínimos de texto (melhoria 10.8) | sim | pílula 40 px, rótulo de cartão 34–38 px, rótulo em caixa alta 30 px | Sem verificação automática de tamanho mínimo | P2 |
| 13 | Saída da pilha com stagger invertido de 2 f (melhoria 10.7) | sim | `exitProgress` em `PillStack` | — | — |
| 14 | Cobertura de 80%, respiro de 40 s, tela parada (melhorias 10.1 e 10.3) | sim | `levels.ts`, `checks.ts` (`pouco-editado`, `tela-parada`), `direction.ts` (`trecho-parado`, `respiros-colados`), `breathers` no schema | — (intervalo de 8–40 s sem evento avisa `trecho-parado`, salvo respiro declarado em `breathers`; dois respiros com menos de 15 s editados entre eles avisam `respiros-colados`) | — |
| 15 | Sete padrões obrigatórios com mínimo | sim | `MAX_PATTERNS`, `budget.ts` (`padrao-obrigatorio`) | — | — |
| 16 | Legenda escondida em palco | sim | `checks.ts` (`legenda-sobre-palco`), `captionClash` em `direction.ts` | Cobre `right`/`left`, `WindowStage` em qualquer slot e toda cena `scene:*`; `DocQuote` e outros componentes com `pip-*` não são conferidos | P2 |
| 17 | Sincronia na palavra − 2 frames (melhoria 10.5) | sim | `findOffSync` em `direction.ts` (`fora-de-sincronia`), `syncWindowSec` em `levels.ts` | Janela [−0,15 s; +0,10 s] contra a palavra de início mais próximo (em `wordAt`, contra a própria palavra dita); não sabe QUAL palavra motiva uma pílula ou um cartão, e cue sem valor declarado (cascata padrão do componente) não é conferido | P1 |
| 18 | Leitura mínima de 1,2 s + 0,25 s por palavra (melhoria 10.6) | sim | `minReadSec` em `components/read-time.ts`; `findShortReads` em `direction.ts` (`leitura-curta`); `grafico-curto` (1,2 s por overlay) | Só confere texto com cue declarado (pílula, linha, nota, cartão com `revealAt`, frase com `wordAt`); texto fixo do overlay e item sem `at` ficam de fora | P2 |
| 19 | Título da tela dividida sincronizado com a fala (melhoria 10.5) | não | `SplitExplainer` usa cascata fixa (`TITLE_STEP` 0,13 s) | Prop `wordAt` como a do `PhraseReveal`: hoje repete a fraqueza da referência | **P0** |
| 20 | Zoom e foco na **gravação de tela** (melhoria 10.2) | não | `pushTransform` devolve escala 1 quando `kind: "screen"` | Zoom dirigido na gravação dentro da janela, com origem no alvo e volta; é o que faltou em 66% da referência e o `STYLE.md` já promete ("zoom no que é citado") | **P0** |
| 21 | Cursor com halo e anel de clique (melhoria 10.2) | não | — | Componente ou efeito de cursor | P1 |
| 22 | Escurecer fora do alvo, contorno desenhado, marca-texto de pós sobre a tela | parcial | efeitos `focus-dim-outside`, `focus-spotlight`; `Callout` (`box`, `underline`) | Não verifiquei se atuam sobre a gravação dentro do `WindowStage`; não há marca-texto varrendo sobre a tela | P1 |
| 23 | Número e termo ancorados ao lado da janela (melhoria 10.4) | parcial | `Counter`, `StatCard`, `KeywordPop`; `notes` do `WindowStage` | Cartela de número dentro do palco (hoje a nota é só pílula de texto; overlay simultâneo gera `graficos-sobrepostos`) | P1 |
| 24 | Indicador de progresso que atravessa layouts | não | `ChapterProgress` (4 s), `StepByStep` | Elemento persistente com troca animada; o lint de sobreposição precisa aceitar uma camada persistente | P1 |
| 25 | Janela espelhada (canto à esquerda, janela à direita) | não | `WINDOW.x` é fixo em 3,5% | Com `pip-bl`, o canto cai sobre a janela; o `STYLE.md` pede alternar `pip-br`/`pip-bl` | P1 |
| 26 | Troca de conteúdo dentro do mesmo palco (janela sai, outra entra) e troca de fase da tela dividida | não | — | Hoje são dois overlays colados: o canto fica, mas o conteúdo troca em corte | P1 |
| 27 | Saída coreografada do conteúdo de palco, sem frame vazio (melhoria 10.7) | parcial | `PillStack`, `PhraseReveal`, `DocQuote` têm saída | `SplitExplainer` e `WindowStage` não têm saída própria; não há sobreposição de 4 f entre palcos | P1 |
| 28 | Variedade: mesmo palco no máximo 2 vezes, lado alternado (melhoria 10.10) | parcial | regra escrita | Sem check | P1 |
| 29 | Pilha que reage: máximo 3 em destaque, anteriores a 70%, reflow (melhoria 10.11) | parcial | só a riscada recua | Limite é 5; as anteriores não cedem; sem vão maior antes da conclusão | P2 |
| 30 | Três níveis de entrada (melhoria 10.10) | parcial | pílula "cola" com rotação e repique; 50 entradas no arsenal | Cartão com overshoot; elemento-herói com máscara; fitas do documento atrasadas | P2 |
| 31 | Carimbo como na referência | parcial | `Stamp` | É centralizado, em Inter 800, a −7°; a referência é lateral, serifada, a −9,3°, com mola de 2,3→1 | P2 |
| 32 | Ícone riscado ("não precisa mais de X") | não | — | Componente | P2 |
| 33 | Seta "olhe aqui / na descrição" | parcial | `Callout` (`arrow`), `LinkCard` | — | — |
| 34 | Contador em chip mono dentro de cena | parcial | `Counter`; `Counter` do kit de cena | — | — |
| 35 | Ícones de papel recortado nos cartões | não | 12 ícones de linha em `scene-kit/icons.tsx` | Mais ícones ou ilustração por cartão | P2 |
| 36 | Punch-in e push-in no apresentador (melhoria 10.12) | parcial | `zooms`, `camera-punch-in`, `camera-slow-push` | Manual; sem regra "fala de mais de 8 s tem mudança de escala" | P2 |
| 37 | Três estados de layout na demonstração (melhoria 10.13) | parcial | `presenter` + `layout.segments` | Sem estado "rosto grande + cartão de conceito" pronto; sem regra de alternância | P2 |
| 38 | Cena que devolve o rosto depois de 5 s (melhoria 10.14) | parcial | dividir a cena em duas, a segunda com `presenter` | Manual; **as duas metades contam como duas cenas a menos de 20 s uma da outra e disparam `cena-frequente`**; cadência de animação das cenas não verificada | P1 |
| 39 | Cartela de capítulo, CTA, tela final (melhoria 10.9) | sim | `SectionTitle`, `SubscribeCTA`, `LikeReminder`, `LinkCard`, `outro` | Sincronia com a palavra é manual; sem check "todo capítulo tem marca" | P2 |
| 40 | Sinal de salto de tempo, prompt redesenhado (melhoria 10.16) | parcial | transição `clock-wipe`; `CodeCard`, `Terminal` | Micro-cartela "N min depois"; cartão de prompt com realce progressivo | P2 |
| 41 | Limpeza de ruído da gravação (melhoria 10.16) | sim | `focus-blur-region`, `focus-pixelate-region` | Manual | — |
| 42 | Curva única da referência no tema | não | `motion.move` é a mais próxima | `Easing.bezier(0.65, 0, 0.35, 1)` como curva de troca, se a decisão for fidelidade | P1 |
| 43 | Papel único com vinheta (melhoria 10.19) | sim | `BACKDROP.paper` | O `reframe.ts` pinta papel chapado atrás do footage; a vinheta vem da camada de gráficos | — |
| 44 | Som | não medido | SFX e trilha do canal | A referência não pôde ser analisada (seção 14) | — |

### 12.2 Números implementados que divergem do medido em 720p

| Item | No editor | Medido (720p) | Comentário |
|---|---|---|---|
| Duração da troca de layout | entrada 0,5 s, saída 0,4 s (`STAGE_IN`, `STAGE_OUT`) | 0,9 s (27 f) nas duas direções | O `STYLE.md` registra "0,4–0,9 s", faixa dos relatórios em 360p |
| Curva da troca | entrada cúbica desacelerando, saída cúbica acelerando | `bezier(0.65, 0, 0.35, 1)`, simétrica | A do editor é mais seca; a medida é mais suave |
| Camada antiga durante a troca | papel e conteúdo aparecem desde o frame 0 | fica parada 5–10 f e é cortada | Detalhe que só o 720p mostrou |
| Borda do cartão | 6 px fixos, opacidade ligada ao tamanho | cresce de 0 a 4,5–6 px com o progresso | |
| Raio do cartão | 40 px (`CARD_RADIUS`) | 33–34 px | 40 vinha do 360p |
| Cartão vertical | 23,5% × 88%, margem direita 3% | 24,3% × 89,9%, margem direita 1,8% | |
| Canto | 21,25% × 35,6%, margens 3% / 5,3% | 21,4% × 36,2%, margens 2,9% / 5,1% | Praticamente igual |
| Zoom do rosto no cartão vertical | 1,3 (`slotZoom`) | 1,0 (cover puro) | |
| Zoom do rosto no canto | 1,5 | ~1,6 | |
| Rasgo | 0,4 s, progresso linear, 22 dentes de ~3,4% + ruído | 0,37 s (11 f), ease-in-out, ~11 dentes de 4,8% | |
| Janela | x 3,5–73,5%, y 7–87%, raio 22 | x 3,7–74,4%, y 8,3–87,9%, raio 19 | Praticamente igual |
| Zoom na janela (`push`) | 0,9 s, `motion.move`, padrão 1,2, sem volta | 1,2 s para entrar, ~0,9 s para sair, padrão 1,25 | |
| Frase: defasagem entre palavras | 0,16 s (`WORD_STEP`) | 0,117 s (3,5 f) | Com `wordAt` o valor fixo não importa |
| Frase: entrada da palavra | 0,3 s, `motion.enter`, subida de 0,08 em (~11 px), sem blur, palavra futura a 22% | 10 f, curva B, subida de 36 px, blur de 3 f, sem "fantasma" | O fantasma é escolha nossa: mostra o tamanho da frase |
| Frase: tamanho | até 132 px | ≈ 140 px (variante 121 px) | |
| Título de painel | 96 px, subida de ~8 px | ≈ 98 px, subida de 20 px | |
| Pílula: tamanho | texto 40 px, raio 12, vão 22 | texto 32 px, raio 8, vão 28 | Texto maior é intencional (10.8) |
| Pílula: entrada | 0,35 s, deslize lateral de 22 px, giro de 5°, repique de 3,5% | 9–11 f, subida de 26 px, escala 0,92→1, sem ultrapassar | Entrada "colando" é intencional (10.10) |
| Pílula: inclinação | −1,2° / +0,8° / −0,6° / +1° por índice | −1,5° em quase todas; −2,5° na conclusão; ±2,05° só na lateral | A alternância de sinal vinha do 360p |
| Cartão de fileira | 0,5 s, subida de 34 px, escala 0,95→1; rótulo 34–38 px | 10 f, subida de 51 px, sem escala; rótulo 30 / 22 px | |
| Recorte de documentação | −1,3°; marca alfa 0,38; fita alfa 0,72; entrada com escala 1,05→1 e blur | −0,86°; marca alfa 0,43 + sublinhado; fita alfa 0,8; entrada com subida de 66 px | |
| Palavra-título | 168 px | ≈ 208 px | |
| Carimbo | −7° | −9,3° (`[M-HD]`) ou −7,5° (`[D-HD]`) | |
| "A referência usa 28 e 22" (`STYLE.md §0`, tamanhos de pílula e rótulo) | — | pílula ≈ 32 px; rótulo de cartão 30 px (grande) e 21–22 px (pequeno) | 28 vinha do `[T1]` em 360p |
| "Saídas são corte seco" (`STYLE.md §0`) | — | corte quando o layout troca; fade coletivo de 8 f quando o fundo continua | |
| Tempo de tela (`STYLE.md §0`) | 28 / 30 / 18 / 23% | 28 / 30 / 17 / 22% | Arredondamento |
| Mínimo de zooms | 2/min | 1,2/min (6 zooms de janela) + ~6 reenquadramentos do rosto inferidos | O orçamento do editor pede mais zoom que a referência |
| Distância mínima entre cenas | 20 s | 14,1 s, 18,4 s e 19,4 s em três pares | A referência não passaria no nosso lint |

Nenhuma dessas divergências é erro por si: várias são escolhas da seção 10. As que mudam a sensação do movimento e merecem
decisão são as cinco primeiras linhas (troca de layout) e a do rasgo.

### 12.3 O que falta, em ordem de prioridade

**P0**

1. Zoom e foco na gravação de tela dentro do `WindowStage` (`kind: "screen"` ignora `push`).
2. ~~Check de sincronia: `at`, `revealAt`, `wordAt`, `notes[].at` e `markAt` contra o `words.json`, janela [−0,15 s; +0,10 s].~~ Feito: `fora-de-sincronia`.
3. ~~Check de leitura mínima por item (ligar `minReadSec` à avaliação).~~ Feito: `leitura-curta`.
4. `wordAt` no título do `SplitExplainer`.

**P1**

5. Troca de layout com a curva e a duração medidas (0,9 s, `bezier(0.65, 0, 0.35, 1)`), camada antiga parada 5–10 f, borda
   crescendo; decidir se vale a fidelidade ou a versão mais seca atual.
6. ~~Aviso localizado para intervalo de 8–40 s parado dentro do trecho editado.~~ Feito: `trecho-parado`, com respiro declarado em `breathers`, e `respiros-colados`.
7. ~~`legenda-sobre-palco` também para `WindowStage` e cena de tela cheia.~~ Feito.
8. Janela espelhada para `pip-bl`.
9. Troca de conteúdo dentro do mesmo palco e saída coreografada de `SplitExplainer` e `WindowStage`, sem frame vazio.
10. Indicador de progresso persistente, com o lint aceitando uma camada fixa.
11. Cursor com halo e anel de clique; marca-texto de pós e contorno desenhado sobre a tela gravada.
12. Cartela de número dentro do palco.
13. Rasgo com ease-in-out e rasgo invertido para sair da cena.
14. Check de variedade (mesmo palco no máximo 2 vezes; lado alternado).
15. Cena dividida em duas para devolver o rosto: hoje dispara `cena-frequente` e conta em dobro no orçamento de cenas.

**P2**

16. Pilha que reage (3 em destaque, anteriores a 70%, vão maior antes da conclusão, conclusão mais torta).
17. Variantes de pílula: par técnico, palavra coral interna, seta e check.
18. Componentes únicos promovidos: ícone riscado; carimbo lateral serifado com mola; miniaturas comparativas com selo.
19. Interface simulada genérica dentro da janela (chat, painel, modal).
20. Entradas por nível (cartão com overshoot, elemento-herói com máscara).
21. Ícones de papel recortado nos cartões.
22. Regras automáticas de footage (mudança de escala em fala longa) e de cena (devolver o rosto depois de 5 s).
23. Micro-cartela de salto de tempo e cartão de prompt redesenhado.
24. Checks de capítulo com marca, CTA na palavra e tamanho mínimo de texto.

---

<a id="s13"></a>
## 13. Checklist final do nível max

**Antes de dirigir**

- [ ] `pnpm mce levels max` e `pnpm mce level <slug>` lidos; nível `max` na EDL.
- [ ] `takes.md` lido inteiro; vídeo fatiado em blocos de 8–10 s, cada um com layout.
- [ ] Respiros escolhidos: até 40 s cada, até 20% do total, nunca dois colados.

**Layouts**

- [ ] Nenhum palco repetido mais de 2 vezes seguidas; lado do cartão alternado.
- [ ] Toda tela de conteúdo tem `presenter`: o rosto encolhe, nunca some (exceto cena de até 5 s).
- [ ] Palcos vizinhos colados quando o rosto deve ficar no cartão.
- [ ] `hidesCaptions: true` em palco lateral, `WindowStage` e cena de tela cheia; legenda ligada sob `PillStack` e `PhraseReveal`.
- [ ] Tela gravada sempre dentro de `WindowStage`, com notas; tela crua só como respiro.
- [ ] `focus` do rosto conferido com `pnpm mce frame` em cada palco.

**Texto**

- [ ] Pílula com 2–5 palavras, minúsculas, sem ponto, uma linha.
- [ ] Ordem de cor: `paper` → `emerald`/`danger` → `coral`; uma coral por pilha, a última.
- [ ] Uma só palavra em `*itálico coral*` por frase ou título.
- [ ] Texto é síntese, nunca transcrição.
- [ ] Número de cartões = número de itens falados.

**Tempo**

- [ ] Todo `at`, `revealAt`, `wordAt`, `notes[].at`, `markAt` = início da palavra − 0,07 s; nunca antes da palavra anterior.
- [ ] Troca de layout 0,15–0,25 s antes da primeira palavra da frase.
- [ ] Cada item fica 1,2 s + 0,25 s por palavra; nenhuma entrada a menos de 1 s do fim do overlay.
- [ ] Lista segura 1 s depois do último item.
- [ ] Algo novo a cada 2–4 s; nenhum intervalo acima de 8 s no trecho editado.
- [ ] Carimbo e número caem na palavra, não antes.

**Padrões obrigatórios** (para a duração do vídeo, `pnpm mce level <slug>`)

- [ ] `PillStack` ≥ 1,5/min · `PhraseReveal` ≥ 0,5/min · `presenter` ≥ 1/min.
- [ ] `SplitExplainer` ≥ 0,4/min · `WindowStage` ≥ 0,4/min · `wipe: "tear"` ≥ 0,5/min · `DocQuote` ≥ 1.

**Cenas e footage**

- [ ] Cena a cada ~30 s (mínimo de 20 s entre duas), entrando por rasgo; visor aberto com `pnpm mce scenes watch <slug>`.
- [ ] Cena com mais de 5 s dividida em duas, a segunda com `presenter: pip-br`.
- [ ] Frase serifada acompanhada de zoom `ease` 1,12–1,18 com `focus.x` ≈ 0,35.
- [ ] Nenhuma fala de mais de 8 s em talking head sem mudança de escala ou elemento.
- [ ] `look-warm-editorial` do começo ao fim.

**Camada do canal**

- [ ] `SectionTitle` em toda virada de capítulo; capítulos (3 ou mais) preenchidos.
- [ ] `SubscribeCTA` depois do primeiro valor e no fim; `LinkCard` quando manda para a descrição; `outro: true`.
- [ ] Trilha com ducking; SFX nas entradas; todo item com `reason`.

**Medir**

- [ ] `pnpm mce edl validate` sem erro; `pnpm mce render` e `pnpm mce eval`.
- [ ] Zero `padrao-obrigatorio`, `pouco-editado`, `tela-parada`, `legenda-sobre-palco`, `abaixo-do-nivel`.
- [ ] Um frame de cada palco aberto: rosto dentro do cartão, nada ilegível, nada sobreposto.
- [ ] Conferido à mão o que ainda não tem check: sincronia com a palavra, leitura mínima por item, variedade.

---

<a id="s14"></a>
## 14. Apêndice: limites da análise e relatórios brutos

### 14.1 O que não foi possível medir

| Item | Por quê | Consequência |
|---|---|---|
| **Som**: trilha, SFX, ducking, sincronia de efeito sonoro | A análise foi feita por frame; nenhum relatório avaliou o áudio | Tudo sobre som no nível `max` vem do `STYLE.md §10`, não da referência |
| Família exata das fontes | Só a classe foi confirmada (serifada tipo Tiempos Headline, sans tipo Inter, mono) | Usamos Playfair Display, Inter e JetBrains Mono |
| Peso da sans em pílula e rótulo | 600 ou 700; no zoom parece 700 | — |
| Tamanhos de fonte em px | Derivados de altura-x e de caixa alta; a medida dura é a que está nas tabelas | Margem de alguns px |
| Curva exata de pílulas e cartões | Três curvas ajustam igual; só o overshoot está descartado | Qualquer desaceleração de ~10 f serve |
| Quantidade de blur nas palavras | A compressão impede medir; 8–10 px é estimativa visual | — |
| Carimbo nos 4 primeiros frames | Escala inicial de 2,3 vem do ajuste da mola, não de medida direta; tamanho final e ângulo divergem entre os dois relatórios em 720p | Adotados 534×119 px e −9,3° |
| Reenquadramentos do apresentador | Vistos por três relatórios em 360p, negados por um; não remedidos em 720p | Valores da seção 8.2 são inferência |
| Escurecimento atrás de texto sobre o rosto | Nada mensurável, mas o enquadramento muda entre os frames comparáveis | Tratado como ausente |
| Grão no papel dos painéis | A 926 kbps o codec apagaria | Tratado como chapado |
| Parâmetros de sombra | Ajuste de um modelo de 1 camada: opacidade ±5 pontos, blur ±20% | — |
| Raios de canto | ±1,5 px em `[D-HD]`, ±3 px em `[M-HD]`; por isso os dois divergem (33 e 26 no canto) | Adotado `[D-HD]`, que ajustou o perfil do canto |
| Frame exato do corte da camada antiga na troca | Varia de 4 a 10 sem regra clara | — |
| Não remedidos em 720p | Defasagens de pílulas e cartões em relação à fala, risco sobre o ícone, moldura da cena, cadência das cenas, ângulo de algumas pílulas, azul da interface, todo o trecho 301–1110 s além dos dois dissolves | Valem os números em 360p |
| Tempos de palavra | O `words.json` pode ter desvio de 0,2–0,3 s | As defasagens têm essa margem |
| Início e fim do indicador de exemplo | Três relatórios dão três faixas (127,5–242,3; 124–240; "133 a 222") | Adotado 127,5–242,3 (medido a 15 fps) |
| Contagem de grupos de pílulas em 0–150 s | `[T1]` não agrupa; 15 é contagem minha da linha do tempo | Inferência |
| Geometria da janela na tela crua | Muda entre tomadas | Valores da seção 4.6 são os mais repetidos |

Precisão geral: tempos ±0,07 s (15 fps) nos relatórios por trecho e ±1 frame nos de movimento; geometria ±1,5 px em 1080p no
720p e ±1,5% do quadro no 360p; cor ±3 por canal.

### 14.2 Conflitos entre relatórios e o que foi adotado

| Assunto | Valores | Adotado |
|---|---|---|
| Duração da troca de layout | 0,4–0,8 s `[T1]`; 0,6–0,9 s `[T2]`; 19–26 f `[M]`; 27 f `[M-HD]` | 27 f (0,9 s) |
| Curva da troca | `(0.4, 0, 0.2, 1)` `[M]`; `(0.65, 0, 0.35, 1)` `[M-HD]` | A de 720p |
| Frame de tela cheia entre cena e troca | existe `[M]`; não existe `[M-HD]` | Não existe |
| Escala do zoom na janela | 1,35–1,45 `[T1]`; 1,25–1,35 `[T2]`; 1,6–1,9 `[D]`; 1,22–1,30 `[M][M-HD]` | 1,22–1,30 |
| Duração do zoom-in | 0,4–0,8 s `[T1]`; 31–49 f `[M]`; 36 f `[M-HD]` | 36 f |
| Rasgos | 3 + 2 = 5 `[T1][T2]`; 4 `[M]` | 5 |
| Duração por palavra | 7 f `[M]`; 10 f `[M-HD]` | 10 f |
| Início da frase de 115 s | 114,37 `[M]`; 115,67 `[T1]`; 115,58 `[M-HD]` | 115,58 |
| Saída das pílulas de 291 s e 153 s | fade longo em 293,55 e fade em 153,5 `[M]`; fade de 8 f em 291,29 e corte em 154,0 `[M-HD]` | 720p |
| Movimento de entrada da pílula | subida `[T1][M][M-HD]`; deslize da esquerda `[T2]` | Subida de 26 px |
| Altura e texto da pílula | 4,5–5% e 28 px `[T1]`; 8% e 32 px `[T2]`; 68–76 px `[D]`; 72 px e 32 px `[D-HD]` | 72 px e 32 px |
| Raio da pílula | 10–12 `[T2][D]`; 8 `[D-HD]` | 8 |
| Rotação da pílula | −1° a −3° `[T1]`; alternada ±1,5° `[D]`; −1,5° fixa com exceções `[D-HD]` | 720p |
| Passo da pilha | irregular 100–135 `[D]`; regular 100 com vão de 68 antes da conclusão `[D-HD]` | 720p |
| Borda do vídeo do apresentador | 5 e 6 px `[D]`; 4,5 px `[D-HD]`; 6 px `[M-HD]` | 4,5–6 px (diferença dentro do erro) |
| Raio do canto | 40 `[D]`; 33 `[D-HD]`; ~26 `[M-HD]` | 33 |
| Carimbo: ângulo | −8° `[T2][D]`; −6° `[M]`; −7,5° `[D-HD]`; −9,3° `[M-HD]` | −9,3° |
| Carimbo: escala inicial | 1,3 `[T2]`; 1,5 `[M]`; 2,3 `[M-HD]` | 2,3 |
| Punch-in no apresentador | existe `[T1][T2][D]`; não existe `[M]` | Existe (inferência) |
| Trecho editado | 0–301 s `[M]`; 0–298 s `[D]` | 0–301 s (o dissolve de saída termina em 301,1) |
| Fundo de papel | degradê vertical `[D]`; vinheta radial `[D-HD]` | Vinheta |
| Permanência mínima proposta | 1,2 s + 0,25 s/palavra `[T1]`; max(1,2 s; 0,35 s × palavras) `[T2]` | A de `[T1]` (já no editor) |
| Teto sem evento proposto | 4 s `[T1][T2]`; 8 s `[T3][T4]`; 8–10 s `[T5][T6]` | 8 s de limite, 2–4 s de alvo |

### 14.3 Onde estão os relatórios brutos

Copiados para `docs/referencia-max/` (só os `.md`, sem as imagens):

| Arquivo | Conteúdo |
|---|---|
| `trecho-1.md` | 0–150 s: linha do tempo, 12 padrões, transições, ritmo |
| `trecho-2.md` | 150–300 s: linha do tempo, 11 padrões, transições, ritmo |
| `trecho-3.md` | 300–520 s: tela crua, capítulos 2 a 4 |
| `trecho-4.md` | 520–760 s: tela crua, capítulos 4 e 5 |
| `trecho-5.md` | 760–944 s: tela crua, capítulos 5 e 6 |
| `trecho-6.md` | 944–1110 s: tabela no navegador e encerramento |
| `movimento.md` | Movimento e transições em 360p: 66 eventos medidos, gramática, catálogo |
| `movimento-hd.md` | Conferência em 720p: afirmação por afirmação, valores finais |
| `design.md` | Design em 360p: paleta, tipografia, grade, fichas de componente, tradução para tokens |
| `design-hd.md` | Conferência em 720p: valores finais de cor, tipo, raio, sombra e geometria |

As imagens de apoio (folhas de contato, sequências quadro a quadro, recortes ampliados), os scripts de medição, o vídeo, a
transcrição (`ref.transcript.txt`), os tempos por palavra (`ref.words.json`) e os metadados (`ref.info.json`) ficaram na pasta
temporária da sessão de análise e **não** foram copiados para o repositório:
uma pasta temporária local. Essa pasta é
temporária: se as imagens forem necessárias depois, copie-as para fora dela.
