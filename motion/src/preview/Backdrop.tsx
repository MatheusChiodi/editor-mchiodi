import { AbsoluteFill } from 'remotion';

import { theme } from '../theme';

/** Fundo neutro para os previews do Studio: simula um talking head sem depender de vídeo. */
export const Backdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 700px at 30% 35%, #3b4a63 0%, ${theme.color.slate900} 60%, ${theme.color.night} 100%)`,
    }}
  >
    {children}
  </AbsoluteFill>
);
