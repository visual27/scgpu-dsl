/**
 * `gpu-compute-dsl` extension entrypoint. Activates on any open
 * `.scgpu` file or whenever the workspace contains one. Providers and
 * commands register eagerly on activation; the document-state cache is
 * the single source of truth shared across all providers.
 */

import * as vscode from 'vscode';

import {
  readConfiguration,
  toScratchOptions,
  toScgpuOptions,
} from './config/defaults';
import { DocumentStateCache, buildDocumentState } from './util/documentState';
import { parseDocument } from './util/parser';

import { registerDiagnostics } from './providers/diagnostic';
import { registerCompletion } from './providers/completion';
import { registerHover } from './providers/hover';
import { registerFormatter } from './providers/format';
import { registerSymbols } from './providers/symbols';
import { registerStatusBar } from './ui/statusBar';

import { registerCopyToScratchCommand } from './commands/copyToScratch';
import { registerInsertSkeletonCommand } from './commands/insertTemplate';
import { registerValidateCommand } from './commands/validate';

const DEBOUNCE_MS = 250;

export function activate(context: vscode.ExtensionContext): void {
  const cache = new DocumentStateCache();

  const getConfig = () => readConfiguration((key, fallback) => {
    return vscode.workspace.getConfiguration().get(key, fallback);
  });

  // Prime the cache for any documents that are already open when the
  // extension activates. Subsequent updates are debounced.
  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === 'gpuComputeDsl') {
      primeDocument(cache, document);
    }
  }

  const debounce = createDebouncer((document: vscode.TextDocument) => {
    primeDocument(cache, document);
  }, DEBOUNCE_MS);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === 'gpuComputeDsl') primeDocument(cache, document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === 'gpuComputeDsl') debounce(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      cache.delete(document.uri.toString());
    }),
    vscode.workspace.onDidChangeConfiguration(() => {
      for (const document of vscode.workspace.textDocuments) {
        if (document.languageId === 'gpuComputeDsl') primeDocument(cache, document);
      }
    }),
  );

  // Providers and UI.
  context.subscriptions.push(registerDiagnostics(context, cache, getConfig));
  context.subscriptions.push(registerCompletion(context, cache));
  context.subscriptions.push(registerHover(context, cache, getConfig));
  context.subscriptions.push(registerFormatter(context, getConfig));
  context.subscriptions.push(registerSymbols(cache));
  context.subscriptions.push(registerStatusBar(cache));

  // Commands.
  context.subscriptions.push(registerCopyToScratchCommand(context, getConfig));
  context.subscriptions.push(registerInsertSkeletonCommand(context, getConfig, cache));
  context.subscriptions.push(registerValidateCommand(context, cache));

  // Touch unused symbol so eslint does not flag the import on
  // environments where the formatter is the only consumer.
  void toScratchOptions;
  void toScgpuOptions;

  vscode.window.showInformationMessage('TurboWasm GPU Compute DSL is active.');
}

export function deactivate(): void {
  // Nothing to clean up — `context.subscriptions` disposes providers
  // automatically.
}

function primeDocument(cache: DocumentStateCache, document: vscode.TextDocument): void {
  const text = document.getText();
  const parsed = parseDocument(text, { regionId: `region:${document.uri.fsPath}` });
  cache.set(buildDocumentState(document.uri.toString(), document.version, parsed));
}

function createDebouncer<T>(
  fn: (value: T) => void,
  delayMs: number,
): (value: T) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: T | undefined;
  let hasPending = false;
  return (value: T) => {
    pending = value;
    hasPending = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (hasPending) {
        const v = pending as T;
        hasPending = false;
        fn(v);
      }
    }, delayMs);
  };
}
