---
name: motion-graphics-insercao
description: Insere motion graphics (explicação, animação, efeito) no meio de um vídeo editado pela EDL, ancorado em segundos ou numa frase falada, com `mce motion add|list|remove|still` e os componentes vetoriais PathDraw, ShapeMorph, Burst, OrganicBlob. Use quando o pedido for "coloca uma animação/gráfico aqui", explicar algo com desenho, ou criar novo gráfico.
---

# Motion graphics no meio do vídeo

## Comandos (`src/motion/insert.ts`; CLI em `src/cli/index.ts`)
- `pnpm mce motion still <Componente> [--props '{...}'|@arq.json] [--frame n] [-o arq.png]` — **ver o gráfico antes** (renderiza um quadro sobre cinza).
- `pnpm mce motion add <projeto> -c <Componente> (--at <s> | --say "frase" [--nth n]) [--offset s] [-d s] [-p json] [--sample] -r "motivo" [--hide-captions]` — nova versão da EDL.
- `pnpm mce motion list <projeto>` (tempo na fonte e no vídeo final) · `pnpm mce motion remove <projeto> <id>`.
- `--say` acha a frase na transcrição (sem acento/caixa/pontuação) e ancora no início dela; `--offset` negativo entra antes da fala.

## Regras (CLAUDE.md)
- **Todo gráfico tem `reason`** (o que reforça na fala); sem motivo, recusa.
- Tempo é sempre em segundos da **fonte**; instante em trecho cortado é recusado pelo schema.
- Componentes: `pnpm mce arsenal components`; cena sob medida: `scene:<projeto>/<Nome>`.

## Componentes vetoriais novos (`motion/src/components/`, grupo `index-c4.ts`)
| Componente | Faz | Props principais |
|---|---|---|
| `PathDraw` | traço desenhado sobre um path SVG com ponta que acompanha (`@remotion/paths`) | `d`, `label`, `tone`, `strokeWidth`, `follower`, `drawSec` |
| `ShapeMorph` | uma forma vira outra (círculo, estrela, coração, triângulo, hexágono, faísca) | `from`, `to`, `label`, `tone`, `holdSec`, `morphSec` |
| `Burst` | estouro de partículas determinístico | `seed`, `count` (6–48), `tone`, `label`, `radius` |
| `OrganicBlob` | bolha orgânica que respira (ruído) com texto | `text`, `tone`, `seed`, `amp` (0–0,4) |
`tone`: `coral` | `ink` | `emerald`. Texto solto usa `outlinedLabel` (`c4-kit.ts`): branco com contorno grosso, lê em fundo claro e escuro. Helpers de tempo em `motion/src/anim.ts`: `springAt`, `chainStarts`, `loopProgress`, `wobble`.

## Receita: novo componente
1. Função pura exportada (cálculo) + componente + `entry` com `sample`, `defaultDuration`, `description`.
2. Registrar em `index-c4.ts` (e portanto no `registry`).
3. Testar a parte pura em `tests/components-c4.test.ts`.
4. `mce motion still <Nome>` e ver o quadro; só então `motion add`.

## Armadilhas
- Pacotes oficiais do Remotion ficam na versão fixa do projeto (`4.0.534`): `@remotion/paths`, `shapes`, `noise`.
- `evolvePath(0)` devolve deslocamento 1,5× o comprimento (esconde a ponta redonda): não esperar exatamente o comprimento.
- Texto branco sem contorno some em parede clara: use `outlinedLabel`.

## Validar
`tests/motion-insert.test.ts` (âncora na fala, id, inserir/remover, recusas), `tests/components-c4.test.ts`, `tests/anim-flow.test.ts` + quadro visto com `motion still`.

## Movimento (atualizado)
Curvas, saída (`motion.leave`), escalonamento (`motion.step`) e sombras/raios em tokens: ver skill `movimento-fluido`. Não use durações, passos ou sombras soltos nos componentes.
