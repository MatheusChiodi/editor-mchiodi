import type { BaseProps } from '../anim';
import { NoticeCard, status } from './c1-kit';
import type { ComponentEntry } from './registry';

export type WarningLevel = 'warning' | 'danger';

export interface WarningCardProps {
  title?: string;
  text: string;
  level?: WarningLevel;
}

/** Cor e rótulo padrão de cada nível; a cor nunca vai sozinha, sempre com palavra e ícone. */
export function warningStyle(level: WarningLevel = 'warning', title?: string): { color: string; label: string } {
  const danger = level === 'danger';
  return {
    color: danger ? status.rose : status.amber,
    label: title?.trim() || (danger ? 'Cuidado' : 'Atenção'),
  };
}

const Triangle: React.FC<{ progress: number; color: string }> = ({ progress, color }) => {
  const dash = { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - progress };
  return (
    <svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {progress > 0 ? (
        <>
          <path d="M21.7 18l-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z" {...dash} />
          <path d="M12 9v4" {...dash} />
          <path d="M12 17h.01" {...dash} />
        </>
      ) : null}
    </svg>
  );
};

export const WarningCard: React.FC<WarningCardProps & BaseProps> = ({ title, text, level, durationInFrames }) => {
  const { color, label } = warningStyle(level, title);
  return (
    <NoticeCard
      label={label}
      text={text}
      accent={color}
      dot={color}
      icon={(progress) => <Triangle progress={progress} color={color} />}
      durationInFrames={durationInFrames}
    />
  );
};

export const entry: ComponentEntry = {
  component: WarningCard,
  sample: {
    level: 'danger',
    text: 'Nunca suba o arquivo .env para o repositório: a chave vaza no primeiro push.',
  },
  defaultDuration: 6,
  vertical: { zone: 'top' },
  description: 'Alerta sobre um erro comum ou um risco (segurança, perda de dados, custo); `danger` para o que causa prejuízo real.',
};
