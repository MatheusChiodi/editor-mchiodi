import { MOTIF_IDS, type MotifId, type MusicPlan, type MusicScene } from '../../motion/src/music/types.ts';

/** Edição das cenas de um plano já gravado (`analysis/music.plan.json`). Cada função devolve um plano novo. */

function sceneIndex(plan: MusicPlan, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > plan.scenes.length) {
    throw new Error(`A cena ${n} não existe (o plano tem ${plan.scenes.length}, numeradas de 1)`);
  }
  return n - 1;
}

const withScenes = (plan: MusicPlan, scenes: MusicScene[]): MusicPlan => ({ ...plan, scenes });

export interface SceneRow {
  n: number;
  start: number;
  end: number;
  motif: MotifId;
  keyword: string | null;
  variant: number;
  /** versos cantados dentro da cena */
  lyric: string;
  /** plano de história: cenário · pose · humor (vazio nas ilustrações) */
  detail: string;
}

export function describeScenes(plan: MusicPlan): SceneRow[] {
  return plan.scenes.map((scene, index) => ({
    n: index + 1,
    start: Math.round((scene.startFrame / plan.fps) * 100) / 100,
    end: Math.round((scene.endFrame / plan.fps) * 100) / 100,
    motif: scene.motif,
    keyword: scene.keyword,
    variant: scene.variant,
    detail: scene.shot ? `${scene.shot.setting} · ${scene.shot.pose} · ${scene.shot.mood}` : '',
    lyric: plan.lyrics
      .filter((line) => line.startFrame < scene.endFrame && line.endFrame > scene.startFrame)
      .map((line) => line.text)
      .join(' / '),
  }));
}

/** Troca o motivo da cena `n`; `keyword` ausente mantém a palavra, `null` apaga. */
export function setSceneMotif(plan: MusicPlan, n: number, motif: MotifId, keyword?: string | null): MusicPlan {
  const index = sceneIndex(plan, n);
  if (!MOTIF_IDS.includes(motif)) throw new Error(`Motivo "${motif}" não existe. Opções: ${MOTIF_IDS.join(', ')}`);
  return withScenes(
    plan,
    plan.scenes.map((scene, i) => (i === index ? { ...scene, motif, keyword: keyword === undefined ? scene.keyword : keyword } : scene)),
  );
}

const MIN_PIECE_SEC = 0.5;

/** Divide a cena `n` em `atSec` (segundos da música); a segunda metade usa outra variante do motivo. */
export function splitScene(plan: MusicPlan, n: number, atSec: number): MusicPlan {
  const index = sceneIndex(plan, n);
  const scene = plan.scenes[index]!;
  const at = Math.round(atSec * plan.fps);
  const margin = Math.round(MIN_PIECE_SEC * plan.fps);
  if (at < scene.startFrame + margin || at > scene.endFrame - margin) {
    throw new Error(`O instante ${atSec}s precisa ficar dentro da cena ${n} (${scene.startFrame / plan.fps}s–${scene.endFrame / plan.fps}s), com ${MIN_PIECE_SEC}s de folga nas bordas`);
  }
  const scenes = [...plan.scenes];
  scenes.splice(index, 1, { ...scene, endFrame: at }, { ...scene, startFrame: at, variant: (scene.variant + 1) % 3 });
  return withScenes(plan, scenes);
}

/** Junta a cena `n` com a seguinte; vale o motivo da primeira. */
export function mergeScenes(plan: MusicPlan, n: number): MusicPlan {
  const index = sceneIndex(plan, n);
  const next = plan.scenes[index + 1];
  if (!next) throw new Error(`A cena ${n} é a última: não há cena seguinte para juntar`);
  const scenes = [...plan.scenes];
  scenes.splice(index, 2, { ...plan.scenes[index]!, endFrame: next.endFrame });
  return withScenes(plan, scenes);
}
