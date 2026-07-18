/**
 * Completion provider for `.scgpu` files.
 *
 * Triggers on `@`, `(`, `,`, `<`, `:`, and space. Suggests directive
 * names, axis names, dtype tokens, and any binding/repeat names already
 * seen in the document. The provider keeps no state of its own —
 * `DocumentStateCache` is the single source of truth.
 */

import * as vscode from 'vscode';
import type { DocumentState, DocumentStateCache } from '../util/documentState';
import {
  BIND_DTYPES,
  DIRECTIVE_HEADS,
  KNOWN_AXES,
  SEQUENTIAL_AXIS,
  type BindDirective,
  type DocumentDirective,
} from '@turbowasm/gpu-kernel-parser';

const TRIGGER_CHARS = ['@', '(', ',', '<', ':', ' '];

export function registerCompletion(
  _context: vscode.ExtensionContext,
  cache: DocumentStateCache,
): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    'gpuComputeDsl',
    {
      provideCompletionItems(document, position) {
        const state = cache.get(document.uri.toString());
        const items = buildCompletionItems(document, position, state);
        return items;
      },
    },
    ...TRIGGER_CHARS,
  );
}

export function buildCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  state: DocumentState | undefined,
): vscode.CompletionItem[] {
  const lineText = document.lineAt(position.line).text;
  const before = lineText.slice(0, position.character);

  if (before.match(/^\s*@$/)) {
    return directiveHeadItems();
  }
  if (before.match(/^\s*@bind\s+\S*\(\s*\d*\s*\)\s+(ro|rw)\s*$/i)) {
    return dtypeItems();
  }
  if (before.match(/^\s*@bind\s+\S*$/i) && state) {
    return bindingNameItems(state);
  }
  if (before.match(/^\s*@bind\s+\S*\($/i)) {
    return slotItem(state);
  }
  if (before.match(/^\s*@max\s+\S*$/i) && state) {
    return maxGroupItems(state);
  }
  if (before.match(/^\s*@repeat\s+\S*$/i)) {
    return repeatNameItems(state);
  }
  if (before.match(/^\s*@repeat\s+\S+:\s*\S*$/i)) {
    return axisItems();
  }
  if (before.match(/^\s*@map\s+\S*$/i) && state) {
    return mapVarItems(state);
  }

  // Generic fallback: suggest directive heads if the cursor is on a
  // bare `@` or near one.
  if (/@\w*$/.test(before)) {
    return directiveHeadItems();
  }

  return [];
}

function directiveHeadItems(): vscode.CompletionItem[] {
  return DIRECTIVE_HEADS.map((name) => {
    const item = new vscode.CompletionItem(`@${name}`, vscode.CompletionItemKind.Keyword);
    item.detail = `TurboWasm directive`;
    item.insertText = `@${name}`;
    item.command = { command: 'editor.action.triggerSuggest', title: 'Suggest' };
    return item;
  });
}

function dtypeItems(): vscode.CompletionItem[] {
  return BIND_DTYPES.map((dtype) => {
    const item = new vscode.CompletionItem(dtype, vscode.CompletionItemKind.TypeParameter);
    item.detail = 'binding dtype';
    return item;
  });
}

function bindingNameItems(state: DocumentState): vscode.CompletionItem[] {
  const seen = new Set<string>();
  for (const d of state.directives) {
    if (d.directive.kind === 'bind') {
      seen.add((d.directive as BindDirective).name);
    }
  }
  return [...seen].map((name) => {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
    item.detail = 'existing binding';
    return item;
  });
}

function slotItem(state: DocumentState | undefined): vscode.CompletionItem[] {
  let maxSlot = -1;
  if (state) {
    for (const d of state.directives) {
      if (d.directive.kind === 'bind') {
        const slot = (d.directive as BindDirective).slot;
        if (slot > maxSlot) maxSlot = slot;
      }
    }
  }
  const next = maxSlot + 1;
  const item = new vscode.CompletionItem(String(next), vscode.CompletionItemKind.Value);
  item.detail = 'next slot';
  item.insertText = String(next);
  return [item];
}

function maxGroupItems(state: DocumentState): vscode.CompletionItem[] {
  const seen = new Set<string>();
  for (const d of state.directives) {
    if (d.directive.kind === 'max') {
      seen.add(d.directive.groupName);
    }
  }
  return [...seen].map((name) => {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
    item.detail = 'existing @max group';
    return item;
  });
}

function repeatNameItems(state: DocumentState | undefined): vscode.CompletionItem[] {
  let nextIndex = 0;
  if (state) {
    for (const d of state.directives) {
      if (d.directive.kind === 'repeat') {
        const m = (d.directive as { name: string }).name.match(/^R(\d+)$/);
        if (m) {
          const idx = Number.parseInt(m[1] ?? '0', 10);
          if (idx >= nextIndex) nextIndex = idx + 1;
        }
      }
    }
  }
  const item = new vscode.CompletionItem(`R${nextIndex}`, vscode.CompletionItemKind.Variable);
  item.detail = 'next repeat index';
  item.insertText = `R${nextIndex}`;
  return [item];
}

function axisItems(): vscode.CompletionItem[] {
  return [...KNOWN_AXES, SEQUENTIAL_AXIS].map((axis) => {
    const item = new vscode.CompletionItem(axis, vscode.CompletionItemKind.EnumMember);
    item.detail = 'reserved axis';
    return item;
  });
}

function mapVarItems(state: DocumentState): vscode.CompletionItem[] {
  const seen = new Set<string>();
  for (const d of state.directives) {
    if (d.directive.kind === 'repeat') {
      seen.add((d.directive as { name: string }).name);
    }
  }
  return [...seen].map((name) => {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
    item.detail = 'existing @repeat name';
    return item;
  });
}

export function directiveAtLine(
  state: DocumentState,
  line: number,
): DocumentDirective | undefined {
  for (const region of state.regions) {
    for (const d of region.directives) {
      if (d.range.start.line === line) return d;
    }
  }
  return undefined;
}
