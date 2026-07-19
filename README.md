# gpu-compute-dsl

`TurboWasm` の `@compute` カーネル DSL(`.scgpu` ファイル)を VSCode 上で快適に編集するための拡張機能です。構文ハイライト・補完・ホバー・ライブ診断・整形・アウトライン・ステータスバー・「Scratch コメントとしてコピー」まで、編集に必要な機能を一通り備えています。

この拡張機能のソースは GPL-3.0 で、[`turbowasm`](https://github.com/anomalyco/scgpu-dsl) 配下の monorepo で公開されています。

---

## 目次

- [主な機能](#主な機能)
- [サポートするディレクティブ](#サポートするディレクティブ)
- [コマンド一覧](#コマンド一覧)
- [キーバインド](#キーバインド)
- [設定](#設定)
- [拡張機能の動作](#拡張機能の動作)
- [Parser パッケージとの関係](#parser-パッケージとの関係)
- [開発・テスト](#開発テスト)
- [既知の警告と対処](#既知の警告と対処)
- [ライセンス](#ライセンス)

---

## 主な機能

### 1. 言語定義 (`.scgpu`)

- TextMate 文法(`syntaxes/gpu-compute-dsl.tmLanguage.json`)による**構文ハイライト**
  - `//` 行コメント
  - `@compute` キーワード(リージョン開始マーカー)
  - `@bind` / `@max` / `@workgroup_size` / `@repeat` / `@map` のディレクティブ名
  - `@bind name(slot) ro|rw [dtype]` の各部位(バッファ名・スロット番号・アクセス修飾子・dtype)を別スコープで彩色
  - `f32` / `i32` / `byte` などの dtype
  - `@workgroup_size(x, y, z)` の数値
  - 数値リテラル / repeat-index 識別子 / `<-` 矢印演算子
- `language-configuration.json` による**コメント・ブラケット・Enter 動作**
  - 自動閉じ括弧: `(` ↔ `)`, `[` ↔ `]`
  - Enter 押下時に余分なインデントを付けず、新規行を 1 行だけ挿入

### 2. スニペット (`snippets/gpu-compute-dsl.json`)

| プレフィックス | 展開内容 | 用途 |
| -------------- | -------- | ---- |
| `@compute`     | `@compute` + 新規行を 1 行挿入 | リージョン開始 |
| `@bind ro`     | `@bind name(0) ro f32` | 読み取り専用バインド |
| `@bind rw`     | `@bind name(1) rw f32` | 読み書きバインド |
| `@max`         | `@max length=1024` | サイズヒント |
| `@workgroup_size` | `@workgroup_size(64)` | workgroup 次元 |
| `@repeat gx`   | `@repeat R0:global_x = R0 + 1` | パラレル軸での repeat |
| `@repeat seq`  | `@repeat R0 = aabb_w` | sequential repeat |
| `@map`         | `@map R0 <- 0` | ループ変数の初期化 |
| `skel`         | 最小実行可能スケルトン全体 | ゼロから書き始めるとき |

### 3. 補完 (`@`, `(`, `,`, `<`, `:`, `space` でトリガ)

- `@` 直後: ディレクティブ名(`@bind` / `@max` / `@workgroup_size` / `@repeat` / `@map`)を提案
- `@bind ... (ro|rw)` まで入力した直後: dtype(`f32` / `i32` / `byte`)を提案
- `@bind <name>`: 既存バインド名を再利用候補として提示。空白・記号を含む名前は引用符とエスケープを補って挿入
- `@bind <name>(`: **次に空いているスロット番号**を提案
- `@max <group>`: 既存 `@max` グループ名を提案
- `@repeat R`: **次に空いている repeat index**(`R0`, `R1`, …)を提案
- `@repeat R0:`: 軸名(`global_x` / `local_x` / …)と `sequential` を提案
- `@map <var>`: 既存 `@repeat` 名を提案(対応する repeat が無いと `information` 診断)

### 4. ホバー

- ディレクティブ行頭の `@<name>` にカーソルを当てると、[`@turbowasm/gpu-kernel-parser`](https://www.npmjs.com/package/@turbowasm/gpu-kernel-parser) 由来の `DIRECTIVE_DESCRIPTIONS` からMarkdown 説明を表示
- 既知の軸トークン(`global_x` 等)にカーソルを当てると「reserved parallel axis」説明
- `sequential` には「safe-fallback axis」説明
- 設定 `turbowasm.enableHover` で **一括 OFF 可能**

### 5. ライブ診断

Problems パネルに以下のメッセージを **入力中リアルタイム** で出します(`debounce 250ms`):

- パーサ由来: `@` で始まらない行、ディレクティブ引数の構文エラー、不正な axis など
- 拡張機能独自の追加チェック(extension checks):
  - **`@bind` 名重複** (`duplicate @bind name '...'`)
  - **`@bind` スロット番号重複** (`duplicate @bind slot N (...)`)
  - **`@repeat` 名重複**
  - **`@map` の var 重複**
  - **`@map` の var がどの `@repeat` 名も参照していない** (`@map var '...' does not reference any @repeat name in this document` — `Information` レベル)
- 設定 `turbowasm.enableDiagnostic` で **一括 OFF 可能**

### 6. ステータスバー

- アクティブな `.scgpu` ファイルの **現在の Problems 件数** を右側ステータスバーに表示
  - 0 件: `$(check) TurboWasm`
  - 1 件以上: `$(warning) TurboWasm: N`
- クリックすると Problems パネルが開く
- `.scgpu` 以外では自動的に隠れる

### 7. ドキュメント整形 (`Shift+Alt+F`)

- パーサの `formatScgpuDocument` に委譲:
  - ディレクティブの **正規順序へのソート**(`@bind` → `@max` → `@workgroup_size` → `@repeat` → `@map`)
  - 連続空行の整理・末尾のトリム
  - 設定 `turbowasm.formatter.alignedBinds = true` で **@bind 行のアクセス列(`ro`/`rw` と dtype)を縦位置揃え**
  - 設定 `turbowasm.formatter.normalizeLineEnding`(`LF` / `CRLF`)で出力改行を統一
- 冪等: 出力をもう一度整形しても同じ結果になる

### 8. アウトライン / シンボル

- `@bind` / `@repeat` / `@map` / `@max` / `@workgroup_size` を **DocumentSymbol** として登録
- アウトライン表示で:
  - リージョン(`@compute` ブロック)を Namespace として子要素をまとめる
  - 各ディレクティブを **bind=Variable, repeat=Function, map=Constant, max=Constant, workgroup_size=Number** として分類
  - 詳細(アクセス属性・formula・`(x, y, z)`)を detail 文字列で保持

### 9. コピー系コマンド

| コマンド | キーバインド | 動作 |
| -------- | ------------ | ---- |
| `turbowasm.copyToScratch`     | `Shift+Alt+C` | 開いている `.scgpu` 全体を **各行頭に `// `(設定可)を付けた Scratch コメント** としてクリップボードへコピー |
| `turbowasm.format`            | `Shift+Alt+F` | ドキュメント整形 |
| `turbowasm.validate`          | `Shift+Alt+V` | 現在の Problems 件数を再計算してメッセージ表示 |
| `turbowasm.insertComputeSkeleton` | (コマンドパレット) | カーソル位置に **最小スケルトン** を挿入(`@workgroup_size` の値は `turbowasm.preset.workgroupSize`) |

### 10. 拡張機能のライフサイクル

- **アクティベーション契機**(`package.json`):
  - `onLanguage:gpuComputeDsl` — `.scgpu` を開いた瞬間
  - `workspaceContains:**/*.scgpu` — ワークスペースに 1 つでも存在すれば起動時
- 起動時に既存テキストドキュメントを priming → 以降は `onDidChangeTextDocument` を 250ms debounce して再パース
- 全プロバイダ・コマンドは `context.subscriptions` に登録し、拡張機能停止時に自動解放

---

## サポートするディレクティブ

| ディレクティブ        | 形式                                                                | 役割 |
| --------------------- | ------------------------------------------------------------------- | ---- |
| `@compute`            | (単独行)                                                            | リージョン開始マーカー |
| `@bind`               | `@bind <name>(<slot>) (ro\|rw) [f32\|i32\|byte]`                    | バッファ宣言。空白・記号を含む名前は二重引用符で囲む。dtype 省略時は `f32` |
| `@max`                | `@max <group>=<uint>`                                               | 静的サイズヒント(Emitter は読まない / ドキュメント用途) |
| `@workgroup_size`     | `@workgroup_size(x[, y[, z]])`                                      | workgroup 次元。各値は 1 以上、デフォルト `(64, 1, 1)` |
| `@repeat`             | `@repeat R<i>[:<axis>] = <formula>[, max=<uint>]`                   | リピートループ宣言。対応する `@map` が必須 |
| `@map`                | `@map <var> <- <formula>`                                           | WGSL `let` 相当。空白・記号を含む名前は二重引用符で囲む。formula は WGSL 予約語を避けた形に書き換えられることがある |

**軸トークン**:
- パラレル: `global_x` / `global_y` / `global_z` / `local_x` / `local_y` / `local_z` / `workgroup_x` / `workgroup_y` / `workgroup_z`
- セーフフォールバック: `sequential`

---

## キーバインド

| アクション                  | ショートカット |
| --------------------------- | -------------- |
| Copy DSL as Scratch Comment | `Shift+Alt+C`  |
| Format Document             | `Shift+Alt+F`  |
| Validate                    | `Shift+Alt+V`  |

---

## 設定

`package.json` の `contributes.configuration` で公開しているキー:

| キー                                          | 型       | 既定値      | 説明 |
| --------------------------------------------- | -------- | ----------- | ---- |
| `turbowasm.scratchCommentPrefix`              | string   | `// `       | Copy-to-Scratch で各行に付与する接頭辞。`// ` / `//` / `""` から選択 |
| `turbowasm.enableDiagnostic`                  | boolean  | `true`      | DSL 構文エラーを Problems パネルに出す |
| `turbowasm.enableHover`                       | boolean  | `true`      | ディレクティブのホバー説明を出す |
| `turbowasm.formatter.alignedBinds`            | boolean  | `false`     | `@bind` のアクセス列(`ro`/`rw` + dtype)を縦位置揃えする |
| `turbowasm.formatter.normalizeLineEnding`     | enum     | `LF`        | 整形後の改行。`LF` / `CRLF` |
| `turbowasm.preset.workgroupSize`              | number   | `64`        | Insert Skeleton で挿入する `@workgroup_size` の値(1〜256) |

設定変更は `onDidChangeConfiguration` をフックして、表示中の全 `.scgpu` ドキュメントに対して **即時再プライム** されます。

---

## 拡張機能の動作

```
┌─ VSCode 起動 / .scgpu ファイルオープン
│
├─ activate(context) 実行
│   ├─ DocumentStateCache を作成
│   ├─ 既存 textDocuments を priming
│   └─ 以下を context.subscriptions に登録
│       ├─ onDidOpenTextDocument / onDidChangeTextDocument (debounce 250ms)
│       ├─ onDidCloseTextDocument
│       ├─ onDidChangeConfiguration
│       ├─ registerDiagnostics
│       ├─ registerCompletion
│       ├─ registerHover
│       ├─ registerFormatter
│       ├─ registerSymbols
│       ├─ registerStatusBar
│       ├─ registerCopyToScratchCommand
│       ├─ registerInsertSkeletonCommand
│       └─ registerValidateCommand
│
└─ 各プロバイダは DocumentStateCache(URI キー)のみ参照。
   キャッシュにヒットすればパース不要、ヒットしなければ priming を待つ。
```

すべての Provider / UI / コマンドは **`DocumentStateCache` という 1 つのソース・オブ・トゥルース** を通してパース結果にアクセスします。Provider 側に状態を持たせないことで、編集中の追従性とデバッグ容易性を両立しています。

---

## Parser パッケージとの関係

この拡張機能の構文解析・整形ロジックは [`@turbowasm/gpu-kernel-parser`](https://www.npmjs.com/package/@turbowasm/gpu-kernel-parser) パッケージに委譲しています。両者は同じ monorepo(`TurboWasm/packages/gpu-kernel-parser`)で開発されており、TurboWasm ビューア等の他クライアントとパース結果を共有できます。

このリポジトリ(`scgpu-dsl`)の `src/util/parser.ts` は薄いラッパのみを持ち、内部実装には依存しません。将来パーサを差し替える際も Provider 側の変更は不要です。

### ローカル開発時の依存解決

パッケージはまだパブリックレジストリに公開されていないため、`file:` プロトコルでローカル参照します:

```jsonc
// package.json (本リポジトリ)
{
  "dependencies": {
    "@turbowasm/gpu-kernel-parser": "file:../TurboWasm/packages/gpu-kernel-parser"
  }
}
```

monorepo 上で開発する場合は、上流の `TurboWasm` リポジトリを sibling に clone してください。

---

## 開発・テスト

### 必要環境

- Node.js 18 以上(推奨 20.x / 22.x; 24 系は後述の `punycode` 警告参照)
- VSCode 1.85 以上

### セットアップとビルド

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src --max-warnings 0
npm test            # vitest run
npm run compile     # node ./build.mjs → dist/extension.js
npm run watch       # esbuild --watch
```

`npm run compile` は esbuild で `src/extension.ts` を `dist/extension.js`(CommonJS)1 ファイルにバンドルし、syntaxes / snippets / language-configuration.json / package.json を `dist/` 配下へコピーします。`dist/` が VSCode がロードする成果物です。

### VSCode 上での動作確認(F5)

`.vscode/launch.json` に以下の構成を用意しています:

| 構成名                          | 用途 |
| ------------------------------- | ---- |
| `Run Extension`                 | 通常の F5 デバッグ |
| `Run Extension (trace deprecation)` | Node.js の `--trace-deprecation --trace-warnings` を渡し、警告の発生源スタックを採取 |
| `Run Extension (no deprecation)` | Node.js の `--no-deprecation` を渡し、DeprecationWarning を抑止 |

通常は `Run Extension`、警告の正体を確かめたいときは `Run Extension (trace deprecation)` を選んで F5 してください。

### パッケージング

```bash
npm run package     # vsce package → .vsix を生成
```

---

## 既知の警告と対処

### `DeprecationWarning: The 'punycode' module is deprecated`

F5 で拡張機能開発ホストを起動した直後、デバッグコンソールに 1 度だけ表示されることがあります:

```
DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `Code --trace-deprecation ...` to show where the warning was created)
```

**このリポジトリのコードは `punycode` を呼び出しません。** バンドル後の `dist/extension.js` は `require("vscode")` のみを行い、`@turbowasm/gpu-kernel-parser` 側も `require("punycode")` の呼び出しは持ちません。`node_modules/punycode` が存在するのは `eslint` 経由の **devDependencies のみ** で、ランタイムには読み込まれません。

この警告は Node.js 21+ で **組み込み `punycode` モジュール** が deprecated となったことに伴うもので、VSCode 本体・Electron・または VSCode にインストール済みの別拡張機能のいずれかが出しているものと考えられます。当拡張機能の動作には影響しません。

#### 発生源を確かめたい

`.vscode/launch.json` の **「Run Extension (trace deprecation)」** 構成を選んで F5 してください。デバッグコンソールにスタックトレースが出るので、先頭のフレームが `vscode/out/...` か `vscode/extensions/...` かで判別できます。

- 先頭が `vscode/out/...` → VSCode 内部由来(当リポジトリでは対応不要、VSCode 上流の修正待ち)
- 先頭が `vscode/extensions/<publisher>.<name>/...` → 別拡張機能由来(該当拡張を一時無効化して切り分け)
- 先頭が当リポジトリの `dist/extension.js` → 想定外。Issue で報告してください

#### 黙らせたい

F5 時のデバッグコンソールが散らかるのが気になる場合は、**「Run Extension (no deprecation)」** 構成を選んでください。Node.js の `--no-deprecation` フラグで警告を抑止します。なおこの方法は **他の DeprecationWarning も含めて全部消える** ため、必要に応じて Node.js の `WarningStream` フィルタで対象を限定してください(Node 21+ の `--no-warnings=ExperimentalWarning` などの個別指定も検討可)。

---

## ライセンス

GPL-3.0-only. 詳細は [`LICENSE`](./LICENSE) を参照してください。
