# Trecho 4 — 520 s a 760 s (8:40–12:40) · "Instalando e conferindo" (fim) + início do "Mod 2: cofre de chaves"

Método: 8 folhas de contato a 2 fps (520–760, sem lacuna), detecção de mudança por `select=gt(scene,…)` no quadro inteiro
(limiar 0,003 e 0,015), só no recorte da câmera (limiar 0,035/0,06) e só na faixa superior do fundo; quadros ampliados 3x em
14 instantes; sequências a 15 fps em 601,0 s e 680,0 s; 4 quadros consecutivos a 30 fps em volta de cada corte suspeito.
Imagens em `analysis/trecho-4/`.

**Achado central: o trecho inteiro (240 s) usa UM único layout fixo e NENHUM gráfico de edição.** Não há título, lower-third,
pílula, legenda, marca-texto, zoom, seta, nem cartão de capítulo. Tudo o que muda na tela é (a) comportamento nativo do
aplicativo gravado e (b) cortes secos de limpeza de fala. É o "vale" de edição do vídeo: tela gravada crua dentro de uma moldura.

---

## 1. Linha do tempo

Layout em uso do início ao fim: **L-SPLIT** (janela da tela à esquerda + cartão da câmera à direita, sobre fundo escuro).

| Tempo (s) | O que acontece na imagem | Origem | Fala no instante (gatilho) | Defasagem |
|---|---|---|---|---|
| 520,0–534,87 | L-SPLIT parado. Cursor pousado sobre a faixa de status do mod (linha "50m · 82k/1M (8%) · 5h 34% · 7d 19% · US$ 0,32"), micro-tremores. | tela | "…30% da sua sessão… equivalente se… via API, via token" | cursor já estava no lugar; nenhum destaque na cifra citada |
| 534,87 | **Corte seco** (cabeça muda de pose entre 2 quadros; tela idêntica). | edição | entre "token." (534,43) e "Esses" (534,93) | corte 0,06 s antes da 1ª palavra da frase nova |
| 534,87–557,56 | Parado. Fala sobre planos subsidiados ("três vezes mais", "janela de oportunidade"). Só o apresentador gesticula. | — | 8:54–9:15 | 22,7 s sem nenhum apoio visual |
| 557,56 | **Corte seco** (pose muda; cursor salta ~1 % para a esquerda). | edição | entre "também" (557,19) e "o volume" (557,69) | corte 0,13 s antes da palavra |
| 557,56–601,2 | Parado. Cursor passeia ±2 % sobre a faixa de status enquanto ele lê "1 milhão de tokens", "8%", "acima de 20". | tela | 9:17–10:00 | **43,6 s sem mudança** — maior buraco do trecho |
| 601,20 | Menu de comandos "/" abre acima do campo de texto (lista ~12 % x 30 % do quadro + painel de descrição à direita). Aparece em 1 quadro; em 3 quadros (0,1 s) a lista troca de "/" para o filtro "/do" com "doctor" no topo. | app | "//doctor." (600,07) → "Esse Barra Doctor" (601,38) | menu aparece **1,13 s depois** da palavra "doctor" |
| 601,2–611,3 | Menu aberto, parado (10 s). Cursor sobe da caixa de texto até o item "doctor" (~602,3). Texto do menu ilegível (≈5 px de altura em 360p; ≈15 px em 1080p). | app | "vai fazer uma análise… corrigir excessos… skills que você não está utilizando" | — |
| 611,3–613,0 | Menu fecha em etapas (lista encolhe conforme apaga os caracteres; 3 estados em ~1,5 s), volta a tela anterior. | app | "…saiu instalando um monte de skill" (611,5–612,6) | sem relação com a fala |
| 613,45 | Corte seco provável (pico só no recorte da câmera; tela igual). *Inferência.* | edição | entre "skill," e "um monte de repositório" | — |
| 625,36 | Corte seco provável (4 quadros seguidos de diferença alta na câmera, tela igual). *Inferência.* | edição | "eu uso (625,27) / lá no VS Code (625,81)" | — |
| 613–654,5 | Parado. Cursor sobre a faixa de status (640–646 passa por cima dos números enquanto fala "5 horas… janela semanal… 19%"). | tela | 10:27–10:53 | 29 s sem mudança |
| 654,5–657,5 | Popover nativo de uso abre no canto inferior direito da janela (≈60–70 % x, 62–76 % y do quadro; barras azuis de limite de sessão/semanal). Aparece e some em 1 quadro. Fica 3,0 s. | app | "Eu posso vir aqui **embaixo**" (653,30) "…ele vai me mostrar" (655,1) | abre **1,2 s depois** de "embaixo"; fecha em "ter isso à vista" (657,6) |
| 660,2–661,7 | **Virada de capítulo (Mod 2) sem nenhum marcador visual.** Pausa de fala 660,99–661,75 (0,76 s). Mesmo quadro. | — | "E tem um outro… exemplo que eu acho muito útil" | — |
| 661,7–676,9 | Parado. Cursor vai ao centro da janela e fica. | tela | "todo mundo trabalha com várias chaves, tokens… muito arriscado" | 15 s, conceito de risco sem apoio visual |
| 676,94 | **Corte seco** (cursor salta do centro para o canto inferior esquerdo da janela; pose muda). | edição | entre "vocês" (676,52) e "que serve" (677,00) | corte 0,06 s antes da palavra |
| 678,4 | Mini-popup azul do sistema (área de transferência) pisca ~0,5 s à direita da caixa de texto. | sistema | "exatamente para isso" | ruído, não intencional |
| 680,1 | Prompt colado: a caixa de texto cresce de 1 linha para ~22 % da altura do quadro, de uma vez (2 quadros com rolagem interna, depois estável). Bloco de texto denso, sublinhados vermelhos do corretor. | app | "incluir (679,96) uma chave de token" | colagem 0,14 s depois de "incluir" |
| 682,9 | Envio: caixa volta a 1 linha, mensagem vira bolha no chat (recolhida com "Mostrar mais"). | app | "sem precisar (682,6–682,8) jogar isso aqui no chat" | — |
| 690,7 | Resposta do assistente aparece abaixo da bolha (parágrafo + 2 marcadores, trechos de código em vermelho). | app | "…bloquear esse tipo de ação. Toda vez que você copia" | — |
| 690,7–703,3 | Parado. Ele descreve o que o texto diz ("ele está pedindo para eu confirmar"), nada aponta para o trecho. | tela | 11:31–11:43 | 12,6 s |
| 703,3–704,8 | Ele responde "sim" (bolhinha à direita) e o chat rola ~8 % para cima; surge linha de progresso da ferramenta. | app | "criar (703,19) uma nova aba" | — |
| 704,8–728,8 | Parado. Cursor estacionado na borda da barra lateral (fora do conteúdo). | tela | "quando estiver desenvolvendo… GitHub privado" | 24 s |
| 728,8 | Linha nova de status da ferramenta ("Lendo os tipos de API…"), salto de 1–2 linhas. | app | "privado, você não pretende" | — |
| 738,90 | Corte seco provável (câmera). *Inferência.* | edição | entre "público." (738,48) e "Mesmo" (739,06) | — |
| 738,9–760 | Parado; só o texto de status "Reading…" troca a cada poucos segundos (2 % do quadro). | app | "…se ela foi exposta em algum momento, ela pode vazar… .env" | 21 s; história do vazamento sem imagem |

---

## 2. Inventário de padrões

### P1 — L-SPLIT "janela + cartão de câmera" (1 ocorrência, 240 s contínuos = 100 % do trecho)
- **Fundo**: degradê vertical quase preto com leve tom verde-azulado: topo `#19201f`, meio `#111817`, base `#0c1110`. Sem textura, sem movimento.
- **Janela da tela**: x 1,5 %–78,4 %, y 13,3 %–87 % (≈77 % x 74 % do quadro). Cantos levemente arredondados (≈0,5–1 % da largura; *inferência*, borda pouco contrastada porque a janela `#141414` quase se confunde com o fundo). Sem borda visível; sombra, se existe, é imperceptível em fundo escuro.
- **Cartão da câmera**: x ≈80 %–98,7 %, y ≈26 %–74 % (≈18,6 % x 48 % do quadro, retrato ~0,69:1 ≈ 2:3). Cantos bem arredondados (raio ≈1,6 % da largura do quadro ≈ 9 % da largura do cartão). Sem borda, sem sombra perceptível. Enquadramento busto, microfone na base. É a única área com cor quente (laranja/âmbar) do quadro.
- **Respiro**: 1,5 % à esquerda, ~1,6 % entre janela e câmera, ~1,3 % à direita; 13 % em cima e embaixo (faixas vazias, nunca usadas neste trecho).
- **Entrada/saída**: não ocorrem dentro do trecho (já estava montado em 520 s e segue assim em 760 s).
- **Footage**: os dois vídeos ficam íntegros, sem desfoque/escurecimento.
- **Legendas/pílulas**: nenhuma.
- **Tipo de fala**: demonstração longa na tela ("aqui ele mostra…").

### P2 — Corte seco de limpeza (jump cut sincronizado) — 3 confirmados (534,87 · 557,56 · 676,94) + 3 prováveis (613,45 · 625,36 · 738,90)
- Corta câmera e tela no mesmo quadro (o cursor salta junto). Duração 0 quadros, sem zoom de disfarce, sem transição.
- Sempre no intervalo entre frases, 0,06–0,13 s antes da primeira palavra da frase seguinte.
- O layout não se mexe; como o cartão da câmera é pequeno (18 % da largura), o salto de pose quase não se nota.

### P3 — Evento nativo do aplicativo como "animação" — 9 ocorrências
(menu "/" abre 601,2 · menu fecha 611,3–613 · popover de uso 654,5–657,5 · popup de sistema 678,4 · colagem 680,1 · envio 682,9 · resposta 690,7 · "sim"+rolagem 703,3–704,8 · linha nova 728,8)
- Tudo aparece em 1 quadro (sem fade, sem deslize), no tamanho real da interface: texto com ≈1,4 % da altura do quadro (ilegível em 360p, pequeno em 1080p).
- Permanência: menu 10 s; popover 3 s; popup 0,5 s; o resto fica.
- Nenhum recebe destaque da edição.

### P4 — Cursor como único apontador — contínuo
- Cursor branco padrão, ≈2,2 % da altura do quadro (um pouco maior que o normal — *inferência*), sem halo, sem rastro, sem clique visível.
- Usado como "dedo" sobre a faixa de status de 520 a 660 s; depois estacionado fora do conteúdo (704–760 s).

**Padrões ausentes no trecho (contagem 0)**: título/cartão de capítulo, lower-third, pílula de palavra-chave, legenda, número grande, punch-in, reenquadramento, marca-texto, desfoque de dado sensível, tela cheia da câmera, b-roll.

---

## 3. Transições

- Entre layouts: **nenhuma** (um só layout).
- Entre cortes: só corte seco (0 quadros), 3–6 vezes. Nada se move.
- Virada de capítulo em 660 s ("Mod 2: cofre de chaves"): **sem transição e sem marcador** — só 0,76 s de pausa na fala.

## 4. Efeitos no footage e na tela gravada

- Zoom/punch-in: **nenhum** (bordas da janela e do cartão idênticas quadro a quadro; a faixa superior do fundo só acusa o pulso periódico de compressão a cada 5,7 s).
- Reenquadramento da câmera: nenhum.
- Cursor destacado: não (só o cursor do sistema).
- Marca-texto / caixa / seta sobre a tela: nenhum — nem sobre "8%", "34%", "19%", "US$", que são o assunto da fala por 2 minutos.
- Desfoque: nenhum (a barra lateral com nomes de conversas fica exposta).
- Cor: tela gravada em tema escuro sobre fundo escuro; contraste global muito baixo (quadro médio quase preto), a câmera é o único ponto quente.
- Sombra: imperceptível.

## 5. Ritmo

- Eventos visuais totais: 9 nativos do app + 3 a 6 cortes = **12–15 em 240 s → 3,0–3,8 por minuto**.
- Eventos criados pela edição: só os cortes → **0,75–1,5 por minuto**. Gráficos: **0 por minuto**.
- Distribuição desigual: 520–601 s tem 2 eventos em 81 s; 676,9–705 s concentra 6 eventos em 28 s.
- Maior intervalo sem mudança: **43,6 s** (557,56 → 601,2). Outros: 29 s (625,4→654,5), 24 s (704,8→728,8), 22,7 s (534,9→557,6), 21 s (738,9→760).
- Duração média de um elemento passageiro: menu 10 s, popover 3 s, popup 0,5 s → média ≈4,5 s. Layout: 240 s.

## 6. Como fazer melhor

| # | Ponto fraco observado | Melhoria concreta |
|---|---|---|
| 1 | **Números falados nunca são mostrados grandes.** 520–660 s a fala gira em torno de "8%", "1 milhão de tokens", "acima de 20", "34% / 19%", "três vezes mais", e a única fonte é uma linha de texto com ~1,4 % da altura do quadro. | A cada cifra dita: punch-in na faixa de status (escala 2,2–2,6x, 10–12 quadros desacelerando, origem na própria linha) + marca-texto coral varrendo a cifra da esquerda para a direita em 8 quadros, no quadro em que a palavra começa. Para "três vezes mais" e "1 milhão", cartão de número grande (Playfair 600, ≥14 % da altura) na faixa vazia inferior. |
| 2 | **43,6 s e 29 s sem nenhuma mudança.** | Teto de 8 s sem evento em tela gravada: alternar punch-in → volta → pílula de termo → destaque. No `max`, o validador deve reprovar qualquer janela >8 s sem evento. |
| 3 | **Tema escuro sobre fundo escuro**: a janela (#141414) some no fundo (#111817); 26 % da altura (faixas de cima e de baixo) é área morta. | Fundo paper #f8f8f2 com a janela em cartão de cantos 16–20 px e sombra suave, ou janela ocupando 100 % da altura útil. Usar a faixa inferior para legenda/pílula e a superior para o rótulo do capítulo. |
| 4 | **Virada de capítulo invisível** (660 s). Quem pulou pelo capítulo do player cai numa tela idêntica à anterior. | Cartão de capítulo de 1,5–2 s ("Mod 2 · Cofre de chaves"): footage encolhe 4 % e escurece 35 %, título entra subindo 24 px com fade em 10 quadros, sai em 8. Depois, rótulo persistente pequeno no topo. |
| 5 | **Destaque atrasado**: menu aparece 1,13 s depois de "doctor"; popover 1,2 s depois de "embaixo". O olho fica sem alvo enquanto a palavra é dita. | Ancorar o gráfico na palavra (words.json), não na ação: pílula "/doctor" entra 2–3 quadros ANTES da palavra (600,0 s) e fica até o menu abrir; anel/seta no canto inferior direito em 653,2 s. |
| 6 | **Menu e popover ilegíveis** (texto ≈15 px em 1080p) ficam 10 s e 3 s sem ampliação. | Enquanto o menu está aberto, zoom na região do menu (escala ~2,5x) com o resto escurecido 40 %; popover de 3 s → segurar com freeze + zoom por pelo menos 4 s e marcar as duas barras. |
| 7 | **Parede de texto colada** (680–690 s): o prompt é o produto do vídeo e passa como um bloco denso com sublinhados vermelhos do corretor. | Substituir por cartão de prompt redesenhado (3–4 linhas-chave em Inter, palavras-chave em coral, entrada linha a linha com stagger de 3 quadros) + selo "prompt na descrição". |
| 8 | **Conceito de risco sem imagem** (704–760 s: repositório privado → público → chave vaza pelo histórico). 56 s de fala com a tela parada num "Reading…". | Diagrama de 3 passos em sequência (privado → público → histórico expõe a chave), cada passo entrando na palavra correspondente (728,0 "GitHub privado", 737,9 "público", ~751 "vazar"); footage encolhe para cartão ou escurece. |
| 9 | **Cursor é o único apontador** e fica estacionado fora do conteúdo por 55 s. | Halo coral translúcido seguindo o cursor só quando ele aponta algo; esconder o cursor quando parado >2 s. Pulso de clique (anel 12 quadros) em cada clique. |
| 10 | **Câmera sempre com 18 % da largura**; nos trechos de opinião (534,9–557,6 "janela de oportunidade") a tela não diz nada e o rosto está pequeno. | Trocar de layout conforme o tipo de fala: opinião → câmera cheia ou 50/50 com frase-chave; demonstração → tela grande. Transição de 12–14 quadros com os dois cartões deslizando/redimensionando (curva que desacelera). |
| 11 | **Ruído não tratado**: popup azul de área de transferência (678,4), sublinhados do corretor, barra lateral com nomes de conversas. | Cobrir/limpar na edição (recorte da janela sem a barra lateral, ou desfoque de 12 px na lateral); cortar os 0,5 s do popup. |
| 12 | **Sem legenda nem pílula de termo** em 4 minutos cheios de jargão (MCP, skills, harness, .env, gitignore). | Pílula de termo (1 por conceito novo, 2–3 s, na faixa inferior) na primeira vez que cada termo é dito. |

**O que vale manter da referência**: o L-SPLIT é limpo e estável (rosto sempre visível, proporção retrato 2:3 com cantos bem arredondados funciona); os cortes secos caem exatamente no intervalo entre frases (≤0,13 s antes da palavra) e somem porque o cartão da câmera é pequeno — bom truque para esconder jump cut sem zoom.
