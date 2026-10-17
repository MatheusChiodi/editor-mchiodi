// Kit papel: primitivas das cenas ilustrativas. O kit voxel fica em './voxel' e é importado à parte,
// para que uma cena de papel não carregue o Three.js.
export { Arrow, type ArrowGeometry, arrowGeometry, type ArrowProps, type Point } from './Arrow';
export { Counter, type CounterProps } from './Counter';
export { type BadgeVariant, IconBadge, type IconBadgeProps } from './IconBadge';
export { AnyIcon, Icon, ICON_NAMES, type IconName, type IconProps, ICONS, isIconName, isStrokeIconName, type StrokeIconName, type TechIconName } from './icons';
export { Eyebrow, type EyebrowProps, Pill, type PillProps, type PillVariant } from './Pill';
export { Reveal, type RevealProps } from './Reveal';
export { SceneBackground, type SceneBackgroundProps } from './SceneBackground';
export { SceneCard, type SceneCardProps } from './SceneCard';
export { Split, splitFlex, type SplitProps } from './Split';
export { Statement, type StatementProps, statementTimes } from './Statement';
export { at, enter, popIn, rise, window } from './timing';
export { alpha, CAPTION_ZONE, longShadow, pillShadow, text, type Tone, toneColors, WORD_STAGGER } from './tokens';
export { type MarkedWord, markWords, MaskedWord, type MaskedWordProps, wordDelay, Words, wordsEnd, type WordsProps } from './Words';
