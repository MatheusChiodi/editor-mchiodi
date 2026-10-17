import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { DEFAULT_LEVEL, LEVEL_IDS } from './edl/levels.ts';
import { readJson, ROOT } from './project/paths.ts';

/**
 * Parâmetros numéricos do pipeline. O STYLE.md explica o porquê de cada um para o diretor;
 * este arquivo é o que as ferramentas leem. Sobrescreva em mce.config.json.
 */
export const configSchema = z.object({
  transcribe: z
    .object({
      model: z.string().default('large-v3'),
      language: z.string().default('pt'),
      device: z.enum(['cuda', 'cpu']).default('cuda'),
      computeType: z.string().default('int8_float16'),
      batchSize: z.number().int().positive().default(4),
      /**
       * initial_prompt do Whisper. Fica vazio de propósito: em trechos sem fala o modelo
       * "transcreve" o próprio prompt (medido: 20 frases alucinadas num vídeo de 8 min).
       */
      prompt: z.string().default(''),
    })
    .prefault({}),
  cuts: z
    .object({
      /** pausa acima disso, no meio da frase, é encurtada */
      maxPauseInPhrase: z.number().default(0.4),
      /** pausa acima disso, entre frases, é encurtada */
      maxPauseBetweenPhrases: z.number().default(0.65),
      /** silêncio medido mínimo dentro de uma pausa para ela poder ser encurtada */
      minSilenceSec: z.number().default(0.12),
      /** respiro mantido antes da primeira palavra de um clipe */
      padIn: z.number().default(0.09),
      /** respiro mantido depois da última palavra de um clipe */
      padOut: z.number().default(0.16),
      /** respiro extra depois de fim de frase, para o corte não parecer picotado */
      sentencePadOut: z.number().default(0.26),
      /** flags abaixo disso ficam só como sugestão no takes.md */
      minFlagConfidence: z.number().default(0.65),
      /** clipes mais curtos que isso se fundem com o vizinho */
      minClipSec: z.number().default(0.6),
    })
    .prefault({}),
  edit: z
    .object({
      /** nível de edição quando ninguém escolhe (`mce draft --level`, pasta inbox/<nível>/) */
      level: z.enum(LEVEL_IDS).default(DEFAULT_LEVEL),
    })
    .prefault({}),
  output: z
    .object({
      /** "source" mantém o fps da gravação */
      fps: z.union([z.literal('source'), z.number().positive()]).default(30),
      height: z.number().int().default(1080),
    })
    .prefault({}),
  render: z
    .object({
      /** abas do Chrome em paralelo no Remotion; 15.8 GB de RAM não aguentam muito mais que 4 */
      remotionConcurrency: z.number().int().positive().default(4),
      previewScale: z.number().positive().max(1).default(0.5),
    })
    .prefault({}),
  headless: z
    .object({
      /** modelo da sessão sem supervisão; vazio = o padrão da sua conta */
      model: z.string().default(''),
      /** teto de gasto por vídeo quando a sessão usa API key; 0 = sem teto */
      maxBudgetUsd: z.number().nonnegative().default(0),
      /** uma edição que passar disso é abortada e marcada como falha */
      timeoutMin: z.number().positive().default(240),
      /** false = remove ANTHROPIC_API_KEY do ambiente para usar o login da assinatura */
      useApiKey: z.boolean().default(false),
      /** ferramentas extras além das padrão (ver HEADLESS_TOOLS) */
      extraTools: z.array(z.string()).default([]),
    })
    .prefault({}),
  preview: z
    .object({
      /** o watcher sobe o visor de cenas (Remotion Studio) e abre o Chrome no começo de cada edição autônoma */
      autoOpen: z.boolean().default(true),
      /** porta do Studio; o índice das cenas usa a seguinte */
      port: z.number().int().positive().default(4173),
    })
    .prefault({}),
  notify: z
    .object({
      /** tópico do ntfy.sh (push no celular); vazio desliga */
      ntfyTopic: z.string().default(''),
      ntfyServer: z.string().default('https://ntfy.sh'),
    })
    .prefault({}),
});

export type Config = z.infer<typeof configSchema>;

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  const file = join(ROOT, 'mce.config.json');
  cached = configSchema.parse(existsSync(file) ? readJson(file) : {});
  return cached;
}
