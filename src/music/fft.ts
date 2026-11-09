/** FFT radix-2 no lugar. `re` e `im` têm o mesmo tamanho, potência de 2. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // reordenação por inversão de bits
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** Espectro de magnitude de uma janela de Hann; reaproveita os buffers entre chamadas. */
export class Spectrum {
  private readonly window: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;

  constructor(readonly size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) throw new Error(`Tamanho da FFT precisa ser potência de 2 (recebi ${size})`);
    this.window = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
  }

  /** Magnitudes dos `size/2` bins para a janela que começa em `start`; fora do sinal vale zero. Seno de amplitude A dá ~A/2. */
  compute(samples: Float32Array, start: number): Float64Array {
    for (let i = 0; i < this.size; i++) {
      const index = start + i;
      this.re[i] = index >= 0 && index < samples.length ? samples[index]! * this.window[i]! : 0;
      this.im[i] = 0;
    }
    fft(this.re, this.im);
    const half = this.size / 2;
    const out = new Float64Array(half);
    for (let k = 0; k < half; k++) out[k] = Math.hypot(this.re[k]!, this.im[k]!) / half;
    return out;
  }
}
