# gpu-compute-dsl

VSCode extension that edits the TurboWasm `@compute` kernel DSL with full
editor support: syntax highlighting, completion, hover, diagnostics,
formatting, outline, code lens, status bar, and "Copy as Scratch
comment" paste.

## Features

- `.scgpu` language: syntax highlighting via TextMate grammar.
- Completion for directive heads, axis names, dtype tokens, and
  binding / repeat names already in the document.
- Hover descriptions for every reserved directive and axis token.
- Live diagnostics that surface parser warnings plus a few
  extension-only checks (duplicate binding slots, orphan `@map`
  references).
- Document formatter with sortable directive order and optional
  `@bind` column alignment.
- Outline / symbol provider for the Outline view.
- Status-bar item showing the live diagnostic count.
- Code lens offering "📋 Copy directive" above each directive line.
- "Copy DSL as Scratch Comment" command that prefixes every line with
  `// ` and writes it to the clipboard.

## Keybindings

| Action                          | Shortcut (mac/win/linux) |
| ------------------------------- | ------------------------ |
| Copy DSL as Scratch Comment     | `Shift+Alt+C`            |
| Format Document                 | `Shift+Alt+F`            |
| Validate                        | `Shift+Alt+V`            |

## Configuration

| Key                                          | Default | Description                          |
| -------------------------------------------- | ------- | ------------------------------------ |
| `turbowasm.scratchCommentPrefix`             | `// `   | Per-line prefix for "Copy to Scratch". |
| `turbowasm.enableDiagnostic`                 | `true`  | Toggle Problems-panel diagnostics.  |
| `turbowasm.enableHover`                      | `true`  | Toggle directive hover descriptions. |
| `turbowasm.formatter.alignedBinds`           | `false` | Align `@bind` access columns.        |
| `turbowasm.formatter.normalizeLineEnding`    | `LF`    | Output line ending.                  |
| `turbowasm.preset.workgroupSize`             | `64`    | Workgroup size used by skeleton insert. |

## Parser dependency

The extension reuses the parser logic that ships in the TurboWasm
Viewer. Both are bundled in the same monorepo at
`TurboWasm/packages/gpu-kernel-parser` and published as
[`@turbowasm/gpu-kernel-parser`](https://www.npmjs.com/package/@turbowasm/gpu-kernel-parser).
While the package is not yet on the public registry, install it via:

```jsonc
{
  "dependencies": {
    "@turbowasm/gpu-kernel-parser": "file:../TurboWasm/packages/gpu-kernel-parser"
  }
}
```

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run compile
```

## License

GPL-3.0-only. See [`LICENSE`](./LICENSE).
