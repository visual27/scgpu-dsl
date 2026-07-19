/**
 * Command: insert the minimum `@compute` skeleton at the current
 * cursor position. Uses `turbowasm.preset.workgroupSize` for the
 * `@workgroup_size` value when provided, picks the two smallest
 * available slot ids from the document state so the inserted binds
 * never collide with existing declarations, and positions the cursor
 * between the empty quotes of the first `@bind` so the user can
 * type the binding name immediately.
 */

import * as vscode from 'vscode';
import { skeletonToString } from '../util/directives';
import type { ExtensionConfiguration } from '../config/defaults';
import type { DocumentStateCache } from '../util/documentState';
import type { BindDirective } from '@turbowasm/gpu-kernel-parser';

export function registerInsertSkeletonCommand(
  _context: vscode.ExtensionContext,
  getConfig: () => ExtensionConfiguration,
  cache: DocumentStateCache,
): vscode.Disposable {
  return vscode.commands.registerCommand('turbowasm.insertComputeSkeleton', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open a .scgpu file first.');
      return;
    }
    const config = getConfig();
    const slots = existingSlotIds(cache, editor.document.uri.toString());
    const text = skeletonToString(config.presetWorkgroupSize, slots);
    const position = editor.selection.active;
    const baseOffset = editor.document.offsetAt(position);
    const applied = await editor.edit((builder) => {
      builder.insert(position, text);
    });
    if (!applied) return;
    const cursorOffset = findFirstEmptyQuoteOffset(text);
    if (cursorOffset < 0) return;
    const targetOffset = baseOffset + cursorOffset;
    const target = editor.document.positionAt(targetOffset);
    editor.selections = [new vscode.Selection(target, target)];
  });
}

function existingSlotIds(cache: DocumentStateCache, uri: string): number[] {
  const state = cache.get(uri);
  if (!state) return [];
  return state.directives
    .filter((d) => d.directive.kind === 'bind')
    .map((d) => (d.directive as BindDirective).slot);
}

/**
 * Return the byte offset (relative to the inserted text) of the first
 * empty quoted identifier `""`. Returns -1 when none is found.
 *
 * The locator walks the text char-by-char so the surrounding `"` is
 * not mis-identified inside an already-quoted fragment.
 */
function findFirstEmptyQuoteOffset(text: string): number {
  for (let i = 0; i < text.length - 1; i += 1) {
    if (text[i] === '"' && text[i + 1] === '"') return i + 1;
  }
  return -1;
}
