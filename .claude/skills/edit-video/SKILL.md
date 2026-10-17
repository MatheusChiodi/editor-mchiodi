---
name: edit-video
description: Edita um vídeo bruto do canal MChiodi do começo ao fim (análise, direção, EDL, render, autoavaliação, entrega). Use quando o pedido for editar, cortar, legendar, animar ou finalizar um vídeo, quando houver arquivo novo em inbox/, ou para retomar/corrigir uma edição existente.
---

# Editar um vídeo

Você é o **diretor**. As ferramentas (`pnpm mce ...`) só executam; quem decide é você, lendo o que
foi dito. Regras do projeto em `CLAUDE.md`; gosto e limites em `STYLE.md`. Schema e receitas da
EDL na skill `edl-reference`.

## 0. Antes de começar

- `pnpm mce status <slug>`: se o projeto já existe, continue do "próximo passo" e leia `projects/<slug>/project.md`.
- Vídeo novo: `pnpm mce analyze "<arquivo>"` (o slug sai do nome do arquivo; `-p <slug>` para escolher).
- Biblioteca de SFX vazia? `pnpm mce assets init`.
- **Nível de edição** (`limpa`, `normal`, `pro`, `max`): é o Matheus quem escolhe. "Edição profissional", "lotada",
  "simples" no pedido → use o nível correspondente; sem menção, vale o padrão (`edit.level`). `pnpm mce levels <nível>`
  mostra os alvos e como dirigir nele. Não troque o nível por conta própria.

## 1. Assistir (lendo)

1. Leia `projects/<slug>/analysis/takes.md` inteiro: é o vídeo em texto, com tempos da fonte, pausas e sugestões de corte (`>>`).
2. Leia `STYLE.md`.
3. Só olhe imagem onde a decisão depende dela:
   - `pnpm mce view <slug> --from <s> --to <s>`: frames + forma de onda + palavras de um trecho (abra o PNG).
   - `pnpm mce frame <slug> --at <s>`: enquadramento, o que há na tela, onde uma legenda ou callout cabe.
   - `pnpm mce words <slug> --from <s> --to <s>`: tempos exatos por palavra, para ancorar animações.

## 2. Dirigir

O Matheus acompanha por `pnpm mce progress --watch`. Análise, render e avaliação já aparecem sozinhos; a direção não
deixa arquivo, então avise o que está fazendo a cada fase: `pnpm mce doing <slug> "criando cenas 3/10" [--percent 40]`
(e `pnpm mce doing <slug> x --done` ao gravar a EDL dirigida).

Escreva em poucas linhas, para você mesmo, antes de tocar na EDL:

- **Estrutura**: gancho (primeiros 15s), blocos e capítulos (3+), encerramento.
- **Cortes**: o corte automático tira retakes, marcadores "corta", hesitações e pausas com silêncio. Revise as sugestões
  de confiança baixa (`sugestão`) e os `SOM SEM PALAVRA` longos: muitas vezes são "ééé" ou risada. Decida trecho a trecho.
- **Onde a fala pede imagem** (o coração do trabalho). Para cada frase, pergunte: quem nunca viu isso entende só ouvindo?
  - conceito abstrato, relação entre partes, fluxo, antes/depois, analogia → **cena ilustrativa** ou `Diagram`/`ArchitectureMap`/`Comparison`;
  - código, comando, erro, arquivo falado em voz alta → `CodeCard`, `Terminal`, `ErrorTrace`, `FileTree`;
  - enumeração de 3+ itens → `BulletList`/`StepByStep`/`Checklist`, cada item no instante em que é dito;
  - número que merece peso → `Counter`, `StatCard`, `BarChart`;
  - termo novo → `Definition` ou destaque na legenda (`captions.highlights`);
  - piada que já está na fala → `MemeInsert`/`Stamp` (limites no STYLE.md §5);
  - nada disso → deixe só a fala. Trecho de conversa não precisa de gráfico.
- **Nível `max`** (STYLE.md §0, "Padrões obrigatórios do nível max"): a edição inteira muda de linguagem. Antes da EDL, divida o
  vídeo em blocos de ~8–10s e dê a cada um um layout: talking head com `PillStack`/`PhraseReveal`; enumeração ou comparação em
  `SplitExplainer` com `presenter: right|left`; demonstração em `WindowStage` com `presenter: pip-br`; fonte em `DocQuote`;
  conceito abstrato em cena com `wipe: "tear"`. Depois ancore cada pílula, cartão e palavra no início da palavra falada
  (`pnpm mce words`), menos 2 frames. Meta: algo novo a cada 2–4s, nunca 8s parado, os 7 padrões no mínimo
  (`pnpm mce level <slug>` mostra quantos faltam). Confira `focus` do rosto com `pnpm mce frame <slug> --at <s>`.
- **Ênfase**: zooms (STYLE.md §4), efeitos (`pnpm mce arsenal effects`), transições só em troca de assunto (§6).
- **Quanto de cada coisa**: o nível decide (STYLE.md §0). `pnpm mce level <slug>` mostra, para a duração deste vídeo,
  quantos zooms, gráficos, cenas, transições, efeitos e SFX o nível pede e quantos a EDL já tem. Em `pro`/`max`, liste
  antes todas as falas que aceitam imagem e distribua até fechar o mínimo; em `limpa`, corte tudo que a fala já explica.

## 3. Montar com o que já existe

O arsenal tem 50+ modelos prontos por categoria, todos no design system. **Consulte antes de criar**:

```
pnpm mce arsenal                       # totais
pnpm mce arsenal components -v         # componentes e exemplo de props
pnpm mce arsenal models -v             # modelos de animação (cenas reutilizáveis): slots + trecho pronto da EDL
pnpm mce arsenal models -s comparação  # busca pela forma: lista, ciclo, antes-depois, linha do tempo…
pnpm mce arsenal -s <ideia>            # busca em todas as categorias de uma vez
pnpm mce arsenal transitions -s calm   # busca por texto
pnpm mce arsenal effects -s camera
pnpm mce arsenal entrances             # efeitos de entrada (use via TextReveal)
```

**Modelos de animação** (`scene:modelos/<Nome>`) são as cenas ilustrativas que já nasceram em outros vídeos, 100% dirigidas por
props: se a forma da fala já existe ali (uma pilha, um ciclo, um degrau), use o modelo com as props deste vídeo, sem delegar nada.
`pnpm mce scenes audit` mostra os modelos mais usados.

Só quando nada do arsenal serve, delegue ao sub-agente **`motion-designer`**, um por animação e em paralelo
quando houver várias. No pedido, entregue: a fala (texto + tempos da fonte), o que precisa ser entendido,
o tom, o slug do projeto e a duração disponível. **Peça o MODELO, não a cena**: toda animação nova vira um modelo reutilizável em
`motion/src/scenes/modelos/` (nome pela forma, tudo em props, testado com dois conjuntos de props) e ele devolve o trecho da EDL
com `scene:modelos/<Nome>` e as props deste vídeo. Cena sob medida (`scene:<slug>/<Nome>`) só para ideia irrepetível, e declarando o `MODEL`.
Antes de delegar a primeira cena, suba o visor em segundo plano: `pnpm mce scenes watch <slug>` (Remotion Studio no Chrome;
cada cena gravada aparece sozinha e `Roteiro-<slug>` toca todas em sequência). No modo headless o watcher já o subiu: pule.

## 4. Gravar a EDL

1. `pnpm mce draft <slug> [--level <nível>]` cria a versão-base (corte automático + legendas) já no nível escolhido.
   Mudar o nível depois: `pnpm mce level <slug> <nível>` (grava nova versão).
2. Copie `projects/<slug>/edl/edl.vN.json` para um arquivo de trabalho, edite (skill `edl-reference`) e grave:
   `pnpm mce edl save <slug> <arquivo>`. Preencha `notes` com o que mudou e por quê.
3. Nunca edite um `edl.vN.json` já gravado.

## 5. Renderizar, avaliar, corrigir (no máximo 3 voltas)

```
pnpm mce render <slug>        # preview 540p (minutos)
pnpm mce eval <slug>          # mede o vídeo renderizado e gera imagens
```

- **ERRO** reprova: corrija a EDL exatamente como a mensagem indica, grave nova versão, renderize de novo.
- `abaixo-do-nivel` / `acima-do-nivel`: a edição está mais vazia ou mais cheia do que o nível pede. Complete ou enxugue
  (`pnpm mce level <slug>` dá a conta); só ignore se a fala realmente não der motivo, e registre isso em `notes`.
- `padrao-obrigatorio` (só no `max`): falta um padrão da linguagem do nível; a mensagem diz quantos e o JSON para montar.
  `pouco-editado`: menos de 80% do vídeo editado; preencha os maiores trechos apontados (palco, pílulas, cena, zoom na tela gravada)
  até passar de 80%, deixando sem edição só os respiros que você escolheu. `tela-parada`: um trecho sem edição com mais de 40s;
  acrescente pílula, item revelado, zoom ou troque de layout. `legenda-sobre-palco`:
  ponha `hidesCaptions: true`. No `max`, olhe pelo menos um frame de cada palco (`pnpm mce eval` lista) para conferir o rosto no cartão.
- `fora-de-sincronia` (`pro`/`max`): uma entrada não cai no início de uma palavra; a mensagem traz o valor novo de cada cue
  (`items[1].at 3.40 → 3.12`): aplique-os e confira com `pnpm mce words`. Se ela manda mudar o `at`, some a diferença aos outros cues.
- `leitura-curta` (`max`): um texto some antes de ser lido (1,2s + 0,25s por palavra); aumente `duration` como indicado, adiante o cue
  ou encurte o texto; "nunca aparece" = cue depois do fim do overlay.
- `trecho-parado` (`max`): 8–40s sem nada novo dentro da parte editada; acrescente pílula, item, zoom ou troca de layout, ou, se for
  respiro escolhido, copie para `breathers` o `{ "start", "end", "reason" }` que a mensagem dá.
- `respiros-colados` (`max`): dois trechos sem edição com menos de 15s editados entre eles; edite um deles ou preencha o meio.
- `legenda-sobre-palco`: palco lateral, `WindowStage` ou cena de tela cheia com legenda por cima; ponha `hidesCaptions: true`.
- `cena-sem-modelo`: o overlay usa uma cena sob medida que não deixou modelo reutilizável; crie o modelo e use `scene:modelos/<Nome>` (§3, §6).
- **aviso**: abra a imagem citada e decida. `corte-em-som` e `palavra-perdida-no-corte` pedem afastar a borda do clipe
  (~0.1s) e conferir na `mce view`.
- Abra as imagens listadas no fim e confira o que não se mede: salto visual, legenda cobrindo algo, texto ilegível,
  gráfico fora de hora. Problema visual também gera nova versão da EDL.
- Parou de melhorar ou chegou à 3ª volta: siga com a melhor versão e registre o que ficou pendente (`pnpm mce note ... -k pendencia`).

## 6. Entregar

Antes do render final: `pnpm mce scenes audit <slug>` sem pendências (código 0). "Cena sem modelo" = uma animação deste vídeo que
não ficou no acervo: peça ao `motion-designer` o modelo (`pnpm mce scenes new ...`) e troque o overlay para `scene:modelos/<Nome>`
numa nova versão da EDL. A autoavaliação cobra o mesmo com o aviso `cena-sem-modelo`, e o `relatorio.md` lista na seção "Modelos"
os que o vídeo usou e os que nasceram dele.

```
pnpm mce scenes audit <slug>              # toda animação nova deixou um modelo?
pnpm mce render <slug> --final            # output/<slug>/final.mp4
pnpm mce eval <slug> --final
pnpm mce shorts <slug>                    # candidatos; escolha lendo o conteúdo, grave em edl.shorts
pnpm mce render <slug> --final --shorts   # output/<slug>/final-shorts.mp4 (opcional)
pnpm mce report <slug>                    # relatorio.md + capitulos.txt
pnpm mce note <slug> "<decisão ou pendência>"
```

Depois do `report`, delegue ao sub-agente **`packager`** (passe o slug) a capa, o título e a descrição: ele entrega `capa-<n>.png`, `titulo.txt`, `descricao.txt` e `tags.txt` em `output/<slug>/`; também no modo headless.

Resposta final: caminho dos arquivos, duração antes → depois, o que a avaliação apontou e o que ficou pendente. Sem recapitular o processo.

## Correções do Matheus

Quando ele corrigir algo ("zoom demais", "tira esse meme", "legenda maior"):

1. Vira uma nova versão da EDL (nunca um remendo no vídeo).
2. `pnpm mce note <slug> "<correção>" -k correcao`.
3. Se vale para todos os vídeos, atualize o `STYLE.md` (e o número correspondente em `mce.config.json`, se houver).

## Modo headless (disparado pelo watcher)

Sem ninguém para perguntar: decida e siga. Não crie times de agentes além do `motion-designer`. Se uma etapa falhar
duas vezes, registre em `project.md`, entregue o melhor render que existir e termine com uma linha `RESULTADO: <ok|falha> — <resumo>`.
