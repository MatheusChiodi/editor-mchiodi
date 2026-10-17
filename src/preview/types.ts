export type SceneStatus = 'queued' | 'rendering' | 'ready' | 'error';
export type RenderStage = 'bundle' | 'strip' | 'video';

export interface StripFrame {
  frame: number;
  /** nome do arquivo dentro da pasta da cena em projects/.preview */
  file: string;
}

export interface StripResult {
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  strip: StripFrame[];
  stripMs: number;
}

/** off = só o índice (o Studio toca ao vivo); strip = tira de frames; video = tira + prévia animada */
export type PreviewMode = 'off' | 'strip' | 'video';

export interface RenderResult extends StripResult {
  /** null quando o trabalho pediu só a tira */
  video: string | null;
  videoMs: number | null;
}

export interface RenderJob {
  key: string;
  compositionId: string;
  outDir: string;
  /** prefixo dos arquivos gerados (derivado do hash): arquivo novo nunca sobrescreve o que a página está tocando */
  prefix: string;
  /** muda quando algum fonte de motion/src mudou: o renderizador rebundla só nesse caso */
  bundleVersion: number;
  /** false = só a tira de frames */
  video: boolean;
}

export interface RenderHooks {
  signal: AbortSignal;
  /** `percent` é o progresso do trabalho inteiro (0–100) */
  onProgress: (stage: RenderStage, percent: number) => void;
  /** a tira fica pronta antes da prévia animada: a página já mostra os frames */
  onStrip: (result: StripResult) => void;
}

export interface PreviewRenderer {
  render: (job: RenderJob, hooks: RenderHooks) => Promise<RenderResult>;
  /** solta o Chrome (RAM) quando a fila esvazia ou pausa */
  release: () => Promise<void>;
}

/** Falha que derruba o bundle inteiro (sintaxe, import quebrado, erro ao montar o Root): nenhuma cena renderiza até corrigir. */
export class PreviewBundleError extends Error {}
