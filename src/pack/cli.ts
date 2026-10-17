import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Command } from 'commander';

import { LAYOUT_IDS, LAYOUT_LABEL } from '../../motion/src/thumbnail/layout.ts';
import { formatClock } from '../lib/time.ts';
import { requireProject } from '../project/paths.ts';
import { packCheck, packFrames, packThumbs, packWrite, projectChapters } from './index.ts';
import { parsePackSpec } from './spec.ts';

/**
 * Grupo `mce pack`: embalagem do vídeo para o YouTube (capa, título, descrição). Quem decide é o agente `packager`.
 * `resolvePath` resolve o `--spec` a partir da pasta de quem chamou.
 */
export function registerPack(program: Command, log: (message: string) => void, resolvePath: (file: string) => string = resolve): void {
  const readSpec = (file: string) => parsePackSpec(JSON.parse(readFileSync(resolvePath(file), 'utf8').replace(/^﻿/, '')));

  const pack = program.command('pack').description('Embalagem para o YouTube: frames de capa, capa, título e descrição (agente packager)');

  pack
    .command('frames <project>')
    .description('Candidatos a frame de capa (com fala, fora de corte, espaçados) + folha de contato numerada para escolher olhando')
    .option('-n, --count <n>', 'quantos candidatos', Number, 12)
    .action(async (project: string, options: { count: number }) => {
      const { sheet, frames } = await packFrames(requireProject(project), options.count, log);
      for (const frame of frames) {
        log(`#${String(frame.index).padStart(2, '0')}  ${formatClock(frame.at, 1)}  nota ${frame.score.toFixed(2)}  nitidez ${frame.sharpness.toFixed(0)}  brilho ${frame.brightness.toFixed(2)}  pele ${(frame.skin * 100).toFixed(1)}%  ${frame.file}`);
      }
      log(`${sheet}\nAbra a folha e escolha pelo número: expressão e olho aberto não se medem.`);
    });

  pack
    .command('thumb <project>')
    .description(`Renderiza as capas do spec em output/<projeto>/capa-<n>.png + capas.png (comparação em tamanho de celular). Layouts: ${LAYOUT_IDS.join(', ')}`)
    .requiredOption('--spec <arquivo>', 'JSON com "thumbs" (ou só o array de variantes)')
    .action(async (project: string, options: { spec: string }) => {
      const { results, sheet } = await packThumbs(requireProject(project), readSpec(options.spec), log);
      if (sheet) log(`${sheet}\nAbra as capas e a folha: julgue no tamanho pequeno, como quem rola o feed.`);
      if (results.some((result) => result.problems.some((problem) => problem.level === 'error'))) process.exitCode = 2;
    });

  pack
    .command('check <project>')
    .description('Confere títulos, texto das capas e descrição (tamanho, repetição capa × título, gancho, capítulos, links, hashtags)')
    .requiredOption('--spec <arquivo>', 'JSON com titles, thumbs, description e tags')
    .action((project: string, options: { spec: string }) => {
      const check = packCheck(readSpec(options.spec), projectChapters(requireProject(project)));
      log(check.lines.join('\n'));
      log(`\n${check.errors} erro(s), ${check.warnings} aviso(s)`);
      if (check.errors > 0) process.exitCode = 2;
    });

  pack
    .command('write <project>')
    .description('Grava output/<projeto>/titulo.txt, descricao.txt (com os capítulos da EDL) e tags.txt')
    .requiredOption('--spec <arquivo>', 'JSON com titles, description e tags')
    .action((project: string, options: { spec: string }) => {
      const { check, files } = packWrite(requireProject(project), readSpec(options.spec));
      log(check.lines.join('\n'));
      if (files.length === 0) {
        log(`\n${check.errors} erro(s): nada foi gravado. Corrija o spec e rode de novo.`);
        process.exitCode = 2;
        return;
      }
      log(`\n${files.join('\n')}`);
    });

  pack
    .command('layouts')
    .description('Lista os layouts de capa')
    .action(() => {
      for (const id of LAYOUT_IDS) log(`${id.padEnd(11)} ${LAYOUT_LABEL[id]}`);
    });
}
