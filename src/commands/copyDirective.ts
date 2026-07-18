/**
 * Command: copy the single directive line that owns the requested
 * position. Triggered by the CodeLens "📋 Copy directive" affordance.
 */

import * as vscode from 'vscode';
import type { DocumentStateCache } from '../util/documentState';

export function registerCopyDirectiveCommand(
  _context: vscode.ExtensionContext,
  cache: DocumentStateCache,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'turbowasm.copyDirective',
    async (uri: vscode.Uri, line: number) => {
      const state = cache.get(uri.toString());
      if (!state) {
        vscode.window.showWarningMessage('Document is not parsed yet.');
        return;
      }
      const directive = state.directives.find((d) => d.range.start.line === line);
      if (!directive) {
        vscode.window.showWarningMessage('No directive at that line.');
        return;
      }
      await vscode.env.clipboard.writeText(directive.raw);
      vscode.window.showInformationMessage('Directive copied to clipboard.');
    },
  );
}
