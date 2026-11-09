import { describe, expect, it } from 'vitest';

import { handPositions, rig } from '../motion/src/music/story/rig.ts';
import { MOOD_IDS, POSE_IDS } from '../motion/src/music/types.ts';

describe('rig (esqueleto do personagem)', () => {
  it('todo par pose × humor, sentado ou em pé, dá juntas finitas e dentro dos limites', () => {
    for (const pose of POSE_IDS) {
      for (const mood of MOOD_IDS) {
        for (const seated of [false, true]) {
          for (const t of [0, 0.4, 1.3, 2.9, 7.7]) {
            const j = rig(pose, mood, t, { seated });
            const angles = [...j.lArm, ...j.rArm, ...j.lLeg, ...j.rLeg, j.torsoTilt, j.headTilt, j.bodyY];
            for (const value of angles) expect(Number.isFinite(value)).toBe(true);
            for (const arm of [j.lArm, j.rArm]) {
              expect(arm[0]).toBeGreaterThanOrEqual(-70);
              expect(arm[0]).toBeLessThanOrEqual(200);
              expect(arm[1]).toBeGreaterThanOrEqual(-10);
              expect(arm[1]).toBeLessThanOrEqual(150);
            }
            expect(j.eyesClosed).toBeGreaterThanOrEqual(0);
            expect(j.eyesClosed).toBeLessThanOrEqual(1);
            expect(Math.abs(j.mouth)).toBeLessThanOrEqual(1);
            expect(Math.abs(j.brow)).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('é determinístico', () => {
    expect(rig('walk', 'sad', 3.3, { seated: false, seed: 4 })).toEqual(rig('walk', 'sad', 3.3, { seated: false, seed: 4 }));
  });

  it('andar: pernas em oposição e ciclo periódico', () => {
    const a = rig('walk', 'neutral', 0.2, { seated: false });
    expect(Math.sign(a.lLeg[0])).toBe(-Math.sign(a.rLeg[0]));
    const period = (2 * Math.PI) / 5.2;
    const b = rig('walk', 'neutral', 0.2 + period, { seated: false });
    expect(b.lLeg[0]).toBeCloseTo(a.lLeg[0], 3);
  });

  it('sentado: coxas à frente (quase horizontais) e corpo mais baixo', () => {
    const sit = rig('lookDown', 'sad', 1, { seated: true });
    const stand = rig('lookDown', 'sad', 1, { seated: false });
    expect(sit.lLeg[0]).toBeGreaterThanOrEqual(80);
    expect(stand.lLeg[0]).toBeLessThan(20);
    expect(sit.bodyY).toBeGreaterThan(stand.bodyY + 30);
  });

  it('humor: boca, sobrancelha e lágrima', () => {
    const at = (mood: (typeof MOOD_IDS)[number]) => rig('stand', mood, 1.2, { seated: false });
    expect(at('sad').mouth).toBeLessThan(0);
    expect(at('smile').mouth).toBeGreaterThan(0.5);
    expect(at('angry').brow).toBeLessThan(-0.5);
    expect(at('cry').tear).toBe(1);
    expect(at('neutral').tear).toBe(0);
  });

  it('pisca de tempos em tempos', () => {
    const samples = Array.from({ length: 400 }, (_, i) => rig('stand', 'neutral', i * 0.01, { seated: false }).eyesClosed);
    expect(Math.max(...samples)).toBeGreaterThan(0.9);
    expect(samples.filter((value) => value === 0).length).toBeGreaterThan(300);
  });

  it('celular: a mão direita sobe até perto do rosto; mãos no rosto: as duas', () => {
    const phone = handPositions(rig('phone', 'sad', 1, { seated: false }));
    expect(phone.r.y).toBeLessThan(-85);
    const face = handPositions(rig('faceHands', 'cry', 1, { seated: false }));
    expect(face.l.y).toBeLessThan(-85);
    expect(face.r.y).toBeLessThan(-85);
    const idle = handPositions(rig('stand', 'neutral', 1, { seated: false }));
    expect(idle.r.y).toBeGreaterThan(-10);
  });

  it('alcançar: a mão se estende para a frente', () => {
    expect(handPositions(rig('reach', 'sad', 1, { seated: false })).r.x).toBeGreaterThan(70);
  });
});
