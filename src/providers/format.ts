/**
 * Formatter for `.scgpu` files. Delegates the actual sorting /
 * whitespace cleanup to `@turbowasm/gpu-kernel-parser`'s
 * `formatScgpuDocument` and then emits a single `TextEdit` covering
 * the entire document.
 */

import * as vscode from 'vscode';
import { formatDocument } from '../util/parser';
import type { ScgpuFormatOptions } from '@turbowasm/gpu-kernel-parser';
import type { ExtensionConfiguration } from '../config/defaults';

export function registerFormatter(
  _context: vscode.ExtensionContext,
  getConfig: () => ExtensionConfiguration,
): vscode.Disposable {
  return vscode.languages.registerDocumentFormattingEditProvider('gpuComputeDsl', {
    provideDocumentFormattingEdits(document) {
      const text = document.getText();
      const options = toScgpuOptionsLocal(getConfig());
      const formatted = formatDocument(text, options);
      if (formatted === text) return [];
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length),
      );
      return [vscode.TextEdit.replace(fullRange, formatted)];
    },
  });
}

function toScgpuOptionsLocal(config: ExtensionConfiguration): ScgpuFormatOptions {
  return {
    alignedBinds: config.formatterAlignedBinds,
    lineEnding: config.formatterLineEnding,
  };
}
