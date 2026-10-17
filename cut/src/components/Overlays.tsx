import { LEVELS, type LevelId } from '../../../src/edl/levels.ts';
import { currentEdl, store, tryOps, useEditor } from '../store.ts';
import { Button, Modal } from './ui.tsx';

const TOAST_TONE = {
  info: 'border-paper/15 bg-s900',
  ok: 'border-emerald/40 bg-s900',
  warn: 'border-peach/50 bg-s900',
  error: 'border-coral/60 bg-s900',
};

export function Overlays() {
  const toasts = useEditor((state) => state.toasts);
  const still = useEditor((state) => state.still);
  const levelConfirm = useEditor((state) => state.levelConfirm) as LevelId | null;
  const level = useEditor((state) => currentEdl(state)?.level);

  return (
    <>
      <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[380px] flex-col gap-2">
        {toasts.map((item) => (
          <div key={item.id} className={`rounded-lg border px-3 py-2 text-xs shadow-xl ${TOAST_TONE[item.tone]}`}>
            {item.text}
          </div>
        ))}
      </div>
      {still && (
        <Modal title="Still do frame (mce frame)" onClose={() => store.set({ still: null })}>
          <img src={still} alt="frame da fonte" className="w-full rounded-md border border-paper/10" />
          <a href={still} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-coral underline">
            abrir em nova aba
          </a>
        </Modal>
      )}
      {levelConfirm && (
        <Modal title="Trocar o nível de edição?" onClose={() => store.set({ levelConfirm: null })}>
          <p className="text-xs leading-relaxed text-s300">
            O nível é decisão sua: o Claude dirige dentro dele e não o troca. Passar de <strong className="text-paper">{level}</strong> para{' '}
            <strong className="text-coral">{levelConfirm}</strong> muda o que a avaliação cobra:
          </p>
          <p className="mt-2 text-xs text-paper">{LEVELS[levelConfirm].summary}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button tone="ghost" onClick={() => store.set({ levelConfirm: null })}>
              cancelar
            </Button>
            <Button
              tone="primary"
              onClick={() => {
                void tryOps([{ type: 'setLevel', level: levelConfirm, confirm: true }]);
                store.set({ levelConfirm: null });
              }}
            >
              sim, trocar para {levelConfirm}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
