/**
 * Helper that builds the minimum-runnable skeleton snippet from the
 * extension configuration. Lives in its own module so both the
 * `turbowasm.insertComputeSkeleton` command and the `skel` snippet can
 * share a single source of truth.
 */

import { DEFAULT_WORKGROUP_SIZE } from '../config/defaults';

export interface SkeletonTemplate {
  lines: string[];
}

export function buildSkeleton(workgroupSize: number = DEFAULT_WORKGROUP_SIZE): SkeletonTemplate {
  const wg = clampWorkgroupSize(workgroupSize);
  return {
    lines: [
      '@compute',
      `@bind tmp0(0) ro`,
      `@bind buff(1) rw f32`,
      `@workgroup_size(${wg})`,
      `@repeat R0:global_x = R0 + 1`,
      `@map R0 <- 0`,
    ],
  };
}

export function skeletonToString(workgroupSize: number = DEFAULT_WORKGROUP_SIZE): string {
  return buildSkeleton(workgroupSize).lines.join('\n');
}

function clampWorkgroupSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return DEFAULT_WORKGROUP_SIZE;
  if (value > 256) return 256;
  return Math.floor(value);
}
