/**
 * Default configuration values and helpers for `gpu-compute-dsl`.
 *
 * Mirrors the `contributes.configuration` block in `package.json` so the
 * extension code can fall back to sensible defaults when VSCode has not
 * yet resolved the workspace settings (e.g. on startup before any
 * editor opens a `.scgpu` file).
 */

import type { ScgpuFormatOptions, ScratchFormatOptions } from '@turbowasm/gpu-kernel-parser';

export const DEFAULT_PREFIX = '// ';
export const DEFAULT_WORKGROUP_SIZE = 64;

export interface ExtensionConfiguration {
  scratchCommentPrefix: string;
  enableDiagnostic: boolean;
  enableHover: boolean;
  formatterAlignedBinds: boolean;
  formatterLineEnding: '\n' | '\r\n';
  presetWorkgroupSize: number;
}

export const DEFAULT_CONFIGURATION: ExtensionConfiguration = {
  scratchCommentPrefix: DEFAULT_PREFIX,
  enableDiagnostic: true,
  enableHover: true,
  formatterAlignedBinds: false,
  formatterLineEnding: '\n',
  presetWorkgroupSize: DEFAULT_WORKGROUP_SIZE,
};

export type ConfigGetter = <T>(key: string, fallback: T) => T;

export function readConfiguration(get: ConfigGetter): ExtensionConfiguration {
  const ending = get<'LF' | 'CRLF'>(
    'turbowasm.formatter.normalizeLineEnding',
    'LF',
  );
  return {
    scratchCommentPrefix: get('turbowasm.scratchCommentPrefix', DEFAULT_CONFIGURATION.scratchCommentPrefix),
    enableDiagnostic: get('turbowasm.enableDiagnostic', DEFAULT_CONFIGURATION.enableDiagnostic),
    enableHover: get('turbowasm.enableHover', DEFAULT_CONFIGURATION.enableHover),
    formatterAlignedBinds: get(
      'turbowasm.formatter.alignedBinds',
      DEFAULT_CONFIGURATION.formatterAlignedBinds,
    ),
    formatterLineEnding: ending === 'CRLF' ? '\r\n' : '\n',
    presetWorkgroupSize: get(
      'turbowasm.preset.workgroupSize',
      DEFAULT_CONFIGURATION.presetWorkgroupSize,
    ),
  };
}

export function toScratchOptions(config: ExtensionConfiguration): ScratchFormatOptions {
  return {
    prefix: config.scratchCommentPrefix,
    lineEnding: '\n',
  };
}

export function toScgpuOptions(config: ExtensionConfiguration): ScgpuFormatOptions {
  return {
    alignedBinds: config.formatterAlignedBinds,
    lineEnding: config.formatterLineEnding,
  };
}
