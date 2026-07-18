/**
 * Thin convenience wrappers around the `@turbowasm/gpu-kernel-parser`
 * package. The VSCode extension never reaches into the parser package
 * directly — it always goes through these helpers so we can swap the
 * parser implementation later without touching the providers.
 */

import {
  parseScgpuDocument,
  formatScratchComment,
  formatScgpuDocument,
} from '@turbowasm/gpu-kernel-parser';
import type {
  ParseScgpuDocumentOptions,
  ParseScgpuDocumentResult,
  ScgpuFormatOptions,
  ScratchFormatOptions,
} from '@turbowasm/gpu-kernel-parser';

export function parseDocument(
  text: string,
  options: ParseScgpuDocumentOptions = {},
): ParseScgpuDocumentResult {
  return parseScgpuDocument(text, options);
}

export function scratchComment(
  text: string,
  options: ScratchFormatOptions = {},
): string {
  return formatScratchComment(text, options);
}

export function formatDocument(
  text: string,
  options: ScgpuFormatOptions = {},
): string {
  return formatScgpuDocument(text, options);
}
