/**
 * Command: insert the minimum `@compute` skeleton at the current
 * cursor position. Uses `turbowasm.preset.workgroupSize` for the
 * `@workgroup_size` value when provided.
 */

import * as vscode from 'vscode';
import { skeletonToString } from '../util/directives';
import type { ExtensionConfiguration } from '../config/defaults';

export function registerInsertSkeletonCommand(
  _context: vscode.ExtensionContext,
  getConfig: () => ExtensionConfiguration,
): vscode.Disposable {
  return vscode.commands.registerCommand('turbowasm.insertComputeSkeleton', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open a .scgpu file first.');
      return;
    }
    const config = getConfig();
    const text = skeletonToString(config.presetWorkgroupSize);
    await editor.edit((builder) => {
      const position = editor.selection.active;
      builder.insert(position, text);
    });
  });
}
