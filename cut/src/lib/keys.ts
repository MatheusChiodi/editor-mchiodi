/** Atalhos estilo CapCut/NLE. Função pura: o componente só traduz o KeyboardEvent e despacha a ação. */
export type KeyAction =
  | 'playPause'
  | 'shuttleForward'
  | 'shuttleBackward'
  | 'shuttleStop'
  | 'frameBack'
  | 'frameForward'
  | 'secondBack'
  | 'secondForward'
  | 'markIn'
  | 'markOut'
  | 'clearMarks'
  | 'undo'
  | 'redo'
  | 'save'
  | 'delete'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomFit'
  | 'toggleView'
  | 'still'
  | 'goStart'
  | 'goEnd';

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** Atalhos que valem mesmo com o foco num campo de texto (salvar, desfazer fora do campo é tratado pelo navegador). */
const GLOBAL_IN_INPUT: KeyAction[] = ['save'];

export function keyAction(input: KeyInput, inTextField = false): KeyAction | null {
  const mod = Boolean(input.ctrlKey || input.metaKey);
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  let action: KeyAction | null = null;
  if (mod) {
    if (key === 's') action = 'save';
    else if (key === 'z') action = input.shiftKey ? 'redo' : 'undo';
    else if (key === 'y') action = 'redo';
    else if (key === '=' || key === '+') action = 'zoomIn';
    else if (key === '-') action = 'zoomOut';
    else if (key === '0') action = 'zoomFit';
  } else if (!input.altKey) {
    switch (key) {
      case ' ':
        action = 'playPause';
        break;
      case 'l':
        action = 'shuttleForward';
        break;
      case 'j':
        action = 'shuttleBackward';
        break;
      case 'k':
        action = 'shuttleStop';
        break;
      case 'ArrowLeft':
        action = input.shiftKey ? 'secondBack' : 'frameBack';
        break;
      case 'ArrowRight':
        action = input.shiftKey ? 'secondForward' : 'frameForward';
        break;
      case 'i':
        action = 'markIn';
        break;
      case 'o':
        action = 'markOut';
        break;
      case 'x':
        action = 'clearMarks';
        break;
      case 'Delete':
      case 'Backspace':
        action = 'delete';
        break;
      case '=':
      case '+':
        action = 'zoomIn';
        break;
      case '-':
        action = 'zoomOut';
        break;
      case 'Tab':
        action = 'toggleView';
        break;
      case 'f':
        action = 'still';
        break;
      case 'Home':
        action = 'goStart';
        break;
      case 'End':
        action = 'goEnd';
        break;
    }
  }
  if (action && inTextField && !GLOBAL_IN_INPUT.includes(action)) return null;
  return action;
}

/** Lançadeira J/K/L: cada L dobra a velocidade para frente (até 8×), cada J para trás; K para. */
export function shuttle(rate: number, action: 'shuttleForward' | 'shuttleBackward' | 'shuttleStop'): number {
  if (action === 'shuttleStop') return 0;
  if (action === 'shuttleForward') return rate <= 0 ? 1 : Math.min(rate * 2, 8);
  return rate >= 0 ? -1 : Math.max(rate * 2, -8);
}

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Espaço', label: 'tocar / pausar' },
  { keys: 'J K L', label: 'lançadeira (trás, parar, frente; repetir acelera)' },
  { keys: '← →', label: 'frame a frame (Shift: 1 s)' },
  { keys: 'I / O', label: 'marcar entrada / saída do trecho (X limpa)' },
  { keys: 'Delete', label: 'remover trecho marcado ou itens selecionados' },
  { keys: 'Ctrl+Z / Ctrl+Shift+Z', label: 'desfazer / refazer (antes de salvar)' },
  { keys: 'Ctrl+S', label: 'salvar como nova versão da EDL' },
  { keys: '+ / − / Ctrl+0', label: 'zoom da timeline / caber tudo' },
  { keys: 'Tab', label: 'vista editada ↔ fonte inteira' },
  { keys: 'F', label: 'still do frame atual' },
];
