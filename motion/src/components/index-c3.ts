import { entry as ChapterProgress } from './ChapterProgress';
import { entry as ChatBubbles } from './ChatBubbles';
import { entry as Countdown } from './Countdown';
import { entry as LikeReminder } from './LikeReminder';
import { entry as LineChart } from './LineChart';
import { entry as LinkCard } from './LinkCard';
import { entry as LogoBug } from './LogoBug';
import { entry as PieChart } from './PieChart';
import { entry as ProgressBar } from './ProgressBar';
import { entry as Rating } from './Rating';
import type { ComponentEntry } from './registry';
import { entry as StatCard } from './StatCard';
import { entry as Timeline } from './Timeline';
import { entry as Toast } from './Toast';

/** Grupo C3 do arsenal: componentes de dados e interface. */
export const groupC3: Record<string, ComponentEntry> = {
  PieChart,
  LineChart,
  StatCard,
  ProgressBar,
  Timeline,
  Rating,
  Countdown,
  Toast,
  ChatBubbles,
  LinkCard,
  ChapterProgress,
  LogoBug,
  LikeReminder,
};
