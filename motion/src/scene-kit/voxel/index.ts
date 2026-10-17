// Kit voxel: o estilo "game" do canal (portado do voxel-story). Carrega Three.js: importe só em cena voxel.
export { buildBox, buildIsland, buildTerrain, bitmapToBlocks, linePath, ringRelief, type TerrainConfig } from './builders';
export { applyPose, horizonY, mixPose, type OrbitOptions, orbitPose, projectToScreen } from './camera';
export { clamp, easeInOut, easeOut, pop, progress, pulse, springs, swing } from './math';
export { type BurstOptions, burstBlocks, type RisingOptions, risingBlocks } from './particle-math';
export { Burst, Rising } from './Particles';
export { hash3, hashString, mulberry32 } from './random';
export { type Light, type SkyProps, skyGradient, Stage, type StageProps } from './Stage';
export { BLOCK_TYPES, getBlockMaterial, getMaterial, getTexture } from './textures';
export { voxelFonts, voxelPalette } from './theme';
export type { Block, CameraPose, Vec3 } from './types';
export { AchievementToast, type AchievementToastProps } from './ui/AchievementToast';
export { Caption, type CaptionProps } from './ui/Caption';
export { type AccentText, SAFE, type Segment, snap, splitAccent, type TimedText, typeSegments, useLayout } from './ui/layout';
export { PIXEL_COLORS, PIXEL_ICONS, pixelColor, PixelIcon, type PixelIconName, type PixelIconProps } from './ui/PixelIcon';
export { PixelPanel, type PixelPanelProps } from './ui/PixelPanel';
export { TerminalLine, type TerminalLineProps } from './ui/TerminalLine';
export { Tooltip, type TooltipProps } from './ui/Tooltip';
export { capacityFor, Ground, groupByType, VoxelWorld } from './VoxelWorld';
