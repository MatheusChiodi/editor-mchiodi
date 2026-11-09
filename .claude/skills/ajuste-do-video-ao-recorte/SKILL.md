---
name: ajuste-do-video-ao-recorte
description: Faz o vídeo (rosto do apresentador) se reenquadrar quando um gráfico sem `presenter` ocupa parte do quadro, para o gráfico não cobrir o rosto. Use ao colocar Checklist, CodeCard, BulletList, BarChart, TipCard, etc. sobre o talking head, ao revisar um vídeo em que o gráfico cobre o rosto, ao criar componente novo (medir o recorte) ou ao rodar `mce fit`.
---

# Ajuste do vídeo ao recorte do gráfico

Dois mecanismos, não confundir:
- **Palco (`presenter`)**: o footage encolhe num cartão e o gráfico ganha o resto (SplitExplainer, WindowStage, DocQuote). Já existia.
- **Ajuste (`fit`)**: gráfico *sem* palco pinta por cima do footage. Se a área dele toca o rosto, o render gera um zoom que leva o rosto para o lado livre. Automático.

## Como funciona
- `motion/src/arsenal/footprints.json`: caixa (0–1) que cada componente ocupa, medida no alfa renderizado com as props de exemplo (`scripts/measure-footprints.ts`).
- `src/edl/fit.ts`: `planFit` compara a área com o sujeito (cabeça e ombros, `SUBJECT_HALF` 0,11×0,16 em torno de `0.5,0.4`), `fitZoom` acha o **menor zoom** (1,08–1,45) e o foco que põe o sujeito num vão livre; `withFit` devolve a EDL com os zooms `fit-<idDoOverlay>`.
- `src/render/index.ts` aplica `withFit(edl, loadFootprints())` na hora de renderizar: a EDL não muda, não gasta cota de zoom do nível.
- Conta do zoom (igual ao `crop` do ffmpeg): posição na tela = `scale·p − (scale−1)·focus`. O foco só alcança uma faixa limitada: rosto muito perto do gráfico pode não ter solução.

## Estados (`pnpm mce fit <projeto>`)
| status | significa | o que fazer |
|---|---|---|
| `livre` | a área não toca o rosto | nada |
| `ajustado` | zoom `fit-*` gerado | conferir num quadro |
| `precisa-palco` | gráfico ocupa quase tudo ou não há vão | dar `presenter` (slot oposto) ou trocar por cena |
| `zoom-manual` | já há zoom da EDL no trecho (ou dois gráficos colados) | conferir se o zoom libera o rosto; ajuste `focus.x` à mão |
| `sem-medida` | componente novo sem entrada no JSON | rodar `pnpm tsx scripts/measure-footprints.ts <Componente>` |
| `ignorado` | já tem palco, é cena de tela cheia ou camada fixa | nada |

`--face x,y` corrige o centro do rosto se o enquadramento da gravação for outro; `--save` grava os zooms `fit-*` numa nova versão (para editar à mão no Cut).

## Receita
1. Ao criar componente novo: renderizar e medir (`scripts/measure-footprints.ts NomeDoComponente`), conferir o JSON e ver um quadro.
2. Ao montar a EDL: `pnpm mce fit <projeto>`; resolver todo `precisa-palco` e `sem-medida` antes do render.
3. Depois do render, olhar um quadro de cada gráfico sem palco: rosto fora da caixa do gráfico.

## Armadilhas
- Props mudam a área (lista maior, `side`, `corner`): a medida usa as props de exemplo. Se o gráfico real é bem maior, meça de novo com as props reais ou use `presenter`.
- Zoom da EDL no mesmo trecho vence o ajuste (somar dois zooms estoura o enquadramento): por isso `zoom-manual`.
- PhraseReveal/PillStack já pedem zoom manual com `focus.x ≈ 0,35`; o ajuste não os duplica.
- Cena `scene:...` cobre o quadro todo: não precisa de ajuste.

## Validar
`tests/fit.test.ts` (zoom leva o sujeito para fora da área, altura preservada, estados, idempotência) e quadro renderizado.

## Regra: nenhum gráfico na frente do rosto (`planGuard`)
- O rosto vem do detector (`analysis/focus-detect.json`, mediana no trecho de cada gráfico; `src/render/guard-io.ts`); sem detector cai em `0.5,0.4`.
- Ordem de decisão por gráfico sem palco: **livre** → **zoom `fit-*`** no vídeo (rosto vai para o vão livre) → **deslocar o gráfico** (`shift`, fração do quadro, aplicado por `Shifted` em `motion/src/Overlay.tsx`; fica fora da base, que é da legenda) → **`precisa-palco`** (aviso no render e em `mce fit`: dê `presenter`).
- Ênfase curta no centro (Stamp, TextReveal, balão) também é deslocada: nada cobre o rosto, nem por 2 s.
- KeywordPop mede grande demais para o centro; para uma palavra solta prefira `TextReveal` (o guarda o desloca para baixo do rosto).
- Validar: `pnpm mce fit <projeto>` sem `precisa-palco` + quadro de cada gráfico no render.
