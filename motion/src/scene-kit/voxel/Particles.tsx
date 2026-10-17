import { type BurstOptions, burstBlocks, type RisingOptions, risingBlocks } from './particle-math';
import { VoxelWorld } from './VoxelWorld';

export const Burst: React.FC<BurstOptions & { frame: number }> = ({ frame, ...options }) => {
  const blocks = burstBlocks(frame, options);
  return blocks.length ? <VoxelWorld blocks={blocks} /> : null;
};

export const Rising: React.FC<RisingOptions & { frame: number }> = ({ frame, ...options }) => {
  const blocks = risingBlocks(frame, options);
  return blocks.length ? <VoxelWorld blocks={blocks} /> : null;
};
