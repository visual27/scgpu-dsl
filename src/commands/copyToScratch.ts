/**
 * Command: copy the active editor's `.scgpu` body to the clipboard
 * formatted as a Scratch comment (every line prefixed with `// `).
 */

import * as vscode from 'vscode';
import { scratchComment } from '../util/parser';
import type { ScratchFormatOptions } from '@turbowasm/gpu-kernel-parser';
import type { ExtensionConfiguration } from '../config/defaults';

export function registerCopyToScratchCommand(
  _context: vscode.ExtensionContext,
  getConfig: () => ExtensionConfiguration,
): vscode.Disposable {
  return vscode.commands.registerCommand('turbowasm.copyToScratch', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open a .scgpu file first.');
      return;
    }
    const text = editor.document.getText();
    const config = getConfig();
    const formatted = scratchComment(text, toScratchOptionsLocal(config));
    await vscode.env.clipboard.writeText(formatted);
    const lineCount = formatted.split('\n').length;
    vscode.window.showInformationMessage(`${lineCount} 行をコピーしました。`);
  });
}

function toScratchOptionsLocal(config: ExtensionConfiguration): ScratchFormatOptions {
  return {
    prefix: config.scratchCommentPrefix,
    lineEnding: '\n',
  };
}
