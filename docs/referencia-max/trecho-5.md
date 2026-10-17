# Trecho 5 — 760 s a 944 s (12:40–15:44) · Mod 2 (cofre de chaves) e teste do `/chave`

Fonte: `ref.mp4` 640x360 @ 29,97 fps. Cobertura: 7 folhas de contato a 2 fps (760–970), 7 sequências quadro a quadro (30 fps) nos pontos de mudança, e curva de diferença quadro a quadro medida em três regiões (janela da tela, cartão da câmera, faixa de fundo). Imagens em `analysis/trecho-5/`.

**Achado central: este trecho de 184 s não tem NENHUM gráfico animado.** Zero legendas, zero pílulas, zero cartões, zero marca-texto, zero zoom, zero transição animada. É um único layout fixo (tela gravada + cartão da câmera) do primeiro ao último quadro. Tudo que "acontece" na imagem é (a) corte seco de edição ou (b) ação ao vivo dentro da tela gravada. O primeiro efeito de pós depois do trecho é um marca-texto amarelo em ~962 s (fora da minha faixa, pertence ao trecho 6).

Evidência: a faixa de fundo (y 0–11 %) tem diferença máxima de 0,0065 entre quadros em todo o trecho (ruído de compressão); nenhum elemento passa por ela. Posição e tamanho da janela e do cartão são idênticos em 800 s, 866 s e 936 s.

---

## 1. Linha do tempo

Legenda de tipo: **CORTE** = edição; **TELA** = ação ao vivo na gravação (não é pós); **CAM** = só câmera.

| # | Tempo (s) | Tipo | O que aparece/muda | Fala no instante | Defasagem |
|---|---|---|---|---|---|
| 0 | 760,0–767,8 | — | Layout fixo. App de chat com a resposta longa do assistente; cursor parado na barra lateral | "...configurar o seu harness. Então, esse prompt..." | — |
| 1 | 767,8–768,3 | TELA | Rolagem para cima em 2 saltos (0,5 s) até o prompt enviado | "mas é importante você usar exatamente esse prompt" (768,03) | rolagem começa 0,2 s ANTES de "mas", termina junto de "importante" |
| 2 | ~773,5 | TELA | Bloco do prompt (caixa cinza) ocupa a coluna; cursor desce até ele | "ele pode criar um... / essa chave" (pausa 773,2–774,0) | junto da pausa |
| 3 | 778,54 | CORTE (provável) | Salto de pose na câmera, tela parada (corte de silêncio). Inferência: diferença isolada de 0,048 contra 0,004 nos vizinhos | "...que você não consiga digitar aqui" | — |
| 4 | 783,85–784,25 | TELA | Rolagem para baixo, 12 quadros, volta à resposta | "para ter aquela variável de ambiente" (783,95) | 0,1 s antes de "ter" |
| 5 | **787,92** | **CORTE seco** | 1 quadro. Tela e câmera saltam juntas (salto no tempo: a resposta já está completa, com trechos coloridos de código) | "não exposta aqui / e agora foi apenas trabalhando" (788,06) | corte 0,13 s depois de "aqui", 0,14 s antes de "e agora" — no respiro entre frases |
| 6 | 790,0–790,3 | TELA | Rolagem até o fim da resposta (lista "Editou 4 arquivos") | "ele já criou esse novo mod" (790,08) | em cima de "criou" |
| 7 | 792,4–792,6 | TELA | Pequeno ajuste de rolagem | "para todas as situações" | junto |
| 8 | 792,6–808,0 | — | **15,4 s parado.** Só o cursor passeia; texto ilegível | "Ele vai ativar de forma automática... um cofre... chave de segurança" | nada reforça a fala |
| 9 | ~808,3–810,6 | TELA | Cursor sobe ao canto superior direito; botão fechar acende vermelho (quadrado ~1,5 % da largura) | "da mesma forma que nós fizemos no primeiro mod, nós vamos fechar o aplicativo" (810,14) | hover 1,8 s ANTES de "fechar"; clique 0,5 s depois |
| 10 | 810,64 | TELA | App fecha em 1 quadro; aparece o navegador que estava atrás (página do repositório, azul-escuro). Câmera contínua, portanto não é corte | "...o aplicativo" (810,48) | 0,16 s depois da palavra |
| 11 | 813,48 | TELA | App reabre em 1 quadro, com cartão pequeno de boas-vindas/uso no topo | "abrir novamente aqui o aplicativo / para desktop" (813,71) | 0,2 s antes de "para desktop", 1,7 s depois de "abrir" |
| 12 | 815,71 | TELA | Clique em nova sessão, tela de conversa vazia | "iniciar uma nova sessão" (815,42) | 0,3 s depois de "sessão" |
| 13 | **817,92** | **CORTE seco** | 1 quadro. Tela e câmera saltam (pula a digitação); conversa "Oi" já enviada | "valendo / vou mandar um oi" (818,07) | 0,15 s antes de "vou" |
| 14 | ~821,0 | TELA | Resposta curta do assistente aparece | "então ele deve só iniciar a sessão" | junto |
| 15 | 823–846 | — | **23 s parado.** Conversa quase vazia (≈90 % da janela é preto), cursor parado | "esse mod que nós criamos... fica nativo fixo... posso desativar... pasta dev... mandar um comando para remover" | fala cita o mod fixo, o caminho da pasta e um comando: nada é mostrado |
| 16 | ~846,5–851,5 | TELA | Digita "/": abre lista suspensa de comandos (≈7 % de largura x 14 % de altura do quadro, 12+ itens), com dicas pretas ao lado; cursor para no item do comando | "então já deve aparecer aqui o comando, apareceu chave" (849,76) | lista abre ~3 s antes de "apareceu"; item ilegível |
| 17 | 851,45 | TELA | Item escolhido, lista some | "Quando eu mandar esse comando" (852,08) | 0,6 s antes |
| 18 | 852,75–853,0 | TELA | Comando enviado; painel lateral do cofre abre à direita dentro do app (≈22 % da largura do quadro, de x≈56,5 % a 78,5 %); a coluna do chat encolhe e vai para a esquerda. Abre em ≤2 quadros, sem animação visível | "ele vai abrir aqui do lado" (853,80) | 0,8–1,0 s ANTES de "abrir" |
| 19 | 858,92 | CORTE (provável) | Salto de pose na câmera (cabeça virada → de frente em 1 quadro), tela parada | "chave de segurança. / Já aparece" (859,11) | 0,2 s antes de "Já", na pausa |
| 20 | 859–925 | — | **67 s sem mudança de imagem.** Painel com 2 campos (Nome, Token) + botão salvar; cursor circula pelos campos (866 s, 872–880 s), digita algo na caixa de mensagem (887–900 s) | "dar o nome... vale para qualquer chave, token, API... vai direto para o .env... dois exemplos... permanente... como uma skill... cloud.md... VS Code... copia e cola sem expor" | conceitos fortes sem nenhum apoio visual |
| 21 | 913,1–914,0 | CAM | Gesto grande com as duas mãos na frente do rosto (pinça) | "achando exatamente aquela linha... anexar" | gesto é o único "evento" em 67 s |
| 22 | ~925,0–926,1 | TELA | Miniatura de pré-visualização da barra de tarefas aparece no rodapé do painel por ~1 s | "que você pode utilizar" | — |
| 23 | 926,09 | TELA | Troca de janela em 1 quadro: navegador com o repositório (tabela "Mods") | "utilizar / e vale a menção também" (926,99) | 0,9 s ANTES de "e vale" |
| 24 | 930,0–931,5 | TELA | Rolagem para o topo da página, cabeçalho do site aparece | "repositório oficial da..." (930,57) | junto de "oficial" |
| 25 | 934,0–934,3 | TELA | Rolagem de volta para a tabela dos 4 mods | "no GitHub / e tem esses quatro aqui" (934,81) | 0,5–0,8 s antes de "esses quatro" |
| 26 | 936,97 | TELA | Ajuste fino de rolagem; tabela centralizada | "que eles já criaram" | junto |
| 27 | 937–944 | — | Tabela parada, cursor aponta a 1ª linha | "documentos... Codex... Cloud Code. Esse primeiro, o Sec..." | — |

---

## 2. Inventário de padrões

### P1 — Layout "tela + cartão de câmera sobre fundo escuro" · 1 uso, 184 s contínuos (100 % do trecho)

- **Fundo**: degradê vertical quase preto esverdeado. Medido: topo rgb(26,33,31) → base rgb(13,18,17). Sem textura, sem vinheta perceptível.
- **Janela da tela gravada**: x 1,5 %–78,5 % (77 % da largura), y 13 %–87 % (74 % da altura), proporção ≈ 1,86:1. Canto reto ou raio mínimo (≤0,3 %; indistinguível em 360p). Sem moldura, sem barra de título falsa, sem sombra visível: a janela escura (rgb 21,21,21) quase funde com o fundo. Margens vazias: 13 % em cima e 13 % embaixo.
- **Cartão da câmera**: x 80,1 %–98,6 % (18,5 % da largura), y 25,7 %–74,1 % (48,4 % da altura), retrato ≈ 2:3, centrado na vertical. Cantos arredondados, raio ≈ 1,9 % da largura do quadro (≈36 px em 1080p). Borda levemente esfumada/halo escuro de ≈0,5–1 % (inferência pela resolução). Única área de cor quente do quadro (cenário laranja/âmbar): funciona como âncora de atenção. Enquadramento: busto, microfone embaixo.
- **Respiro entre janela e cartão**: 1,6 % da largura; margem direita 1,4 %.
- **Entrada/saída**: nenhuma dentro do trecho (o layout já vem montado de antes de 760 s e continua depois de 944 s).
- **Footage**: tela nunca é desfocada, escurecida nem reenquadrada. A câmera nunca vai a tela cheia.
- **Legendas/pílulas**: não existem neste layout.
- **Uso**: demonstração prática ("vou fazer", "aparece aqui", "do lado").

### P2 — Corte seco de salto (jump cut) com as duas camadas juntas · 2 confirmados (787,92; 817,92) + 2 prováveis (778,54; 858,92)

- 1 quadro, sem dissolução, sem zoom de disfarce, sem flash.
- Sempre no respiro entre frases: 0,13–0,2 s depois da última palavra e 0,14–0,2 s antes da próxima.
- Usado para pular espera/digitação (resposta carregando, digitar "oi") e para aparar silêncio.
- O layout não muda no corte, então só se percebe pelo salto do conteúdo da tela ou da pose.

### P3 — Mudança ao vivo dentro da tela gravada · 16 ocorrências

Rolagem (7), troca/fecha/abre de janela (4), lista suspensa (1), painel lateral (1), nova sessão/resposta (2), hover vermelho no fechar (1). Tudo instantâneo (1–12 quadros), é o comportamento nativo do app, sem suavização de pós. Costuma ANTECIPAR a fala em 0,2–1,0 s (o apresentador age e depois narra).

### P4 — Gesto na câmera como ênfase · 1 marcante (913 s)

Único reforço visual num bloco de 67 s.

### Ausentes no trecho (contagem 0)

Legenda palavra a palavra, pílula/etiqueta, cartão de título, lower third, marca-texto, seta/círculo de destaque, zoom/punch-in, desfoque de fundo, tela cheia de câmera, tela cheia de gráfico, barra de progresso/capítulo, contador, B-roll, transição animada. A virada de capítulo em 814 s ("Testando /chave", segundo os metadados) **não tem marcação visual nenhuma**.

---

## 3. Transições

| Tipo | Quantas | Duração | O que se move |
|---|---|---|---|
| Corte seco tela+câmera | 2 (+2 prováveis só perceptíveis na câmera) | 1 quadro (33 ms) | nada; troca instantânea |
| Troca de janela na gravação (app ↔ navegador) | 3 (810,64; 813,48; 926,09) | 1 quadro | conteúdo da janela; moldura fixa |
| Rolagem nativa | 7 | 2–12 quadros (0,07–0,4 s), em degraus | conteúdo da janela, 10–60 % da altura dela |
| Painel lateral nativo | 1 (852,75) | ≤2 quadros | coluna do chat encolhe ≈22 % da largura do quadro para a esquerda |

Não há transição entre layouts porque só há um layout.

## 4. Efeitos no footage e na tela

- **Zoom/punch-in**: nenhum. Texto do app com altura de ≈1,4 % do quadro (≈15 px em 1080p); itens da lista de comandos ≈1 %. Ilegível em celular.
- **Reenquadramento**: nenhum. A janela é mostrada inteira, com ≈60 % dela em preto vazio durante a conversa nova (818–853 s).
- **Cursor**: nativo, branco, ≈1,5 % da altura; sem halo, sem anel de clique, sem ampliação. Some no fundo escuro.
- **Marca-texto / setas / caixas**: nenhum.
- **Desfoque / escurecimento**: nenhum.
- **Sombra**: só o halo suave do cartão da câmera.
- **Cor**: tela com contraste baixo (cinza sobre preto); câmera com gradação quente. Cerca de 18 % dos quadros da câmera são repetidos (1002 de 5515 com diferença ≈0), o que indica câmera gravada em ~24/25 fps conformada para 29,97.
- **Vermelho no botão fechar (808–810 s)**: é o hover do sistema, mas acaba servindo de sinal para "vamos fechar o aplicativo". Único ponto de cor saturada na janela em todo o trecho.

## 5. Ritmo

- Duração: 184 s (3,07 min).
- Eventos de edição: 2 cortes confirmados (0,65/min); 4 contando os prováveis (1,3/min).
- Gráficos de pós: 0/min.
- Mudanças ao vivo na tela: 16 (5,2/min), concentradas em 3 rajadas (767–793, 808–822, 846–853, 926–937).
- Total de eventos visuais de qualquer tipo: ≈20 → **6,5/min**, mas muito mal distribuídos.
- **Maior intervalo sem nenhuma mudança de imagem: ≈67 s (859–925)**; sem corte confirmado: 126 s (817,92–944). Outros buracos: 23 s (823–846) e 15,4 s (792,6–808).
- Tempo "parado" somado: ≈105 s de 184 s (**57 %**).
- Duração média de um elemento de pós: não se aplica (não há). Elementos nativos: lista de comandos 5 s; painel do cofre 73 s (853–926); janela do navegador 2,8 s na 1ª aparição e 18 s+ na 2ª.

## 6. Como fazer melhor

1. **Texto ilegível (≈1,4 % do quadro)** → punch-in automático na região de interesse sempre que a fala disser "aqui/aparece/do lado": escalar a tela para 160–220 % com âncora no ponto (lista de comandos em 847 s, painel do cofre em 853 s, tabela em 934 s). Entrada de 10–12 quadros desacelerando, sustenta enquanto a frase durar, volta em 8 quadros. Meta: texto-alvo ≥ 3,5 % da altura.
2. **67 s parados com a fala mais rica do trecho** (859–925) → é onde o `max` precisa trabalhar. Roteiro sugerido: 859 s rótulos coral nos dois campos ("NOME", "TOKEN"); 869–878 s trio de pílulas em cascata "token · API · chave" (stagger de 4 quadros); 876 s cartão ".env" com seta saindo do botão salvar; 879–892 s cartão comparativo de duas colunas "MOD FIXO (sempre na tela) x MOD CHAMADO (/comando)"; 900–920 s cartão de 3 passos "abrir VS Code → achar a linha → colar" riscado e substituído por "colar aqui". Alvo: algo novo a cada 4–8 s, nenhum buraco acima de 10 s.
3. **Virada de capítulo sem marca (814 s)** → cartão de capítulo de 1,5–2 s sobre o corte de 817,92 (título serifado em paper + número do passo em coral), cobrindo o próprio corte para ele deixar de ser um salto.
4. **Demonstração sem clímax**: o painel do cofre abre em 2 quadros, pequeno, 0,8 s antes da fala. → congelar 6–8 quadros, contorno coral desenhando ao redor do painel (traço em 10 quadros), leve escurecimento (40 %) do resto da janela e punch-in de 130 %; soltar quando ele diz "do lado".
5. **Fala cita coisas que não aparecem** (823–846: "pasta dev", "mandar um comando para remover") → pílula de caminho em monoespaçada e chip de comando entrando de baixo (deslocamento de 2–3 % da altura, 8 quadros), sincronizados 2–3 quadros ANTES da palavra-chave; sai 0,5 s depois do fim da frase.
6. **Cursor invisível** → halo circular claro de ≈4 % da altura seguindo o cursor só nos momentos de clique, com anel que expande e some em 8 quadros no clique (810,6; 815,7; 851,4).
7. **Segurança é o tema e a tela não dramatiza** → no momento "sem ter exposto aquela chave" (920–923 s), máscara de pontos animada sobre o campo Token e selo "não aparece no chat". É a promessa do mod e passa em branco.
8. **Layout único por 3 min** → alternar 3 estados com transição de 10–12 quadros: (a) tela + cartão (atual); (b) tela cheia com câmera reduzida a círculo/cartão pequeno no canto quando há texto para ler; (c) câmera grande com cartão de conceito quando a tela está parada e a fala é conceitual (ex.: 879–905 s). Trocar no máximo a cada 15–25 s para não cansar.
9. **Janela com 60 % de preto vazio** (818–853) e 26 % de margem vertical ociosa → recortar a região útil da tela em vez de mostrar a janela inteira; usar as faixas de cima/baixo para o título do passo atual ("Mod 2 · testando /chave") e uma barra de progresso do capítulo.
10. **Cortes secos percebidos como tranco** (787,92; 817,92) → micro punch-in de 3–4 % na câmera no quadro do corte ou cobrir com o gráfico que entra; e manter a regra que a referência já acerta: cortar 0,13–0,2 s depois da última palavra.
11. **Ação antecipa a fala em até 1 s** (painel 853; navegador 926) → atrasar a tela 10–25 quadros com congelamento (ou esticar o trecho anterior) para a mudança cair em cima da palavra ("abrir", "repositório").
12. **Janela sem separação do fundo** (rgb 21,21,21 sobre 18,23,22) → raio de 12–16 px, borda de 1 px a 10 % de branco e sombra larga e suave; ganha profundidade sem poluir.

Resumo do diagnóstico: neste trecho a referência é só "gravação limpa bem enquadrada". O que ela faz certo e vale manter: layout estável e sem poluição, cartão de câmera com cor quente como âncora, cortes sempre no respiro. Todo o resto é espaço para superar.
