---
name: analise-de-musica
description: Como o sistema "ouve" uma música (FFT própria, graves/médios/agudos, tempo, batidas, tempos fortes, seções por energia) e como ajustar. Use ao depurar BPM errado, batidas fora de lugar, seções demais/de menos, ou ao mexer em `src/music/{fft,features,tempo,sections}.ts`.
---

# Análise de música

Tudo em Node, sem biblioteca de áudio. Lógica inspirada em web-audio-beat-detector (tempo por picos), beat-synced-edit (energia e picos/vales), audio-reactive-led-strip (filtro exponencial) e projectM (graves/médios/agudos).

## Etapas (arquivos)
1. `features.ts` `decodeMono`: ffmpeg → mono float32 a 22050 Hz, em fluxo.
2. `fft.ts` `Spectrum`: FFT radix-2 com janela de Hann (`compute(samples, start)` → magnitudes).
3. `analyzeSpectrum`: por quadro de vídeo, `bass` (20–250 Hz), `mid` (250–2000), `treble` (2000–8000), `rms`, 16 barras log (40 Hz–10 kHz). Normaliza pelo **percentil 95** com piso relativo (`bandRef*0.1`, para banda vazia não virar sinal) e suaviza com `expSmooth(rise 0.7, decay 0.2)` (ataca rápido, solta devagar).
4. `onsetEnvelope`: fluxo espectral positivo em log a **100 quadros/s** (fina para a batida cair no instante certo).
5. `tempo.ts` `estimateTempo`: pente de fase — para cada BPM (80–160, passo 0,25) e fase, soma o onset nas batidas e **desconta 0,3× o meio-tempo**; prior suave para ~120. Soma ao onset o **fluxo do grave** (o bumbo marca a batida; o chimbal nos contratempos engana a oitava).
6. Tempos fortes: fase (0–3) com mais grave nas batidas, a cada 4 batidas.
7. `bassOnsets` (reserva): se `confidence < 0.15` (`LOW_TEMPO_CONFIDENCE` em `src/music/index.ts`), batidas = picos reais de subida do grave (≥ 0,28 s entre si) e tempos fortes = os 25% mais fortes, ≥ 1,2 s entre si.
8. `sections.ts` `segmentSections`: novidade de energia (média da janela seguinte − anterior, 4 s), picos ≥ 0,15 com distância mínima de 8 s; nível `low/mid/high` relativo à própria música. Energia usada = `0.6*rms + 0.4*bass`.

## Ajustes comuns
- BPM em outra oitava: conferir `confidence`; o resultado só afeta o *pulso* visual; o corte usa as batidas (`beats`).
- Poucas seções: baixar `minJump`; muitas: subir `minSec`/`minJump`.
- Visual "morto": subir o ganho nas bandas (`expSmooth` rise) ou baixar o percentil.

## Armadilhas
- Não normalizar cada banda isoladamente sem piso: ruído de banda vazia vira 1,0 (já resolvido com `minRef`).
- A fase da batida pode cair no contratempo se o grave não for passado a `estimateTempo`.

## Validar
`tests/music-dsp.test.ts` (FFT, bandas, tempo 120/128/60→120, seções) e `tests/music.integration.test.ts` (áudio sintético com chimbal: 120 BPM ±1).
