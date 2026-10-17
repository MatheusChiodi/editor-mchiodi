import { describe, expect, it } from 'vitest';

import { formatBody, formatLatency, statusColor, statusLabel, statusTone } from '../motion/src/components/ApiRequest.tsx';
import { flowSchedule, flowSegments, linkPoint, mapLayout, packetAt } from '../motion/src/components/ArchitectureMap.tsx';
import { pageStart, splitUrl, typedUrlChars, URL_START_SEC } from '../motion/src/components/BrowserFrame.tsx';
import { clip, fitWire, monoColumns, WIRE_GAP, WIRE_HEIGHT } from '../motion/src/components/c2-kit.tsx';
import { columnAligns, formatCell, isNumericCell, tableLayout } from '../motion/src/components/DataTable.tsx';
import {
  collapseContext,
  diffLines,
  diffMode,
  diffStats,
  diffTimeline,
  resolveLanguage,
  splitSides,
} from '../motion/src/components/DiffCard.tsx';
import { frameWindow, parseFrame, tailClip } from '../motion/src/components/ErrorTrace.tsx';
import { buildTree, limitRows, rowRoom } from '../motion/src/components/FileTree.tsx';
import { edgeDrawStart, graphEdgePath, GRAPH, layoutGitGraph, nodePoint } from '../motion/src/components/GitGraph.tsx';
import { groupC2 } from '../motion/src/components/index-c2.ts';
import { highlightedLines, jsonLines, lineWindow, normalizePath, parseJsonLines } from '../motion/src/components/JsonViewer.tsx';
import { keyDepth, keyLabel, keyWidth, pressTimes, rowScale } from '../motion/src/components/KeyboardShortcut.tsx';
import { PHONE, phonePosition } from '../motion/src/components/PhoneFrame.tsx';
import { activeLayer, buildTimes, stackLayout } from '../motion/src/components/StackLayers.tsx';
import { cursorState, terminalTimeline, visibleChars, visibleWindow } from '../motion/src/components/Terminal.tsx';

const CANVAS = { width: 1920, height: 1080 };
const SAFE = { x: 96, y: 64 };

describe('groupC2', () => {
  const names = [
    'Terminal',
    'BrowserFrame',
    'PhoneFrame',
    'FileTree',
    'ApiRequest',
    'ErrorTrace',
    'KeyboardShortcut',
    'GitGraph',
    'StackLayers',
    'ArchitectureMap',
    'DataTable',
    'JsonViewer',
    'DiffCard',
  ];

  it('tem os 13 componentes', () => {
    expect(Object.keys(groupC2).sort()).toEqual([...names].sort());
  });

  it.each(names)('%s tem componente, sample, duração e descrição', (name) => {
    const entry = groupC2[name]!;
    expect(typeof entry.component).toBe('function');
    expect(Object.keys(entry.sample).length).toBeGreaterThan(0);
    expect(entry.defaultDuration).toBeGreaterThan(0);
    expect(entry.description.length).toBeGreaterThan(20);
  });
});

describe('c2-kit', () => {
  it('clip corta com reticências sem passar do limite', () => {
    expect(clip('abcdef', 6)).toBe('abcdef');
    expect(clip('abcdefg', 6)).toBe('abcde…');
    expect(clip('abc', 0)).toBe('');
  });

  it('monoColumns conta colunas inteiras e nunca devolve zero', () => {
    expect(monoColumns(600, 20)).toBe(50);
    expect(monoColumns(5, 40)).toBe(1);
  });

  it('fitWire mantém as alturas naturais quando cabe', () => {
    const layout = fitWire([{ kind: 'heading' }, { kind: 'button' }], 600);
    expect(layout.scale).toBe(1);
    expect(layout.heights).toEqual([WIRE_HEIGHT.heading, WIRE_HEIGHT.button]);
  });

  it('fitWire limita a quantidade e comprime a imagem antes do resto', () => {
    const blocks = [{ kind: 'heading' }, { kind: 'image' }, { kind: 'text' }, { kind: 'button' }] as const;
    const natural = WIRE_HEIGHT.heading + WIRE_HEIGHT.image + WIRE_HEIGHT.text + WIRE_HEIGHT.button + WIRE_GAP * 3;
    const layout = fitWire(blocks, natural - 60);
    expect(layout.scale).toBe(1);
    expect(layout.heights[1]).toBeCloseTo(WIRE_HEIGHT.image - 60);
    expect(layout.heights[0]).toBe(WIRE_HEIGHT.heading);
    expect(fitWire(Array.from({ length: 9 }, () => ({ kind: 'text' as const })), 5000, 6).blocks).toHaveLength(6);
  });

  it('fitWire encolhe tudo quando só a imagem não resolve, cabendo no espaço', () => {
    const blocks = Array.from({ length: 6 }, () => ({ kind: 'list' as const }));
    const available = 500;
    const layout = fitWire(blocks, available);
    expect(layout.scale).toBeLessThan(1);
    const gaps = WIRE_GAP * layout.scale * 5;
    expect(layout.heights.reduce((sum, height) => sum + height, 0) + gaps).toBeLessThanOrEqual(available + 0.001);
  });
});

describe('Terminal', () => {
  const lines = [
    { text: 'npm run build', kind: 'command' as const },
    { text: 'building...', kind: 'output' as const },
    { text: 'ok', kind: 'success' as const },
    { text: 'npm test' },
  ];

  it('comando leva tempo proporcional ao tamanho; saída é instantânea', () => {
    const timeline = terminalTimeline(lines, 30, 13);
    expect(timeline[0]!.end - timeline[0]!.start).toBeCloseTo(1, 2);
    expect(timeline[1]!.end).toBe(timeline[1]!.start);
    expect(timeline[1]!.start).toBeGreaterThan(timeline[0]!.end);
  });

  it('a linha do tempo nunca volta e cabe em 70% da duração', () => {
    const long = Array.from({ length: 20 }, () => ({ text: 'x'.repeat(60) }));
    const timeline = terminalTimeline(long, 6);
    timeline.forEach((timing, index) => {
      expect(timing.end).toBeGreaterThanOrEqual(timing.start);
      if (index) expect(timing.start).toBeGreaterThanOrEqual(timeline[index - 1]!.end);
    });
    expect(timeline.at(-1)!.end).toBeLessThanOrEqual(6 * 0.7 + 0.001);
  });

  it('typeSpeed inválido cai no padrão', () => {
    expect(terminalTimeline(lines, 30, 0)).toEqual(terminalTimeline(lines, 30));
  });

  it('visibleChars cresce linearmente no comando e é tudo-ou-nada na saída', () => {
    const timing = { start: 1, end: 3 };
    const command = { text: '1234567890' };
    expect(visibleChars(command, timing, 0.5)).toBe(0);
    expect(visibleChars(command, timing, 2)).toBe(5);
    expect(visibleChars(command, timing, 9)).toBe(10);
    const output = { text: 'pronto', kind: 'output' as const };
    expect(visibleChars(output, { start: 2, end: 2 }, 1.9)).toBe(0);
    expect(visibleChars(output, { start: 2, end: 2 }, 2)).toBe(6);
  });

  it('visibleWindow rola para as últimas linhas', () => {
    const timeline = Array.from({ length: 6 }, (_, index) => ({ start: index, end: index }));
    expect(visibleWindow(timeline, -1, 3)).toEqual({ first: 0, last: -1 });
    expect(visibleWindow(timeline, 1.5, 3)).toEqual({ first: 0, last: 1 });
    expect(visibleWindow(timeline, 4.2, 3)).toEqual({ first: 2, last: 4 });
  });

  it('cursorState acompanha a linha em digitação', () => {
    const timeline = terminalTimeline(lines, 30, 13);
    expect(cursorState(lines, timeline, 0)).toEqual({ line: -1, typing: false });
    expect(cursorState(lines, timeline, timeline[0]!.start + 0.2)).toEqual({ line: 0, typing: true });
    expect(cursorState(lines, timeline, timeline[2]!.start + 0.01)).toEqual({ line: 2, typing: false });
  });
});

describe('BrowserFrame', () => {
  it('splitUrl separa host e caminho e trata o protocolo como cadeado', () => {
    expect(splitUrl('https://mchiodi.com/projetos?x=1')).toEqual({ secure: true, host: 'mchiodi.com', path: '/projetos?x=1' });
    expect(splitUrl('http://localhost:5173/')).toEqual({ secure: false, host: 'localhost:5173', path: '' });
    expect(splitUrl('mchiodi.com')).toEqual({ secure: true, host: 'mchiodi.com', path: '' });
    expect(splitUrl('localhost:3000/api').secure).toBe(false);
  });

  it('typedUrlChars começa em zero, cresce e termina no tamanho total', () => {
    expect(typedUrlChars(20, URL_START_SEC - 0.01)).toBe(0);
    const middle = typedUrlChars(20, URL_START_SEC + 0.2);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(20);
    expect(typedUrlChars(20, 5)).toBe(20);
    expect(typedUrlChars(0, 5)).toBe(0);
  });

  it('a página só carrega depois do endereço, e endereço longo não atrasa mais que 0.9s', () => {
    expect(pageStart(10)).toBeGreaterThan(URL_START_SEC);
    expect(pageStart(500)).toBeCloseTo(URL_START_SEC + 0.9 + 0.15);
    expect(typedUrlChars(500, pageStart(500))).toBe(500);
  });
});

describe('PhoneFrame', () => {
  it('fica dentro da margem segura dos dois lados e centrado na vertical', () => {
    const left = phonePosition('left', CANVAS);
    const right = phonePosition('right', CANVAS);
    expect(left.x).toBeGreaterThanOrEqual(SAFE.x);
    expect(right.x + PHONE.width).toBeLessThanOrEqual(CANVAS.width - SAFE.x);
    expect(left.x).toBe(CANVAS.width - right.x - PHONE.width);
    expect(left.y).toBe((CANVAS.height - PHONE.height) / 2);
    expect(left.y).toBeGreaterThanOrEqual(SAFE.y);
  });
});

describe('FileTree', () => {
  it('cria as pastas intermediárias e indenta pelo caminho', () => {
    const rows = buildTree([{ path: 'src/edl/schema.ts', highlight: true, note: 'fonte' }, { path: 'src/index.ts' }, { path: 'package.json' }]);
    expect(rows.map((row) => `${row.depth}:${row.name}${row.isDir ? '/' : ''}`)).toEqual([
      '1:src/',
      '2:edl/',
      '3:schema.ts',
      '2:index.ts',
      '1:package.json',
    ]);
    expect(rows[2]).toMatchObject({ highlight: true, note: 'fonte', item: 0 });
    expect(rows[0]!.highlight).toBe(false);
  });

  it('pasta implícita herda o item que a trouxe; pasta explícita termina em /', () => {
    const rows = buildTree([{ path: 'a.ts' }, { path: 'lib/util/x.ts' }, { path: 'vazia/' }, { path: 'lib\\y.ts' }]);
    expect(rows.find((row) => row.name === 'lib')!.item).toBe(1);
    expect(rows.find((row) => row.name === 'vazia')).toMatchObject({ isDir: true, depth: 1 });
    expect(rows.find((row) => row.name === 'y.ts')).toMatchObject({ depth: 2, item: 3 });
  });

  it('marca o último filho e as linhas guia que continuam', () => {
    const rows = buildTree([{ path: 'a/b/c.ts' }, { path: 'a/d.ts' }, { path: 'e.ts' }]);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName.a!.last).toBe(false);
    expect(byName.b!.last).toBe(false);
    expect(byName['d.ts']!.last).toBe(true);
    expect(byName['e.ts']!.last).toBe(true);
    // c.ts está dentro de a (que tem irmão depois) e de b (que também tem)
    expect(byName['c.ts']!.guides).toEqual([true, true]);
    expect(byName['d.ts']!.guides).toEqual([true]);
  });

  it('não duplica caminho repetido e junta as marcações', () => {
    const rows = buildTree([{ path: 'a.ts' }, { path: 'a.ts', highlight: true }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.highlight).toBe(true);
  });

  it('limitRows reserva a última linha para o contador', () => {
    const rows = buildTree(Array.from({ length: 20 }, (_, index) => ({ path: `f${index}.ts` })));
    const limited = limitRows(rows, 8);
    expect(limited.rows).toHaveLength(7);
    expect(limited.hidden).toBe(13);
    expect(limitRows(rows.slice(0, 8), 8)).toEqual({ rows: rows.slice(0, 8), hidden: 0 });
  });

  it('rowRoom dá prioridade ao nome e some com a nota que não cabe', () => {
    expect(rowRoom(10, 0, 600)).toEqual({ nameChars: 33, noteChars: 0 });
    const roomy = rowRoom(10, 12, 600);
    expect(roomy).toEqual({ nameChars: 10, noteChars: 12 });
    const squeezed = rowRoom(40, 30, 500);
    expect(squeezed.nameChars).toBeLessThan(40);
    expect(squeezed.noteChars).toBeGreaterThanOrEqual(8);
    expect(squeezed.nameChars * 18 + squeezed.noteChars * 24 * 0.56 + 56).toBeLessThanOrEqual(500);
    expect(rowRoom(40, 30, 150).noteChars).toBe(0);
  });
});

describe('ApiRequest', () => {
  it('classifica o status por família', () => {
    expect([200, 204, 301, 404, 429, 500, 503, 99].map(statusTone)).toEqual([
      'success',
      'success',
      'redirect',
      'warning',
      'warning',
      'error',
      'error',
      'info',
    ]);
  });

  it('2xx é emerald, 4xx amber, 5xx rose', () => {
    expect(statusColor(201)).toBe('#34d399');
    expect(statusColor(404)).toBe('#fbbf24');
    expect(statusColor(500)).toBe('#fb7185');
    expect(statusColor(201)).not.toBe(statusColor(302));
  });

  it('statusLabel usa o nome conhecido ou só o número', () => {
    expect(statusLabel(404)).toBe('404 Not Found');
    expect(statusLabel(201)).toBe('201 Created');
    expect(statusLabel(418)).toBe('418');
  });

  it('formatLatency troca de unidade em 1s', () => {
    expect(formatLatency(142.4)).toBe('142 ms');
    expect(formatLatency(1240)).toBe('1,2 s');
    expect(formatLatency(12_480)).toBe('12 s');
    expect(formatLatency(-1)).toBe('');
  });

  it('formatBody reidenta JSON, preserva texto comum e limita as linhas', () => {
    expect(formatBody('{"a":1,"b":[true]}')).toEqual(['{', '  "a": 1,', '  "b": [', '    true', '  ]', '}']);
    expect(formatBody('nome=Matheus\n\tativo=1')).toEqual(['nome=Matheus', '  ativo=1']);
    expect(formatBody('   ')).toEqual([]);
    expect(formatBody(undefined)).toEqual([]);
    const long = formatBody(JSON.stringify(Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`k${index}`, index]))), 6);
    expect(long).toHaveLength(6);
    expect(long.at(-1)).toBe('…');
  });
});

describe('ErrorTrace', () => {
  it('parseFrame entende os formatos comuns de stack', () => {
    expect(parseFrame('    at renderRows (src/TaskList.tsx:24:18)')).toEqual({ fn: 'renderRows', location: 'src/TaskList.tsx:24:18' });
    expect(parseFrame('at async Foo.bar (C:\\app\\foo.js:1:2)')).toEqual({ fn: 'async Foo.bar', location: 'C:\\app\\foo.js:1:2' });
    expect(parseFrame('at src/index.ts:3:1')).toEqual({ fn: '', location: 'src/index.ts:3:1' });
    expect(parseFrame('render@http://localhost/app.js:10:5')).toEqual({ fn: 'render', location: 'http://localhost/app.js:10:5' });
    expect(parseFrame('main')).toEqual({ fn: 'main', location: '' });
  });

  it('tailClip preserva o fim do caminho', () => {
    expect(tailClip('src/a.ts:1:2', 20)).toBe('src/a.ts:1:2');
    expect(tailClip('node_modules/x/y/z.js:10:5', 10)).toBe('…z.js:10:5');
    expect(tailClip('abc', 0)).toBe('');
  });

  it('frameWindow sempre inclui a linha culpada', () => {
    const frames = Array.from({ length: 10 }, (_, index) => `f${index}`);
    expect(frameWindow(frames, 0, 4)).toEqual({ frames: ['f0', 'f1', 'f2', 'f3'], highlight: 0 });
    const deep = frameWindow(frames, 7, 4);
    expect(deep.frames).toHaveLength(4);
    expect(deep.frames[deep.highlight]).toBe('f7');
    expect(frameWindow(frames, 99, 4).highlight).toBe(-1);
    expect(frameWindow(frames, undefined, 4).highlight).toBe(-1);
    expect(frameWindow(['a'], 0, 4)).toEqual({ frames: ['a'], highlight: 0 });
  });
});

describe('KeyboardShortcut', () => {
  it('keyLabel normaliza apelidos e letras', () => {
    expect(['control', 'CMD', 'p', ' ', 'F5', 'escape'].map(keyLabel)).toEqual(['Ctrl', 'Cmd', 'P', 'Espaço', 'F5', 'Esc']);
  });

  it('tecla de um caractere é quadrada; nomes longos alargam', () => {
    expect(keyWidth('P', 136)).toBe(136);
    expect(keyWidth('Backspace', 136)).toBeGreaterThan(keyWidth('Ctrl', 136));
  });

  it('as teclas descem em sequência e soltam juntas', () => {
    const times = pressTimes(3);
    expect(times[1]! - times[0]!).toBeCloseTo(0.3);
    const afterSecond = times[1]! + 0.15;
    expect(keyDepth(0, 3, afterSecond)).toBe(1);
    expect(keyDepth(1, 3, afterSecond)).toBe(1);
    expect(keyDepth(2, 3, afterSecond)).toBe(0);
    const held = times[2]! + 0.5;
    expect([0, 1, 2].map((index) => keyDepth(index, 3, held))).toEqual([1, 1, 1]);
    expect([0, 1, 2].map((index) => keyDepth(index, 3, 10))).toEqual([0, 0, 0]);
    const releasing = times[2]! + 0.1 + 0.75 + 0.08;
    const depths = [0, 1, 2].map((index) => keyDepth(index, 3, releasing));
    expect(depths[0]).toBeGreaterThan(0);
    expect(depths[0]).toBeLessThan(1);
    expect(new Set(depths).size).toBe(1);
    expect(keyDepth(5, 3, held)).toBe(0);
  });

  it('rowScale só encolhe quando a fileira não cabe', () => {
    expect(rowScale(['Ctrl', 'P'], 1728)).toBe(1);
    const labels = ['Ctrl', 'Shift', 'Alt', 'Backspace', 'K'];
    const scale = rowScale(labels, 600);
    expect(scale).toBeLessThan(1);
    const total = labels.reduce((sum, label) => sum + keyWidth(label), 0) + 64 * 4;
    expect(total * scale).toBeCloseTo(600);
  });
});

describe('GitGraph', () => {
  const commits = [
    { id: 'a', message: 'init', branch: 'main' },
    { id: 'b', message: 'login', branch: 'feature' },
    { id: 'c', message: 'fix', branch: 'feature' },
    { id: 'd', message: 'deps', branch: 'main' },
    { id: 'e', message: 'merge', branch: 'main', merge: 'feature' },
  ];

  it('dá uma raia por branch na ordem de aparição', () => {
    const layout = layoutGitGraph(commits);
    expect(layout.lanes).toEqual(['main', 'feature']);
    expect(layout.nodes.map((node) => node.lane)).toEqual([0, 1, 1, 0, 0]);
    expect(layout.nodes.map((node) => node.opensBranch)).toEqual([true, true, false, false, false]);
    expect(layout.nodes[4]!.isMerge).toBe(true);
  });

  it('liga pai e filho, abre a branch a partir da main e fecha no merge', () => {
    const { edges } = layoutGitGraph(commits);
    const summary = edges.map((edge) => `${edge.from}>${edge.to}:${edge.kind}:${edge.colorLane}`);
    expect(summary).toEqual(['0>1:branch:1', '1>2:straight:1', '0>3:straight:0', '3>4:straight:0', '2>4:merge:1']);
  });

  it('branches além da terceira dividem a última raia e o total de commits é limitado', () => {
    const many = ['main', 'a', 'b', 'c'].map((branch, index) => ({ id: String(index), message: 'm', branch }));
    const layout = layoutGitGraph(many);
    expect(layout.lanes).toEqual(['main', 'a', 'b']);
    expect(layout.nodes[3]!.lane).toBe(2);
    expect(layoutGitGraph(Array.from({ length: 20 }, (_, index) => ({ id: String(index), message: 'm', branch: 'main' }))).nodes).toHaveLength(8);
  });

  it('merge de branch inexistente ou da própria branch não cria ligação', () => {
    const layout = layoutGitGraph([
      { id: 'a', message: 'x', branch: 'main' },
      { id: 'b', message: 'y', branch: 'main', merge: 'fantasma' },
      { id: 'c', message: 'z', branch: 'main', merge: 'main' },
    ]);
    expect(layout.edges).toHaveLength(2);
    expect(layout.nodes.some((node) => node.isMerge)).toBe(false);
  });

  it('graphEdgePath começa na origem e termina no destino', () => {
    const { edges } = layoutGitGraph(commits);
    for (const edge of edges) {
      const a = nodePoint(edge.from, edge.fromLane);
      const b = nodePoint(edge.to, edge.toLane);
      const path = graphEdgePath(edge);
      expect(path.startsWith(`M ${a.x} ${a.y}`)).toBe(true);
      expect(path.endsWith(`${b.x} ${b.y}`)).toBe(true);
      expect(path.includes('C')).toBe(edge.kind !== 'straight');
    }
    // o merge de 2 para 4 desce reto pela raia da feature antes de curvar
    expect(graphEdgePath(edges[4]!)).toContain(` L ${nodePoint(2, 1).x} ${nodePoint(4, 0).y - GRAPH.row}`);
  });

  it('a ligação chega junto com o commit de destino, sem sair antes da origem', () => {
    expect(edgeDrawStart(1, 3)).toBeCloseTo(2.6);
    expect(edgeDrawStart(2.9, 3)).toBe(2.9);
  });
});

describe('StackLayers', () => {
  it('empilha de cima para baixo, centrado e dentro da margem', () => {
    const { slabs, scale } = stackLayout(4, CANVAS, true);
    expect(scale).toBe(1);
    expect(slabs).toHaveLength(4);
    slabs.forEach((slab, index) => {
      if (index) expect(slab.y).toBeGreaterThan(slabs[index - 1]!.y + slabs[index - 1]!.height);
      expect(slab.x).toBeGreaterThanOrEqual(SAFE.x);
      expect(slab.x + slab.width + slab.depth).toBeLessThanOrEqual(CANVAS.width - SAFE.x);
    });
    const first = slabs[0]!;
    expect(first.x + (first.width + first.depth) / 2).toBeCloseTo(CANVAS.width / 2);
    expect(first.y - first.depth).toBeGreaterThanOrEqual(SAFE.y);
    expect(slabs.at(-1)!.y + slabs.at(-1)!.height).toBeLessThanOrEqual(CANVAS.height - SAFE.y);
  });

  it('limita a 5 camadas e encolhe quando a tela é baixa', () => {
    expect(stackLayout(9, CANVAS).slabs).toHaveLength(5);
    expect(stackLayout(0, CANVAS).slabs).toEqual([]);
    const tight = stackLayout(5, { width: 1920, height: 600 }, true);
    expect(tight.scale).toBeLessThan(1);
    expect(tight.slabs.at(-1)!.y + tight.slabs.at(-1)!.height).toBeLessThanOrEqual(600 - SAFE.y + 0.001);
  });

  it('monta de baixo para cima', () => {
    const times = buildTimes(3);
    expect(times[2]).toBeLessThan(times[1]!);
    expect(times[1]).toBeLessThan(times[0]!);
  });

  it('activeLayer rejeita índice fora da pilha', () => {
    expect(activeLayer(1, 3)).toBe(1);
    expect(activeLayer(3, 3)).toBe(-1);
    expect(activeLayer(undefined, 3)).toBe(-1);
    expect(activeLayer(1.5, 3)).toBe(-1);
  });
});

describe('ArchitectureMap', () => {
  it('a consulta ao banco é ida e volta', () => {
    expect(flowSegments(['request', 'query', 'response']).map((segment) => `${segment.from}>${segment.to}`)).toEqual(['0>1', '1>2', '2>1', '1>0']);
    expect(flowSegments().length).toBe(4);
    expect(flowSegments([])).toEqual([]);
  });

  it('o ritmo é comprimido para o percurso caber no overlay', () => {
    const relaxed = flowSchedule(4, 20);
    expect(relaxed.travel).toBe(0.75);
    const tight = flowSchedule(8, 5);
    expect(tight.travel).toBeLessThan(0.75);
    expect(tight.start + 8 * (tight.travel + tight.pause)).toBeLessThanOrEqual(5 - 0.5 + 0.001);
  });

  it('packetAt percorre os trechos em ordem e some no fim', () => {
    const schedule = { start: 1, travel: 0.8, pause: 0.2 };
    expect(packetAt(3, schedule, 0.5)).toBeNull();
    expect(packetAt(3, schedule, 1.4)!.segment).toBe(0);
    expect(packetAt(3, schedule, 1.4)!.progress).toBeCloseTo(0.5);
    expect(packetAt(3, schedule, 1.9)).toEqual({ segment: 0, progress: 1 });
    expect(packetAt(3, schedule, 3.4)!.segment).toBe(2);
    expect(packetAt(3, schedule, 4.01)).toBeNull();
    expect(packetAt(0, schedule, 2)).toBeNull();
  });

  it('os nós ficam centrados e o pacote anda entre as bordas', () => {
    const boxes = mapLayout(CANVAS);
    expect(boxes).toHaveLength(3);
    expect(boxes[0]!.x).toBeGreaterThanOrEqual(SAFE.x);
    expect(boxes[0]!.x).toBeCloseTo(CANVAS.width - boxes[2]!.x - boxes[2]!.width);
    expect(mapLayout(CANVAS, true)[0]!.y).toBeLessThan(boxes[0]!.y);
    const start = linkPoint(boxes, 0, 1, 0);
    const end = linkPoint(boxes, 0, 1, 1);
    expect(start.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width);
    expect(end.x).toBeLessThan(boxes[1]!.x);
    // a volta percorre o mesmo trecho no sentido contrário
    expect(linkPoint(boxes, 1, 0, 0)).toEqual(end);
    expect(linkPoint(boxes, 1, 0, 1)).toEqual(start);
  });
});

describe('DataTable', () => {
  it('reconhece números e valores com unidade', () => {
    expect([12, '1.240', '98%', 'R$ 12,90', '140 ms', '-3,5', '0,3 s'].every(isNumericCell)).toBe(true);
    expect(['Vite 7', '', 'v1.2.3', 'gru1', undefined, Number.NaN].some(isNumericCell)).toBe(false);
  });

  it('formata número em pt-BR e deixa texto como está', () => {
    expect(formatCell(3000000)).toBe('3.000.000');
    expect(formatCell(1.5)).toBe('1,5');
    expect(formatCell('Vite')).toBe('Vite');
    expect(formatCell(undefined)).toBe('');
  });

  it('alinha à direita só colunas totalmente numéricas', () => {
    const rows = [
      ['Vite', 6.4, '0,3 s', 'ok'],
      ['Webpack', 38.2, '', 12],
    ];
    expect(columnAligns(4, rows)).toEqual(['left', 'right', 'right', 'left']);
    expect(columnAligns(1, [])).toEqual(['left']);
  });

  it('usa o maior corpo que cabe e encolhe as colunas no pior caso', () => {
    const roomy = tableLayout(['A', 'B'], [['Vite', 1]], 1600);
    expect(roomy.fontSize).toBe(36);
    expect(roomy.total).toBe(roomy.widths.reduce((sum, width) => sum + width, 0));
    const wide = ['Serviço', 'Plano', 'Requisições', 'Latência', 'Preço', 'Região'];
    const rows = [wide.map(() => 'x'.repeat(30))];
    const tight = tableLayout(wide, rows, 1600);
    expect(tight.fontSize).toBe(26);
    expect(tight.widths.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(1600);
  });

  it('o cabeçalho também conta na largura da coluna', () => {
    const layout = tableLayout(['Requisições por mês', 'B'], [['1', '2']], 1600);
    expect(layout.widths[0]).toBeGreaterThan(layout.widths[1]! * 2);
  });
});

describe('JsonViewer', () => {
  const value = { user: { name: 'Ana', tags: ['a', 'b'] }, ok: true, empty: {} };

  it('normalizePath unifica as notações', () => {
    expect(normalizePath('user.name')).toBe('user.name');
    expect(normalizePath('$.items[0].id')).toBe('items.0.id');
    expect(normalizePath('["a"]["b c"]')).toBe('a.b c');
    expect(normalizePath('  ')).toBe('');
  });

  it('jsonLines reidenta e guarda o caminho de cada linha', () => {
    const lines = jsonLines(value);
    expect(lines.map((line) => line.text)).toEqual([
      '{',
      '  "user": {',
      '    "name": "Ana",',
      '    "tags": [',
      '      "a",',
      '      "b"',
      '    ]',
      '  },',
      '  "ok": true,',
      '  "empty": {}',
      '}',
    ]);
    expect(lines.map((line) => line.path)).toEqual(['', 'user', 'user.name', 'user.tags', 'user.tags.0', 'user.tags.1', 'user.tags', 'user', 'ok', 'empty', '']);
    expect(lines.map((line) => line.text).join('\n')).toBe(JSON.stringify(value, null, 2));
  });

  it('collapsedDepth fecha objetos e listas a partir da profundidade', () => {
    expect(jsonLines(value, 1).map((line) => line.text)).toEqual(['{', '  "user": { … },', '  "ok": true,', '  "empty": {}', '}']);
    expect(jsonLines(value, 0)).toEqual([{ text: '{ … }', path: '' }]);
    expect(jsonLines([1, [2]], 1).map((line) => line.text)).toEqual(['[', '  1,', '  [ … ]', ']']);
  });

  it('highlightedLines pega a chave e tudo dentro dela', () => {
    const lines = jsonLines(value);
    expect(highlightedLines(lines, 'user.name')).toEqual([2]);
    expect(highlightedLines(lines, 'user.tags')).toEqual([3, 4, 5, 6]);
    expect(highlightedLines(lines, 'user.tags[1]')).toEqual([5]);
    expect(highlightedLines(lines, 'us')).toEqual([]);
    expect(highlightedLines(lines, undefined)).toEqual([]);
  });

  it('JSON inválido vira texto puro, sem caminhos', () => {
    const parsed = parseJsonLines('{ nome: "sem aspas" }\n');
    expect(parsed.valid).toBe(false);
    expect(parsed.lines).toEqual([{ text: '{ nome: "sem aspas" }', path: '' }]);
    expect(parseJsonLines('[1]').valid).toBe(true);
  });

  it('lineWindow desce até o destaque caber', () => {
    expect(lineWindow(8, 10, [7])).toEqual({ start: 0, end: 8 });
    expect(lineWindow(30, 10)).toEqual({ start: 0, end: 10 });
    expect(lineWindow(30, 10, [4])).toEqual({ start: 0, end: 10 });
    const deep = lineWindow(30, 10, [20, 21]);
    expect(deep.end - deep.start).toBe(10);
    expect(deep.start).toBeLessThanOrEqual(20);
    expect(deep.end).toBeGreaterThan(21);
    const last = lineWindow(30, 10, [29]);
    expect(last).toEqual({ start: 20, end: 30 });
  });
});

describe('DiffCard', () => {
  const before = ['a', 'b', 'c', 'd'];
  const after = ['a', 'B', 'c', 'd', 'e'];

  it('diffLines marca removidas antes das adicionadas e preserva as iguais', () => {
    expect(diffLines(before, after).map((row) => `${row.kind[0]}:${row.text}`)).toEqual(['s:a', 'r:b', 'a:B', 's:c', 's:d', 'a:e']);
  });

  it('aplicar o diff reconstrói os dois lados', () => {
    const rows = diffLines(['x', 'y', 'z', 'w'], ['y', 'q', 'w', 'z']);
    expect(rows.filter((row) => row.kind !== 'added').map((row) => row.text)).toEqual(['x', 'y', 'z', 'w']);
    expect(rows.filter((row) => row.kind !== 'removed').map((row) => row.text)).toEqual(['y', 'q', 'w', 'z']);
  });

  it('casos de borda: iguais, vazio e troca total', () => {
    expect(diffStats(diffLines(before, before))).toEqual({ added: 0, removed: 0 });
    expect(diffLines([], ['a']).map((row) => row.kind)).toEqual(['added']);
    expect(diffStats(diffLines(['a', 'b'], ['c']))).toEqual({ added: 1, removed: 2 });
  });

  it('collapseContext esconde o que está longe das mudanças', () => {
    const long = Array.from({ length: 20 }, (_, index) => `l${index}`);
    const changed = [...long];
    changed[10] = 'novo';
    const rows = collapseContext(diffLines(long, changed), 8);
    expect(rows.map((row) => (row.kind === 'gap' ? `gap${row.hidden}` : row.text))).toEqual(['gap9', 'l9', 'l10', 'novo', 'l11', 'gap8']);
    expect(collapseContext(diffLines(before, after), 12)).toEqual(diffLines(before, after));
  });

  it('collapseContext corta o excesso e conta o que ficou de fora', () => {
    const rows = collapseContext(diffLines([], Array.from({ length: 30 }, (_, index) => `n${index}`)), 6);
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toEqual({ kind: 'gap', text: '', hidden: 25 });
  });

  it('splitSides põe o bloco removido de frente para o adicionado', () => {
    const { left, right } = splitSides(diffLines(before, after));
    expect(left.map((row) => row?.text ?? null)).toEqual(['a', 'b', 'c', 'd', null]);
    expect(right.map((row) => row?.text ?? null)).toEqual(['a', 'B', 'c', 'd', 'e']);
    expect(left).toHaveLength(right.length);
  });

  it('diffMode escolhe lado a lado só para diffs curtos com os dois lados', () => {
    expect(diffMode(diffLines(before, after))).toBe('split');
    expect(diffMode(diffLines(before, [...before, 'e']))).toBe('unified');
    expect(diffMode(diffLines(['x'.repeat(60)], ['y'.repeat(60)]))).toBe('unified');
    const many = Array.from({ length: 14 }, (_, index) => `l${index}`);
    expect(diffMode(diffLines(many, [...many.slice(1), 'z']))).toBe('unified');
  });

  it('diffTimeline: antes → removidas → adicionadas, com folga proporcional à duração', () => {
    const short = diffTimeline(5, 4);
    expect(short.removedAt).toBeCloseTo(1);
    expect(short.addedAt).toBeCloseTo(1.6);
    const long = diffTimeline(5, 12);
    expect(long.removedAt).toBeCloseTo(2.4);
    expect(long.addedAt).toBeGreaterThan(long.removedAt + 1.5);
    expect(diffTimeline(40, 4).removedAt).toBeGreaterThan(3);
  });

  it('resolveLanguage aceita apelidos e cai em ts', () => {
    expect(resolveLanguage('TypeScript')).toBe('ts');
    expect(resolveLanguage('py')).toBe('python');
    expect(resolveLanguage('sql')).toBe('sql');
    expect(resolveLanguage('cobol')).toBe('ts');
    expect(resolveLanguage()).toBe('ts');
  });
});
