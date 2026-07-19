import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildSkeleton,
  smallestAvailableSlot,
  skeletonToString,
} from '../../src/util/directives';

const root = fileURLToPath(new URL('../..', import.meta.url));

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as T;
}

describe('buildSkeleton', () => {
  it('produces a minimum-runnable skeleton', () => {
    const skeleton = buildSkeleton(64);
    expect(skeleton.lines).toEqual([
      '@compute',
      '@bind ""(0) ro',
      '@bind ""(1) rw f32',
      '@workgroup_size(64)',
      '@repeat R0:global_x = R0 + 1',
      '@map "" <- 0',
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

  it('picks the smallest available slot id around existing declarations', () => {
    const skeleton = buildSkeleton(64, [0, 1, 2]);
    expect(skeleton.lines[1]).toBe('@bind ""(3) ro');
    expect(skeleton.lines[2]).toBe('@bind ""(4) rw f32');
  });

  it('fills gaps in the existing slot range', () => {
    const skeleton = buildSkeleton(64, [0, 1, 2, 5, 6]);
    expect(skeleton.lines[1]).toBe('@bind ""(3) ro');
    expect(skeleton.lines[2]).toBe('@bind ""(4) rw f32');
  });

  it('serialises to a string with the requested newline', () => {
    const text = skeletonToString(64, [7]);
    expect(text).toBe(
      '@compute\n@bind ""(0) ro\n@bind ""(1) rw f32\n@workgroup_size(64)\n@repeat R0:global_x = R0 + 1\n@map "" <- 0',
    );
  });
});

describe('smallestAvailableSlot', () => {
  it('returns 0 when no slots are used', () => {
    expect(smallestAvailableSlot([])).toBe(0);
  });

  it('returns max+1 when the used range is contiguous from 0', () => {
    expect(smallestAvailableSlot([0, 1, 2])).toBe(3);
  });

  it('fills gaps inside the used range', () => {
    expect(smallestAvailableSlot([0, 1, 2, 5, 6])).toBe(3);
  });

  it('ignores negative and non-integer entries', () => {
    expect(smallestAvailableSlot([-1, 1.5, Number.NaN, 0])).toBe(1);
  });
});

describe('editor configuration', () => {
  it('uses parser-compatible snippet bodies', () => {
    const snippets = readJson<Record<string, { body: string[] }>>('snippets/gpu-compute-dsl.json');
    expect(snippets['@compute']?.body).toEqual(['@compute', '$0']);
    expect(snippets['@bind ro']?.body).toEqual(['@bind "${1}"(${2:0}) ro f32']);
    expect(snippets['@bind rw']?.body).toEqual(['@bind "${1}"(${2:1}) rw f32']);
    expect(snippets['@map']?.body).toEqual(['@map ${1:""} <- ${2:0}']);
    expect(snippets['kernel skeleton']?.body.slice(1, 3)).toEqual([
      '@bind "${1}"(0) ro',
      '@bind "${2}"(1) rw f32',
    ]);
  });

  it('inserts only the requested newline on Enter', () => {
    const configuration = readJson<{
      indentationRules?: unknown;
      onEnterRules: Array<{ action: { appendText?: string } }>;
    }>('language-configuration.json');
    expect(configuration.indentationRules).toBeUndefined();
    expect(configuration.onEnterRules.every((rule) => rule.action.appendText === undefined)).toBe(true);
  });
});
