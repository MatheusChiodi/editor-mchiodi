import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useRef, useState } from 'react';

import { MusicVideo } from '../../motion/src/music/MusicVideo';
import type { MotifId, MusicPlan } from '../../motion/src/music/types';
import { theme } from '../../motion/src/theme';
import { describeScenes } from '../../src/music/edit.ts';

const MOTIF_LABEL: Record<MotifId, string> = {
  story: 'História',
  phone: 'Celular',
  heart: 'Coração',
  night: 'Noite',
  morning: 'Manhã',
  photos: 'Fotos',
  clock: 'Relógio',
  rain: 'Chuva',
  road: 'Estrada',
  shout: 'Grito',
  paper: 'Papel rasgado',
  words: 'Palavra',
  burst: 'Estouro',
  blob: 'Bolha',
};

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function App() {
  const [plan, setPlan] = useState<MusicPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const player = useRef<PlayerRef>(null);

  // plano em disco: carrega e recarrega sempre que o Claude edita as cenas
  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/plan', { cache: 'no-store' });
        if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? `HTTP ${response.status}`);
        setPlan((await response.json()) as MusicPlan);
        setUpdatedAt(Date.now());
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    void load();
    const events = new EventSource('/api/events');
    events.addEventListener('plan', () => void load());
    return () => events.close();
  }, []);

  useEffect(() => {
    const current = player.current;
    if (!current) return;
    const onFrame = (event: { detail: { frame: number } }) => setFrame(event.detail.frame);
    current.addEventListener('frameupdate', onFrame);
    return () => current.removeEventListener('frameupdate', onFrame);
  }, [plan === null]);

  if (!plan) {
    return <div style={{ padding: 32 }}>{error ? `Sem plano: ${error}` : 'Carregando o plano...'}</div>;
  }

  const rows = describeScenes(plan);
  const active = Math.max(0, plan.scenes.findIndex((scene) => frame >= scene.startFrame && frame < scene.endFrame));
  const seek = (startFrame: number) => {
    player.current?.seekTo(startFrame);
    player.current?.play();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', height: '100vh' }}>
      <main style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, overflow: 'auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong style={{ fontSize: 20 }}>{plan.title || 'Vídeo da música'}</strong>
          <span style={{ color: theme.color.slate300, fontSize: 14 }}>{plan.bpm ? `${plan.bpm} BPM · ` : ''}{rows.length} cenas · {clock(plan.durationInFrames / plan.fps)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: theme.color.glowMint }} title={updatedAt ? `plano carregado às ${new Date(updatedAt).toLocaleTimeString()}` : ''}>● ao vivo</span>
        </header>
        <Player
          ref={player}
          component={MusicVideo}
          inputProps={{ plan, audioSrc: '/api/audio' }}
          durationInFrames={plan.durationInFrames}
          fps={plan.fps}
          compositionWidth={plan.width}
          compositionHeight={plan.height}
          controls
          clickToPlay
          spaceKeyToPlayOrPause
          acknowledgeRemotionLicense
          style={{ width: '100%', maxHeight: '68vh', borderRadius: 12, overflow: 'hidden' }}
        />
        {/* linha do tempo das cenas: clique para ir ao trecho */}
        <div style={{ display: 'flex', height: 34, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
          {plan.scenes.map((scene, index) => (
            <button
              key={index}
              onClick={() => seek(scene.startFrame)}
              title={`#${index + 1} ${MOTIF_LABEL[scene.motif]}`}
              style={{ flex: scene.endFrame - scene.startFrame, border: 0, cursor: 'pointer', background: index === active ? theme.color.coral : theme.color.slate600, color: theme.color.white, fontSize: 11, padding: 0, minWidth: 0, overflow: 'hidden' }}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, color: theme.color.slate300, fontSize: 13, lineHeight: 1.5 }}>
          Para editar, peça ao Claude citando o número da cena, por exemplo: “a cena 7 vira chuva”, “divida a cena 3 aos 45 s” ou “junte as cenas 5 e 6”. Esta tela atualiza sozinha, sem renderizar.
        </p>
      </main>
      <aside style={{ borderLeft: '1px solid #1f2937', overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => (
          <button
            key={row.n}
            ref={(element) => {
              if (element && row.n - 1 === active) element.scrollIntoView({ block: 'nearest' });
            }}
            onClick={() => seek(plan.scenes[row.n - 1]!.startFrame)}
            style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', background: row.n - 1 === active ? '#1b2333' : '#11151f', border: `1px solid ${row.n - 1 === active ? theme.color.coral : '#1f2937'}`, borderRadius: 10, padding: '10px 12px' }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <strong style={{ color: theme.color.coral }}>#{row.n}</strong>
              <span>{MOTIF_LABEL[row.motif]}</span>
              {row.detail ? <span style={{ fontSize: 12, color: theme.color.glowMint }}>{row.detail}</span> : row.keyword ? <span style={{ fontSize: 12, color: theme.color.glowMint }}>“{row.keyword}”</span> : null}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: theme.color.slate300 }}>{clock(row.start)}–{clock(row.end)}</span>
            </div>
            {row.lyric ? <div style={{ marginTop: 4, fontSize: 12, color: theme.color.slate300, lineHeight: 1.35 }}>{row.lyric}</div> : <div style={{ marginTop: 4, fontSize: 12, color: theme.color.slate600 }}>instrumental</div>}
          </button>
        ))}
      </aside>
    </div>
  );
}
