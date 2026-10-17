# Trecho 1 — 0 s a 150 s (abertura + explicação conceitual)

Método: folhas de contato a 2 fps (5 blocos de 30 s, `analysis/trecho-1/cs_*.jpg`), score de diferença quadro a quadro do ffmpeg (`scene.txt`, 30 fps) para achar o instante exato de cada mudança, e 57 sequências a 15 fps de 2 s (`q_<t>.jpg`) em volta de cada evento. Fala cruzada com `ref.words.json`.

Precisão: tempos ±0,07 s (1 quadro a 15 fps). Posições/tamanhos ±1,5 % do quadro (fonte 640×360). Cores, raio de canto, sombra e fonte são **inferência** pela baixa resolução. Áudio/SFX não medido.

Convenção de sincronia: `Δ` = entrada do elemento menos o início da palavra-gatilho. Negativo = elemento chega antes da fala.

---

## 1. Linha do tempo

Layouts: **FT** footage tela cheia · **TELA** gravação de tela em janela + PiP · **SPLIT** fundo papel + manchete à esquerda + apresentador em cartão retrato à direita · **BROLL** ilustração de papel recortado em tela cheia · **DOC** recorte de documentação em cartão + PiP.

| # | Início–fim (s) | O que aparece / muda | Layout | Fala-gatilho | Δ |
|---|---|---|---|---|---|
| 1 | 0,2–0,5 | Título gigante "mods." (serifa itálica coral) no canto sup. esq., fade | FT | "Os **mods**" 0,2 | 0 a +0,2 |
| 2 | 1,07–1,27 | Pílula branca "a maior atualização desde as skills" sob o título | FT | "maior atualização" 0,8 | +0,25 |
| 3 | 1,47–1,75 | Mini-cartão de documento (print escuro, borda branca, 2 fitas coral, inclinado −3°) sob a pílula | FT | "do Claude Code" 1,9 | −0,4 |
| 4 | 2,9–3,9 | Push-in lento no footage (~1,00→1,10; inferência) | FT | "desde que chegaram as Skills" | — |
| 5 | 3,95–4,75 | **T1** footage encolhe para o canto inf. dir. e vira PiP; janela da tela surge por baixo; título/pílula/cartão somem em ~3 quadros | FT→TELA | "**Agora** você pode" 4,6 | −0,65 (transição termina na palavra) |
| 6 | 5,2–8,35 | Digitação do prompt no campo de entrada (caractere a caractere) | TELA | "pedir para o Claude mudar" 5,3 | −0,1 |
| 7 | 8,35–8,5 | Prompt enviado: bolha sobe ao topo, resposta do agente aparece | TELA | "interface" 8,4 | 0 |
| 8 | 10,0–10,2 | Linha "Write …" + painel de estatísticas (grade azul) abre à direita da janela | TELA | "**mudar** o sistema" 10,0 | 0 |
| 9 | 10,55–11,0 | Zoom-in na tela (~1,0→1,35, âncora no painel sup. dir.); PiP não escala | TELA | "para trabalhar" 10,9 | −0,35 |
| 10 | 11,6 | Linha verde "✓ Painel adicionado à sua interface" | TELA | — | — |
| 11 | 11,9–12,1 | Pílula coral "personalizado pra você", colada à direita do painel, −3° | TELA | "**personalizada**" 12,0 | −0,1 |
| 12 | 13,0–13,3 | Zoom-out de volta a 1,0 | TELA | "para você." 12,8 | +0,2 |
| 13 | 13,47–14,05 | **T2** janela + pílula somem em 1 quadro (corte); PiP cresce até tela cheia | TELA→FT | "**Inclusive**" 13,6 | −0,13 |
| 14 | 14,97–15,2 | Ícone de terminal (cartão escuro ">_", borda clara) à esquerda | FT | "abrir um **terminal**" 15,4/15,8 | −0,4 / −0,8 |
| 15 | 15,9–16,1 | Risco diagonal coral desenhado sobre o ícone (esq.→dir.) | FT | "terminal" 15,8 | +0,1 |
| 16 | 16,1–16,3 | Pílula coral "sem abrir o terminal" abaixo do ícone | FT | (reforço) | +0,3 |
| 17 | 18,0–18,13 | Ícone + pílula somem (fade 2 quadros) | FT | fim da frase 17,9 | — |
| 18 | 18,3–18,6 | **T3** rasgo de papel varre esq.→dir. revelando o b-roll | FT→BROLL | "**Basta**" 18,4 | −0,1 |
| 19 | 18,6–23,3 | B-roll 1: balões de fala → engrenagens → janela (papel recortado, animação em passos ~6 fps, leve push-in) | BROLL | "pedir em linguagem natural… configura" | — |
| 20 | 19,43–19,63 | Pílula branca "você pede em linguagem natural" (inf. esq.) | BROLL | "**linguagem** natural" 19,5 | 0 |
| 21 | 20,8–21,0 | Pílula coral "e o Claude configura tudo" (empilha abaixo) | BROLL | "**configura**" 21,0 | −0,2 |
| 22 | 23,3–23,9 | **T4** corte: footage aparece cheio e encolhe/desliza para cartão retrato à direita; fundo papel | BROLL→SPLIT | "**Até aqui**" 23,3 | 0 |
| 23 | 23,75 | Sobretítulo "ATÉ AQUI" (caixa alta coral, minúsculo) | SPLIT | "Até aqui" 23,3 | +0,45 |
| 24 | 23,85–24,65 | Manchete "Você personalizava / *como* ele trabalha" palavra a palavra (5 palavras, defasagem 0,13–0,2 s) | SPLIT | "personalizava" 24,3; "**como**" 26,0 | −0,4; **−1,7** |
| 25 | 30,2–30,45 | Cartão de ícone 1 "Skills" | SPLIT | "**skills**" 30,3 | −0,1 |
| 26 | 31,0–31,3 | Cartão 2 "Conectores" | SPLIT | "**conectores**" 31,3 | −0,3 |
| 27 | 33,25–33,55 | Cartão 3 "Ferramentas" | SPLIT | "**ferramentas**" 33,3 | 0 |
| 28 | 34,65–34,85 | Pílula branca "→ definiam o *como* nos seus documentos" (como em coral) | SPLIT | "**definia**" 34,8 | −0,15 |
| 29 | 37,05–37,75 | **T5** cartão retrato cresce até tela cheia cobrindo o split | SPLIT→FT | "documentos." 37,1 | 0 |
| 30 | 38,0–38,15 | Dissolve de 2 quadros: footage real → versão ilustrada 3D do mesmo enquadramento | FT→BROLL | "**Os mods**" 38,0 | 0 |
| 31 | 38,6–41,0 | Câmera recua (passos ~4,3 fps): o quadro vira o conteúdo de uma janela de papel; barra lateral surge à esquerda | BROLL | "vão um passo além… personalizar" | — |
| 32 | 42,0–42,15 | Pílula coral "mods mudam ONDE ele trabalha" (inf. esq.) | BROLL | "**ambiente**" 42,0 | 0 |
| 33 | 43,5–43,9 | **T6** corte: footage cheio → cartão retrato à direita | BROLL→SPLIT | "**Pode** mudar" 43,5 | 0 |
| 34 | 43,85–44,65 | Sobretítulo "COM MODS" + manchete "Muda o *ambiente* / onde ele trabalha" palavra a palavra | SPLIT | (resume a frase anterior, 40,2–43,4) | **+1,8 atrasada** |
| 35 | 44,5–44,8 | Cartão 1 (mão) "Mudar uma decisão antes que aconteça" | SPLIT | "**decisão**" 44,4 | +0,1 |
| 36 | 46,33–46,55 | Cartão 2 (monitor) "Alterar o que aparece na tela" | SPLIT | "**alterar**" 46,4 | −0,05 |
| 37 | 48,4–48,6 | Cartão 3 (peça +) "Criar um recurso que não existia" | SPLIT | "**criar**" 48,5 | −0,1 |
| 38 | 52,95–53,6 | **T7** cartão retrato cresce até tela cheia (footage agora em punch-in ~1,25× vs. abertura) | SPLIT→FT | "desktop, por exemplo" 52,9 | 0 |
| 39 | 54,67–54,87 | Pílula branca "o mais interessante" (sup. esq.) | FT | "mais **interessante**" 54,4 | +0,25 |
| 40 | 56,8–57,33 | Manchete branca sobre footage "Sem abrir / o *terminal.*" palavra a palavra (4 palavras, 0,13 s) | FT | "não precisa **abrir**" 56,8–57,5 | 0 a −0,6 |
| 41 | 60,33–60,5 | Pílula + manchete somem (fade 3 quadros) | FT | fim da frase 60,3 | — |
| 42 | 60,5–61,0 | **T8** footage → PiP; janela da tela surge | FT→TELA | "**Na aba** do Code" 60,7 | −0,2 |
| 43 | 61,0–61,2 | Pílula branca "aba Code · app desktop" à direita da janela | TELA | "aba do **Code**" 61,4 | −0,4 |
| 44 | 61,7–62,0 | Cursor vai à aba "Code" (clique; cursor minúsculo, sem destaque) | TELA | "aplicativo para desktop" 61,8 | 0 |
| 45 | 63,5–63,7 | Pílula coral "em linguagem natural" (empilha abaixo, −3°) | TELA | "descrever" 63,7; "**linguagem**" 64,5 | −0,2 / **−1,0** |
| 46 | 63,5–67,4 | Digitação do prompt | TELA | "descrever em linguagem natural" | 0 |
| 47 | 67,5–68,0 | Prompt enviado; resposta + linha "Write" | TELA | "o Claude passa a" 67,1 | +0,4 |
| 48 | 68,9–69,7 | Zoom-in na conversa (~1,0→1,4, âncora esq./centro) | TELA | "modificar o próprio **sistema**" 69,1 | −0,2 |
| 49 | 70,0–73,5 | Bloco de código aparece linha a linha (streaming) | TELA | "**criar o código**" 69,9 | +0,1 |
| 50 | 73,3 | Linha vermelha/coral final ("Pronto. Feche e abra o app…") | TELA | "aquilo passa a valer" 73,3 | 0 |
| 51 | 74,45–74,9 | Zoom-out | TELA | "a partir do momento" 74,4 | 0 |
| 52 | 75,35–75,7 | Janela some: fade + encolhe (~1,0→0,9) | TELA | "**fecha**" 75,4 | −0,05 |
| 53 | 75,9–76,25 | Nova janela (app com painel) entra: fade + cresce (0,9→1,0); 0,2 s de papel vazio no meio | TELA | "**abre**" 75,8 | +0,1 |
| 54 | 76,6–76,8 | Pílula verde "mod ativo ✓" (3ª da pilha) | TELA | "novamente o aplicativo" 76,4 | +0,2 |
| 55 | 77,6 | Corte: janela + 3 pílulas somem em 1 quadro; fica papel + PiP por 0,25 s | TELA→DOC | fim da frase 77,5 | — |
| 56 | 77,85–78,2 | Cartão de documentação (print escuro "Mods overview", borda branca, 2 fitas, −2°) + pílula-fonte "docs oficiais · code.claude.com": fade + leve subida | DOC | "**É um pedido**" 77,9 | −0,05 |
| 57 | 80,1–81,0 | Marca-texto coral varre a 1ª frase do parágrafo (esq.→dir., ~0,9 s) | DOC | "mudar o seu próprio **sistema**" 79,3–80,6 | +0,8 no início; termina na palavra |
| 58 | 83,5–83,7 | Pílula coral "o agente muda o próprio sistema" sob o cartão | DOC | "personalizar a interface" 82,8 | +0,7 (resumo) |
| 59 | 85,4–85,95 | **T9** corte: cartão + pílulas somem em 1 quadro; PiP quadrado cresce/estica para cartão retrato | DOC→SPLIT | "**O que poucas**" 85,5 | −0,1 |
| 60 | 85,9 | Sobretítulo "POUCOS MOSTRAM" | SPLIT | "poucas pessoas" 85,7 | +0,2 |
| 61 | 86,85–87,4 | Manchete "Não só no *terminal*" palavra a palavra | SPLIT | "**não só** no terminal" 88,6 | **−1,75** |
| 62 | 89,13–89,4 | Cartão "Terminal" (mini-janela escura com `$ claude`) | SPLIT | "**terminal**" 89,1 | 0 |
| 63 | 90,6–90,9 | Cartão "App desktop · aba Code" (mini-print, contorno coral) | SPLIT | "**app** para desktop" 90,7 | −0,1 |
| 64 | 91,1–91,3 | Selo coral "também aqui" no canto sup. dir. do 2º cartão | SPLIT | "também" 89,8 / "desktop" 91,2 | +1,3 / 0 |
| 65 | 91,87–92,3 | **T10** conteúdo da esquerda some em 1 quadro; rasgo de papel esq.→dir. revela b-roll e engole o cartão retrato por último | SPLIT→BROLL | "**O que é muito**" 92,0 | −0,1 |
| 66 | 92,3–102,0 | B-roll 2: papéis/planilha/pasta voam para dentro de um notebook (passos, contínuo 9,7 s) | BROLL | "pessoas não técnicas… arquivos, documentos" | — |
| 67 | 95,0–95,2 | Pílula branca "para quem não é técnico" | BROLL | "não são **técnicas**" 94,9 | +0,1 |
| 68 | 100,4–100,6 | Pílula coral "arquivos e documentos" | BROLL | "**arquivos**" 100,7 | −0,3 |
| 69 | 102,0 | Corte seco para footage (plano aberto) + push-in lento contínuo até 114,9 (~1,00→1,08) | BROLL→FT | "**se você**" 102,3 | −0,3 |
| 70 | 103,07–103,3 | Pílula branca "não programa" | FT | "profissional" 103,1; "não trabalha com **código**" 104,7 | 0 / **−1,6** |
| 71 | ~104,8–105,0 | Risco horizontal sobre "não programa" | FT | "código" 104,7 | +0,1 |
| 72 | 105,4–105,6 | Pílula branca "não faz vibe coding" | FT | "não faz **vibe**" 105,6 | −0,2 |
| 73 | 106,05–106,2 | Risco sobre "não faz vibe coding" | FT | "**mas**" 106,4 | −0,3 |
| 74 | 107,0–107,2 | Pílula **verde** "trabalha com documentos" | FT | "trabalha com **documentos**" 107,0 | 0 |
| 75 | 108,33–108,55 | Pílula **coral** "o maior poder da atualização" (inclinada −3°) | FT | "**maior poder**" 108,2 | +0,1 |
| 76 | 113,6–113,8 | Pílula escura/translúcida, texto branco "no SEU fluxo de trabalho" | FT | "**seu** fluxo" 113,4 | +0,2 |
| 77 | 114,6–114,8 | As 5 pílulas somem juntas (fade 3 quadros) | FT | fim da frase 114,6 | 0 |
| 78 | 114,9 | Jump cut: footage volta ao plano aberto (reset do push-in) | FT | "**Vou dar**" 114,9 | 0 |
| 79 | 115,67–116,3 | Manchete branca "*6* exemplos / na prática" palavra a palavra | FT | "alguns **exemplos**" 115,5 | +0,2 |
| — | 116,3–127,47 | **Nada muda por 11,2 s** (manchete parada sobre o footage) | FT | frase longa de transição | — |
| 80 | 127,47 | Corte seco: b-roll 3 (pasta de papel com folhas saindo + triângulo de alerta) + indicador "EXEMPLO ① 2 3 4 5 6" no topo esq. | FT→BROLL | "**Então** imagina" 127,7 | −0,2 |
| 81 | 129,5–129,7 | Pílula branca "o Claude vai apagar uma pasta" | BROLL | "**apagar**" 129,5 | 0 |
| 82 | 130,93–131,6 | Chip vermelho mono "N arquivos": contador 0→40 (≈+4 por quadro a 15 fps, 0,65 s, trava no 40); folhas aceleram | BROLL | "**40** arquivos" 130,9 | 0 |
| 83 | 133,3–133,75 | **T11** corte: footage cheio → PiP; janela da tela por baixo | BROLL→TELA | "mod que **interrompe**" 133,5 | −0,2 |
| 84 | 133,8–134,1 | Modal "40 arquivos serão apagados" abre dentro da tela (fade) + pílula coral "o mod interrompe" | TELA | "interrompe" 133,5 | +0,3 |
| 85 | 135,2–135,6 | Zoom-in no modal (~1,0→1,45) | TELA | "e **mostre** para você" 135,2 | 0 |
| 86 | 136–140 | Lista de arquivos rola dentro do modal | TELA | "todos os arquivos que serão afetados" 136,6 | 0 |
| 87 | 140,85–141,1 | Zoom-out | TELA | "excluir tudo aquilo" 140,5 | +0,3 |
| 88 | 141,2–141,65 | **T12** janela + pílula somem em 1 quadro; indicador avança para ②; rasgo de papel esq.→dir. revela b-roll 4 (lixeira com papéis caindo) e engole o PiP | TELA→BROLL | "**Você** pode ter um outro mod" 141,5 | −0,3 |
| 89 | ~144,9–145,1 | Pílula **verde** "outro mod: manda para a lixeira" | BROLL | "**lixeira**" 144,8 | +0,1 |
| — | 145,1–150 | B-roll 4 segue (papéis caindo em loop), sem novo elemento | BROLL | "em vez de excluí-los definitivamente…" | — |

Tempo por layout (150 s): FT 40,8 s (27 %) · TELA 33,8 s (23 %) · BROLL 34,1 s (23 %) · SPLIT 27,9 s (19 %) · DOC 7,5 s (5 %) · transições ~6 s.

---

## 2. Inventário de padrões

### P1 — Pílula/etiqueta de reforço — **25×** (o elemento mais usado)
- **Anatomia:** retângulo de cantos pouco arredondados (raio ~0,8 % da largura, não é cápsula), altura ~4,5–5 % da altura do quadro, largura conforme o texto (12–35 % da largura). Texto sem serifa em negrito, ~2,6 % da altura (≈28 px em 1080p — pequeno). Sombra curta e suave. Inclinação de −1° a −3° (as coral inclinam mais; as brancas quase retas) — parece etiqueta colada.
- **Cores e papel:** branca com texto escuro = fato/contexto (10×) · coral com texto branco = conclusão/ênfase (10×) · verde com texto branco = positivo/solução (3×) · escura translúcida com texto branco = fecho (1×) · vermelha com fonte mono = número/contador (1×).
- **Posição:** sempre ancorada à esquerda, x ≈ 5,5 %. Sobre footage: y ≈ 22 % (empilha para baixo a cada ~9 %). Sobre b-roll: inferior esquerda, y ≈ 77–88 %. Em TELA/DOC: coladas no canto sup. dir. da janela (x 75–93 %, y 13–33 %) ou sob o cartão.
- **Entra:** fade + subida de ~1 % da altura, 3–4 quadros a 15 fps (0,2–0,27 s), desacelera. Sem mola perceptível. Empilhamento: a nova entra abaixo, as antigas não se mexem.
- **Sai:** nunca individualmente — some junto com o layout (corte de 1 quadro) ou em fade coletivo de 2–3 quadros no fim da frase.
- **Permanência:** média 5,1 s, mediana 3,8 s, de 0,8 s ("também aqui") a 16,6 s ("aba Code · app desktop").
- **Footage:** não muda (sem escurecer nem desfocar).
- **Uso:** resumir em 3–5 palavras o que acabou de ser dito; sequência branca→coral = "premissa → conclusão" (19,5/20,8; 95,0/100,4).
- **Variações:** risco horizontal sobre a pílula branca quando a ideia é negada (2×, 104,8 e 106,1); palavra interna em coral ("como"); seta "→" no início; "✓" no fim; pílula-fonte acima de um documento.

### P2 — Split editorial (manchete + apresentador em cartão retrato) — **3×** (23,3 / 43,5 / 85,4)
- **Anatomia:** fundo papel claro com vinheta suave. Direita: footage recortado em **retrato**, x 74–98 %, y 5–94 % (24 % × 89 %), cantos ~2 % da largura, borda branca fina, sombra larga e suave; o recorte centraliza o rosto. Esquerda (x 5,5 %): sobretítulo em caixa alta coral espaçado, ~1,8 % da altura (≈19 px em 1080p — quase ilegível), y ≈ 9 %; manchete serifada escura em 2 linhas, ~7,5 % da altura por linha, y 12–28 %, **uma palavra em itálico coral**.
- **Entra:** T4 (ver §3); sobretítulo em fade ~0,45 s depois do corte; manchete palavra a palavra, cada palavra em fade de cinza-claro para preto em ~3 quadros (0,2 s), defasagem 0,13–0,2 s, total 0,8 s. Sem deslocamento perceptível.
- **Sai:** o cartão retrato cresce e cobre tudo (T5/T7), ou corte seco + rasgo (T10).
- **Permanência:** 13,1 s / 8,8 s / 6,0 s.
- **Uso:** comparação/definição ("antes × agora", "A × B"): frases que enumeram.

### P3 — Cartões de ícone em fileira (dentro do split) — **8 cartões em 3 fileiras** (3+3+2)
- **Anatomia:** cartões brancos ~19 % × 29 % do quadro, cantos ~1,5 %, sombra suave, ilustração de papel recortado em cima (≈60 % do cartão) e rótulo sem serifa em negrito embaixo (~2,3 % da altura; 1–2 linhas). Fileira em x 5,5 %, y 38–67 %, vão ~2 %. Variante 85,4: mini-janelas escuras com rótulo fora, embaixo; a segunda com contorno coral + selo "também aqui".
- **Entra:** fade + subida de ~1,5 % + leve escala (0,95→1,0), 4 quadros (0,27 s), desacelera; um por item **quando o item é dito** (Δ entre −0,3 e +0,1 s — a melhor sincronia do trecho). Intervalo entre cartões = ritmo da fala (0,8 a 2,3 s).
- **Sai:** com o layout.
- **Uso:** enumeração de 2–3 itens.

### P4 — Tela gravada em janela + PiP — **3×** (4,0 / 60,5 / 133,3)
- **Anatomia:** fundo papel; janela x 3,5–74 %, y 8–87 % (70 % × 79 %), cantos ~1,5 %, sombra grande; PiP do apresentador quase quadrado x 75,5–97 %, y 59–94 % (21 % × 35 %), cantos ~2,5 %, borda branca ~2 px, sombra; sobrepõe ~1 % o canto da janela. Pílulas na coluna vazia acima do PiP.
- **Entra/sai:** T1/T8/T11 e T2 (ver §3).
- **Dentro da tela:** digitação real do prompt, resposta em streaming, painel/modal abrindo — parece **tela reconstruída/roteirizada** (limpa, sem ruído), não captura bruta.
- **Permanência:** 9,5 s / 16,6 s / 7,7 s.
- **Uso:** "você pede → ele faz" — demonstração do que a fala descreve.

### P5 — B-roll de papel recortado em tela cheia — **5×** (18,6 / 38,0 / 92,3 / 127,5 / 141,6)
- **Anatomia:** cena ilustrada (papel/cartolina, sombras reais, paleta papel + coral + cinza-esverdeado + grafite), animada em **passos** (4–6 fps, estilo stop-motion) com leve movimento de câmera. Uma metáfora por frase: balões→engrenagens→janela; estúdio dentro de uma janela; papéis voando para o notebook; pasta cuspindo folhas; lixeira.
- **Entra:** rasgo de papel (3×), dissolve de 2 quadros (1×), corte seco (1×). **Sai:** corte seco para o próximo layout.
- **Permanência:** 4,7 / 5,5 / 9,7 / 5,8 / 8,4+ s.
- **Footage:** some por completo (inclusive o PiP).
- **Legendas:** 1–2 pílulas no canto inf. esq. (ou sup. esq. nos exemplos).
- **Uso:** conceito abstrato sem tela para mostrar.

### P6 — Manchete serifada sobre o footage — **3×** (0,2 "mods." / 56,8 "Sem abrir o terminal." / 115,7 "6 exemplos na prática")
- **Anatomia:** serifa branca, 2 linhas, ~12 % da altura por linha, x 5,5–38 %, y 32–56 %; palavra-chave ou número em itálico coral. O título de abertura é só itálico coral, ~22 % da altura, y 3–22 %. Lado esquerdo do footage escurece levemente (gradiente; inferência).
- **Entra:** palavra a palavra, fade de ~3 quadros, defasagem 0,13 s; quase em sincronia com a fala (Δ 0 a +0,2). **Sai:** fade de 3 quadros ou corte.
- **Permanência:** 3,8 s / 3,5 s / **11,8 s**.
- **Uso:** tese do bloco / anúncio do que vem.

### P7 — Recorte de documento com fita — **2×** (1,5 pequeno sobre footage; 77,9 grande)
- **Anatomia:** print escuro de documentação, borda branca ~0,5 %, duas fitas adesivas coral translúcidas nos cantos superiores (±35°), inclinado −2° a −3°, sombra. Grande: x 4–73 %, y 14–70 %; pílula-fonte acima ("docs oficiais · domínio"). Pequeno: x 5–35 %, y 37–62 %.
- **Entra:** fade + leve subida/escala, 4–5 quadros (0,3 s). **Sai:** corte de 1 quadro.
- **Extra:** marca-texto (P9) e pílula-conclusão embaixo.
- **Uso:** prova/fonte oficial.

### P8 — Ícone + risco de negação — **1×** (15,0–18,1); risco em pílula **2×**
- Cartão escuro 15 % × 21 % com ">_", x 8–23 %, y 22–43 %; risco coral diagonal desenhado em 3 quadros (0,2 s) exatamente na palavra negada; pílula coral logo depois (+0,2 s).

### P9 — Marca-texto animado — **1×** (80,1–81,0)
- Faixa coral translúcida (~45 % de opacidade) cresce esq.→dir. sobre uma linha, ~0,9 s, velocidade quase constante; termina na palavra-chave falada. Fica até o fim do layout.

### P10 — Contador numérico — **1×** (130,9–131,6)
- Chip vermelho, fonte mono branca, "N arquivos": 0→40 em 0,65 s (≈10 passos), dispara na palavra "40".

### P11 — Indicador de progresso "EXEMPLO 1…6" — **1×**, persistente a partir de 127,5
- Topo esquerdo (x 1,5–21 %, y 2–5 %), etiqueta "EXEMPLO" escura + 6 quadradinhos numerados; o atual preenchido em coral. Altura ~2,5 % do quadro (minúsculo). Avança no corte do exemplo seguinte (141,2).

### P12 — Troca de tela "fecha e abre" — **1×** (75,35–76,25)
- Janela encolhe e some (5 quadros), 0,2 s de vazio, janela nova cresce e aparece (5 quadros): a animação **encena o verbo** ("fecha"/"abre", Δ ≤ 0,1 s).

---

## 3. Transições

| Tipo | Vezes | Onde | Duração | O que se move |
|---|---|---|---|---|
| **Footage ↔ cartão** (o footage é o elemento compartilhado: encolhe para PiP/retrato ou cresce para tela cheia) | **9** | T1 3,95 · T2 13,47 · T4 23,3 · T5 37,05 · T6 43,5 · T7 52,95 · T8 60,5 · T9 85,4 · T11 133,3 | 0,4–0,8 s (12–24 quadros a 30 fps) | Só o footage (escala + posição + raio de canto + borda/sombra surgindo); desacelera forte no fim (ease-out, sem ultrapassar). O novo fundo/janela já está pronto por baixo. Ao encolher para retrato o recorte muda de 16:9 para ~1:2 durante o movimento. |
| **Rasgo de papel** (borda serrilhada irregular varrendo esq.→dir.) | 3 | 18,3 · 92,0 · 141,35 | 0,3–0,4 s | Máscara com borda rasgada + sombra fina; revela sempre um b-roll; velocidade quase linear. |
| **Corte seco** | 5 | 77,6 · 102,0 · 114,9 (jump cut) · 127,47 · saída de todo b-roll | 1 quadro | Nada; em 77,6, 91,87 e 141,2 sobra 0,2–0,3 s de papel vazio antes do próximo elemento. |
| **Dissolve curto** | 1 | 38,0 (real → ilustrado) | 2 quadros (0,13 s) | Mesmo enquadramento; depois recuo de câmera revela a moldura. |
| **Fade + escala da janela** | 2 | 75,35 (sai) · 75,9 (entra) | 0,33 s cada | Janela 1,0↔0,9 + opacidade. |
| **Zoom da tela** | 3 pares | 10,55/13,0 · 68,9/74,45 · 135,2/140,85 | entra 0,4–0,8 s; sai 0,25–0,45 s | Só o conteúdo da janela (escala 1,35–1,45, âncora no ponto de interesse); janela "sangra" para fora do quadro; PiP e pílulas ficam fixos. |

Regras observadas:
- **Toda mudança de layout cai no início de frase**, de 0,1 a 0,3 s antes da primeira palavra (13 de 13).
- Assimetria: **entradas animadas, saídas em corte** (janela, documento, pílulas e cartões desaparecem em 1 quadro).
- O apresentador nunca some por corte quando o próximo layout o contém: ele "viaja" até a nova posição.

---

## 4. Efeitos no footage e na tela gravada

**Footage**
- 3 enquadramentos do mesmo take: aberto (0–4; 14–18; 102–103; 115–127), punch-in ~1,25× (53,5–60,5) e push-in lento contínuo (2,9–3,9 ≈ +10 %; 102–114,9 ≈ +8 %, com reset em jump cut na frase seguinte).
- Recortes: PiP quase quadrado (21 % × 35 %) e cartão retrato (24 % × 89 %), ambos com borda branca, canto arredondado e sombra.
- Sob manchete: leve escurecimento à esquerda (inferência). Sob pílulas: nada.
- **Não há** desfoque de fundo, mudança de cor, tremor ou zoom rápido por palavra.
- Uma substituição do footage por versão ilustrada (38,0), usada como metáfora ("o ambiente onde ele trabalha").

**Tela gravada**
- Sempre dentro de janela com sombra sobre papel; nunca em tela cheia.
- Zoom por escala para o ponto de interesse (1,35–1,45×), 1 por bloco, com retorno antes de sair.
- Cursor do sistema, minúsculo (~1 % do quadro), **sem halo nem marca de clique**.
- Destaque por pílula colada ao lado da janela, não por caixa/seta sobre a UI.
- Marca-texto só no recorte de documento (1×).
- Sem desfoque nem escurecimento do resto da tela.

---

## 5. Ritmo

- **83 eventos visuais em 150 s = 33 por minuto** (1 a cada 1,8 s).
  - 0–30 s: 21 (42/min) · 30–60 s: 16 (32/min) · 60–90 s: 20 (40/min) · 90–120 s: 15 (30/min) · 120–150 s: 11 (22/min).
- **Maior intervalo sem mudança: 11,2 s** (116,3–127,47, manchete parada). Depois: 5,6 s (24,65–30,2, split só com manchete) e ~4,9 s (145,1–150, b-roll em loop).
- Sem contar esses três, o maior intervalo é ~2,5 s.
- **Duração média na tela:** pílula 5,1 s (mediana 3,8 s); manchete 6,4 s; cartão de ícone ~5 s; layout 7,9 s em média (19 blocos em 150 s), de 4,3 s a 25,5 s.
- **Sincronia:** de 44 elementos com palavra-gatilho clara, 33 entram a ±0,3 s da palavra; 7 chegam ≥ 0,4 s antes; 4 chegam ≥ 0,7 s depois. Os cartões de ícone e as animações "encenadas" são os mais precisos; as manchetes de split são as menos (−1,7 s, +1,8 s, −1,75 s).
- Densidade simultânea máxima: 5 pílulas empilhadas (113,6–114,7) e janela + 3 pílulas + PiP (76,7–77,6).

---

## 6. Como fazer melhor

| # | Ponto fraco medido | Melhoria concreta |
|---|---|---|
| 1 | **11,2 s parados** (116,3–127,5): manchete "6 exemplos na prática" fica 11,8 s sobre o footage sem nada acontecer. | Teto de 4 s sem evento. Aqui: manchete sai em 3 s e entram 6 chips numerados em defasagem de 4 quadros (prévia dos exemplos), que depois "voam" para o canto e viram o indicador de progresso. |
| 2 | **Texto pequeno**: pílulas ~2,6 % da altura (28 px em 1080p), sobretítulo ~1,8 % (19 px), indicador EXEMPLO ~2,5 % total, rótulo de cartão 2,3 %. Ilegível no celular. | Mínimos: pílula 3,6 % (≈40 px), sobretítulo 2,4 %, rótulo de cartão 3 %, indicador com 4 % de altura e nome do exemplo ao lado do número. |
| 3 | **Manchete de split fora de sincronia** (−1,7 s, +1,8 s, −1,75 s) e, depois dela, 5,6 s de quadro vazio até o 1º cartão. | Revelar cada palavra no `start` dela em `words.json` (−2 quadros); a palavra de ênfase só fica coral + sublinhado desenhado quando é dita. Sem palavra correspondente na fala → manchete entra no início da frase e os cartões preenchem o vazio. |
| 4 | **Saídas em corte de 1 quadro** (13,47 / 77,6 / 85,4 / 91,87 / 141,2) contra entradas animadas; deixam 0,2–0,3 s de papel vazio. | Saída espelhada de 6–8 quadros (fade + escala 0,97 + 1,5 % de deslocamento), pílulas em defasagem reversa de 2 quadros, sobreposta à entrada seguinte (cruzamento de 4 quadros) — zero quadro vazio. |
| 5 | **Mesma transição 9× em 150 s** (footage encolhe/cresce, sempre para a direita). | Manter o footage como elemento compartilhado, mas variar: lado do cartão alterna por bloco, 3 curvas/âncoras (canto, lateral, centro-baixo), e no máximo 2 repetições seguidas antes de um rasgo/empurrão. |
| 6 | **Pilha de 5 pílulas** cobre ~40 % da altura à esquerda por até 11,6 s; as riscadas continuam em destaque total. | Máx. 3 visíveis: ao riscar, a pílula encolhe para 85 % e cai a 45 % de opacidade; a mais nova empurra as antigas (reflow animado de 6 quadros) e a 4ª expulsa a 1ª. |
| 7 | **Pílulas que somem rápido demais**: "também aqui" 0,8 s, "mod ativo ✓" 0,9 s, "no SEU fluxo de trabalho" 1,1 s, "mods mudam ONDE…" 1,5 s. | Permanência mínima = 1,2 s + 0,25 s por palavra; se a frase acabar antes, segurar o layout ou adiantar a entrada. |
| 8 | **Tela gravada pouco legível**: zoom só 1,35–1,45×, cursor ~1 % sem destaque, nada isola o ponto de interesse. | Zoom 1,8–2,2× com foco: resto da janela a 45 % de brilho + desfoque leve, contorno coral desenhado no elemento, cursor ampliado com halo e onda no clique; zoom entra 4 quadros antes da palavra. |
| 9 | **Pílulas antecipadas** entregam a ideia antes da fala ("não programa" −1,6 s, "em linguagem natural" −1,0 s, ícone de terminal −0,8 s). | Regra única: gatilho = início da palavra-chave −2 quadros; nunca antes da palavra anterior. Validar com um teste automático sobre `words.json`. |
| 10 | **Entrada sempre igual** (fade + subida de 1 %, sem caráter) para pílula, cartão e documento. | Vocabulário por tipo: pílula "cola" com rotação −6°→−2° e leve mola; cartão de ícone vira (flip de 12 quadros); documento cai com fita sendo aplicada (as fitas entram 3 quadros depois); número conta com desaceleração no fim em vez de passo fixo. |
| 11 | **Footage passivo**: sob pílula/manchete nada muda; push-in só em 2 momentos. | Push-in de 3–5 % sincronizado à frase de ênfase, escurecimento em gradiente de 30 % atrás de todo texto e punch-in de 8 % (4 quadros) na palavra da tese. |
| 12 | **B-roll longo em loop** (92,3–102 e 141,6–150): a metáfora se esgota em ~4 s e só 1–2 pílulas entram. | B-roll com 3 batidas ligadas a palavras (ex.: folha entra na palavra "arquivos", notebook acende em "interface") e PiP pequeno do apresentador depois de 5 s para não perder o rosto por 10 s. |
