import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatScratchComment,
  formatScgpuDocument,
  parseScgpuDocument,
} from '@turbowasm/gpu-kernel-parser';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(path.join(fixtures, name), 'utf8');
}

describe('fixtures roundtrip', () => {
  it('parses the skeleton fixture without diagnostics', () => {
    const text = loadFixture('skeleton.scgpu');
    const result = parseScgpuDocument(text);
    expect(result.regions).toHaveLength(1);
    const region = result.regions[0];
    expect(region?.directives.map((d) => d.directive.kind)).toEqual([
      'bind',
      'bind',
      'workgroup_size',
      'repeat',
      'map',
    ]);
    expect(region?.diagnostics.filter((d) => d.severity === 'warn')).toEqual([]);
  });

  it('preserves frontmatter in the full fixture', () => {
    const text = loadFixture('full.scgpu');
    const result = parseScgpuDocument(text);
    expect(result.frontmatter.range).not.toBeNull();
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]?.directives.map((d) => d.directive.kind)).toEqual([
      'bind',
      'bind',
      'max',
      'max',
      'workgroup_size',
      'repeat',
      'map',
    ]);
  });

  it('surfaces diagnostics for the broken fixture', () => {
    const text = loadFixture('broken.scgpu');
    const result = parseScgpuDocument(text);
    const messages = result.regions.flatMap((r) => r.diagnostics.map((d) => d.message));
    expect(messages.some((m) => m.includes('@bogus'))).toBe(true);
    expect(messages.some((m) => m.includes('@bind'))).toBe(true);
    expect(messages.some((m) => m.includes('@repeat'))).toBe(true);
    expect(messages.some((m) => m.includes('@map'))).toBe(true);
  });

  it('strips a leading BOM', () => {
    const text = loadFixture('utf8-bom.scgpu');
    const result = parseScgpuDocument(text);
    expect(result.regions).toHaveLength(1);
    expect(result.regions[0]?.directives[0]?.directive.kind).toBe('bind');
  });

  it('formats the unsorted fixture into the canonical order', () => {
    const text = loadFixture('unsorted.scgpu');
    const formatted = formatScgpuDocument(text);
    const lines = formatted.trim().split('\n');
    expect(lines[0]).toBe('@compute');
    expect(lines.indexOf('@bind tmp0(0) ro')).toBeLessThan(
      lines.indexOf('@repeat R0:global_x = R0 + 1'),
    );
    expect(lines.indexOf('@repeat R0:global_x = R0 + 1')).toBeLessThan(
      lines.indexOf('@map R0 <- 0'),
    );
  });

  it('emits Scratch-comment-prefixed text', () => {
    const text = loadFixture('skeleton.scgpu');
    const scratch = formatScratchComment(text);
    const lines = scratch.split('\n');
    expect(lines.every((line) => line.startsWith('// '))).toBe(true);
  });
});
