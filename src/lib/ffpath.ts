/**
 * Escapa um caminho para uso como valor de opção dentro de um filtergraph do ffmpeg
 * (subtitles=, lut3d=, movie=...). O filtergraph tem dois níveis de parsing, e no Windows
 * o ":" da letra do drive é lido como separador de opção se não for escapado nos dois.
 * Resultado para C:\a\b.ass -> 'C\:/a/b.ass'
 */
export function escapeFilterPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const escaped = normalized.replace(/'/g, "'\\\\\\''").replace(/:/g, '\\:');
  return `'${escaped}'`;
}

/** Escapa texto livre para drawtext=text=... */
export function escapeFilterText(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, '\u2019')
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/;/g, '\\;');
}
