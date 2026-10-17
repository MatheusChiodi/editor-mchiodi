import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { listVersions, loadEdl } from '../edl/store.ts';
import { buildTimeline } from '../edl/timeline.ts';
import { collectEvaluations } from '../eval/index.ts';
import { type ProjectPaths, readJson } from '../project/paths.ts';
import { bumperDurations } from '../render/bumpers.ts';
import type { RetentionAnalysis } from '../retention/index.ts';
import { loadScenes } from '../scenes/models.ts';
import { buildChapters, buildReport, renderChapters } from './index.ts';

export function retentionFile(paths: ProjectPaths): string {
  return join(paths.analysisDir, 'retention.json');
}

/** Grava output/<projeto>/relatorio.md e capitulos.txt (casca do `buildReport`). */
export function writeReport(paths: ProjectPaths, version?: number): { report: string; chapters: string; count: number; problems: string[] } {
  const current = loadEdl(paths, version);
  const timeline = buildTimeline(current.clips, current.output.fps);
  const finalFile = join(paths.outputDir, 'final.mp4');
  const retention = existsSync(retentionFile(paths)) ? readJson<RetentionAnalysis>(retentionFile(paths)) : null;
  const report = buildReport({
    edl: current,
    timeline,
    history: listVersions(paths).map((item) => loadEdl(paths, item)),
    evaluations: collectEvaluations(paths.rendersDir),
    renderedFile: existsSync(finalFile) ? finalFile : null,
    scenes: loadScenes(),
    retention,
  });
  mkdirSync(paths.outputDir, { recursive: true });
  const reportFile = join(paths.outputDir, 'relatorio.md');
  const chaptersFile = join(paths.outputDir, 'capitulos.txt');
  writeFileSync(reportFile, report, 'utf8');
  const { chapters, problems } = buildChapters(current, timeline, bumperDurations(current).introSec);
  writeFileSync(chaptersFile, renderChapters(chapters), 'utf8');
  return { report: reportFile, chapters: chaptersFile, count: chapters.length, problems };
}
