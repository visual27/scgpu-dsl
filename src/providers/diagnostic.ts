/**
 * Diagnostic provider for `.scgpu` files. Wraps the parser's
 * `Diagnostic` list into VSCode `Diagnostic` objects and adds a few
 * extension-only checks (duplicate binding slot, etc.).
 *
 * Diagnostics are stored in a single `DiagnosticCollection` keyed by
 * the language id so the Problems panel groups them automatically.
 */

import * as vscode from 'vscode';
import type { DocumentState, DocumentStateCache } from '../util/documentState';
import type { ExtensionConfiguration } from '../config/defaults';
import type {
  BindDirective,
  DocumentDirective,
  MapDirective,
  RepeatDirective,
  Severity,
} from '@turbowasm/gpu-kernel-parser';

export function registerDiagnostics(
  context: vscode.ExtensionContext,
  cache: DocumentStateCache,
  getConfig: () => ExtensionConfiguration,
): vscode.DiagnosticCollection {
  const collection = vscode.languages.createDiagnosticCollection('gpuComputeDsl');
  context.subscriptions.push(collection);

  function refresh(document: vscode.TextDocument): void {
    const config = getConfig();
    if (!config.enableDiagnostic) {
      collection.delete(document.uri);
      return;
    }
    const state = cache.get(document.uri.toString());
    if (!state) {
      collection.delete(document.uri);
      return;
    }
    const diags = buildDiagnostics(state, document);
    collection.set(document.uri, diags);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === 'gpuComputeDsl') refresh(event.document);
    }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === 'gpuComputeDsl') refresh(document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      collection.delete(document.uri);
    }),
  );

  return collection;
}

export function buildDiagnostics(
  state: DocumentState,
  document: vscode.TextDocument,
): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  for (const region of state.regions) {
    for (const d of region.diagnostics) {
      diags.push(toVsDiagnostic(d, d.line ?? region.markerLine, d.column ?? 0, document));
    }
  }
  diags.push(...extensionChecks(state, document));
  return diags;
}

function toVsDiagnostic(
  diag: { severity: Severity; code: string; message: string },
  line: number,
  column: number,
  document: vscode.TextDocument,
): vscode.Diagnostic {
  const safeLine = Math.max(0, Math.min(line, document.lineCount - 1));
  const range = new vscode.Range(
    new vscode.Position(safeLine, column),
    new vscode.Position(safeLine, Number.MAX_SAFE_INTEGER),
  );
  return new vscode.Diagnostic(
    range,
    diag.message,
    severityToVs(diag.severity),
  );
}

function severityToVs(severity: Severity): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    case 'warn':
      return vscode.DiagnosticSeverity.Warning;
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    default:
      return vscode.DiagnosticSeverity.Warning;
  }
}

function extensionChecks(
  state: DocumentState,
  document: vscode.TextDocument,
): vscode.Diagnostic[] {
  const directives = state.directives.map((d) => d.directive);
  const diags: vscode.Diagnostic[] = [];

  diags.push(...checkDuplicateBinds(directives, document));
  diags.push(...checkDuplicateRepeats(directives, document));
  diags.push(...checkDuplicateMaps(directives, document));
  diags.push(...checkMapReferencingRepeat(directives, document));

  return diags;
}

function checkDuplicateBinds(
  directives: readonly { kind: string }[],
  document: vscode.TextDocument,
): vscode.Diagnostic[] {
  const binds = directives.filter((d): d is BindDirective => d.kind === 'bind');
  const out: vscode.Diagnostic[] = [];
  const seenNames = new Set<string>();
  const seenSlots = new Set<number>();
  for (const bind of binds) {
    if (seenNames.has(bind.name)) {
      out.push(
        warning(
          `duplicate @bind name '${bind.name}'`,
          bind.line,
          bind.column,
          document,
        ),
      );
    }
    if (seenSlots.has(bind.slot)) {
      out.push(
        warning(
          `duplicate @bind slot ${bind.slot} (${bind.name})`,
          bind.line,
          bind.column,
          document,
        ),
      );
    }
    seenNames.add(bind.name);
    seenSlots.add(bind.slot);
  }
  return out;
}

function checkDuplicateRepeats(
  directives: readonly { kind: string }[],
  document: vscode.TextDocument,
): vscode.Diagnostic[] {
  const repeats = directives.filter((d): d is RepeatDirective => d.kind === 'repeat');
  const seen = new Set<string>();
  const out: vscode.Diagnostic[] = [];
  for (const r of repeats) {
    if (seen.has(r.name)) {
      out.push(
        warning(
          `duplicate @repeat name '${r.name}'`,
          r.line,
          r.column,
          document,
        ),
      );
    }
    seen.add(r.name);
  }
  return out;
}

function checkDuplicateMaps(
  directives: readonly { kind: string }[],
  document: vscode.TextDocument,
): vscode.Diagnostic[] {
  const maps = directives.filter((d): d is MapDirective => d.kind === 'map');
  const seen = new Set<string>();
  const out: vscode.Diagnostic[] = [];
  for (const m of maps) {
    if (seen.has(m.var)) {
      out.push(
        warning(
          `duplicate @map var '${m.var}'`,
          m.line,
          m.column,
          document,
        ),
      );
    }
    seen.add(m.var);
  }
  return out;
}

function checkMapReferencingRepeat(
  directives: readonly { kind: string }[],
  document: vscode.TextDocument,
): vscode.Diagnostic[] {
  const maps = directives.filter((d): d is MapDirective => d.kind === 'map');
  const repeats = directives.filter((d): d is RepeatDirective => d.kind === 'repeat');
  const repeatNames = new Set(repeats.map((r) => r.name));
  const out: vscode.Diagnostic[] = [];
  for (const m of maps) {
    if (!repeatNames.has(m.var)) {
      out.push(
        information(
          `@map var '${m.var}' does not reference any @repeat name in this document`,
          m.line,
          m.column,
          document,
        ),
      );
    }
  }
  return out;
}

function warning(
  message: string,
  line: number,
  column: number,
  document: vscode.TextDocument,
): vscode.Diagnostic {
  return new vscode.Diagnostic(
    rangeFor(line, column, document),
    message,
    vscode.DiagnosticSeverity.Warning,
  );
}

function information(
  message: string,
  line: number,
  column: number,
  document: vscode.TextDocument,
): vscode.Diagnostic {
  return new vscode.Diagnostic(
    rangeFor(line, column, document),
    message,
    vscode.DiagnosticSeverity.Information,
  );
}

function rangeFor(
  line: number,
  column: number,
  document: vscode.TextDocument,
): vscode.Range {
  const safeLine = Math.max(0, Math.min(line, document.lineCount - 1));
  return new vscode.Range(
    new vscode.Position(safeLine, column),
    new vscode.Position(safeLine, Number.MAX_SAFE_INTEGER),
  );
}

export function collectDirectiveAtLine(
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
