import type { Rect } from '../../motion/src/thumbnail/layout.ts';
import { formatChapter, formatClock } from '../lib/time.ts';

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const CONTACT = { columns: 3, cellWidth: 480, cellHeight: 270, gap: 12, label: 40 } as const;

export interface ContactGrid {
  width: number;
  height: number;
  /** o quadro inteiro */
  cells: Rect[];
  /** ao lado dele, o recorte ampliado do rosto: é onde se vê expressão e olho fechado */
  faces: Rect[];
}

/** Grade da folha de contato: `count` quadros numerados, cada um com o recorte do rosto ao lado. */
export function contactGrid(count: number, columns: number = CONTACT.columns): ContactGrid {
  const cols = Math.max(1, Math.min(columns, count));
  const rows = Math.max(1, Math.ceil(count / cols));
  const step = CONTACT.cellWidth + CONTACT.cellHeight + CONTACT.gap;
  const cells = Array.from({ length: count }, (_, index) => ({
    x: CONTACT.gap + (index % cols) * step,
    y: CONTACT.gap + Math.floor(index / cols) * (CONTACT.cellHeight + CONTACT.label + CONTACT.gap),
    width: CONTACT.cellWidth,
    height: CONTACT.cellHeight,
  }));
  return {
    width: CONTACT.gap + cols * step,
    height: CONTACT.gap + rows * (CONTACT.cellHeight + CONTACT.label + CONTACT.gap),
    cells,
    faces: cells.map((cell) => ({ x: cell.x + cell.width, y: cell.y, width: CONTACT.cellHeight, height: CONTACT.cellHeight })),
  };
}

export interface ContactItem {
  index: number;
  at: number;
  score: number;
  /** centro do rosto (0–1), quando houve palpite */
  focus?: { x: number; y: number } | null;
}

/** Números grandes sobre cada quadro (é por eles que o agente escolhe) e, embaixo, o instante e a nota. */
export function contactSvg(grid: ContactGrid, items: ContactItem[]): string {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${grid.width}" height="${grid.height}" font-family="Segoe UI, Arial, sans-serif">`];
  items.forEach((item, position) => {
    const cell = grid.cells[position];
    if (!cell) return;
    parts.push(
      `<rect x="${cell.x}" y="${cell.y}" width="76" height="56" fill="#ff5555"/>`,
      `<text x="${cell.x + 38}" y="${cell.y + 42}" fill="#ffffff" font-size="38" font-weight="800" text-anchor="middle">${item.index}</text>`,
      `<text x="${cell.x + 4}" y="${cell.y + cell.height + 28}" fill="#f8f8f2" font-size="22" font-weight="600">#${item.index} · ${formatClock(item.at, 1)} (${item.at.toFixed(2)}s) · nota ${item.score.toFixed(2)}${item.focus ? ` · rosto ${item.focus.x.toFixed(2)}, ${item.focus.y.toFixed(2)}` : ' · rosto ?'}</text>`,
    );
  });
  parts.push('</svg>');
  return parts.join('\n');
}

/** Os três tamanhos em que a capa é julgada: sugerido no desktop, feed do celular e lista lateral. */
export const COMPARE_TIERS = [
  { id: 'desktop', label: 'desktop (640×360)', width: 640, height: 360, background: '#0f0f0f' },
  { id: 'feed', label: 'celular, feed (320×180)', width: 320, height: 180, background: '#0f0f0f' },
  { id: 'lista', label: 'celular, lista e busca (168×94), tema claro', width: 168, height: 94, background: '#ffffff' },
] as const;

export interface CompareTile extends Rect {
  variant: number;
  tier: number;
}

export interface CompareSheet {
  width: number;
  height: number;
  /** faixa de fundo de cada tamanho */
  bands: (Rect & { tier: number })[];
  tiles: CompareTile[];
}

const COMPARE = { gap: 24, header: 44 } as const;

/** Folha de comparação: uma coluna por variante, uma linha por tamanho. */
export function compareSheet(count: number): CompareSheet {
  const column = COMPARE_TIERS[0].width;
  const width = COMPARE.gap + count * (column + COMPARE.gap);
  const bands: CompareSheet['bands'] = [];
  const tiles: CompareTile[] = [];
  let y = 0;
  COMPARE_TIERS.forEach((tier, tierIndex) => {
    const height = COMPARE.header + tier.height + COMPARE.gap;
    bands.push({ x: 0, y, width, height, tier: tierIndex });
    for (let variant = 0; variant < count; variant++) {
      tiles.push({ x: COMPARE.gap + variant * (column + COMPARE.gap), y: y + COMPARE.header, width: tier.width, height: tier.height, variant, tier: tierIndex });
    }
    y += height;
  });
  return { width, height: y, bands, tiles };
}

/** Selo de duração como o YouTube desenha, no canto inferior direito: prova que o texto não fica embaixo dele. */
export function durationBadge(tile: Rect, clock: string): { rect: Rect; fontSize: number; text: string } {
  const fontSize = Math.max(9, Math.round(tile.height * 0.072));
  const width = Math.round(clock.length * fontSize * 0.62 + fontSize * 0.7);
  const height = Math.round(fontSize * 1.5);
  const margin = Math.max(3, Math.round(tile.height * 0.035));
  return { rect: { x: tile.x + tile.width - width - margin, y: tile.y + tile.height - height - margin, width, height }, fontSize, text: clock };
}

export function compareSvg(sheet: CompareSheet, labels: string[], durationSec: number): string {
  const clock = formatChapter(durationSec);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.width}" height="${sheet.height}" font-family="Segoe UI, Arial, sans-serif">`];
  for (const band of sheet.bands) {
    const tier = COMPARE_TIERS[band.tier]!;
    const color = tier.background === '#ffffff' ? '#0f0f0f' : '#f1f1f1';
    parts.push(`<text x="${COMPARE.gap}" y="${band.y + 30}" fill="${color}" font-size="20" font-weight="600">${escapeXml(tier.label)}</text>`);
  }
  for (const tile of sheet.tiles) {
    const badge = durationBadge(tile, clock);
    parts.push(
      `<rect x="${badge.rect.x}" y="${badge.rect.y}" width="${badge.rect.width}" height="${badge.rect.height}" rx="${Math.round(badge.rect.height * 0.25)}" fill="rgba(0,0,0,0.82)"/>`,
      `<text x="${badge.rect.x + badge.rect.width / 2}" y="${badge.rect.y + badge.rect.height * 0.72}" fill="#ffffff" font-size="${badge.fontSize}" font-weight="600" text-anchor="middle">${clock}</text>`,
    );
    if (tile.tier === 0) {
      const label = labels[tile.variant] ?? `capa ${tile.variant + 1}`;
      const band = sheet.bands[0]!;
      parts.push(`<text x="${tile.x + tile.width}" y="${band.y + 30}" fill="#ff5555" font-size="20" font-weight="700" text-anchor="end">${escapeXml(label)}</text>`);
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}
