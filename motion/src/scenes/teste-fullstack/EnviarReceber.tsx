import { useCurrentFrame, useVideoConfig } from 'remotion';

import type { BaseProps } from '../../anim';
import type { ComponentEntry } from '../../components/registry';
import { Arrow, enter, Eyebrow, IconBadge, type IconName, Pill, type Point, rise, SceneBackground, Statement, text } from '../../scene-kit';
import { theme } from '../../theme';

export interface EnviarReceberProps {
  /** segundos relativos ao início da cena */
  revealAt?: {
    /** "enviar os dados" */
    send: number;
    /** "receber os dados" */
    receive: number;
    /** "compreender o motivo": entra a frase de fecho */
    why: number;
  };
  eyebrow?: string;
  sendLabel?: string;
  receiveLabel?: string;
  title?: string;
  /** trecho do título em coral */
  accent?: string;
  support?: string;
}

const DEFAULT_REVEAL = { send: 0.9, receive: 1.75, why: 4.0 };
/** altura aproximada (px) do bloco da frase de fecho, com o espaçamento */
const CLOSING_HEIGHT = 300;

export interface ExchangeLayout {
  width: number;
  height: number;
  badge: number;
  front: Point;
  back: Point;
  send: { from: Point; to: Point; bend: number; label: Point };
  receive: { from: Point; to: Point; bend: number; label: Point };
  labelY: number;
}

/** Front à esquerda, back à direita e duas setas curvas entre eles: ida por cima, volta por baixo. */
export function exchangeLayout(width = 1320): ExchangeLayout {
  const badge = 176;
  const centerY = badge / 2 + 40;
  const bend = 44;
  const inset = badge + 36;
  const offset = 46;
  const middle = width / 2;
  return {
    width,
    height: centerY + badge / 2 + 76,
    badge,
    front: [badge / 2, centerY],
    back: [width - badge / 2, centerY],
    // `bend` negativo nas duas: indo para a direita curva para cima; voltando para a esquerda, para baixo
    send: { from: [inset, centerY - offset], to: [width - inset, centerY - offset], bend: -bend, label: [middle, centerY - offset - bend] },
    receive: { from: [width - inset, centerY + offset], to: [inset, centerY + offset], bend: -bend, label: [middle, centerY + offset + bend] },
    labelY: centerY + badge / 2 + 24,
  };
}

const Node: React.FC<{ icon: IconName; name: string; center: Point; size: number; labelY: number; progress: number }> = ({
  icon,
  name,
  center,
  size,
  labelY,
  progress,
}) => (
  <>
    <IconBadge icon={icon} size={size} progress={progress} style={{ position: 'absolute', left: center[0] - size / 2, top: center[1] - size / 2 }} />
    <div
      style={{
        position: 'absolute',
        left: center[0] - 200,
        width: 400,
        top: labelY,
        textAlign: 'center',
        fontFamily: theme.font.body,
        fontWeight: 600,
        fontSize: text.label,
        lineHeight: 1.2,
        color: theme.color.slate900,
        ...rise(progress, 16),
      }}
    >
      {name}
    </div>
  </>
);

const Label: React.FC<{ at: Point; progress: number; children: string }> = ({ at, progress, children }) => (
  <div style={{ position: 'absolute', left: at[0], top: at[1], width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {/* fundo opaco: a pílula interrompe a seta em vez de deixar o traço passar por trás do texto */}
    <Pill progress={progress} style={{ background: theme.color.paper }}>
      {children}
    </Pill>
  </div>
);

/** Não só enviar e receber dados: entender o motivo. O vai e vem entre front e back, e depois o porquê. */
export const EnviarReceber: React.FC<EnviarReceberProps & BaseProps> = ({
  revealAt = DEFAULT_REVEAL,
  eyebrow = 'A herança do back-end',
  sendLabel = 'enviar os dados',
  receiveLabel = 'receber os dados',
  title = 'E entender o porquê.',
  accent = 'o porquê',
  support = 'Quem já fez o back sabe por que o dado vai e volta.',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = exchangeLayout();
  const nodes = enter(frame, fps, 0.15, 0.5);
  const send = enter(frame, fps, revealAt.send, 0.6);
  const receive = enter(frame, fps, revealAt.receive, 0.6);
  // até a frase de fecho entrar, o diagrama fica no centro da área útil; depois sobe e abre espaço para ela
  const lift = (1 - enter(frame, fps, revealAt.why - 0.35, 0.7)) * CLOSING_HEIGHT * 0.5;

  return (
    <SceneBackground durationInFrames={durationInFrames} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 52 }}>
      <Eyebrow progress={enter(frame, fps, 0)} style={{ translate: `0px ${lift}px` }}>
        {eyebrow}
      </Eyebrow>
      <div style={{ position: 'relative', width: layout.width, height: layout.height, translate: `0px ${lift}px` }}>
        <Arrow from={layout.send.from} to={layout.send.to} bend={layout.send.bend} progress={send} />
        <Arrow from={layout.receive.from} to={layout.receive.to} bend={layout.receive.bend} progress={receive} />
        <Node icon="browser" name="Front-end" center={layout.front} size={layout.badge} labelY={layout.labelY} progress={nodes} />
        <Node icon="server" name="Back-end" center={layout.back} size={layout.badge} labelY={layout.labelY} progress={enter(frame, fps, 0.3, 0.5)} />
        <Label at={layout.send.label} progress={enter(frame, fps, revealAt.send + 0.2)}>
          {sendLabel}
        </Label>
        <Label at={layout.receive.label} progress={enter(frame, fps, revealAt.receive + 0.2)}>
          {receiveLabel}
        </Label>
      </div>
      {/* a frase ocupa o lugar desde o início (invisível) para o diagrama não pular quando ela entra */}
      <div style={{ opacity: frame >= revealAt.why * fps ? 1 : 0 }}>
        <Statement text={title} accent={accent} support={support} atSec={revealAt.why} fontSize={88} />
      </div>
    </SceneBackground>
  );
};

export const entry: ComponentEntry = {
  component: EnviarReceber,
  sample: { revealAt: DEFAULT_REVEAL },
  defaultDuration: 7.6,
  description: 'Cena papel: front e back trocando dados (enviar, receber) e o fecho "entender o porquê". Para falas sobre a herança do back-end.',
};

export const MODEL = 'TrocaEntreDoisPolos';
