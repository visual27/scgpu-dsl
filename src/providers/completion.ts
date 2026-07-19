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
    return directiveHeadItems(position, before);
  }
  if (before.match(/^\s*@bind\s+(?:"[^"\\]*(?:\\.[^"\\]*)*"|[A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\d*\s*\)\s+(ro|rw)\s*$/i)) {
    return dtypeItems();
  }
  if (before.match(/^\s*@bind\s+(?:"(?:\\.|[^"\\])*|[A-Za-z_][A-Za-z0-9_]*)?$/i) && state) {
    return bindingNameItems(state, position, before);
  }
  if (before.match(/^\s*@bind\s+(?:"[^"\\]*(?:\\.[^"\\]*)*"|[A-Za-z_][A-Za-z0-9_]*)\s*\($/i)) {
    return slotItem(state);
  }
  if (before.match(/^\s*@max\s+\S*$/i) && state) {
    return maxGroupItems(state);
  }
  if (before.match(/^\s*@repeat\s+\S+:\s*\S*$/i)) {
    return axisItems();
  }
  if (before.match(/^\s*@repeat\s+\S*$/i)) {
    return repeatNameItems(state);
  }
  if (before.match(/^\s*@map\s+\S*$/i) && state) {
    return mapVarItems(state);
  }

  // Generic fallback: suggest directive heads if the cursor is on a
  // bare `@` or near one.
  if (/@\w*$/.test(before)) {
    return directiveHeadItems(position, before);
  }

  return [];
}

function directiveHeadItems(
  position: vscode.Position,
  before: string,
): vscode.CompletionItem[] {
  const token = before.match(/@\w*$/)?.[0] ?? '';
  const range = new vscode.Range(
    position.line,
    position.character - token.length,
    position.line,
    position.character,
  );
  return DIRECTIVE_HEADS.map((name) => {
    const item = new vscode.CompletionItem(`@${name}`, vscode.CompletionItemKind.Keyword);
    item.detail = `TurboWasm directive`;
    item.insertText = `@${name}`;
    item.range = range;
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

function bindingNameItems(
  state: DocumentState,
  position: vscode.Position,
  before: string,
): vscode.CompletionItem[] {
  const tokenStart = before.match(/^\s*@bind\s+/)?.[0].length ?? position.character;
  const range = new vscode.Range(
    position.line,
    tokenStart,
    position.line,
    position.character,
  );
  // Detect whether the user has typed anything after `@bind `. When
  // the slot is empty we lead with a "new quoted binding" suggestion
  // so the cursor lands between the empty quotes immediately.
  const namePart = before.match(/^\s*@bind\s+([^\s]*)$/i)?.[1] ?? '';
  const isEmpty = namePart.length === 0;

  const seen = new Set<string>();
  for (const d of state.directives) {
    if (d.directive.kind === 'bind') {
      seen.add((d.directive as BindDirective).name);
    }
  }

  const items: vscode.CompletionItem[] = [];

  if (isEmpty) {
    const newItem = new vscode.CompletionItem('""  new quoted binding', vscode.CompletionItemKind.Variable);
    newItem.detail = 'new quoted binding';
    newItem.documentation = 'Insert an empty quoted name; the cursor lands between the quotes.';
    newItem.insertText = new vscode.SnippetString('"$1"');
    newItem.range = range;
    newItem.sortText = '\0';
    items.push(newItem);
  }

  for (const name of seen) {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
    item.detail = 'existing binding';
    item.insertText = formatNameToken(name);
    item.range = range;
    items.push(item);
  }

  return items;
}

function slotItem(state: DocumentState | undefined): vscode.CompletionItem[] {
  const used = new Set<number>();
  if (state) {
    for (const d of state.directives) {
      if (d.directive.kind === 'bind') {
        used.add((d.directive as BindDirective).slot);
      }
    }
  }
  let next = 0;
  while (used.has(next)) next += 1;
  const item = new vscode.CompletionItem(String(next), vscode.CompletionItemKind.Value);
  item.detail = 'smallest available slot';
  item.insertText = String(next);
  return [item];
}

function maxGroupItems(state: DocumentState): vscode.CompletionItem[] {
  const seen = new Set<string>();
  for (const d of state.directives) {
    if (d.directive.kind === 'max') {
      seen.add(d.directive.name);
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

function formatNameToken(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
