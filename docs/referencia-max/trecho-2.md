# Trecho 2 — 150 s a 300 s (fim da explicação conceitual → início de "Onde criar mods")

Método: folhas de contato a 2 fps (5 blocos de 30 s, cobertura total) + 28 sequências a 15 fps (janelas de 2,4 s) em volta de cada evento + 6 quadros ampliados 3x. Imagens em `analysis/trecho-2/` (`cs_*.jpg` = 2 fps, `q_<t>.jpg` = 15 fps, `f_<t>.jpg` = still 3x, `counter.jpg`).
Precisão: tempos medidos a 15 fps têm erro de ±0,07 s; os marcados com "≈" vieram só da folha de 2 fps (±0,25 s). Fonte 360p: cores, raios e tamanhos de fonte são estimativas. Os tempos de palavra vêm de `ref.words.json` (podem ter desvio de ~0,2–0,3 s). Áudio/SFX não foram avaliados.
Não há legenda corrida (karaokê) em nenhum momento do trecho: todo texto na tela é pílula, título ou UI do mock.

---

## 1. Linha do tempo

Layouts: **FULL** = apresentador em tela cheia · **BROLL** = b-roll papercraft em tela cheia · **MOCK+PiP** = fundo papel + cartão do app simulado + apresentador em cartão pequeno · **SPLIT** = fundo papel, conteúdo à esquerda + apresentador em cartão retrato à direita.

| # | Tempo (s) | O que acontece | Layout | Fala-gatilho e defasagem |
|---|---|---|---|---|
| 1 | 150,0–151,2 | B-roll (lixeira de papel) com pílula verde "outro mod: manda para a lixeira" herdada do trecho anterior; HUD "EXEMPLO 1–6" com o 2 ativo | BROLL | "Por padrão, o Claude…" |
| 2 | 151,20 | Corte seco para o apresentador; pílula verde some junto com o corte | FULL | "faz" (150,89) +0,3 s |
| 3 | 151,33–151,47 | Pílula **vermelha** "padrão: exclusão definitiva" entra (fade + deslize curto, 3 quadros) | FULL | "exclusão" (151,29) +0,05 s |
| 4 | 153,47–153,67 | Pílula **verde** "com mod: vai para a lixeira" empilha abaixo | FULL | "enviar para a lixeira" (153,21) +0,25 s |
| 5 | 154,00–154,65 | Footage encolhe e vira PiP no canto inferior direito, revelando o mock do app já parado por baixo; as 2 pílulas somem no 1º quadro; HUD passa para 3 | FULL→MOCK+PiP | "E você pode ter ainda um outro mod" (154,25) −0,25 s |
| 6 | 154,9–157,0 | Mock "digita" 3 linhas (Read / Write / Edit), uma a cada ~0,7 s | MOCK+PiP | acompanha a frase, sem palavra exata |
| 7 | 157,33 | Painel lateral do mock abre (desliza da direita) | MOCK+PiP | "histórico" (157,37) 0 s |
| 8 | 157,53–157,73 | Pílula coral inclinada "histórico de ações" na margem direita | MOCK+PiP | "histórico" +0,15 s |
| 9 | 158,00–158,60 | Punch-in só no cartão do mock (~1,25x, ancorado à direita; barra lateral sai do quadro); PiP e pílula não escalam | MOCK+PiP | "das ações" (158,22) |
| 10 | 158,6–165,0 | Itens do painel aparecem um a um (~1 a cada 1,3 s): 4 de histórico, seção "PRÓXIMOS PASSOS" (≈163,5) + 2 itens | MOCK+PiP | "aquilo que ele já fez" (161,6), "próximos passos" (163,6) 0 s |
| 11 | 165,93–166,10 | Pílula branca "+ a janela de pensamentos" + bloco itálico "Pensando…" com barra coral no mock | MOCK+PiP | "pensamentos" (165,96) 0 s |
| 12 | 169,20–169,73 | Zoom-out do cartão (volta ao enquadramento inteiro) | MOCK+PiP | "ao longo de uma tarefa" (fim da frase) |
| 13 | 169,80–170,40 | Troca de exemplo: mock + 2 pílulas somem em 1 quadro; mock novo surge por fade (~0,25 s) deslocado para a direita; PiP desliza do canto inf. direito ao inf. esquerdo (~60% da largura, 0,6 s, desacelera); HUD → 4 | MOCK+PiP espelhado | "Agora pense na interface" (169,98) −0,2 s |
| 14 | 170,5–173,5 | Mock digita "Edit proposta.docx" e "Tarefa concluída" | MOCK+PiP | "Quando o Claude termina uma tarefa" (171,9–173,0) |
| 15 | 174,87–175,07 | Pílula coral "painel do lado" (canto sup. esquerdo) + painel do mock abre | MOCK+PiP | "painel" (174,91) 0 s |
| 16 | 175,53–176,40 | Punch-in grande (~1,35x; cartão encosta nas bordas direita/inferior); PiP e pílula ficam por cima | MOCK+PiP | "do lado ali mesmo" |
| 17 | 177,0–183,5 | Painel enche: "Próximos passos" (2 itens), "Preparando" (1), "Precisa de você" (1, destacado em coral) | MOCK+PiP | "próximos passos" (179,3), "preparando" (181,3), "precisar de você" (182,5): cada bloco entra na palavra |
| 18 | 185,40–185,93 | Zoom-out | MOCK+PiP | "perguntando" (185,03) |
| 19 | 186,00–186,60 | Mock + pílula somem em 1 quadro; o PiP cresce até tela cheia (0,6 s, desacelera), destravando o recorte para 16:9; footage termina ~1,15x mais fechado que o plano normal | →FULL | "e agora" (186,18) −0,2 s |
| 20 | 186,33–186,87 | Título serifado branco "E agora, / o que eu *faço?*" palavra por palavra (última em itálico coral), começando com o cartão ainda crescendo | FULL | cada palavra ~0,1 s depois da fala (186,18–186,82) |
| 21 | 188,60 | Título some em ≤2 quadros (sem animação de saída) | FULL | "passos" (188,18) |
| 22 | 188,80–189,13 | Wipe de papel rasgado, esquerda→direita, para b-roll (escada de blocos de papel); HUD → 5 | FULL→BROLL | "em um projeto maior?" (188,9) 0 s |
| 23 | ≈192,3 | Pílula branca "projeto com várias etapas" (sup. esquerda) | BROLL | "várias etapas" (192,56) ≈−0,2 s |
| 24 | 197,13–197,33 | Pílula coral "sem se perder nas fases" empilha | BROLL | "perdido" (197,22) 0 s |
| 25 | 198,67–199,27 | Corte para o footage já em encolhimento → PiP inf. direito; mock nº 3 por baixo; pílulas cortadas | BROLL→MOCK+PiP | "Você pode ter um mod" (198,75) 0 s |
| 26 | 199,3–200,9 | Mock digita; painel "MOD · PLANO DO PROJETO" abre (≈200,1) e fases entram uma a uma | MOCK+PiP | "vai definindo" (200,5) |
| 27 | ≈201,0–201,6 | Punch-in no cartão | MOCK+PiP | "vai mostrando a janela" (201,5) |
| 28 | ≈202,4 | Pílula coral "todas as etapas à vista" | MOCK+PiP | "todas as etapas" (202,79) ≈−0,3 s |
| 29 | 201,5–206 | Fases 1–5 listadas, fase 3 destacada com contorno coral; código aparece no painel central | MOCK+PiP | "aquilo que está sendo feito" (204–205,5) |
| 30 | 206,53–206,67 | Pílula branca "o plano de ação" | MOCK+PiP | "plano" (206,53) 0 s |
| 31 | 206,87–207,47 | Zoom-out | MOCK+PiP | fim da frase |
| 32 | 207,53 | Corte seco para b-roll (bonecos de pixel sobre barra de progresso); HUD → 6 | →BROLL | "Teve um exemplo" (207,61) 0 s |
| 33 | ≈211,4 | Pílula branca "um mod de jogo multiplayer" | BROLL | "jogo multiplayer" (211,69) ≈−0,3 s |
| 34 | ≈213,9 | Pílula coral "jogando enquanto o Claude trabalha" | BROLL | "trabalhando" (214,18) ≈−0,3 s |
| 35 | 218,00 | Corte seco para o apresentador (meio da frase); pílulas cortadas | →FULL | "elas esperam" (218,26) |
| 36 | 221,67–221,80 | Carimbo "INÚTIL" bate na tela (escala ~1,3→1,0 + cinza→vermelho em 3 quadros), inclinado ~−8° | FULL | "esdrúxulo" (221,72); ~1 s ANTES de "inútil" (222,82) |
| 37 | 222,07–222,20 | Punch-in seco no footage (~1,08x, 2–3 quadros) | FULL | 0,3 s depois do carimbo |
| 38 | ≈226,4 | Pílula coral "mostra o poder da personalização" (esq., y≈62%) | FULL | "poder" (226,38) 0 s |
| 39 | 230,27–230,40 | Carimbo + pílula saem por fade (3 quadros) e o footage volta ao enquadramento normal | FULL | "disso." (230,25) |
| 40 | 230,60–230,93 | Wipe de papel rasgado para b-roll (mecanismo de engrenagens) | FULL→BROLL | "Em resumo" (230,67) 0 s |
| 41 | 234,47–234,60 | Pílula escura mono "harness" (canto inf. esquerdo) | BROLL | "harness" (234,53) 0 s |
| 42 | 235,27–235,40 | Pílula branca "o motor que coordena o agente" ao lado, na mesma linha | BROLL | "o motor" (235,17) +0,1 s |
| 43 | 239,53–239,67 | Pílula coral "você só descreve a mudança" abaixo | BROLL | "descrever a mudança" (237,9–238,8): ~1,0–1,5 s ATRASADA |
| 44 | 242,33 | Corte seco para o apresentador; pílulas cortadas; HUD "EXEMPLO" some de vez | →FULL | "Inclusive" (242,45) −0,1 s |
| 45 | 243,40–243,60 | Pílula branca "exporta para outros sistemas" | FULL | "exportar" (243,33) +0,1 s |
| 46 | 245,67–245,87 | Pílula coral "mods + prompts na descrição" | FULL | "na descrição" (245,53) +0,15 s |
| 47 | 246,00–246,20 | Seta fina coral ↓ aparece abaixo das pílulas | FULL | idem |
| 48 | 246,2–253,3 | Nada muda (7,1 s com as 2 pílulas + seta paradas) | FULL | frase longa sobre os prompts |
| 49 | 253,33–253,47 | Pílulas + seta saem por fade (3 quadros) | FULL | "do seu jeito." (253,20) |
| 50 | 253,53–254,40 | Footage encolhe para a direita e vira cartão retrato; fundo papel entra pela esquerda; cartão de b-roll + etiqueta "SKILL × MOD" surgem por fade (253,87–254,0) | FULL→SPLIT | "E é por isso" (253,68) −0,15 s |
| 51 | 256,53–256,70 | Pílula branca "skill instrui COMO fazer uma tarefa" sob o cartão | SPLIT | "Uma skill" (256,43) +0,1 s |
| 52 | ≈261,0 | Pílula coral "mod muda o ambiente de TODAS"; o b-roll no cartão evolui (a sala se abre) ≈261–263 | SPLIT | "Já o mod" (260,65) ≈+0,3 s |
| 53 | 264,13–264,47 | Todo o lado esquerdo sai por fade simultâneo (0,33 s); cartão retrato fica | SPLIT | "acontecem." (263,83) |
| 54 | 264,80–265,40 | Etiqueta "NO TRABALHO" + título "Mais *controle* / sobre o Claude" palavra por palavra (cadência fixa de 2 quadros, não segue a fala) | SPLIT | "Para quem usa… no trabalho" (264,57–265,6) |
| 55 | 268,47–268,67 | Cartão-ícone 1 "Operações delicadas" | SPLIT | "proteger" (268,66) 0 s (≈0,8 s antes de "operações") |
| 56 | ≈270,4 | Cartão 2 "Segurança" | SPLIT | "segurança" (270,56) ≈−0,15 s |
| 57 | ≈271,4 | Cartão 3 "Acompanhar o processo" | SPLIT | "acompanhar" (271,40) 0 s |
| 58 | ≈273,4 | Cartão 4 "Limites da sessão" | SPLIT | "limites" (273,42) 0 s |
| 59 | 275,73–276,00 | Screenshot "colado com fita" (print escuro com grade azul, inclinado) + cartão 5 "Gastos" (275,8–275,93) | SPLIT | "gastos" (275,80) 0 s |
| 60 | 276,53–276,73 | Cartão 6 "Janela de contexto" | SPLIT | "janela" (276,61) 0 s |
| 61 | 277,40–278,07 | Cartão retrato cresce até tela cheia cobrindo o conteúdo; cartão 7 ("cache") começa a aparecer em 277,73 e é coberto antes de ficar legível | SPLIT→FULL | "de cache" (277,61–277,75) |
| 62 | 278,07–285,9 | Apresentador puro, nenhum elemento (7,8 s) | FULL | "…esse novo sistema… é mais útil" |
| 63 | ≈286,0 | Pílula branca "um recorte importante" | FULL | "recorte" (286,11) ≈0 s |
| 64 | ≈287,9 | Pílula escura "Claude Code", recuada | FULL | "Claude Code" (288,07) ≈−0,1 s |
| 65 | 289,53–289,73 | Pílula branca "› aba Code", mais recuada | FULL | "aba" (289,58) 0 s |
| 66 | 291,00–291,13 | Pílula coral "› app desktop", mais recuada | FULL | "desktop" (290,96) +0,05 s |
| 67 | 291,33–291,47 | As 4 pílulas saem juntas por fade (a última ficou ~0,3 s) | FULL | — |
| 68 | ≈291,8 | Punch-in seco no footage (~1,1x) | FULL | "que é nesse ambiente" (291,70) |
| 69 | 293,60–294,50 | Footage encolhe → PiP inf. direito; mock do app em tela inicial; pílula coral "a seguir: demonstração" entra durante o encolhimento (≈294,0) | FULL→MOCK+PiP | "demonstração" (293,76) +0,2 s |
| 70 | ≈296,3 | Pílula branca "problemas reais do dia a dia" | MOCK+PiP | "problemas" (296,60) ≈−0,3 s |
| 71 | 298,67–299,47 | Dissolve cruzado (0,8 s) do layout inteiro para o apresentador em tela cheia | →FULL | "Mas a melhor forma" (299,64) −0,2 s |

Tempo por layout no trecho: MOCK+PiP ≈ 49 s (33%) · FULL ≈ 44 s (29%) · BROLL ≈ 33 s (22%) · SPLIT ≈ 24 s (16%).

---

## 2. Inventário de padrões

### P1. Pílula-etiqueta ("adesivo" de frase curta) — 25 pílulas em 13 grupos
- **Anatomia:** retângulo de cantos pouco arredondados (raio ≈ 10–12 px em 1080p, não é cápsula), altura ≈ 8% do quadro, largura pelo texto (15–33%). Texto sans bold (tipo Inter 700) ≈ 3% da altura do quadro (~32 px em 1080p), minúsculas, sem ponto final, 2 a 6 palavras. Leve inclinação de −1° a −2° (sobre o mock chega a ±2–3°, alternando o sentido entre pílulas vizinhas). Sombra curta e suave.
- **Variantes de cor:** branca com texto tinta (10) · coral com texto branco (11) · escura com texto mono branco, para termo técnico (2: "harness", "Claude Code") · vermelha (1) e verde (1), usadas como par antes/depois. Regra percebida: a 1ª do grupo é branca (assunto) e a 2ª é coral (conclusão); quando só há uma, é coral.
- **Posição:** sobre footage/b-roll, coluna esquerda x≈5,7%, 1ª pílula em y≈24–32%, as seguintes ~11% abaixo (vão de ~3%). No MOCK+PiP ficam na margem livre (direita x≈75–96%, y≈17–30%, ou esquerda quando o layout é espelhado), "mordendo" a borda do cartão. Uma exceção no rodapé (y≈86–95%) para a definição de "harness". Uma exceção em escada (cada pílula ~2% mais recuada) para o caminho Claude Code › aba Code › app desktop.
- **Entrada:** fade 0→100% + deslize curto vindo da esquerda (≈1–2% da largura; o 1º quadro aparece borrado/deslocado), 3 quadros a 15 fps ≈ 0,2 s, desacelerando, sem overshoot. Empilhamento governado pela fala (intervalo de 0,8 a 5 s entre pílulas), não por stagger fixo.
- **Saída:** em 9 dos 13 grupos a pílula simplesmente morre no corte/troca de layout (0 quadros). Nos demais, fade de 3 quadros (0,2 s) com o grupo inteiro junto, sem stagger.
- **Permanência:** de 0,3 s a 12 s; mediana ≈ 4 s. Ficam até o fim do bloco de fala, não por tempo fixo.
- **Footage por baixo:** não muda (sem escurecer nem desfocar).
- **Uso:** resumir a frase que está sendo dita em 2–6 palavras; nomear o exemplo; par problema/solução; termo + definição; passo de um caminho.
- **Sincronia:** 19 das 25 entram entre −0,3 e +0,25 s da palavra-chave.

### P2. Mock do app + apresentador em PiP — 4 vezes (154,0 · 169,8 troca · 198,7 · 293,6)
- **Anatomia:** fundo papel off-white quente com vinheta leve. Cartão do app simulado (janela escura quase preta, três bolinhas de janela, barra lateral, área de chat, campo de entrada) em x≈3,5–74%, y≈8–88%, raio ≈ 24 px, sombra larga e difusa. PiP do apresentador: cartão quase quadrado ≈ 21% × 35% do quadro (x≈75,5–96,5%, y≈59–94%), contorno branco ≈ 4 px, raio ≈ 28 px, sombra suave; recorte fechado no rosto (bem mais apertado que o plano cheio). Versão espelhada: PiP no canto inf. esquerdo (x≈3–24%) e app em x≈26–97%.
- **Entrada:** o footage em tela cheia ganha contorno claro e encolhe em direção ao canto, enquanto o recorte muda de 16:9 para quase quadrado; 0,6–0,9 s, desacelera, sem overshoot. O mock já está parado por baixo (é revelado, não entra).
- **Dentro do layout:** o mock é animado como UI de verdade — linhas "digitadas" (~0,7 s cada), painel lateral que desliza, itens de lista entrando um a um (~1,3 s), item destacado com contorno/fundo coral. O conteúdo acompanha a fala item a item.
- **Saída:** (a) corte seco para b-roll precedido de zoom-out; (b) mock some em 1 quadro e o PiP cresce até tela cheia (0,6 s); (c) dissolve cruzado de 0,8 s.
- **Permanência:** 15,8 s · 16,2 s · 8,9 s · 5,0 s.
- **Uso:** "imagina um mod que…" — demonstração hipotética de interface, e o gancho "a seguir: demonstração".

### P3. Punch-in no cartão do mock — 3 idas + 3 voltas
- Só o cartão do app escala (≈1,25x a 1,35x), ancorado no lado do painel que interessa; PiP, pílulas e HUD não escalam e ficam por cima. Ida 0,6–0,85 s, volta 0,55–0,6 s, ambas ease-in-out. A ida vem 0,5–0,7 s depois da pílula; a volta termina 0,05–0,1 s antes do corte/troca.

### P4. HUD de progresso "EXEMPLO 1 2 3 4 5 6" — 1 elemento persistente (150,0–242,3), 4 trocas no trecho
- Canto sup. esquerdo: etiqueta escura "EXEMPLO" (caps com espaçamento largo) + 6 quadradinhos numerados; o ativo fica coral com número branco. Ocupa x≈1–10,5%, y≈1,4–3,6% (≈ 8 px de altura em 360p ≈ 24 px em 1080p). Troca de número seca, sem animação. Atravessa todos os layouts e some sem animação no corte de 242,33.

### P5. B-roll papercraft em tela cheia — 4 vezes (lixeira até 151,2 · escada 189,1–198,7 · bonecos de pixel 207,5–218,0 · engrenagens 230,9–242,3) + 1 dentro de cartão (254–264)
- Cenas 3D estilo papel recortado, paleta creme/verde-sálvia/coral, com um astro coral de pontas como personagem; câmera em movimento lento. Cobre 100% do quadro; o apresentador some (só voz). Sempre com 2–3 pílulas por cima e o HUD.
- Entrada: wipe de papel rasgado (2x) ou corte seco (1x). Saída: sempre corte seco. Duração 9,6–11,4 s.
- Uso: metáfora visual de um conceito ou exemplo.

### P6. Título serifado palavra por palavra — 2 vezes
- (a) Sobre o footage (186,33–188,6): serif de alto contraste, branco, 2 linhas, x≈5%, y≈33–46%, corpo ≈ 8% da altura; última palavra em itálico coral. Cada palavra passa de cinza translúcido a branco em 2 quadros, colada na fala. Sai seco. Footage ~1,15x mais fechado enquanto o título está na tela.
- (b) Sobre papel (264,8–277,5): etiqueta caps coral "NO TRABALHO" (≈2% da altura) + título em tinta ≈ 8,5% da altura, palavra de ênfase em itálico coral; x≈5,7%, y≈8–25%. Cadência fixa de ~0,13 s por palavra.
- Uso: citar a pergunta do espectador; abrir um bloco de lista.

### P7. Split papel + cartão retrato — 1 vez (253,5–278,1), em duas fases
- Cartão retrato do apresentador à direita: x≈74–98%, y≈5–95% (≈ 24% × 90%), contorno branco, raio ≈ 40 px, recorte fechado no rosto e microfone. Esquerda (x≈5,7–58%): fase 1 = etiqueta "SKILL × MOD" + cartão de b-roll 16:9 (x≈5,7–58%, y≈13–65%, raio ≈ 14 px, sombra) + 2 pílulas abaixo; fase 2 = título + grade de cartões-ícone + screenshot com fita.
- Entrada: footage desliza/encolhe para a direita mudando de 16:9 para retrato (0,9 s); conteúdo da esquerda por fade 0,15–0,2 s. Troca de fase: fade-out simultâneo de 0,33 s, 0,3 s de vazio, título novo. Saída: o cartão retrato cresce e cobre tudo (0,65 s).
- Uso: comparação conceitual e lista de benefícios.

### P8. Grade de cartões-ícone — 6 cartões visíveis (+1 abortado)
- Cartões quase brancos, raio ≈ 12 px, sombra suave, ≈ 10,8% de largura × 20–23% de altura (os de rótulo em 2 linhas são mais altos), vão ≈ 1,1%; 4 por linha a partir de x≈5,7%, y≈31%; 2ª linha em y≈57%. Ícone ilustrado no mesmo estilo papercraft (≈ 6% do quadro) + rótulo sans bold centralizado ≈ 2% da altura do quadro.
- Entrada: fade (+ subida de ~1%, inferida) em 3 quadros, um por item falado (intervalo 1,0–2,4 s). Não há saída própria.

### P9. Screenshot "colado com fita" — 1 vez (275,7)
- Print escuro de painel com borda branca tipo foto, 2 tiras de fita coral translúcida nos cantos superiores, inclinado ~+4°, x≈53–73%, y≈57–82%. Fade de 4 quadros. O conteúdo do print é ilegível nessa resolução.

### P10. Carimbo — 1 vez (221,7–230,3)
- Placa clara com contorno vermelho, palavra em serif caixa-alta vermelha, x≈6,5–36%, y≈23–43%, inclinada ~−8°. Entra maior (~1,3x), cinza e translúcida e assenta em 3 quadros; 0,3 s depois o footage dá um punch-in seco. Sai por fade de 3 quadros junto com a pílula.

### P11. Seta indicadora — 1 vez (246,0–253,4)
- Seta fina coral apontando para baixo, x≈13%, y≈53–65%, traço ≈ 3 px; aparece em ~3 quadros logo após a pílula "na descrição". Parada depois de entrar.

---

## 3. Transições

| Tipo | Vezes | Duração | O que se move |
|---|---|---|---|
| Corte seco | 5 (151,2 · 198,67 · 207,53 · 218,0 · 242,33) | 0 | tudo troca; pílulas morrem no corte |
| Footage encolhe para PiP | 3 (154,0 · 198,67 · 293,6) | 0,6–0,9 s, desacelera | o próprio vídeo do apresentador vira o cartão; recorte fecha no rosto; fundo e mock já estão por baixo |
| Footage encolhe para cartão retrato | 1 (253,53) | 0,9 s | idem, mudando para proporção vertical |
| PiP/cartão cresce até tela cheia | 2 (186,0 · 277,4) | 0,6–0,65 s | cartão do apresentador cobre o layout |
| Wipe de papel rasgado | 2 (188,8 · 230,6) | 0,33–0,4 s, quase linear | borda irregular com sombra varre da esquerda para a direita; só de FULL para BROLL |
| Troca de exemplo dentro do layout | 1 (169,8) | 0,6 s | mock antigo some em 1 quadro, novo entra por fade 0,25 s, PiP atravessa a tela |
| Troca de fase por fade | 1 (264,1) | 0,33 s + 0,3 s vazio | só o lado esquerdo |
| Dissolve cruzado | 1 (298,67) | 0,8 s | layout inteiro para footage |

Padrões de montagem: toda volta do mock para outro plano é preparada por um zoom-out de ~0,55 s; as transições começam 0,15–0,25 s antes da primeira palavra da frase nova; o apresentador nunca é cortado para dentro de um cartão — é sempre o mesmo vídeo que encolhe ou cresce.

---

## 4. Efeitos no footage e na tela

- **Punch-in seco no apresentador:** 2 vezes (222,1 ~1,08x; 291,8 ~1,1x), em 2–3 quadros, na palavra de ênfase ou no início da frase. Volta ao normal escondida numa saída de elementos (230,3) ou numa transição.
- **Plano mais fechado durante título:** 186,6–188,8 (~1,15x).
- **Reenquadramento por layout:** PiP quase quadrado e cartão retrato usam recortes bem mais fechados no rosto que o plano cheio.
- **Punch-in no mock** (P3): substitui cursor/marca-texto; o destaque dentro da UI é feito com contorno/fundo coral no item e barra coral no bloco "Pensando…".
- **Sem** desfoque, escurecimento ou gradação aplicada ao footage sob pílulas, títulos ou carimbo. **Sem** cursor destacado ou marca-texto no trecho (a tela aqui é um mock redesenhado, não gravação real).
- Sombras: todos os cartões têm sombra difusa; contorno branco só nos cartões do apresentador.

---

## 5. Ritmo

- **71 eventos visuais em 150 s = 28 por minuto** (1 a cada 2,1 s). Sem contar as microanimações internas do mock: ~58 eventos = 23 por minuto.
- Por tipo: 25 entradas de pílula · 14 transições/cortes · 6 punch-in/out no mock · 7 cartões/print · 2 títulos · 2 punch-in no footage · 4 trocas do HUD · restante = animações de UI do mock.
- **Maior intervalo sem mudança:** 7,8 s (278,1–285,9, apresentador puro). Segundo: 7,1 s (246,2–253,3, pílulas e seta paradas). Terceiro: 4,2 s (222,2–226,4).
- **Duração de um elemento na tela:** pílulas — mediana ≈ 4 s, média ≈ 4,6 s (mín. 0,3 s, máx. 12,2 s). Layouts — MOCK+PiP 5–16 s, BROLL 10–11 s, SPLIT 24 s, FULL 2–11 s.
- O plano do apresentador nunca passa de 11,2 s contínuos e nunca passa de 7,8 s sem um elemento gráfico.

---

## 6. Como fazer melhor

1. **Elementos que morrem antes de serem lidos.** "› app desktop" fica 0,3 s; a pílula verde "com mod: vai para a lixeira" 0,4 s; "o plano de ação" 0,9 s; o cartão "cache" nasce já coberto. → Regra de permanência mínima: `max(1,2 s, 0,35 s × nº de palavras)` depois de 100% de opacidade; se o corte vier antes, adiantar a entrada ou atrasar a transição. Nunca iniciar uma entrada a menos de 1 s de uma transição.
2. **Saída inexistente.** 9 de 13 grupos de pílulas somem no corte seco, o que dá um "pisca". → Saída de 4–5 quadros (fade + 1% de deslize na direção contrária à entrada) terminando 2 quadros antes do corte, com stagger invertido de 2 quadros.
3. **Texto pequeno demais.** HUD "EXEMPLO" tem ~24 px em 1080p; rótulos dos cartões-ícone e etiquetas caps ~2% da altura; a UI do mock sem zoom é ilegível, e o print com fita também. → Piso de 28 px (2,6% da altura) para qualquer texto; HUD com ≥ 36 px de altura; mock já montado em escala de leitura (cartão ≥ 85% da largura) ou zoom antes da primeira linha digitada; print só entra com um recorte ampliado do número que importa.
4. **Dois trechos parados de 7–8 s.** 278–286 sem nada e 246–253 com gráficos congelados. → Teto de 4 s sem evento: punch-in lento contínuo (1,00→1,05), pílula de palavra-chave ("mais útil"), ou animar o que já está na tela (seta pulsando 2x, contador de itens).
5. **Sincronia irregular.** "você só descreve a mudança" chega ~1,2 s atrasada; o carimbo "INÚTIL" chega ~1 s antes da palavra; "proteger" dispara o cartão "Operações delicadas" 0,8 s antes do rótulo ser dito. → Ancorar todo elemento ao `start` da palavra-chave no words.json com offset fixo de −2 quadros (30 fps) e validar automaticamente: nenhum elemento fora de [−0,15 s, +0,1 s].
6. **Uma única entrada para tudo.** As 25 pílulas, os cartões e o print usam o mesmo fade+deslize de 0,2 s. → Entrada por papel: pílula de assunto desliza 24 px com mola curta (overshoot 3–4%); pílula de conclusão (coral) entra com escala 0,92→1 + realce que varre o fundo; termo técnico "digita" letra a letra; cartões-ícone sobem 16 px com stagger de 3 quadros quando a lista é dita rápido.
7. **Pílula sobre footage sem proteção de contraste.** A pílula coral sobre o fundo âmbar da estante e a seta fina sobre a planta quase somem. → Degradê escuro local (20–30% de opacidade, 40% da largura) atrás da coluna de pílulas, ou sombra mais marcada; seta com traço ≥ 6 px e contorno claro.
8. **Punch-in do mock sem foco.** O zoom aproxima o cartão, mas o olho não sabe onde ir até o item ganhar cor. → Somar ao zoom um escurecimento de 35% no resto do cartão e um contorno que se desenha (0,3 s) em volta do painel citado; no item falado, marca-texto animado em vez de só trocar a cor.
9. **Troca de exemplo com buraco.** Em 169,8 e 264,5 a tela fica 2–5 quadros só com papel. → Encadear: o conteúdo novo começa a entrar no mesmo quadro em que o antigo começa a sair (crossfade com deslize de 3% no mesmo sentido do PiP), e o número do HUD troca com um pulso de escala.
10. **Lista que fecha incompleta e sem resumo.** 7 itens falados, 6 mostrados, e o layout é coberto na hora do último. → Segurar o layout 1 s depois do último item, dar um pulso em todos os cartões juntos e só então expandir o apresentador.
11. **HUD de progresso mudo.** A troca 3→4→5→6 é seca e o HUD some sem aviso. → Animar a troca (quadrado ativo desliza para o seguinte, 6 quadros) e, no fim da série, preencher todos e recolher a barra.
12. **Repetição de enquadramento.** O MOCK+PiP aparece 4 vezes com a mesma coreografia (encolhe, digita, pílula, zoom, zoom-out). → Variar a 2ª e a 3ª: uma com o painel já em destaque e o PiP em círculo, outra com tela dividida 50/50 e o item construído em tamanho grande fora do mock.
