import { z } from 'zod';

import { LAYOUT_IDS } from '../../motion/src/thumbnail/layout.ts';

const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

const supportSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pill'), text: z.string().min(1).max(28), tone: z.enum(['paper', 'coral', 'emerald']).optional() }).strict(),
  z.object({ kind: z.literal('arrow') }).strict(),
  z.object({ kind: z.literal('badge'), text: z.string().min(1).max(16) }).strict(),
]);

/** Uma variante de capa: a foto (frame), o layout e o texto. */
export const thumbVariantSchema = z
  .object({
    /** número na folha de contato (`pack frames`) ou caminho de uma imagem */
    frame: z.union([z.number().int().positive(), z.string().min(1)]),
    /** layout `split`: foto do lado direito (padrão: a mesma) */
    frame2: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
    layout: z.enum(LAYOUT_IDS),
    text: z.string().min(1),
    accent: z.string().optional(),
    font: z.enum(['display', 'body']).optional(),
    uppercase: z.boolean().optional(),
    number: z.string().optional(),
    unit: z.string().optional(),
    support: supportSchema.optional(),
    tone: z.enum(['paper', 'ink']).optional(),
    /** onde está o rosto na foto (0–1) e quanto aproximar */
    focus: point.optional(),
    zoom: z.number().min(1).max(4).optional(),
    focus2: point.optional(),
    zoom2: z.number().min(1).max(4).optional(),
    dim: z.number().min(0).max(0.6).optional(),
    /** o ângulo desta variante (emoção, conceito, número): entra na folha de comparação */
    idea: z.string().optional(),
  })
  .strict();

export type ThumbVariant = z.infer<typeof thumbVariantSchema>;

const link = z.object({ label: z.string().min(1), url: z.string().min(1) }).strict();

export const descriptionSchema = z
  .object({
    /** 1–2 linhas: é o que aparece antes do "mostrar mais" */
    hook: z.array(z.string().min(1)).min(1).max(2),
    /** o que a pessoa vai aprender, em tópicos */
    learn: z.array(z.string().min(1)).default([]),
    /** links citados no vídeo; o que não souber vira "[PREENCHER: ...]" */
    links: z.array(link).default([]),
    cta: z.string().default(''),
    socials: z.array(link).default([]),
    hashtags: z.array(z.string().min(1)).default([]),
    extra: z.string().optional(),
  })
  .strict();

export type DescriptionSpec = z.infer<typeof descriptionSchema>;

export const packSpecSchema = z
  .object({
    /** termo de busca principal: conferido no começo do título e no gancho da descrição */
    keyword: z.string().optional(),
    /** ranqueados: o recomendado primeiro */
    titles: z.array(z.object({ text: z.string().min(1), why: z.string().default('') }).strict()).default([]),
    thumbs: z.array(thumbVariantSchema).default([]),
    description: descriptionSchema.optional(),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type PackSpec = z.infer<typeof packSpecSchema>;

/** Aceita o spec completo ou só o array de variantes de capa. */
export function parsePackSpec(data: unknown): PackSpec {
  const parsed = packSpecSchema.safeParse(Array.isArray(data) ? { thumbs: data } : data);
  if (parsed.success) return parsed.data;
  throw new Error(`Spec inválido:\n${parsed.error.issues.map((issue) => `- ${issue.path.join('.') || '(raiz)'}: ${issue.message}`).join('\n')}`);
}
