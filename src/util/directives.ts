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

export function buildSkeleton(
  workgroupSize: number = DEFAULT_WORKGROUP_SIZE,
  existingSlots: readonly number[] = [],
): SkeletonTemplate {
  const wg = clampWorkgroupSize(workgroupSize);
  const first = smallestAvailableSlot(existingSlots);
  const second = smallestAvailableSlot([...existingSlots, first]);
  return {
    lines: [
      '@compute',
      `@bind ""(${first}) ro`,
      `@bind ""(${second}) rw f32`,
      `@workgroup_size(${wg})`,
      `@repeat R0:global_x = R0 + 1`,
      `@map "" <- 0`,
    ],
  };
}

export function skeletonToString(
  workgroupSize: number = DEFAULT_WORKGROUP_SIZE,
  existingSlots: readonly number[] = [],
): string {
  return buildSkeleton(workgroupSize, existingSlots).lines.join('\n');
}

/**
 * Return the smallest non-negative integer that is not present in
 * `used`. Gap-filling semantics: `{0,1,2,5,6}` → `3`. Negative or
 * non-integer entries in `used` are ignored so the helper stays
 * tolerant of partially-parsed directives.
 */
export function smallestAvailableSlot(used: readonly number[]): number {
  const seen = new Set<number>();
  for (const slot of used) {
    if (Number.isInteger(slot) && slot >= 0) seen.add(slot);
  }
  let next = 0;
  while (seen.has(next)) next += 1;
  return next;
}

function clampWorkgroupSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return DEFAULT_WORKGROUP_SIZE;
  if (value > 256) return 256;
  return Math.floor(value);
}
