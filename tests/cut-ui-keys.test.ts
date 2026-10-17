import { describe, expect, it } from 'vitest';

import { keyAction, shuttle } from '../cut/src/lib/keys.ts';

describe('keyAction', () => {
  it('atalhos de transporte e marcação', () => {
    expect(keyAction({ key: ' ' })).toBe('playPause');
    expect(keyAction({ key: 'L' })).toBe('shuttleForward');
    expect(keyAction({ key: 'j' })).toBe('shuttleBackward');
    expect(keyAction({ key: 'k' })).toBe('shuttleStop');
    expect(keyAction({ key: 'ArrowLeft' })).toBe('frameBack');
    expect(keyAction({ key: 'ArrowRight', shiftKey: true })).toBe('secondForward');
    expect(keyAction({ key: 'i' })).toBe('markIn');
    expect(keyAction({ key: 'o' })).toBe('markOut');
    expect(keyAction({ key: 'Delete' })).toBe('delete');
  });

  it('Ctrl: salvar, desfazer, refazer, zoom', () => {
    expect(keyAction({ key: 's', ctrlKey: true })).toBe('save');
    expect(keyAction({ key: 'z', ctrlKey: true })).toBe('undo');
    expect(keyAction({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(keyAction({ key: 'y', metaKey: true })).toBe('redo');
    expect(keyAction({ key: '0', ctrlKey: true })).toBe('zoomFit');
  });

  it('dentro de um campo de texto só o Ctrl+S passa', () => {
    expect(keyAction({ key: ' ' }, true)).toBeNull();
    expect(keyAction({ key: 'Delete' }, true)).toBeNull();
    expect(keyAction({ key: 'z', ctrlKey: true }, true)).toBeNull();
    expect(keyAction({ key: 's', ctrlKey: true }, true)).toBe('save');
  });

  it('Alt não dispara atalho de letra', () => {
    expect(keyAction({ key: 'i', altKey: true })).toBeNull();
    expect(keyAction({ key: 'q' })).toBeNull();
  });
});

describe('shuttle J/K/L', () => {
  it('L acelera para frente, J para trás, K para', () => {
    expect(shuttle(0, 'shuttleForward')).toBe(1);
    expect(shuttle(1, 'shuttleForward')).toBe(2);
    expect(shuttle(8, 'shuttleForward')).toBe(8);
    expect(shuttle(2, 'shuttleBackward')).toBe(-1);
    expect(shuttle(-1, 'shuttleBackward')).toBe(-2);
    expect(shuttle(-8, 'shuttleBackward')).toBe(-8);
    expect(shuttle(-4, 'shuttleForward')).toBe(1);
    expect(shuttle(4, 'shuttleStop')).toBe(0);
  });
});
