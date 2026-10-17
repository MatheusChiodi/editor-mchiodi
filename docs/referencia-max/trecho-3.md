# Trecho 3 — 300 s a 520 s (Onde criar mods · Mod 1 · começo da instalação)

Método: folhas de contato a 2 fps cobrindo 300–520 s sem buracos (`analysis/trecho-3/cs_*.jpg`), detecção de corte por `select=scene` recortada na área da tela gravada, e sequências a 15/30 fps em cada mudança (`seq_*.jpg`, `seq30_*.jpg`, `cuts30.jpg`). Fonte 640x360 a 29,97 fps: medidas de posição têm erro de ±0,5 % do quadro; cor, raio de canto e sombra são inferência.

**Resumo em uma frase:** o trecho inteiro (219 de 220 s) é UM layout fixo — cartão de tela gravada à esquerda + cartão vertical do apresentador à direita sobre fundo escuro — sem nenhum gráfico sobreposto, sem legenda, sem pílula, sem zoom, sem destaque de cursor. Toda a "animação" vem da própria interface gravada. É o trecho mais parado do vídeo e a maior oportunidade de fazer melhor.

---

## 1. Linha do tempo

Legenda de layout: **A** = apresentador em quadro cheio · **S** = split tela + rosto (ver padrão P1). "Nativo" = mudança que acontece dentro do app gravado, não é edição.

| Tempo (s) | O que aparece / muda | Layout | Fala no instante | Sincronia |
|---|---|---|---|---|
| 300,00–300,93 | Apresentador em quadro cheio, olha para baixo/lado (vai para o computador) | A | "Mas a melhor forma da gente ver isso…" (299,64) | — |
| 300,93–301,10 | **Dissolve A → S**, ~5 quadros (0,17 s). Nada se move: o quadro cheio apaga enquanto o split acende; o cartão do rosto já nasce no lugar final | A→S | "…ver **isso** (300,87) **funcionando** (301,09)" | Começa 0,06 s depois de "isso", termina em cima de "funcionando". "aqui direto no Cloud Code" só vem em 302,4 → o visual antecipa a fala em ~1,4 s |
| 301,1–309,98 | Tela inicial do app (painel de visão geral com heatmap). Só o cursor se move | S | "…verificar se você está de fato dentro do sistema do Cloud Code" | 8,9 s sem mudança |
| 309,98 | Nativo: clica no outro ícone da aba superior → tela "Bem-vindo…", aparece pop-up pequeno no canto inferior direito da tela | S | "Cloud **Code.**" (310,50) / "Aqui na aba superior" (310,94) | Clique 1,0 s ANTES de "aqui na aba superior" |
| 314,05 | Nativo: clica no ícone de código → volta para a tela inicial | S | "clicar **nesse**" (314,08) | Em cima da palavra (−0,03 s) |
| 314,1–323,0 | Parado; cursor desce até o rodapé esquerdo | S | "garantir… aplicativo atualizado… basta vir aqui em configurações" | 8,9 s |
| ~323,0 | Nativo: menu do usuário abre no rodapé esquerdo (lista ~8 itens, minúsculo) | S | "basta vir aqui em **configurações**" (≈323–324) | ~em cima |
| 325,93 | Nativo: modal de Configurações abre e ocupa ~65 % do cartão de tela; o app atrás escurece (overlay do próprio app). Tem um bloco branco (preview de tema) que estoura no quadro escuro | S | "em **configurações**" (325,95) | −0,02 s (em cima) |
| 327,66 | Nativo: troca para a seção "Sistema" (a versão fica na 1ª linha, ilegível em 360p e pequena mesmo em 1080p) | S | "em **sistema**" (327,17) / "aqui em sistema" (328,01) | +0,5 s depois da 1ª menção |
| 327,7–339,7 | Parado no modal por 12 s; cursor paira no canto superior direito do modal (onde está o nº da versão) | S | "…qual a versão… acima de 2.8… o meu já está no 2.3… já está atualizado" | Nenhum destaque no número citado |
| 339,74–339,84 | **Dissolve entre tomadas da gravação**, 3 quadros (0,10 s): modal → tela inicial. Só a área da tela muda; rosto e fundo ficam | S | "então (339,26) **os** (339,82) mods já estão funcionando" | Em cima do início da frase nova |
| 339,8–357,7 | Tela inicial parada por **17,9 s**; cursor quase imóvel | S | "Tem inclusive alguns mods que a própria Anthropic… O primeiro que eu quero mostrar…" | Maior trecho de fala sem apoio visual da 1ª metade |
| 357,72 / 358,96 | Nativo: prompt colado; a caixa de texto cresce em dois saltos (≈12 linhas de texto, com marcação vermelha do corretor ortográfico do sistema) | S | "já vou deixar o **prompt pronto** aqui" (357,7–358,4) | Em cima |
| 359,0–371,0 | Prompt longo na tela, ilegível. Parado 12 s | S | "…o Cloud vai desenvolver o sistema de forma mais completa. Então o objetivo aqui desse mod…" | — |
| 371,0–372,5 | Nativo: seleção azul do sistema em 2 linhas do prompt (~1,5 s) e some | S | "dentro do próprio sistema" (371,1–371,9) | Em cima, mas dura só 1,5 s |
| 372,5–381,4 | Parado 8,9 s | S | "esse mod… vai ficar à vista aqui, coisas que o Cloud não mostra de forma nativa" | — |
| 381,38 | Nativo: envia o prompt → vira bolha no topo, área de conversa vazia | S | "vou **mandar** (381,13) esse **pedido** (381,52)" | +0,25 s depois de "mandar" |
| 381,4–423,4 | 42 s com a conversa quase vazia: aparecem linhas de execução (≈392, ≈397, ≈401 s) e o cursor abre um item ("vou abrir aqui a ferramenta", 396,9). Nada destacado | S | "Na primeira etapa eu pedi para ele ler a skill… plugin da Anthropic que cria novos mods… mesmo peso…" | A fala cita "skill" e "plugin da Anthropic" sem nenhum rótulo na tela |
| 423,36 | **Corte seco** na gravação (salto de ~10 min): resposta final longa aparece | S | "na **tela.**" (423,14) / "**Ele** trabalhou" (423,46) | +0,22 s depois de "tela", −0,10 s antes de "Ele" — corte na respiração |
| 425,6 | Nativo: rolagem para cima no resultado | S | "ele já **concluiu**" (425,86) | −0,25 s |
| 425,6–448,8 | Resultado em texto denso (código inline vermelho/azul). Cursor aponta linhas; ~436–446 s uma seleção azul marca o caminho da pasta | S | "…salva em uma pasta no seu computador… meu usuário, Cloud, desenvolvedor, mods… faixa de sessão" | O caminho citado só recebe a seleção nativa, minúscula |
| 448,85–449,12 | Nativo: rolagem rápida até o fim da resposta (~4 quadros) | S | "você vai **ver** (448,99) que ele trabalhou" | Em cima |
| 449,1–456,0 | Parado; cursor sobe ao canto superior direito | S | "…concluída e instalado… mas nada dentro do seu sistema vai mudar ainda" | — |
| 456,0–458,1 | Nativo: botão fechar da janela fica vermelho (hover) | S | "Para poder valer, a gente precisa…" | — |
| 458,12 | Nativo: app fecha → papel de parede do desktop (gradiente roxo/laranja) enche o cartão de tela. Único momento colorido do trecho | S | "precisa (457,68) **voltar** (458,50)… **fechar** o aplicativo (459,32)" | 1,2 s ANTES de "fechar" (ação antecipa a fala) |
| 461,53 | **Corte seco**: app já aberto de novo (a abertura foi cortada) | S | "abrindo **novamente** (461,20) o aplicativo (461,82)" | Dentro da frase |
| 464,00 | Nativo: nova sessão (tela inicial) | S | "uma **nova sessão**" (463,42–463,70) | +0,3 s |
| 466,13 | Nativo: mensagem "oi" enviada, resposta aparece; **a faixa do mod surge** acima do campo de texto (uma linha de ~1,5 % da altura do quadro) | S | "mandar um **oi** aqui" (465,04) … "essa **faixa**" (467,62) | Faixa na tela 1,5 s antes da palavra |
| 466,1–520,0 | **54 s sem nenhuma mudança além do cursor** passando sobre os itens da faixa | S | "…criou a faixa com informações úteis… janela de cache… 60 minutos… 10 vezes mais… 20 vezes… 500 mil tokens… 30 % da sessão" | Seis números ditos, nenhum na tela |

---

## 2. Inventário de padrões

### P1 — Split "tela + cartão do apresentador" (layout base) — 1 ocorrência contínua, 219 s (99,6 % do trecho)

- **Anatomia**
  - Fundo: cor chapada escura esverdeada com degradê vertical sutil (topo ≈ #1a2422, base ≈ #0c1110 — inferência). Sem textura, sem grão visível.
  - Cartão de tela: x 1,5 %→78,5 % (77 % da largura), y 13 %→89 % (76 % da altura). Proporção ≈16:9. Margem esquerda 1,5 %, topo 13 %, base 11 % (levemente acima do centro vertical). Borda não visível; cantos quase retos (se há raio, é <0,5 % — inferência). Sem sombra perceptível: o app escuro se funde ao fundo, o cartão quase não "lê" como cartão.
  - Cartão do apresentador: x 80,1 %→98,6 % (18,5 % da largura), y 25,7 %→74 % (48,3 % da altura), proporção ≈2:3 vertical, centrado verticalmente na altura do cartão de tela. Cantos arredondados ≈1,3 % da largura do quadro (≈25 px em 1080p). Halo/sombra suave e curta ao redor (inferência). Enquadramento: recorte central do footage, rosto ocupando ~45 % da altura do cartão, microfone na base.
  - Calha entre os dois cartões: 1,6 %. Margem direita 1,4 %.
  - Tipografia/gráficos próprios: **nenhum**. Zero texto de edição no trecho.
- **Entrada:** dissolve de 5 quadros (0,17 s) a partir do quadro cheio; sem deslocamento, sem escala, sem stagger — os dois cartões aparecem juntos e já no lugar. Curva: linear (opacidade).
- **Saída:** fora do trecho (segue além de 520 s).
- **Permanência:** 219 s seguidos sem variação de tamanho ou posição.
- **Footage por baixo:** some por completo; o apresentador encolhe para o cartão (de 100 % para 18,5 % da largura). O recorte muda de plano médio para close.
- **Legendas/pílulas:** não existem neste trecho.
- **Tipo de fala:** demonstração passo a passo ("aqui", "você vai clicar", "eu vou mandar").

### P2 — Dissolve curto entre tomadas da gravação — 1 ocorrência (339,74 s)

- 3 quadros (0,10 s), só dentro do cartão de tela; rosto contínuo (o áudio/rosto não corta). Usado para pular "fechei o modal e voltei".
- Fala: troca de assunto ("então os mods já estão funcionando").

### P3 — Corte seco dentro do cartão de tela (salto de tempo) — 2 ocorrências (423,36 s e 461,53 s)

- 1 quadro. O rosto segue contínuo; só a tela pula. O primeiro esconde ~10 min de processamento; o segundo esconde a reabertura do app.
- Sem indicação visual do salto (nenhum "10 min depois", relógio, barra).

### P4 — Ação nativa como "evento" — ~14 ocorrências

- Cliques de aba (2), menu (1), modal (2), colar prompt (2 saltos), seleção de texto azul (2), enviar (1), rolagens (2), fechar app/desktop (1), nova sessão + "oi" (2).
- É o único movimento do trecho. Não tem tratamento: sem zoom, sem realce, sem som mensurável.

### P5 — Quadro cheio do apresentador — 1 ocorrência (0,93 s no início)

- Só a cauda do bloco anterior; serve de ponto de partida do dissolve.

**Não aparecem no trecho (contagem 0):** título de capítulo (353 s "Mod 1" e 452 s "Instalando" passam sem cartela), legenda/karaokê, pílula/lower-third, callout/seta, marca-texto de edição, zoom/punch-in, destaque de cursor, desfoque, cartela de número, barra de progresso, b-roll, tela cheia da gravação.

---

## 3. Transições

| Tempo | De → Para | Tipo | Duração | O que se move |
|---|---|---|---|---|
| 300,93 | Quadro cheio → split | Dissolve (cross-fade) | 5 quadros / 0,17 s | Nada; só opacidade. O rosto "salta" de tamanho dentro do fade (vê-se o fantasma do rosto grande sobre o cartão pequeno em 2 quadros) |
| 339,74 | Modal → tela inicial (dentro do cartão) | Dissolve | 3 quadros / 0,10 s | Nada |
| 423,36 | Conversa vazia → resultado final | Corte seco | 1 quadro | Nada |
| 461,53 | Desktop → app reaberto | Corte seco | 1 quadro | Nada |

Não há transição com deslocamento, escala, máscara, wipe ou morph em 220 s. A troca quadro cheio → split não usa o rosto como elemento compartilhado (ele não encolhe até o cartão; apaga e reaparece).

---

## 4. Efeitos no footage e na tela gravada

- **Zoom / punch-in na tela:** nenhum. A janela inteira do app (sidebar + coluna de conversa) fica reduzida a 77 % da largura o tempo todo. A coluna de conteúdo útil ocupa só ~31 % da largura do quadro (x 30 %→61 %); o resto do cartão é sidebar e vazio preto.
- **Tamanho de texto resultante:** corpo do texto da interface ≈3 px de altura em 360p → ≈9–10 px em 1080p (≈0,9 % da altura do quadro). Ilegível em celular; no limite em desktop.
- **Reenquadramento:** nenhum na tela. No rosto, um único recorte fixo 2:3.
- **Cursor:** cursor padrão do sistema, sem halo, sem ampliação, sem anel de clique. Em vários momentos ele é o único indicador do que está sendo falado.
- **Marca-texto:** só a seleção azul nativa (2 vezes, 1,5 s e ~10 s).
- **Desfoque/escurecimento:** só o overlay nativo do modal de Configurações. Nenhum da edição.
- **Sombra/cor:** halo suave no cartão do rosto; tela sem correção. O rosto (tons quentes laranja/âmbar) é o único ponto de cor contra o conjunto quase preto — o olho vai para o rosto, não para a tela. Exceções que estouram: bloco branco no modal (325,9–327,6) e o papel de parede (458,1–461,5).
- **Rosto no cartão:** sem movimento de câmera, sem troca de escala, 219 s idêntico.

---

## 5. Ritmo

- **Eventos de edição** (decisões do editor): 4 em 220 s → **1,1 por minuto** (1 troca de layout, 1 dissolve, 2 cortes).
- **Eventos visuais contando ações nativas:** ~18 em 220 s → **4,9 por minuto**.
- **Maior intervalo sem nenhuma mudança além do cursor:** **54 s** (466,1→520,0, e continua). Outros: 42 s (381,4→423,4, só linhas de log surgindo), 17,9 s (339,8→357,7), 12 s (327,7→339,7 e 359→371).
- **Duração média de um "estado" de tela:** 220 s / 18 ≈ **12 s**; mediana ≈ 9 s.
- **Duração dos elementos:** o único elemento de layout dura 219 s. Realces nativos: seleção 1,5 s (curta demais para ler) e ~10 s.
- **Sincronia:** ações nativas caem entre −1,2 s e +0,5 s da palavra; os 3 cortes de edição caem em pausa de respiração (±0,25 s do início da frase).

---

## 6. Como fazer melhor

| # | Ponto fraco observado | Melhoria concreta |
|---|---|---|
| 1 | Texto da interface com ~0,9 % da altura do quadro; coluna útil usa só 31 % da largura | **Punch-in dirigido por fala:** a cada "aqui/nesse/essa faixa", escalar o cartão de tela para 1,6–2,4x com âncora no alvo (entrada 10–12 quadros com desaceleração, segura enquanto fala do alvo, volta em 8 quadros). Meta: texto citado ≥ 2,5 % da altura do quadro. Recortar a sidebar por padrão (ganho imediato de ~20 %) |
| 2 | 54 s e 42 s sem mudança; 6 números falados (60 min, 10x, 20x, 500 mil, 30 %, 2.8/2.3) sem nada na tela | **Cartela de número** ancorada ao lado do cartão de tela ou sobre a área vazia do app: valor em Playfair 600 grande + rótulo Inter curto, entra 2–3 quadros antes da palavra, fica até o próximo número (mín. 1,8 s). Regra: nenhum trecho > 8 s sem evento de edição |
| 3 | A faixa do mod — o assunto do capítulo — tem 1,5 % da altura e nunca é ampliada | **Lupa/recorte flutuante:** duplicar a região da faixa num cartão ampliado 3–4x (borda paper, sombra), ligado ao original por linha fina; realce coral percorre item por item em sincronia com "cache", "contexto", "custo" |
| 4 | Cursor comum é o único guia de atenção; cliques invisíveis | Cursor com halo suave + anel de clique (expande 0→1,4 % do quadro em 8 quadros e apaga); opcionalmente escurecer 35–45 % tudo fora do alvo durante 1–2 s |
| 5 | Saltos de tempo sem sinal (10 min cortados em 1 quadro; reabertura do app cortada) | Micro-cartela de salto ("10 min depois") com avanço rápido de 6–8 quadros da própria gravação antes do corte; o espectador entende que houve espera |
| 6 | Capítulos "Mod 1" (353 s) e "Instalando e conferindo" (452 s) passam sem marcação | Cartela de capítulo curta (0,8–1,2 s) ou pílula persistente no canto com nº e nome do passo; atualiza com troca animada |
| 7 | Passo a passo falado (clicar no ícone → configurações → sistema → versão) sem estrutura | Trilha de passos (3–4 pílulas) no rodapé do cartão de tela: a atual acende em coral quando a palavra é dita |
| 8 | Entrada do split é só um fade com fantasma do rosto | Transição com elemento compartilhado: o footage encolhe do quadro cheio até o cartão 2:3 (14–16 quadros, desacelera) enquanto a tela desliza da esquerda com 3–4 quadros de atraso |
| 9 | Cartão de tela sem borda/sombra se funde ao fundo; conjunto quase preto, o rosto rouba a atenção | Dar ao cartão de tela borda de 1 px clara a 8–12 % + raio igual ao do rosto + sombra longa; fundo em tom do design system. Reduzir o cartão do rosto quando a tela é o assunto e ampliar quando ele comenta |
| 10 | Rosto idêntico por 219 s | Alternar 3 estados conforme o tipo de fala: split (demonstra), tela cheia com rosto em círculo pequeno (leitura de detalhe), quadro cheio do apresentador (opinião: "eu acho que é uma atualização que tem esse mesmo peso", 416–423 s) |
| 11 | Prompt colado ilegível por 24 s, com sublinhado vermelho do corretor | Substituir por cartão de prompt redesenhado (texto limpo, 3–5 linhas-chave, realce progressivo da linha citada); a gravação fica desfocada atrás |
| 12 | Termos novos ("skill", "plugin da Anthropic que cria novos mods", caminho da pasta) só falados | Rótulo curto/pílula de termo na primeira menção; caminho da pasta como breadcrumb animado (usuário › .claude › dev › mods › faixa-sessao), um nível por palavra |
| 13 | Flashes claros (bloco branco no modal, papel de parede) quebram a paleta | Escurecer/dessaturar esses quadros ou cobrir com cartela durante a passagem |
