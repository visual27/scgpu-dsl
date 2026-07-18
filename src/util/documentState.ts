/**
 * URI-keyed cache that maps an open document to its most-recently-parsed
 * directive state. Providers and UI elements (status bar, code lens) all
 * read from this cache; the editor event listener refreshes it.
 *
 * The cache is intentionally simple — it stores plain serialisable
 * values so it survives `JSON.stringify` round-trips for debugging or
 * snapshot tests.
 */

import type {
  DocumentDirective,
  DocumentRegion,
  ParseScgpuDocumentResult,
} from '@turbowasm/gpu-kernel-parser';

export interface DocumentState {
  uri: string;
  version: number;
  parsed: ParseScgpuDocumentResult;
  regions: DocumentRegion[];
  diagnostics: ParseScgpuDocumentResult['diagnostics'];
  frontmatter: ParseScgpuDocumentResult['frontmatter'];
  directives: DocumentDirective[];
}

export class DocumentStateCache {
  private readonly states = new Map<string, DocumentState>();

  get(uri: string): DocumentState | undefined {
    return this.states.get(uri);
  }

  set(state: DocumentState): void {
    this.states.set(state.uri, state);
  }

  delete(uri: string): boolean {
    return this.states.delete(uri);
  }

  entries(): IterableIterator<DocumentState> {
    return this.states.values();
  }

  clear(): void {
    this.states.clear();
  }
}

export function buildDocumentState(
  uri: string,
  version: number,
  parsed: ParseScgpuDocumentResult,
): DocumentState {
  const regions = parsed.regions;
  const directives = regions.flatMap((region) => region.directives);
  return {
    uri,
    version,
    parsed,
    regions,
    diagnostics: parsed.diagnostics,
    frontmatter: parsed.frontmatter,
    directives,
  };
}
