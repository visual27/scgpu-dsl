/**
 * Document symbol provider for `.scgpu` files. Surfaces `@bind`,
 * `@repeat`, `@map`, `@workgroup_size`, and `@max` directives as
 * outline entries so users can navigate large kernels via the
 * "Outline" view.
 */

import * as vscode from 'vscode';
import type {
  BindDirective,
  MapDirective,
  MaxDirective,
  RepeatDirective,
  WorkgroupSizeDirective,
} from '@turbowasm/gpu-kernel-parser';
import type { DocumentState, DocumentStateCache } from '../util/documentState';

export function registerSymbols(cache: DocumentStateCache): vscode.Disposable {
  return vscode.languages.registerDocumentSymbolProvider(
    'gpuComputeDsl',
    new SymbolProvider(cache),
  );
}

class SymbolProvider implements vscode.DocumentSymbolProvider {
  public constructor(private readonly cache: DocumentStateCache) {}

  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const state = this.cache.get(document.uri.toString());
    if (!state) return [];
    return buildSymbols(state);
  }
}

export function buildSymbols(state: DocumentState): vscode.DocumentSymbol[] {
  const symbols: vscode.DocumentSymbol[] = [];
  for (const region of state.regions) {
    const regionRange = toVsRange(region.range);
    const regionSymbol = new vscode.DocumentSymbol(
      region.regionId,
      '',
      vscode.SymbolKind.Namespace,
      regionRange,
      regionRange,
    );
    for (const d of region.directives) {
      const symbol = directiveSymbol(d.directive.kind, d.directive, d.range);
      if (symbol) regionSymbol.children.push(symbol);
    }
    symbols.push(regionSymbol);
  }
  return symbols;
}

function directiveSymbol(
  kind: string,
  directive:
    | BindDirective
    | MapDirective
    | MaxDirective
    | RepeatDirective
    | WorkgroupSizeDirective,
  range: vscode.Range | { start: { line: number; character: number }; end: { line: number; character: number } },
): vscode.DocumentSymbol | undefined {
  const vsRange = isVsRange(range) ? range : toVsRange(range);
  switch (kind) {
    case 'bind': {
      const d = directive as BindDirective;
      return new vscode.DocumentSymbol(
        `@bind ${d.name}(${d.slot})`,
        d.readOnly ? 'read-only' : 'read-write',
        vscode.SymbolKind.Variable,
        vsRange,
        vsRange,
      );
    }
    case 'repeat': {
      const d = directive as RepeatDirective;
      return new vscode.DocumentSymbol(
        `@repeat ${d.name}${d.axis === 'sequential' ? '' : ':' + d.axis}`,
        d.formula,
        vscode.SymbolKind.Function,
        vsRange,
        vsRange,
      );
    }
    case 'map': {
      const d = directive as MapDirective;
      return new vscode.DocumentSymbol(
        `@map ${d.var}`,
        d.formula,
        vscode.SymbolKind.Constant,
        vsRange,
        vsRange,
      );
    }
    case 'max': {
      const d = directive as MaxDirective;
      return new vscode.DocumentSymbol(
        `@max ${d.name}`,
        `= ${d.value}`,
        vscode.SymbolKind.Constant,
        vsRange,
        vsRange,
      );
    }
    case 'workgroup_size': {
      const d = directive as WorkgroupSizeDirective;
      return new vscode.DocumentSymbol(
        '@workgroup_size',
        `(${d.x}, ${d.y}, ${d.z})`,
        vscode.SymbolKind.Number,
        vsRange,
        vsRange,
      );
    }
    default:
      return undefined;
  }
}

function toVsRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }): vscode.Range {
  return new vscode.Range(
    new vscode.Position(range.start.line, range.start.character),
    new vscode.Position(range.end.line, range.end.character),
  );
}

function isVsRange(value: unknown): value is vscode.Range {
  return value instanceof vscode.Range;
}
