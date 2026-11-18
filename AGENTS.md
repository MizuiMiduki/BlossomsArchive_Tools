# BlossomsArchive Tools - Code Quality, Architecture & Stability Guidelines

このドキュメントは、次回以降の開発・保守・機能追加においてコード品質・セキュリティ・パフォーマンス（PageSpeed Insights / Lighthouse 全カテゴリ100点 & AIスコア100点）を恒久的に維持するためのプロジェクト規約です。

---

## 1. 必須検証コマンド（コミット・プッシュ前の品質ゲート）

コードを変更した際は、コミット前に必ず以下の統合チェックを実行し、すべてパスすることを確認してください。

```bash
pnpm run type-check && pnpm test && pnpm run build
```

---

## 2. Solid.js 2.0 (`solid-js@2.0.0` / `@solidjs/router@2.0.0`) 実装規約

1. **ライフサイクルフック**:
   - Solid 2.0 では `onMount` / `onCleanup` ではなく `onSettled` を使用し、クリーンアップ関数は `onSettled` の戻り値として返してください。
2. **リアクティブ追跡 (`[STRICT_READ_UNTRACKED]` 防止)**:
   - `createEffect` は2引数形式 `createEffect(() => trackedDeps, (deps) => { ... })` を使用し、第1引数（compute関数）でリアクティブ値を読み取ってください。
3. **数値入力の境界値・`NaN` 防御**:
   - `<input type="number">` や `<input type="range">` の `onInput` / `onChange`、および計算処理 (`createMemo` 等) では、必ず `Number.isFinite(val)` を確認し、有効範囲へクランプ（`Math.max` / `Math.min`）してください。
   - `new Uint32Array(length)` などの TypedArray 生成前に必ず正の有限整数へ正規化し、`RangeError` や画面上の `NaN` / `Infinity` 露出を防止してください。

---

## 3. セキュリティ & CodeQL 再発防止規約

1. **`js/incomplete-multi-character-sanitization` の禁止**:
   - HTMLタグ・コメント・パス文字列の除去に `.replace(/<[^>]+>/g, "")` や `.replace(/<script[\s\S]*?<\/script>/gi, "")`、`.replace(/<!--[\s\S]*?-->/g, "")`、`.replace(/\.\.\//g, "")` のような単一パス・マルチ文字正規表現を**絶対に使用しないでください**。
   - HTMLからプレーンテキストを抽出する場合は文字単位走査（`src/pages/SeoChecker.tsx` の `stripHtmlTagsToPlainText` または `src/utils/textConverter.ts` の `parseHtmlToAst` + `.replace(/[<>]/g, "")`）を使用してください。
   - テンプレート置換（`scripts/generate-route-pages.ts`）では正規表現ではなく `<!-- BA_TOOLS_SEO_START -->` / `<!-- BA_TOOLS_SEO_END -->` マーカーと `indexOf` + `slice` を使用してください。
2. **XSS・危険URLスキームの無害化**:
   - `eval()` や `new Function()` は使用禁止です。
   - ユーザー入力に由来するURLは `javascript:`, `vbscript:`, `data:text/html` を拒否し、ダウンロード用オブジェクトURLは `createSafeObjectUrl` で `blob:` スキームを強制してください。
   - `target="_blank"` を持つ外部リンクには必ず `rel="noopener noreferrer"` を付与してください。
3. **暗号学的乱数 (CSPRNG)**:
   - パスワード生成や抽選などの乱数生成には `Math.random()` ではなく `window.crypto.getRandomValues()` を使用してください。

---

## 4. PageSpeed Insights / Lighthouse & AIスコア 100/100 維持規約

1. **LCP / Speed Index 最適化**:
   - `src/utils/animations.ts` の `playPageEntrance` で初回描画要素を `opacity: 0` に遅延させないでください（同期即時表示を維持）。
   - `src/utils/budoux.ts` はブラウザ標準の `Intl.Segmenter` 実装（5KB未満）を維持し、212KBの `budoux` 辞書パッケージを直接バンドルに読み込まないでください。
   - `src/components/AdSense.tsx` および `src/components/Layout.tsx` の Google タグ遅延読み込みトリガーに `"scroll"` イベントを追加しないでください（初期レイアウト時の自動スクロール発火を防ぐため、ユーザー操作イベントのみをトリガーとします）。
2. **新規ルート追加・メタデータ変更時のチェックリスト**:
   - `src/routes.ts`:
     - `title`（` | BlossomsArchive Tools` 付与後）は **15〜60文字**（推奨21〜40文字）。
     - `description` は **50〜160文字**（推奨85〜110文字）。
   - `scripts/generate-route-pages.ts` の `ROUTE_CHUNK_PREFIX` にルートとチャンク名プレフィックスを登録。
   - `public/.well-known/ard.json` と `public/ard.json`（同一内容）および `public/llms.txt` に新規ツールを反映。
3. **アクセシビリティ (A11y) & WebMCP (`agentic-browsing`)**:
   - 各ページに必ず `<h1>` を1つ以上配置し、見出し階層（`h1` → `h2` → `h3`）をスキップしないでください。
   - すべての `<button>`, `<input>`, `<select>`, `<textarea>` にアクセシブルな名前（テキスト、`aria-label`、または関連付けられた `<label>`）を付与し、表示テキストと `aria-label` が矛盾しないようにしてください（`label-content-name-mismatch` 防止）。
   - `<form>` 要素には WebMCP 用の `toolname` / `tooldescription` 属性を設定し、`<dialog>` 内で送信ボタンを持たない `<form method="dialog">` は使わず `<button type="button" onClick={() => modalRef?.close()}>` を使用してください。

---

## 5. テストスイート構成 (`src/__tests__/`)

機能追加・修正時は、以下の各テストカテゴリのうち該当するテストを追加・更新してください。

- **単体テスト / UIコンポーネントテスト**: 各ページ・ユーティリティの個別テストおよび `Components.test.tsx`
- **結合テスト**: `integration.test.tsx`（Router + Layout + メタタグ/JSON-LD/ディスカバリファイル連携）
- **E2Eテスト**: `e2e.test.tsx`（複数ページを横断するユーザージャーニー）
- **ビジュアルリグレッション / UI構造テスト**: `visualRegression.test.tsx`（ランドマーク、レスポンシブクラス、A11y構造、SVGジオメトリ）
- **パフォーマンステスト**: `performance.test.tsx`（処理時間ベンチマーク、LCP即時描画、チャンクサイズ予算）
- **セキュリティテスト**: `security.test.tsx`（XSS、多段タグ除去、URLスキーム、CSPRNG、セキュリティヘッダー）
- **モンキーテスト / カオスファジング**: `monkey.test.tsx`（全ルート×80回ランダム操作＋クロスルート150回連続遷移）
- **コード品質・アーキテクチャガード**: `codeQualityGuard.test.ts`（静的コード規約・ルート同期・マニフェスト整合性の自動検査）
