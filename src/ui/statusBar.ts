/**
 * Status bar item that shows the live diagnostic count for the active
 * `.scgpu` document. The item is hidden when the active editor is not
 * a `.scgpu` file.
 */

import * as vscode from 'vscode';
import type { DocumentStateCache } from '../util/documentState';

export function registerStatusBar(cache: DocumentStateCache): vscode.Disposable {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'workbench.actions.view.problems';
  item.text = '$(check) TurboWasm';
  item.tooltip = 'Open the Problems panel';

  function refresh(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'gpuComputeDsl') {
      item.hide();
      return;
    }
    const state = cache.get(editor.document.uri.toString());
    const count = state ? state.diagnostics.length : 0;
    if (count === 0) {
      item.text = '$(check) TurboWasm';
      item.tooltip = 'No DSL issues';
    } else {
      item.text = `$(warning) TurboWasm: ${count}`;
      item.tooltip = `${count} DSL issue(s). Click to open the Problems panel.`;
    }
    item.show();
  }

  refresh();
  const sub = vscode.window.onDidChangeActiveTextEditor(refresh);
  const sub2 = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.languageId === 'gpuComputeDsl') refresh();
  });
  return vscode.Disposable.from(item, sub, sub2);
}
