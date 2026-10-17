import { useEffect, useMemo, useRef, useState } from 'react';

import { sourceToOutput } from '../../../../src/edl/timeline.ts';
import { api } from '../../api.ts';
import { type CaptionWord, captionPages, highlightOp, pageAt, replaceOp } from '../../lib/captions.ts';
import { seek } from '../../playback.ts';
import { currentEdl, currentTimeline, store, toast, tryOps, usePlayhead, useEditor } from '../../store.ts';
import { Badge, Button, inputClass, Section } from '../ui.tsx';

function WordChip({ word, focused }: { word: CaptionWord; focused: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(word.shown);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => setText(word.shown), [word.shown]);
  useEffect(() => {
    if (focused) {
      ref.current?.scrollIntoView({ block: 'center' });
      setEditing(true);
    }
  }, [focused]);
  const commit = () => {
    setEditing(false);
    const op = replaceOp(word, text);
    if (op) void tryOps([op], op.type === 'captionReplace' && op.to ? `“${op.from}” → “${op.to}” em todas as ocorrências` : null);
    store.set({ focusWord: null });
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setText(word.shown);
            setEditing(false);
          }
        }}
        className="h-5 rounded border border-coral bg-night px-1 text-xs text-paper outline-none"
        style={{ width: `${Math.max(3, text.length + 1)}ch` }}
      />
    );
  }
  return (
    <span ref={ref} className="group relative inline-flex items-center">
      <button
        type="button"
        onClick={() => seek(word.start + 0.001)}
        onDoubleClick={() => setEditing(true)}
        title={`transcrito: ${word.raw}${word.replaced ? ` → ${word.shown}` : ''} · duplo clique edita`}
        className={`rounded px-0.5 text-xs ${word.highlighted ? 'font-bold text-coral' : 'text-paper/90'} ${word.replaced ? 'underline decoration-peach decoration-2 underline-offset-2' : ''} hover:bg-paper/10`}
      >
        {word.shown}
      </button>
      <button
        type="button"
        onClick={() => {
          const op = highlightOp(word);
          if (op) void tryOps([op]);
        }}
        title={word.highlighted ? 'tirar destaque' : 'destacar (captions.highlights)'}
        className="absolute -top-2.5 left-1/2 hidden -translate-x-1/2 rounded bg-s900 px-0.5 text-[9px] text-peach group-hover:block"
      >
        ★
      </button>
    </span>
  );
}

export function CaptionsPanel() {
  const project = useEditor((state) => state.project)!;
  const edl = useEditor(currentEdl)!;
  const timeline = useEditor(currentTimeline)!;
  const focusWord = useEditor((state) => state.focusWord);
  const pages = useMemo(() => captionPages(project.words, timeline, edl.captions), [project.words, timeline, edl.captions]);
  const active = usePlayhead((state) => pageAt(pages, sourceToOutput(timeline, state.source) ?? -1));
  const file = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const shown = filter.trim()
    ? pages.filter((page) => page.words.some((word) => `${word.raw} ${word.shown}`.toLowerCase().includes(filter.trim().toLowerCase())))
    : pages;

  const importSrt = async (text: string) => {
    try {
      const result = await api.srtImport(project.slug, project.latest!, text);
      if (result.ops.length === 0) return toast(`nenhuma correção encontrada${result.unmatched.length ? ` (${result.unmatched.length} sem correspondência)` : ''}`, 'warn');
      const ok = await tryOps(result.ops, `${result.changes.length} correções do .srt`);
      if (ok && result.unmatched.length) toast(`não mapeado (palavra apagada/inserida): ${result.unmatched.slice(0, 3).join(' · ')}`, 'warn', 9000);
    } catch (error) {
      toast(`import falhou: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Section
        title="Legendas"
        right={
          <div className="flex gap-1">
            <Button small onClick={() => {
                const link = document.createElement('a');
                link.href = api.srtUrl(project.slug, project.latest ?? undefined);
                link.download = `${project.slug}-v${project.latest}.srt`;
                link.click();
              }} title="baixa o .srt da versão salva (tempo de saída)">
              baixar .srt
            </Button>
            <Button small onClick={() => {
                api.srtSave(project.slug, project.latest ?? undefined).then(
                  (saved) => toast(`.srt gravado em ${saved.path}`, 'ok', 7000),
                  (error: unknown) => toast(`.srt falhou: ${error instanceof Error ? error.message : String(error)}`, 'error'),
                );
              }} title="grava o .srt da versão salva ao lado do render (final > preview; sem render, em renders/)">
              gravar .srt
            </Button>
            <Button small onClick={() => file.current?.click()}>
              importar .srt
            </Button>
            <input
              ref={file}
              type="file"
              accept=".srt"
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (picked) void picked.text().then(importSrt);
                event.target.value = '';
              }}
            />
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Badge tone={edl.captions.enabled ? 'emerald' : 'coral'}>{edl.captions.enabled ? 'ligadas' : 'desligadas'}</Badge>
          <Badge>{edl.captions.preset}</Badge>
          <Badge>até {edl.captions.maxWordsPerPage} palavras/página</Badge>
          <Badge tone="peach">{Object.keys(edl.captions.replacements).length} correções</Badge>
          <Badge tone="coral">{edl.captions.highlights.length} destaques</Badge>
        </div>
        <input className={inputClass} placeholder="buscar palavra…" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <p className="mt-1.5 text-[10px] text-s300/50">Duplo clique edita (vale para toda ocorrência da palavra) · ★ destaca · o .srt exportado vai com a vinheta de abertura.</p>
      </Section>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-1">
        {shown.map((page) => {
          const index = pages.indexOf(page);
          return (
            <div key={page.words[0]!.index} className={`mb-0.5 flex gap-2 rounded px-1.5 py-1 ${index === active ? 'bg-coral/10 ring-1 ring-coral/40' : 'hover:bg-paper/[0.03]'}`}>
              <span className="w-10 shrink-0 pt-0.5 font-mono text-[10px] text-s600">{page.outputStart.toFixed(1)}</span>
              <div className="flex flex-wrap gap-x-1 gap-y-1.5">
                {page.words.map((word) => (
                  <WordChip key={word.index} word={word} focused={focusWord === word.index} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
