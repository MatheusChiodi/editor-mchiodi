import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { theme } from '../../motion/src/theme';
import { App } from './App.tsx';
import { themeCssVars } from './lib/ui.ts';
import './styles.css';

for (const [name, value] of Object.entries(themeCssVars(theme))) document.documentElement.style.setProperty(name, value);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
