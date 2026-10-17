import { entry as Checklist } from './Checklist';
import { entry as Comparison } from './Comparison';
import { entry as Definition } from './Definition';
import { entry as KeywordPop } from './KeywordPop';
import { entry as ProsCons } from './ProsCons';
import { entry as QuestionCard } from './QuestionCard';
import { entry as Quote } from './Quote';
import type { ComponentEntry } from './registry';
import { entry as SourceCitation } from './SourceCitation';
import { entry as SpeechBubble } from './SpeechBubble';
import { entry as Stamp } from './Stamp';
import { entry as StepByStep } from './StepByStep';
import { entry as TipCard } from './TipCard';
import { entry as WarningCard } from './WarningCard';

/** Grupo C1 do arsenal: componentes de texto e conceito. */
export const groupC1: Record<string, ComponentEntry> = {
  Quote,
  Definition,
  Comparison,
  ProsCons,
  StepByStep,
  Checklist,
  TipCard,
  WarningCard,
  QuestionCard,
  KeywordPop,
  Stamp,
  SpeechBubble,
  SourceCitation,
};
