import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Tone = 'default' | 'primary' | 'danger' | 'ghost' | 'ok';

const TONES: Record<Tone, string> = {
  default: 'bg-paper/[0.07] hover:bg-paper/[0.12] text-paper border border-paper/10',
  primary: 'bg-coral hover:bg-coral-deep text-paper border border-coral',
  danger: 'bg-coral/15 hover:bg-coral/25 text-coral border border-coral/40',
  ghost: 'hover:bg-paper/[0.08] text-s300 border border-transparent',
  ok: 'bg-emerald/15 hover:bg-emerald/25 text-emerald border border-emerald/40',
};

export function Button({ tone = 'default', small, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; small?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`${TONES[tone]} ${small ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'} inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { id: T; label: string; badge?: ReactNode }[] }) {
  return (
    <div className="flex shrink-0 gap-0.5 border-b border-paper/10 px-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`relative -mb-px flex items-center gap-1 border-b-2 px-2.5 py-2 text-xs font-semibold transition-colors ${
            value === item.id ? 'border-coral text-paper' : 'border-transparent text-s300/70 hover:text-paper'
          }`}
        >
          {item.label}
          {item.badge}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'coral' | 'emerald' | 'peach' | 'peri' }) {
  const colors = {
    default: 'bg-paper/10 text-s300',
    coral: 'bg-coral/20 text-coral',
    emerald: 'bg-emerald/15 text-emerald',
    peach: 'bg-peach/15 text-peach',
    peri: 'bg-peri/20 text-peri',
  };
  return <span className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-bold tracking-wide ${colors[tone]}`}>{children}</span>;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-paper/[0.06] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-[0.12em] text-s300/60 uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-xs leading-relaxed text-s300/50">{children}</div>;
}

export const inputClass =
  'w-full rounded-md border border-paper/10 bg-night/60 px-2 py-1 text-xs text-paper outline-none placeholder:text-s600 focus:border-coral/60';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/70 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[85vh] w-[min(560px,92vw)] overflow-auto rounded-xl border border-paper/10 bg-s900 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-paper/10 px-4 py-3">
          <h2 className="text-sm font-bold">{title}</h2>
          <Button tone="ghost" small onClick={onClose}>
            fechar
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-paper/15 bg-paper/[0.06] px-1 font-mono text-[10px] text-s300">{children}</kbd>;
}
