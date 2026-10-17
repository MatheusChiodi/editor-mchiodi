import { AbsoluteFill, Img } from 'remotion';

import { theme } from '../theme';
import { COLORS, type ImageSlot, placeImage, planThumb, type Point, type TextBlock, THUMB, type ThumbDesign } from './layout';

export type ThumbPhoto = {
  /** data URL ou URL da foto (frame do vídeo) */
  src: string;
  width: number;
  height: number;
  /** onde está o rosto na foto (0–1) */
  focus?: Point;
  /** 1 = cobre a caixa; acima disso aproxima o rosto */
  zoom?: number;
};

export type ThumbnailProps = ThumbDesign & {
  photo: ThumbPhoto | null;
  /** segunda foto do layout `split` (lado direito); sem ela, a mesma foto vai nos dois lados */
  photo2?: ThumbPhoto | null;
  /** escurecimento extra da foto inteira, 0–0.6 */
  dim?: number;
};

const ink = (alpha: number) => `rgba(17,24,39,${alpha})`;

const Photo: React.FC<{ slot: ImageSlot; photo: ThumbPhoto | null }> = ({ slot, photo }) => {
  const { box } = slot;
  const clip = slot.clip ? `polygon(${slot.clip.map((point) => `${point.x - box.x}px ${point.y - box.y}px`).join(', ')})` : undefined;
  const placed = photo ? placeImage(photo, box, photo.focus ?? { x: 0.5, y: 0.4 }, photo.zoom ?? 1, slot.anchor) : null;
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, overflow: 'hidden', clipPath: clip }}>
      {photo && placed ? (
        <Img
          src={photo.src}
          style={{
            position: 'absolute',
            left: placed.left,
            top: placed.top,
            width: placed.width,
            height: placed.height,
            maxWidth: 'none',
            // a capa compete com vizinhas saturadas: um pouco mais de contraste e cor que o vídeo
            filter: slot.muted ? 'grayscale(1) contrast(1.05) brightness(0.72)' : 'contrast(1.12) saturate(1.2) brightness(1.16)',
          }}
        />
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(circle at ${slot.anchor.x * 100}% ${slot.anchor.y * 100}%, #334155, ${theme.color.night})` }} />
      )}
      {/* luz quente no rosto: gravação em quarto escuro some no feed; o disco pêssego do design system o destaca da parede */}
      {slot.muted ? null : (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${slot.anchor.x * 100}% ${slot.anchor.y * 100}%, rgba(255,184,108,0.3), rgba(255,184,108,0.1) 22%, transparent 44%)`,
            mixBlendMode: 'screen',
          }}
        />
      )}
    </div>
  );
};

const Text: React.FC<{ block: TextBlock }> = ({ block }) => {
  const display = block.font === 'display';
  return (
    <div
      style={{
        position: 'absolute',
        left: block.rect.x,
        top: block.rect.y,
        fontFamily: display ? theme.font.display : theme.font.body,
        fontWeight: display ? 600 : 800,
        fontSize: block.fontSize,
        lineHeight: block.lineHeight,
        letterSpacing: '-0.02em',
        color: block.color,
        whiteSpace: 'nowrap',
        textShadow: block.surface === 'photo' ? '0 8px 34px rgba(0,0,0,0.62), 0 2px 5px rgba(0,0,0,0.55)' : 'none',
      }}
    >
      {block.lines.map((line, index) => (
        <div key={index}>
          {line.map((segment, part) => (
            <span key={part} style={segment.accent ? { color: block.accentColor, fontStyle: display ? 'italic' : 'normal' } : undefined}>
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

const Arrow: React.FC<{ from: Point; to: Point; bend: number }> = ({ from, to, bend }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const control = { x: from.x + dx / 2 - (dy / length) * bend * length, y: from.y + dy / 2 + (dx / length) * bend * length };
  // a ponta segue a tangente do fim da curva
  const angle = Math.atan2(to.y - control.y, to.x - control.x);
  const head = (offset: number) => `${to.x - Math.cos(angle + offset) * 46} ${to.y - Math.sin(angle + offset) * 46}`;
  return (
    <svg width={THUMB.width} height={THUMB.height} style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.55))' }}>
      <path d={`M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`} fill="none" stroke={COLORS.paper} strokeWidth={13} strokeLinecap="round" />
      <path d={`M ${head(0.5)} L ${to.x} ${to.y} L ${head(-0.5)}`} fill="none" stroke={COLORS.paper} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/**
 * Capa do vídeo (miniatura do YouTube). Um frame do vídeo como foto, um texto enorme com UMA palavra
 * em coral e, no máximo, um elemento de apoio. A geometria inteira vem de `planThumb`.
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({ photo, photo2, dim = 0, ...design }) => {
  const plan = planThumb(design);
  const scrim = plan.scrim;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.color.night, overflow: 'hidden' }}>
      {plan.images.map((slot, index) => (
        <Photo key={index} slot={slot} photo={index === 1 ? (photo2 ?? photo) : photo} />
      ))}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, transparent 58%, ${ink(0.42)} 100%)` }} />
      {dim > 0 ? <AbsoluteFill style={{ backgroundColor: ink(Math.min(0.6, dim)) }} /> : null}
      {scrim ? (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${scrim.axis === 'x' ? '90deg' : '180deg'}, ${scrim.stops.map((stop) => `${ink(stop.alpha)} ${stop.at * 100}%`).join(', ')})`,
          }}
        />
      ) : null}

      {plan.band ? (
        <div
          style={{
            position: 'absolute',
            left: plan.band.x,
            top: plan.band.y,
            width: plan.band.width,
            height: plan.band.height,
            backgroundColor: plan.bandColor ?? COLORS.paper,
            borderTop: `10px solid ${COLORS.coral}`,
            boxShadow: '0 -24px 60px -20px rgba(0,0,0,0.6)',
          }}
        />
      ) : null}

      {plan.divider ? (
        <>
          <svg width={THUMB.width} height={THUMB.height} style={{ position: 'absolute', inset: 0 }}>
            <line x1={plan.divider.top.x} y1={plan.divider.top.y - 20} x2={plan.divider.bottom.x} y2={plan.divider.bottom.y + 20} stroke={COLORS.paper} strokeWidth={12} />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: plan.divider.center.x - 66,
              top: plan.divider.center.y - 66,
              width: 132,
              height: 132,
              borderRadius: theme.radius.pill,
              backgroundColor: COLORS.coral,
              border: `8px solid ${COLORS.paper}`,
              boxShadow: theme.shadow.raised,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width={72} height={72} viewBox="0 0 24 24" fill="none" stroke={COLORS.white} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12h16M13 5l7 7-7 7" />
            </svg>
          </div>
        </>
      ) : null}

      {plan.number ? (
        <div
          style={{
            position: 'absolute',
            left: plan.number.rect.x,
            top: plan.number.rect.y,
            display: 'flex',
            alignItems: 'baseline',
            gap: 18,
            fontFamily: theme.font.body,
            fontWeight: 800,
            lineHeight: 0.84,
            letterSpacing: '-0.04em',
            whiteSpace: 'nowrap',
            textShadow: '0 10px 40px rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ fontSize: plan.number.fontSize, color: COLORS.coral }}>{plan.number.text}</span>
          {plan.number.unit ? <span style={{ fontSize: plan.number.unitSize, color: COLORS.white, letterSpacing: '-0.02em' }}>{plan.number.unit}</span> : null}
        </div>
      ) : null}

      {plan.blocks.map((block, index) => (
        <Text key={index} block={block} />
      ))}

      {plan.pill ? (
        <div
          style={{
            position: 'absolute',
            left: plan.pill.rect.x,
            top: plan.pill.rect.y,
            height: plan.pill.rect.height,
            padding: '0 28px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: theme.radius.pill,
            backgroundColor: plan.pill.background,
            color: plan.pill.color,
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: plan.pill.fontSize,
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
            boxShadow: theme.shadow.card,
          }}
        >
          {plan.pill.text}
        </div>
      ) : null}

      {plan.badge ? (
        <div
          style={{
            position: 'absolute',
            left: plan.badge.center.x - plan.badge.radius,
            top: plan.badge.center.y - plan.badge.radius,
            width: plan.badge.radius * 2,
            height: plan.badge.radius * 2,
            borderRadius: theme.radius.pill,
            backgroundColor: COLORS.coral,
            border: `8px solid ${COLORS.paper}`,
            boxShadow: theme.shadow.raised,
            transform: 'rotate(-9deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: COLORS.white,
            fontFamily: theme.font.body,
            fontWeight: 800,
            fontSize: plan.badge.fontSize,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          {plan.badge.text}
        </div>
      ) : null}

      {plan.arrow ? <Arrow {...plan.arrow} /> : null}
    </AbsoluteFill>
  );
};

/**
 * Só os campos obrigatórios: o Remotion mescla `defaultProps` com as props do render, então qualquer
 * opcional aqui (pílula, acento) vazaria para toda capa que não o declarasse.
 */
export const thumbnailSample: ThumbnailProps = {
  photo: null,
  layout: 'face-right',
  text: 'Larguei o\nback-end',
};
