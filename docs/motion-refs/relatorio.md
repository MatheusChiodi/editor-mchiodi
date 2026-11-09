# Referências de Motion Graphics: o que falta no mchiodi-editor

Gerado em 2026-11-08. Busca: `gh search repos` por estrelas (termos: remotion, motion graphics, lottie, manim, motion canvas,
programmatic video, kinetic typography, animated captions). Ruído descartado (rustdesk, ansible, listas de links etc.).
Clones rasos em pasta isolada; nada foi executado nem instalado deles.

## Repositórios analisados

| Repositório | Estrelas | Licença | Lang | Foco |
|---|---|---|---|---|
| 3b1b/manim | 96.261 | MIT | Python | animação matemática (Create/Write/Transform, gráficos, LaTeX, 3D) |
| ManimCommunity/manim | 42.344 | MIT | Python | fork da comunidade (**não clonado**: colidiu com o nome `manim`; vale o 3b1b) |
| remotion-dev/remotion | 71.720 | Remotion License | TS | base do projeto; 80+ pacotes oficiais |
| OpenMontage | 78.628 | AGPL-3.0 | Python | produção de vídeo por agente (só estudo; AGPL: não copiar código) |
| motion-canvas/motion-canvas | 19.727 | MIT | TS | animação vetorial por generators, signals, 2D |
| mojs/mojs | 18.890 | MIT | JS | burst, shapes, swirl, motion-path, stagger |
| diffusionstudio/lottie | 5.705 | MIT | TS | editor/preview Lottie |
| tixl3d/tixl | 5.171 | MIT | C# | motion graphics em tempo real, nós, shaders |
| dmtrKovalenko/fframes | 3.038 | MIT | Rust | vídeo programático com renderer Skia/Lyon |
| alyssaxuu/motionity | 4.146 | MIT | JS | editor de motion graphics no navegador |
| nexu-io/html-video | 4.818 | Apache-2.0 | HTML | vídeo a partir de HTML |

## REA: o que cobriu e o que não

`rea analyze-javascript-application` rodou em motion-canvas, mojs, lottie, motionity, html-video e remotion (21–129 s cada).
O resultado é um envelope de evidência (hash, grafo da aplicação) **sem inventário de funcionalidades**. As funcionalidades
abaixo vêm da estrutura de módulos do código-fonte (nomes de arquivo e pastas). **Não li a implementação** de nenhum deles.
Repositórios Python/Rust/C# (manim, OpenMontage, fframes, tixl) o REA não analisa; foram lidos por estrutura de pastas.

## Já existe no mchiodi-editor

61 componentes, 50 entradas, 50 transições, 50 efeitos, 35 temas, 6 estilos de legenda, 15 modelos de cena, 274 ícones de tecnologia
(`pnpm mce arsenal`). Cobre: gráficos de dados, cards, terminal/código, diagramas, legendas animadas, vinhetas, cena 3D voxel.
Helpers de animação em `motion/src/anim.ts`: só `progressAt`, `presence`, `stagger`, `usePresence`.

## O que falta (por referência), com como resolver

| # | Funcionalidade | Onde existe | Esforço | Como |
|---|---|---|---|---|
| 1 | Desenhar traço de path (draw-on), seguir path | manim `Create/Write`, mojs `motion-path`, remotion `@remotion/paths` | baixo | pacote oficial `@remotion/paths` (`evolvePath`, `getPointAtLength`) |
| 2 | Morph entre formas/paths | manim `Transform`, mojs `shape-swirl` | médio | `@remotion/paths` + interpolação de path; ou `flubber` |
| 3 | Formas prontas (círculo, estrela, polígono, seta) | mojs `shapes`, motion-canvas `Circle/Polygon/Rect` | baixo | `@remotion/shapes` |
| 4 | Física de mola (spring) como curva | motion-canvas `spring`, remotion `spring()` | baixo | `spring()` do Remotion já vem no pacote base; falta expor em `anim.ts` e nas curvas do arsenal |
| 5 | Orquestração: `sequence/chain/all/delay/loop` | motion-canvas `flow` | médio | helpers puros em `anim.ts` (função do tempo → progresso), testáveis |
| 6 | Burst/partículas, stagger de partículas | mojs `burst`, `stagger` | médio | componente próprio com PRNG determinístico por frame |
| 7 | Ruído (movimento orgânico, textura) | `@remotion/noise` | baixo | pacote oficial |
| 8 | Motion blur real (acúmulo de sub-frames) | `@remotion/motion-blur` | baixo | pacote oficial (`CameraMotionBlur`, `Trail`) |
| 9 | Importar Lottie / Rive | diffusionstudio/lottie, `@remotion/lottie`, `@remotion/rive` | baixo | pacotes oficiais; entrar como entrada do arsenal |
| 10 | Fórmulas LaTeX | manim `Tex`, motion-canvas `Latex` | médio | KaTeX/MathJax renderizando SVG |
| 11 | Código com tween de tokens (diff animado) | motion-canvas `Code/CodeBlock` | médio | estender `CodeCard`/`DiffCard` |
| 12 | Gráficos matemáticos (eixos, plano, campo vetorial) | manim `graphing`, `vector_field`, `value_tracker` | médio | componente de eixos + funções; hoje só barras/linha/pizza |
| 13 | Light leaks, starburst, rough-notation (sublinhado à mão) | `@remotion/light-leaks`, `starburst`, `rough-notation` | baixo | pacotes oficiais |
| 14 | Shaders/filtros/gradientes/padrões | motion-canvas `Filter/Gradient/Pattern/ShaderConfig`, tixl | alto | `@remotion/skia` ou WebGL próprio |
| 15 | Câmera 2D (pan/zoom/rotação com keyframes) | motion-canvas `Camera` | médio | componente de câmera sobre cena (hoje há zoom no vídeo, não na cena) |
| 16 | Sinais reativos (valores derivados) | motion-canvas `signals` | alto, **baixa prioridade** | o modelo `useCurrentFrame()` do projeto já cobre; não vale |
| 17 | Remover fundo no navegador | `@remotion/video-matting` | — | **feito de outro jeito:** `background` na EDL com RVM (sidecar `matting/`) |
| 18 | Editor visual de timeline | motionity, fframes-editor, tixl | — | fora de escopo: exportação `mce nle` + `mce cut` já cobrem |

## Ordem sugerida

1. Pacotes oficiais Remotion na versão fixa 4.0.534, sem código próprio: `paths`, `shapes`, `noise`, `motion-blur`, `lottie`,
   `rive`, `light-leaks`, `starburst`, `rough-notation`, `layout-utils`, `animation-utils` (itens 1, 3, 7, 8, 9, 13).
   Cada um entra como componente/entrada em `motion/src/` com `entry.sample`, registro e teste (regra do `CLAUDE.md`).
2. Helpers puros de tempo em `anim.ts`: spring exposto + `sequence/chain/all/delay/loop` (itens 4, 5).
3. Componentes próprios: morph, partículas, eixos/gráfico matemático, câmera de cena, LaTeX (itens 2, 6, 10, 12, 15).
4. Shaders (item 14) por último.

## Licenças

Remotion usa licença própria (estudo/uso conforme a licença da empresa). OpenMontage é AGPL: só a lógica foi descrita,
nenhum código deve ser copiado. Os demais são MIT/Apache.
