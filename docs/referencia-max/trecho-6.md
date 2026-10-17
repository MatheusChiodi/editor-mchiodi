# Trecho 6 — 944 s a 1110 s (mods oficiais, outros usos, encerramento)

Fonte: `ref.mp4` 640x360, 29,97 fps. Olhado inteiro a 2 fps (6 folhas de 30 s), mais sequências a 30 fps nos pontos de mudança.
Medições por script: detecção de cena do ffmpeg (limiares 0,04 e 0,012), diferença quadro a quadro a 30 fps, contagem de pixels azuis (seleção de texto) a 10 fps e rastreio do centro/tamanho da lâmpada do cenário a 4 fps (para detectar zoom).
Imagens em `analysis/trecho-6/`.

**Achado central: este trecho não tem NENHUM gráfico de edição.** Sem legenda, sem pílula, sem título, sem lower-third, sem zoom, sem marca-texto de pós, sem cartão de CTA, sem tela final. São 2 layouts estáticos ligados por 1 dissolve. Tudo o que "muda" na tela é feito pelo apresentador dentro da gravação (seleção de texto e cursor). É a parte mais fraca da referência e a maior oportunidade de "fazer melhor".

## 1. Linha do tempo

Tempos em segundos do vídeo. "Gatilho" = palavra em `ref.words.json`.

| Início–fim | O que aparece/muda | Layout | Fala que disparou | Defasagem |
|---|---|---|---|---|
| (antes de 944)–1035,4 | Layout já vem montado do trecho anterior: cartão da tela (README "Mods" no GitHub, tema escuro) + cartão da webcam à direita, fundo quase preto | L1 tela + webcam | "Esse primeiro, o Sec" (944,3) | sem evento de edição na troca de capítulo (944) |
| 944–953,6 | Só o cursor passeia pela linha `sec-default` da tabela | L1 | "ele é para empresas" (948,3–949,2) | cursor chega ~1 s antes |
| 953,6–954,5 | Seleção azul nativa do navegador sobre a descrição da linha 1 (cresce em 0,1 s, dura 0,9 s) | L1 | "não vai fazer sentido" (953,0–953,6) | começa junto com "sentido" (0 s) |
| 954,1–~1018,6 | Aparece um balão branco de extensão de navegador (bolinhas coloridas de marca-texto + X), ~9% x 3% do quadro, em cima do cabeçalho da tabela. Fica ~64 s, mudando de lugar a cada nova seleção. É lixo da gravação, não é gráfico | L1 | — | acidental |
| 954,5–972,7 | Sem seleção. Cursor desce para a linha `diff` | L1 | "esse Diff, ele também vale muito a pena" (957–961) | cursor acompanha, sem destaque |
| 972,7–975,8 | Seleção azul na linha `diff` (2 linhas de texto), 3,1 s | L1 | "Esse mod, ele mostra exatamente isso" (972,4) | +0,3 s depois de "Esse" |
| 976,0–1018,6 | Seleção azul na linha `telemetry` (3 linhas). **Fica 42,6 s parada** enquanto ele sai do assunto (plano do GPT, janela de 258 mil tokens) | L1 | "Esse daqui é pouco útil" (975,3) | +0,7 s depois de "Esse"; termina com "Mas aqui esse mod" (1016,8), +1,8 s |
| 981–1016 | Digressão sobre GPT Plus / 258 mil tokens / "um terço": número importante dito sem nenhum apoio visual. Tela congelada na seleção errada | L1 | "apenas 258 mil tokens" (1009) | nada entra |
| 1018,6–1035,4 | Seleção some. Cursor parado/pequenos movimentos sobre a linha `agents-md` | L1 | "ele dá ao Cloud Code a possibilidade de ler ... agentes.md" (1017,9–1024) | sem destaque |
| 1035,40–1035,57 | **Dissolve cruzado** de L1 para a câmera em tela cheia, 4–5 quadros (0,13–0,17 s) | L1 → L2 | fim de "agentes.md." (1034,6–~1035,2) / antes de "Então aqui dois exemplos" (1036,2) | corte cai na pausa: ~0,2 s depois do fim da frase, 0,7 s antes da próxima |
| 1035,6–1110,1 | Câmera em tela cheia, enquadramento fixo, **74,5 s sem nenhuma mudança visual** (resumo, novidade do projeto, pedido de like/inscrição, despedida) | L2 talking head | "Então aqui dois exemplos muito práticos" | — |
| ~1052,84 | Pico de diferença entre quadros (4,2 vs 1,1 dos vizinhos): provável corte seco de silêncio no mesmo enquadramento (inferência; a 360p não dá para ver salto) | L2 | entre "produção." e "Pretendo trazer" (1051) | invisível |
| 1087–1100 | "deixa o like nesse vídeo" (1091–1092), "Se inscreva nesse canal" (1099,7): nenhum botão, ícone ou texto na tela | L2 | CTA falada | nada entra |
| 1110,08 | Fim seco: último quadro é a câmera, sem fade, sem tela final, sem cartões | L2 | "próximo vídeo." (1109,9) | 0,2 s depois da última palavra |

## 2. Inventário de padrões

### P1 — Layout "tela em cartão + webcam em cartão" (1 ocorrência, 944→1035,4 = 91,4 s; começa antes do trecho)
- Fundo: quase preto com leve tom verde (≈ #0e1411), um pouco mais claro no topo que na base (gradiente vertical sutil; inferência pela compressão).
- Cartão da tela: x 1,4%→78,6%, y 13,4%→87,0% do quadro (≈ 77,2% x 73,6%, proporção ≈ 1,86:1, a janela do navegador inteira com abas e barra de endereço). Cantos pouco arredondados (≈ 0,4% da largura; quase reto). Borda fina azul-acinzentada 1 px (é a própria borda da janela). Sem sombra visível.
- Cartão da webcam: x 80,1%→98,6%, y 25,7%→74,1% (≈ 18,5% x 48,4%, retrato ≈ 2:3), centrado na vertical do quadro (não alinhado ao topo da tela). Cantos bem arredondados (raio ≈ 1,5% da largura do quadro, ≈ 8% da largura do cartão). Sombra suave escura em volta (halo ≈ 1% do quadro). Rosto recortado apertado (testa ao microfone).
- Folga: 1,4% nas laterais, 1,5% entre os cartões, 13% acima e abaixo da tela (faixas vazias, sem uso).
- Entrada: não ocorre no trecho. Saída: dissolve de 4–5 quadros para a câmera cheia (os dois cartões somem juntos, sem movimento próprio).
- Footage: tela e câmera ficam nítidas, sem escurecer, sem zoom durante os 91 s.
- Legendas/pílulas: não existem neste trecho.
- Uso: demonstração/leitura de página (aqui, tabela do README).

### P2 — Seleção de texto nativa como "marca-texto" (3 ocorrências)
- Anatomia: faixa azul do navegador (≈ #1f6feb) sobre o texto da célula; 1 a 3 linhas, largura ≈ 24% do quadro, altura ≈ 1,7% por linha. Texto fica branco sobre azul.
- Entrada: arrasto do mouse, cresce em 0,1–0,9 s da esquerda para a direita/baixo, linear (é o gesto real). Saída: some em 1 quadro ao clicar fora.
- Duração: 0,9 s / 3,1 s / 42,6 s (média 15,5 s; mediana 3,1 s).
- Sincronia: de 0 a +0,7 s depois da palavra-gatilho ("sentido", "Esse mod", "Esse daqui").
- Uso: apontar qual linha da tabela está sendo comentada.
- Efeito colateral: dispara o balão branco de uma extensão (ver P4).

### P3 — Cursor como apontador (contínuo, sem contagem discreta)
- Cursor padrão do sistema, branco, ≈ 1,6% do quadro de altura (≈ 6 px em 360p): praticamente invisível. Sem halo, sem aumento, sem rastro, sem clique destacado.

### P4 — Balão de extensão vazado na gravação (1 ocorrência, ≈ 64 s)
- Pílula branca ≈ 9% x 3% do quadro com 4 bolinhas coloridas e um X. É o elemento mais claro e mais saturado da tela e não faz parte do conteúdo. Poluição.

### P5 — Câmera em tela cheia, enquadramento fixo (1 ocorrência, 1035,6→1110,1 = 74,5 s)
- Plano médio, rosto no centro (olhos a ≈ 33% da altura, cabeça ≈ 30% da altura do quadro), microfone embaixo, cenário quente (estante, quadro, lâmpada acesa no canto superior direito), fundo levemente desfocado.
- Sem zoom: o centro da lâmpada fica em x=593,2±0,5 px / y=35,5±0,5 px e largura 35–38 px durante todos os 74,5 s (a variação é ruído de compressão, periódico a cada ~5 s). Nenhum punch-in, nenhum reenquadramento.
- Entrada: dissolve de 4–5 quadros. Saída: fim seco do arquivo.
- Uso: recapitulação, opinião pessoal, CTA e despedida.

### P6 — Dissolve cruzado curto (1 ocorrência)
- Ver seção 3.

Contagem: P1 ×1, P2 ×3, P3 contínuo, P4 ×1, P5 ×1, P6 ×1. Legendas ×0, pílulas ×0, títulos ×0, zooms ×0, cartões de CTA ×0, tela final ×0.

## 3. Transições

| Tempo | De → para | Tipo | Duração | O que se move |
|---|---|---|---|---|
| 944 (troca de capítulo "Mods oficiais e outros usos") | L1 → L1 | nenhuma | 0 | nada: o capítulo muda só na barra do YouTube |
| 1035,40–1035,57 | L1 → L2 | dissolve cruzado linear | 4–5 quadros (0,13–0,17 s) | nada se move; as duas imagens se misturam (por 2–3 quadros o rosto grande aparece fantasma sobre a tabela). Sem deslize, sem escala, sem a webcam "crescer" até virar tela cheia |
| 1062 (troca de capítulo "O que criar") | L2 → L2 | nenhuma | 0 | nada |
| ~1052,84 | L2 → L2 | corte seco de silêncio (inferido) | 1 quadro | salto mínimo de postura |
| 1110,08 | L2 → fim | corte seco | 0 | — |

Observação: o dissolve cai exatamente na pausa entre frases (0,2 s após "agentes.md", 0,7 s antes de "Então"). É a única decisão de sincronia de edição do trecho, e está correta.

## 4. Efeitos no footage e na tela gravada

- Zoom/punch-in: nenhum (medido). A tela fica em 77% da largura com texto de README em corpo ≈ 4 px de altura a 360p (≈ 12 px a 1080p): ilegível em celular.
- Reenquadramento: nenhum. A tabela comentada ocupa só ≈ 41% x 36% do quadro; o resto do cartão é barra lateral de arquivos e margens da página.
- Cursor destacado: não.
- Marca-texto de pós: não. O "destaque" é a seleção azul do próprio navegador (P2).
- Desfoque/escurecimento: não.
- Sombra: só no cartão da webcam (suave). Cartão da tela sem sombra.
- Cor: câmera com gradação quente (laranja/âmbar no fundo, pele neutra), contraste alto, pretos fechados; tela em tema escuro azul-marinho. Fundo do layout esverdeado escuro que não conversa com nenhum dos dois.
- Cantos: webcam bem arredondada, tela quase reta: inconsistente.

## 5. Ritmo

- Duração do trecho: 166,1 s (2,77 min).
- Eventos de edição (decisões do editor): 1 (o dissolve) → **0,36 por minuto**.
- Contando também as mudanças feitas pelo apresentador na gravação (3 seleções que entram + 3 que saem + 1 balão): 8 → 2,9 por minuto, todas concentradas nos primeiros 75 s.
- Maior intervalo sem nenhuma mudança visual: **74,5 s** (1035,6→1110,1, câmera fixa até o fim). Segundo maior: 42,6 s (976,0→1018,6, seleção parada durante a digressão).
- Maior intervalo sem evento de edição: 91,4 s (944→1035,4).
- Duração média de um elemento na tela: seleções 15,5 s (mediana 3,1 s); layouts 83 s cada.
- Fala: ≈ 2,9 palavras/s, contínua, sem pausas longas. A imagem não acompanha essa densidade.

## 6. Como fazer melhor

| # | Ponto fraco visto | Melhoria concreta |
|---|---|---|
| 1 | Final de 74,5 s de câmera fixa, sem um único elemento; a CTA ("deixa o like", "se inscreva") é só falada | Cartão de CTA sincronizado com a palavra: botão de like entra 0,1 s antes de "like" (1091,6) e é "pressionado" na palavra; pílula de inscrição entra em "inscreva" (1099,7). Entrada 8–10 quadros com mola leve, permanência 2,5–3 s, saída 6 quadros. Lado oposto ao rosto, terço inferior |
| 2 | Vídeo acaba em corte seco, sem tela final | Últimos 8–12 s: câmera encolhe para um cartão (≈ 45% da largura, à esquerda) em 14 quadros com desaceleração, e abrem 2 espaços para vídeos sugeridos + botão de inscrição no fundo paper. Dá destino ao clique |
| 3 | Recapitulação ("dois recursos bem diferentes, com o mesmo gesto", 1056–1066) sem apoio visual | Cartão de resumo com 2 itens (faixa da sessão / cofre de chaves) entrando em stagger de 4 quadros, cada um na sua menção; miniatura do que foi construído. Fecha o arco do vídeo |
| 4 | Câmera cheia sem zoom durante 74,5 s | Punch-in de 100% → 108–112% em cortes de frase a cada 8–15 s (corte seco, não animado) e um empurrão lento de 100 → 104% ao longo da CTA. Alternar 2 escalas já quebra a monotonia |
| 5 | Texto da tela ilegível (≈ 12 px a 1080p), tabela ocupa só 41% x 36% do quadro | Reenquadrar a gravação na tabela: zoom de 1,8–2,0x ancorado na linha comentada, movimento de 12–16 quadros com desaceleração, trocando de linha a cada "Esse" (944,3 / 957 / 975,3 / 1017,3). Barra lateral de arquivos fica fora |
| 6 | Destaque feito com seleção azul do navegador, que ainda dispara balão de extensão por 64 s | Marca-texto de pós: faixa coral translúcida que varre a linha da esquerda para a direita em 8 quadros, 0,1 s antes da palavra-gatilho, e escurecer 35–45% as outras linhas. Gravar sem extensões ou cobrir o balão |
| 7 | Seleção de `telemetry` fica 42,6 s enquanto o assunto é outro (plano do GPT) | Limpar o destaque quando o assunto muda (981) e trocar de cena: sair da tela para a câmera ou para um cartão de dado |
| 8 | "258 mil tokens ... um terço" (1009–1015) é o único número do trecho e não aparece | Cartão de comparação: duas barras (258 mil vs ≈ 3x), número grande em Playfair, contagem animada em 12 quadros, entrando em "258" e a segunda barra em "um terço". Permanência ≈ 4 s |
| 9 | Quatro mods são avaliados (sec: só empresas / diff: vale a pena / telemetry: pouco útil / agents-md: útil com Codex) e o veredito fica só na fala | Lista lateral de 4 linhas com selo de veredito que acende conforme cada um é comentado (um por vez, stagger pela fala). No fim sobra um placar legível |
| 10 | Troca de capítulo (944 e 1062) sem marca visual | Cartela curta de capítulo (0,8–1,2 s) ou pílula de capítulo que troca de texto no canto, com deslize de 6 quadros |
| 11 | Transição L1→L2 é um dissolve genérico com rosto fantasma sobre a tabela | Fazer o cartão da webcam crescer até a tela cheia (escala + posição, 12–14 quadros, desaceleração) enquanto a tela sai por desvanecimento/deslize para a esquerda: continuidade do mesmo objeto, sem fantasma |
| 12 | Sem legendas nem palavras-chave em 166 s | Pílula de palavra-chave nos termos fortes ("agents.md", "CLAUDE.md", "dentro do aplicativo"), 1 a cada 6–10 s nos trechos sem gráfico maior |
| 13 | Faixas vazias de 13% acima e abaixo do cartão da tela; cantos da tela retos e da webcam redondos; fundo esverdeado solto | Tela em 16:9 ocupando a altura útil (≈ 82%), mesmo raio e mesma sombra nos dois cartões, fundo do design system |
| 14 | Cursor de ≈ 6 px, invisível | Halo suave ou cursor ampliado 1,5–2x na camada de pós só quando ele aponta algo |

Meta de ritmo para superar a referência neste tipo de trecho: de 0,36 para 6–8 eventos de edição por minuto, com intervalo máximo de 8–10 s sem mudança (contra 74,5 s).
