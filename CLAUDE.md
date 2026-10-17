# MChiodi Editor — regras do projeto

Pipeline em que o **Claude Code edita os vídeos do canal MChiodi**. O projeto só fornece
ferramentas determinísticas (CLI `mce`) e um arsenal de modelos prontos; o diretor é você.
Este arquivo vence o `CLAUDE.md` da raiz `D:\PROJETOS` no que divergir.

## Permissões que divergem da raiz

- **Pode rodar sem pedir**: `pnpm mce ...`, `pnpm test`, `pnpm typecheck`, ffmpeg/ffprobe. Editar vídeo é rodar comandos.
- **Todo código novo tem teste unitário** (vitest, em `tests/`). Lógica vai em função pura testável;
  o que chama ffmpeg/Remotion fica numa casca fina, coberta por teste de integração em mídia sintética.
  Rode `pnpm test` e `pnpm typecheck` antes de dar por pronto, e veja o resultado com os próprios olhos (still, `mce view`).
- Em sessão headless (`claude -p` disparado pelo watcher): não crie times de agentes nem peça confirmação; siga a skill `edit-video` até o fim.

## Como editar um vídeo

Siga a skill `edit-video`; o formato da EDL está na skill `edl-reference`. Em uma linha:
`analyze` → ler `takes.md` + `STYLE.md` → `draft` → editar e `edl save` → `render` → `eval` → corrigir (até 3 voltas) → `render --final` → `report`.

`pnpm mce status <slug>` diz em que pé o projeto está e qual o próximo passo.

## Regras invioláveis

- **A EDL é a única fonte da verdade.** Nunca edite vídeo "por fora" com ffmpeg solto; mude a EDL e renderize.
- **Nunca sobrescreva uma EDL**: toda mudança vira `edl.v(N+1).json` via `mce edl save`, com `notes` dizendo o que mudou e por quê.
- **Todo tempo na EDL é em segundos do arquivo FONTE.** O renderer converte. Não faça conta de tempo de saída à mão.
- **Nunca corte dentro de palavra.** Borda de clipe fica em pausa com silêncio medido; confira na `mce view` quando mexer num corte à mão.
- **Todo overlay, zoom, efeito e transição tem `reason`** (o que reforça). Sem motivo, não entra (STYLE.md §1).
- **O nível de edição (`level` na EDL: `limpa`, `normal`, `pro`, `max`) é escolha do Matheus.** Dirija dentro dele
  (`pnpm mce level <slug>`, STYLE.md §0) e não o troque por conta própria. Números em `src/edl/levels.ts`.
- **Arsenal primeiro**: consulte `pnpm mce arsenal` antes de criar qualquer coisa. Só o que não existe vai para o sub-agente `motion-designer`.
- **Toda animação nova nasce com um modelo reutilizável**: em `motion/src/scenes/modelos/<Nome>.tsx` (nome pela forma, tudo em props;
  `pnpm mce scenes new`), usado na EDL como `scene:modelos/<Nome>`. Antes de entregar, `pnpm mce scenes audit <slug>` sem "cena sem modelo".
- Não assista frame a frame: leia `takes.md`; peça imagem só nos pontos de decisão.
- Nunca altere, mova ou apague o arquivo original (nem o que está em `inbox/`).

## Estrutura

```
src/analyze/    ingestão, transcrição (sidecar), fala (retakes, hesitações), takes.md, timeline-view
src/edl/        schema Zod, versões, timeline fonte↔saída, corte automático
src/render/     cortes (ffmpeg, passe único), legendas, overlay (Remotion alfa), cor/zoom, efeitos,
                áudio/mixagem, vinhetas, layout de tela gravada, Short, composição
src/arsenal/    catálogos de transições e efeitos, consulta (`mce arsenal`), galeria
src/eval/       autoavaliação do vídeo renderizado
src/report/     relatorio.md e capitulos.txt
src/scenes/     índice das cenas sob medida
src/watcher/    fila, sessão headless (claude -p), notificação
src/project/    caminhos, memória por projeto (project.md), status
src/cli/        comandos `mce`
motion/src/     Remotion: theme, anim, captions, components/ (+ registry), arsenal/ (entradas, stingers, fx),
                scene-kit/ (papel e voxel), scenes/<projeto>/
transcriber/    sidecar Python (WhisperX); só `transcribe.py`
.claude/        skills (edit-video, edl-reference), agents (motion-designer), settings
projects/<slug>/{analysis,edl,renders}/ + project.md     (fora do git)
```

## Decisões técnicas (não desfazer sem medir)

- Cortes por **índice de frame/amostra em passe único** (`trim`/`atrim` + `concat`). Segmentos encodados +
  `concat -c copy` acumulam drift de A/V a cada corte (medido: 305 ms em 40 cortes).
- Grafo do ffmpeg sempre por arquivo (`-/filter_complex`): 300 cortes estouram a linha de comando do Windows.
- Caminho dentro de filtergraph passa por `escapeFilterPath` (o `:` do drive quebra `subtitles=`/`lut3d=`).
- Gráficos = uma camada Remotion com alfa (ProRes 4444) composta pelo ffmpeg; o footage não passa pelo Chrome.
- Transição `xfade` empresta frames dos dois lados do corte, só no vídeo; a duração não muda. `stinger` é overlay sobre corte seco.
- Loudness por ganho linear + limitador (medir → aplicar), não `loudnorm` dinâmico: ele bombeia a fala.
- **Filtros de áudio atrasam o som** (`afftdn` 25 ms, lookahead do `alimiter` 5 ms): toda cadeia compensa a própria latência
  (`compensate`). Um teste de integração garante que um impulso sai onde entrou.
- O corte automático só encurta pausa que tem **silêncio medido**; intervalo "com som e sem palavra" fica como sugestão.
- `initial_prompt` do Whisper fica vazio: em trecho sem fala o modelo transcreve o próprio prompt.
- Rótulos de filtergraph são globais: prefixe por domínio (`[vox…]`, `[l…]`) para não colidir (`[vmain]` já colidiu).
- `tpad` duas vezes em sequência perde o preenchimento do fim: use um só.
- Render do Remotion sempre com `gl: 'angle'` (cenas 3D do kit voxel).
- Saída padrão 30 fps: a camada de gráficos é o gargalo do render; 60 fps dobra o tempo.
- Headless: `--setting-sources project,local --permission-mode dontAsk --allowedTools …`. Sem isso, hooks e instruções globais
  do usuário entram na sessão; e `ANTHROPIC_API_KEY` no ambiente tem precedência sobre o login.

## Convenções de código

- TypeScript estrito, ESM, imports com extensão `.ts` em `src/` e sem extensão em `motion/`.
- Código em inglês; mensagens ao usuário, comentários e docs em PT-BR. Comentário só para o porquê.
- Componente novo de motion: arquivo em `motion/src/components/`, exporta `entry` (com `sample`), registrado em `registry.ts`,
  usa só tokens de `theme.ts` e curvas de `motion`, animação por `useCurrentFrame()` (nada de CSS animation).
- Modelo de animação: `pnpm mce scenes new <Nome>` → `motion/src/scenes/modelos/<Nome>.tsx` (de `_template/ModelTemplate.tsx`); `entry` com
  `tags`, `origin` e `slots` em literais (lidos do fonte por `src/scenes/models.ts`).
- Cena sob medida (exceção): `motion/src/scenes/<projeto>/<Nome>.tsx` a partir de `motion/src/scenes/_template/`, com
  `export const MODEL = '<Nome>'` na raiz do arquivo, depois `pnpm mce scenes sync`.
- Commits em PT, imperativo curto (`feat: ...`, `fix: ...`).
