---
name: cena-palavra
description: Cena "palavra" do vídeo de música (palavra-chave gigante em caixa alta, com pulo de mola e anéis). Use quando o verso não tiver tema conhecido, ou ao pedir destaque tipográfico de uma palavra.
---

# Cena: palavra

**Conta:** uma palavra carrega o verso. Aparece enorme, com contorno, e pula ao entrar.

## Quando usar
- **Reserva do verso sem tema:** se `motifForText` não acha nada, `planScenes` usa `words` com a **maior palavra (≥ 4 letras)** do verso como `keyword`.
- Trocar à mão com palavra escolhida: `pnpm mce mv set <projeto> <n> --motif words --keyword "perdeu"`.

## Onde está
`motion/src/music/motifs.tsx` → `Words`. A palavra vem em `keyword` (campo `MusicScene.keyword`).

## Como funciona
- Texto em caixa alta; tamanho = `clamp(520 / max(3, len) * 1.7, 90, 210)`.
- Entrada: `springAt(frame, fps, 0.05, { damping: 9, stiffness: 140, mass: 0.7 })` (escala de 0,6 a 1,0 com leve excesso).
- Contorno de papel/tinta (`paintOrder="stroke fill"`), sublinhado que cresce com `progress*4`, dois anéis e 10 pontos de brilho.

## Receita para mudar
Para destacar outra palavra: `mce mv set ... --keyword`. Para outra tipografia, trocar `fontFamily` (`theme.font.body`/`display`).

## Armadilhas
- Palavra com acento aparece certa (`toUpperCase` mantém), mas fonte sem o glifo cai em fallback: ficar nas fontes do tema.
- `keyword` vazio: o componente não desenha o texto (só os anéis).

## Validar
`tests/music-motifs.test.ts` (palavra `silêncio` sai como `SILÊNCIO`) + quadro visto.
