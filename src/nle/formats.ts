import { basename } from 'node:path';

import type { Edl } from '../edl/schema.ts';
import type { Timeline } from '../edl/timeline.ts';

/**
 * Exportação da EDL para editores visuais (Shotcut, Kdenlive, OpenShot e outros). Só os cortes, em frames:
 * gráficos, zoom, cor, legenda e mixagem ficam no render do `mce`; isto serve para ajustar o corte à mão.
 */
export interface NleClip {
  name: string;
  /** frames da fonte; fim exclusivo */
  sourceIn: number;
  sourceOut: number;
  /** frames da timeline de saída; fim exclusivo */
  start: number;
  end: number;
}

export interface NleInput {
  name: string;
  mediaPath: string;
  fps: number;
  width: number;
  height: number;
  sourceFrames: number;
  clips: NleClip[];
}

export function toNleInput(edl: Pick<Edl, 'project' | 'source'>, timeline: Timeline): NleInput {
  return {
    name: edl.project,
    mediaPath: edl.source.path,
    fps: timeline.fps,
    width: edl.source.width,
    height: edl.source.height,
    sourceFrames: Math.round(edl.source.durationSec * timeline.fps),
    clips: timeline.clips.map((clip) => ({
      name: clip.id,
      sourceIn: clip.startFrame,
      sourceOut: clip.endFrame,
      start: Math.round(clip.outputStart * timeline.fps),
      end: Math.round(clip.outputEnd * timeline.fps),
    })),
  };
}

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (value: number, width = 2) => String(value).padStart(width, '0');
const posix = (path: string) => path.replace(/\\/g, '/');

/** Base inteira de timecode: 29.97 → 30, 23.976 → 24. */
const timebase = (fps: number) => Math.round(fps);
const isNtsc = (fps: number) => Math.abs(fps - Math.round(fps)) > 0.001;

export function frameTimecode(frames: number, fps: number): string {
  const base = timebase(fps);
  const total = Math.max(0, Math.round(frames));
  const ff = total % base;
  const seconds = Math.floor(total / base);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}:${pad(ff)}`;
}

/** `file:///D:/a%20b.mp4`: espaço e & escapados, barra preservada. */
function fileUrl(path: string, host = ''): string {
  const normalized = posix(path);
  const encoded = normalized.split('/').map((part, index) => (index === 0 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part))).join('/');
  return `file://${host}${encoded.startsWith('/') ? '' : '/'}${encoded}`;
}

/** CMX3600: o formato de EDL que qualquer editor importa. */
export function cmx3600(input: NleInput): string {
  const lines = [`TITLE: ${input.name}`, 'FCM: NON-DROP FRAME', ''];
  input.clips.forEach((clip, index) => {
    const tc = (frames: number) => frameTimecode(frames, input.fps);
    lines.push(`${pad(index + 1, 3)}  AX       AA/V  C        ${tc(clip.sourceIn)} ${tc(clip.sourceOut)} ${tc(clip.start)} ${tc(clip.end)}`);
    lines.push(`* FROM CLIP NAME: ${basename(posix(input.mediaPath))}`);
  });
  return `${lines.join('\n')}\n`;
}

/** MLT XML no molde do que o Shotcut grava: abre direto no Shotcut e no `melt`. */
export function mlt(input: NleInput): string {
  const clock = (frames: number) => {
    const seconds = frames / input.fps;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds - h * 3600 - m * 60;
    return `${pad(h)}:${pad(m)}:${s.toFixed(3).padStart(6, '0')}`;
  };
  const total = input.clips.at(-1)?.end ?? 0;
  const size = `${input.width}x${input.height}`;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(input.width, input.height);
  const [fpsNum, fpsDen] = isNtsc(input.fps) ? [timebase(input.fps) * 1000, 1001] : [timebase(input.fps), 1];
  const media = escapeXml(posix(input.mediaPath));
  const caption = escapeXml(basename(posix(input.mediaPath)));

  const chains = input.clips.map(
    (_, index) =>
      `  <chain id="chain${index}" out="${clock(input.sourceFrames - 1)}">\n` +
      `    <property name="length">${clock(input.sourceFrames)}</property>\n` +
      '    <property name="eof">pause</property>\n' +
      `    <property name="resource">${media}</property>\n` +
      '    <property name="mlt_service">avformat</property>\n' +
      `    <property name="caption">${caption}</property>\n` +
      '  </chain>',
  );
  const entries = input.clips.map((clip, index) => `    <entry producer="chain${index}" in="${clock(clip.sourceIn)}" out="${clock(clip.sourceOut - 1)}"/>`);

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<mlt LC_NUMERIC="C" version="7.33.0" title="${escapeXml(input.name)} (${size})" producer="main_bin">`,
    `  <profile description="automatic" width="${input.width}" height="${input.height}" progressive="1" sample_aspect_num="1" sample_aspect_den="1" display_aspect_num="${input.width / divisor}" display_aspect_den="${input.height / divisor}" frame_rate_num="${fpsNum}" frame_rate_den="${fpsDen}" colorspace="709"/>`,
    '  <playlist id="main_bin">',
    '    <property name="xml_retain">1</property>',
    '  </playlist>',
    '  <producer id="bg">',
    `    <property name="length">${clock(total)}</property>`,
    '    <property name="eof">pause</property>',
    '    <property name="resource">black</property>',
    '    <property name="mlt_service">color</property>',
    '    <property name="mlt_image_format">rgba</property>',
    '    <property name="aspect_ratio">1</property>',
    '  </producer>',
    '  <playlist id="background">',
    `    <entry producer="bg" in="00:00:00.000" out="${clock(total - 1)}"/>`,
    '  </playlist>',
    ...chains,
    '  <playlist id="playlist0">',
    '    <property name="shotcut:video">1</property>',
    '    <property name="shotcut:name">V1</property>',
    ...entries,
    '  </playlist>',
    `  <tractor id="tractor0" in="00:00:00.000" out="${clock(total - 1)}">`,
    '    <property name="shotcut">1</property>',
    '    <property name="shotcut:projectAudioChannels">2</property>',
    '    <track producer="background"/>',
    '    <track producer="playlist0"/>',
    '  </tractor>',
    '</mlt>',
    '',
  ].join('\n');
}

/** Final Cut Pro 7 XML (xmeml v4): OpenShot, Kdenlive, Premiere e Resolve importam. */
export function fcp7(input: NleInput): string {
  const base = timebase(input.fps);
  const rate = `<rate><timebase>${base}</timebase><ntsc>${isNtsc(input.fps) ? 'TRUE' : 'FALSE'}</ntsc></rate>`;
  const total = input.clips.at(-1)?.end ?? 0;
  const fileName = escapeXml(basename(posix(input.mediaPath)));
  const fileFull =
    `<file id="file-1"><name>${fileName}</name><pathurl>${escapeXml(fileUrl(input.mediaPath, 'localhost'))}</pathurl>${rate}` +
    `<duration>${input.sourceFrames}</duration><media><video><samplecharacteristics>${rate}<width>${input.width}</width><height>${input.height}</height></samplecharacteristics></video>` +
    '<audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>2</channelcount></audio></media></file>';

  const item = (kind: 'video' | 'audio', clip: NleClip, index: number) => {
    const id = `${kind === 'video' ? 'clipitem' : 'clipitem-a'}-${index + 1}`;
    const links = (['video', 'audio'] as const)
      .map((other) => `<link><linkclipref>${other === 'video' ? 'clipitem' : 'clipitem-a'}-${index + 1}</linkclipref><mediatype>${other}</mediatype><trackindex>1</trackindex><clipindex>${index + 1}</clipindex></link>`)
      .join('');
    return (
      `<clipitem id="${id}"><name>${escapeXml(clip.name)}</name><enabled>TRUE</enabled><duration>${input.sourceFrames}</duration>${rate}` +
      `<start>${clip.start}</start><end>${clip.end}</end><in>${clip.sourceIn}</in><out>${clip.sourceOut}</out>` +
      `${kind === 'video' && index === 0 ? fileFull : '<file id="file-1"/>'}` +
      `<sourcetrack><mediatype>${kind}</mediatype><trackindex>1</trackindex></sourcetrack>${links}</clipitem>`
    );
  };
  // o arquivo é declarado inteiro no primeiro clipe de vídeo; áudio e demais clipes só referenciam
  const track = (kind: 'video' | 'audio') => `<track>${input.clips.map((clip, index) => item(kind, clip, index)).join('')}</track>`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="4">',
    '<sequence id="sequence-1">',
    `<name>${escapeXml(input.name)}</name><duration>${total}</duration>${rate}`,
    `<timecode>${rate}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>`,
    '<media>',
    `<video><format><samplecharacteristics>${rate}<width>${input.width}</width><height>${input.height}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></format>${track('video')}</video>`,
    `<audio><numOutputChannels>2</numOutputChannels><format><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics></format>${track('audio')}</audio>`,
    '</media>',
    '</sequence>',
    '</xmeml>',
    '',
  ].join('\n');
}

/** OpenTimelineIO (JSON): o Kdenlive e outros editores importam por ele. */
export function otio(input: NleInput): string {
  const time = (value: number) => ({ OTIO_SCHEMA: 'RationalTime.1', rate: input.fps, value });
  const range = (start: number, duration: number) => ({ OTIO_SCHEMA: 'TimeRange.1', start_time: time(start), duration: time(duration) });
  const reference = {
    OTIO_SCHEMA: 'ExternalReference.1',
    target_url: fileUrl(input.mediaPath),
    available_range: range(0, input.sourceFrames),
    metadata: {},
  };
  const track = (kind: 'Video' | 'Audio') => ({
    OTIO_SCHEMA: 'Track.1',
    name: kind === 'Video' ? 'V1' : 'A1',
    kind,
    source_range: null,
    metadata: {},
    children: input.clips.map((clip) => ({
      OTIO_SCHEMA: 'Clip.1',
      name: clip.name,
      source_range: range(clip.sourceIn, clip.sourceOut - clip.sourceIn),
      media_reference: reference,
      metadata: {},
    })),
  });
  return `${JSON.stringify(
    {
      OTIO_SCHEMA: 'Timeline.1',
      name: input.name,
      global_start_time: null,
      metadata: {},
      tracks: { OTIO_SCHEMA: 'Stack.1', name: 'tracks', source_range: null, metadata: {}, children: [track('Video'), track('Audio')] },
    },
    null,
    2,
  )}\n`;
}
