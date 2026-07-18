/**
 * Hover provider for `.scgpu` files. Surfaces directive descriptions
 * for known tokens and a few helpful notes for the @repeat / @map
 * pairing.
 */

import * as vscode from 'vscode';
import {
  ALL_AXES,
  DIRECTIVE_DESCRIPTIONS,
  SEQUENTIAL_AXIS,
  type DirectiveName,
} from '@turbowasm/gpu-kernel-parser';
import type { DocumentState, DocumentStateCache } from '../util/documentState';
import type { ExtensionConfiguration } from '../config/defaults';

export function registerHover(
  _context: vscode.ExtensionContext,
  cache: DocumentStateCache,
  getConfig: () => ExtensionConfiguration,
): vscode.Disposable {
  return vscode.languages.registerHoverProvider('gpuComputeDsl', {
    provideHover(document, position) {
      if (!getConfig().enableHover) return null;
      const state = cache.get(document.uri.toString());
      const word = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
      if (!word) return null;
      const token = document.getText(word);
      const line = document.lineAt(position.line).text;
      const description = describeAtToken(line, token, state);
      if (!description) return null;
      return new vscode.Hover(description);
    },
  });
}

function describeAtToken(
  lineText: string,
  token: string,
  _state: DocumentState | undefined,
): vscode.MarkdownString | null {
  const markdown = new vscode.MarkdownString();
  markdown.isTrusted = true;
  markdown.supportHtml = false;

  // Whole-line directive heads: `@bind`, `@repeat`, …
  const directiveMatch = lineText.match(/^\s*@([A-Za-z_][A-Za-z0-9_]*)/);
  if (directiveMatch && directiveMatch[1]?.toLowerCase() === token.toLowerCase()) {
    const name = directiveMatch[1].toLowerCase() as DirectiveName;
    const description = DIRECTIVE_DESCRIPTIONS[name];
    if (description) {
      markdown.appendMarkdown(`**@${name}** — ${description}`);
      return markdown;
    }
  }

  if ((ALL_AXES as readonly string[]).includes(token)) {
    markdown.appendMarkdown(
      `**${token}** — reserved parallel axis. Use as \`@repeat R<i>:${token}\`.`,
    );
    return markdown;
  }
  if (token === SEQUENTIAL_AXIS) {
    markdown.appendMarkdown(
      `**sequential** — the safe-fallback axis. Use this when you do not want the kernel to dispatch in parallel.`,
    );
    return markdown;
  }

  return null;
}
