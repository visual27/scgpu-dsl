import { describe, expect, it } from 'vitest';
import {
  buildSkeleton,
} from '../../src/util/directives';

describe('buildSkeleton', () => {
  it('produces a minimum-runnable skeleton', () => {
    const skeleton = buildSkeleton(64);
    expect(skeleton.lines).toEqual([
      '@compute',
      '@bind tmp0(0) ro',
      '@bind buff(1) rw f32',
      '@workgroup_size(64)',
      '@repeat R0:global_x = R0 + 1',
      '@map R0 <- 0',
    ]);
  });

  it('clamps invalid workgroup sizes', () => {
    expect(buildSkeleton(0).lines.some((l: string) => l.startsWith('@workgroup_size(64)'))).toBe(true);
    expect(buildSkeleton(512).lines.some((l: string) => l.startsWith('@workgroup_size(256)'))).toBe(true);
    expect(buildSkeleton(8).lines.some((l: string) => l.startsWith('@workgroup_size(8)'))).toBe(true);
  });

  it('falls back to 64 for non-finite values', () => {
    expect(buildSkeleton(Number.NaN).lines.some((l: string) => l.startsWith('@workgroup_size(64)'))).toBe(true);
  });
});
