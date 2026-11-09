import { describe, expect, it } from 'vitest';

import { buildTimeline } from '../src/edl/timeline.ts';
import { cmx3600, fcp7, frameTimecode, mlt, otio, type NleInput, toNleInput } from '../src/nle/formats.ts';

const timeline = buildTimeline(
  [
    { id: 'c1', start: 1, end: 3 },
    { id: 'c2', start: 5, end: 6.5 },
  ],
  30,
);

const input: NleInput = toNleInput(
  { project: 'demo', source: { path: 'D:\\Videos\\a & b.mp4', durationSec: 10, fps: 30, width: 1920, height: 1080 } },
  timeline,
);

/** Confere que toda tag abre e fecha na ordem certa (sem parser XML no projeto). */
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  for (const match of xml.replace(/<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>/g, '').matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match;
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else {
      stack.push(name!);
    }
  }
  return stack.length === 0;
}

describe('toNleInput', () => {
  it('converte clipes para frames da fonte e da saída', () => {
    expect(input.fps).toBe(30);
    expect(input.sourceFrames).toBe(300);
    expect(input.clips).toEqual([
      { name: 'c1', sourceIn: 30, sourceOut: 90, start: 0, end: 60 },
      { name: 'c2', sourceIn: 150, sourceOut: 195, start: 60, end: 105 },
    ]);
  });
});

describe('frameTimecode', () => {
  it('HH:MM:SS:FF', () => {
    expect(frameTimecode(0, 30)).toBe('00:00:00:00');
    expect(frameTimecode(95, 30)).toBe('00:00:03:05');
    expect(frameTimecode(30 * 3661 + 7, 30)).toBe('01:01:01:07');
    expect(frameTimecode(24, 23.976)).toBe('00:00:01:00');
  });
});

describe('cmx3600', () => {
  it('um evento por clipe, com timecode de fonte e de saída', () => {
    const text = cmx3600(input);
    expect(text).toContain('TITLE: demo');
    expect(text).toContain('FCM: NON-DROP FRAME');
    expect(text).toContain('001  AX       AA/V  C        00:00:01:00 00:00:03:00 00:00:00:00 00:00:02:00');
    expect(text).toContain('002  AX       AA/V  C        00:00:05:00 00:00:06:15 00:00:02:00 00:00:03:15');
    expect(text).toContain('* FROM CLIP NAME: a & b.mp4');
  });
});

describe('mlt (Shotcut)', () => {
  const xml = mlt(input);
  it('é XML bem formado e escapa o caminho', () => {
    expect(wellFormed(xml)).toBe(true);
    expect(xml).toContain('a &amp; b.mp4');
    expect(xml).not.toContain('a & b');
  });
  it('perfil, uma entrada por clipe e trilha principal', () => {
    expect(xml).toContain('<profile description="automatic" width="1920" height="1080"');
    expect(xml).toContain('frame_rate_num="30" frame_rate_den="1"');
    expect(xml).toContain('<entry producer="chain0" in="00:00:01.000" out="00:00:02.967"');
    expect(xml).toContain('<entry producer="chain1" in="00:00:05.000" out="00:00:06.467"');
    expect(xml).toContain('<track producer="playlist0"/>');
  });
});

describe('fcp7 (xmeml)', () => {
  const xml = fcp7(input);
  it('XML bem formado, com vídeo e áudio ligados', () => {
    expect(wellFormed(xml)).toBe(true);
    expect(xml).toContain('<xmeml version="4">');
    expect(xml).toContain('<timebase>30</timebase>');
    expect(xml).toContain('<start>60</start>');
    expect(xml).toContain('<in>150</in>');
    expect(xml.match(/<clipitem /g)).toHaveLength(4);
    expect(xml).toContain('<mediatype>audio</mediatype>');
  });
  it('declara o arquivo uma vez e referencia nas outras', () => {
    expect(xml.match(/<pathurl>/g)).toHaveLength(1);
    expect(xml).toContain('<pathurl>file://localhost/D:/Videos/a%20%26%20b.mp4</pathurl>');
  });
  it('fps NTSC marca ntsc TRUE com a base inteira', () => {
    const ntsc = fcp7({ ...input, fps: 29.97 });
    expect(ntsc).toContain('<timebase>30</timebase>');
    expect(ntsc).toContain('<ntsc>TRUE</ntsc>');
  });
});

describe('otio', () => {
  const doc = JSON.parse(otio(input));
  it('timeline com trilha de vídeo e de áudio', () => {
    expect(doc.OTIO_SCHEMA).toBe('Timeline.1');
    const tracks = doc.tracks.children;
    expect(tracks.map((track: { kind: string }) => track.kind)).toEqual(['Video', 'Audio']);
    expect(tracks[0].children).toHaveLength(2);
  });
  it('intervalo de fonte em RationalTime', () => {
    const clip = doc.tracks.children[0].children[1];
    expect(clip.source_range.start_time).toEqual({ OTIO_SCHEMA: 'RationalTime.1', rate: 30, value: 150 });
    expect(clip.source_range.duration.value).toBe(45);
    expect(clip.media_reference.target_url).toBe('file:///D:/Videos/a%20%26%20b.mp4');
  });
});
