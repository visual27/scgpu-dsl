/**
 * Command: re-run the parser over the active editor and surface the
 * resulting diagnostics in the Problems panel.
 */

import * as vscode from 'vscode';
import { parseDocument } from '../util/parser';
import type { DocumentStateCache } from '../util/documentState';

export function registerValidateCommand(
  _context: vscode.ExtensionContext,
  cache: DocumentStateCache,
): vscode.Disposable {
  return vscode.commands.registerCommand('turbowasm.validate', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open a .scgpu file first.');
      return;
    }
    const text = editor.document.getText();
    const result = parseDocument(text);
    const state = cache.get(editor.document.uri.toString());
    const total = (state?.diagnostics.length ?? 0) + result.diagnostics.length;
    if (total === 0) {
      vscode.window.showInformationMessage('No DSL issues.');
      return;
    }
    await vscode.commands.executeCommand('workbench.actions.view.problems');
    vscode.window.showInformationMessage(
      `${total} 件の DSL 診断が見つかりました。`,
    );
  });
}
