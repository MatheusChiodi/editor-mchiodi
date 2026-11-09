---
name: previa-ao-vivo
description: Prévia em tempo real do vídeo de música no navegador (player com a música, cenas numeradas, recarga automática), e servidores de edição ao vivo. Use ao iniciar qualquer criação/edição de vídeo, para o Matheus acompanhar sem renderizar, e ao depurar portas/servidores.
---

# Prévia ao vivo

O Matheus quer **ver tudo acontecendo antes de qualquer render**. A prévia é a forma de ele pedir edição ("a cena 7 vira chuva").

## O que sobe
| Para | Porta | Comando |
|---|---|---|
| Vídeo de música: API do plano e da música | 4880 | `pnpm mce mv preview <projeto> --no-open --port 4880` |
| Vídeo de música: página com recarga instantânea (Vite) | 5190 | `pnpm music:dev` |
| Edição por EDL (MChiodi Cut) | 4870 | `pnpm mce cut <projeto> --no-open --port 4870` |

URL do vídeo de música: **http://localhost:5190/**. A página mostra o vídeo tocando (com a música), a linha do tempo de cenas e a lista numerada com cenário/pose/humor e a letra de cada uma. Clicar numa cena pula para ela.

## Automático (hook)
`scripts/ensure-preview.mjs`, registrado em `UserPromptSubmit` em `~/.claude/settings.json`, sobe os servidores quando o prompt pede vídeo (assunto + verbo de ação; conversa de git não conta). Estado em `.preview/state.json` (ignorado pelo git). Se o projeto mais recente mudou, reinicia a API na troca. Para testar sem subir nada: `MCE_PREVIEW_DRYRUN=1`.
- Música (mp3/clipe/letra) → portas 4880+5190; senão → 4870.
- Depois de editar o hook, abrir `/hooks` uma vez ou reiniciar a sessão.

## Edição sem renderizar
- Cenas: `pnpm mce mv scenes|set|split|merge <projeto> ...` (reescrevem `music.plan.json`; o servidor avisa por SSE e a página recarrega).
- Código (cenários, personagem, efeitos): o Vite recarrega ao salvar o arquivo.
- Gráficos de EDL: `pnpm mce motion add|list|remove|still` e o Cut.

## Armadilhas
- O Vite escuta em `localhost` (no Windows costuma ser **só IPv6 `::1`**): teste de porta tem que olhar IPv4 e IPv6 (o hook já faz).
- O Vite encerra quando o stdin fecha; ao lançar destacado use `CI=true`.
- A página usa `plan.scenes[n].shot`; plano antigo sem `shot` ainda toca (cai nos motivos).
- `pnpm music:build` gera `music-preview/dist` (usado por `mce mv preview` sem o Vite).

## Validar
`tests/music-preview.integration.test.ts` (plano, áudio com Range, evento ao mudar o plano, bloqueio fora de loopback) e `tests/ensure-preview.test.ts`.
