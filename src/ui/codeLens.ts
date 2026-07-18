/**
 * Code lens provider that offers "Copy directive" actions above each
 * directive line. The provider reuses the cached directive state so
 * editing the file does not require re-parsing.
 */

import * as vscode from 'vscode';
import type { DocumentStateCache } from '../util/documentState';

export function registerCodeLens(cache: DocumentStateCache): vscode.Disposable {
  return vscode.languages.registerCodeLensProvider('gpuComputeDsl', new LensProvider(cache));
}

class LensProvider implements vscode.CodeLensProvider {
  public constructor(private readonly cache: DocumentStateCache) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const state = this.cache.get(document.uri.toString());
    if (!state) return [];
    const lenses: vscode.CodeLens[] = [];
    for (const region of state.regions) {
      for (const d of region.directives) {
        const range = new vscode.Range(
          new vscode.Position(d.range.start.line, 0),
          new vscode.Position(d.range.start.line, 0),
        );
        const lens = new vscode.CodeLens(range, {
          title: '📋 Copy directive',
          command: 'turbowasm.copyDirective',
          arguments: [document.uri, d.range.start.line],
        });
        lenses.push(lens);
      }
    }
    return lenses;
  }

  resolveCodeLens(lens: vscode.CodeLens): vscode.CodeLens {
    return lens;
  }
}
