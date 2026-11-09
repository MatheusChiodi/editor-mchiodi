import { entry as Burst } from './Burst';
import { entry as OrganicBlob } from './OrganicBlob';
import { entry as PathDraw } from './PathDraw';
import type { ComponentEntry } from './registry';
import { entry as ShapeMorph } from './ShapeMorph';

/** Grupo C4 do arsenal: motion graphics vetorial (traço, morph, partículas, ruído), inspirado em manim, motion-canvas e mojs. */
export const groupC4: Record<string, ComponentEntry> = {
  PathDraw,
  ShapeMorph,
  Burst,
  OrganicBlob,
};
