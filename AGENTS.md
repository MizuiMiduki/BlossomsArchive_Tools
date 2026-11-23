# BlossomsArchive Tools - Code Quality, Architecture & Stability Guidelines

このドキュメントは、次回以降の開発・保守・機能追加においてコード品質・セキュリティ・パフォーマンス（PageSpeed Insights / Lighthouse 全カテゴリ100点 & AIスコア100点）を恒久的に維持するためのプロジェクト規約です。

---

## 1. 必須検証コマンド（コミット・プッシュ前の品質ゲート）

コードを変更（新機能追加、既存機能の修正・リファクタリング、バグ修正）した際は、**必ず対応するテストコードを新規作成または更新してください（テストコードの追加・更新のない実装変更は禁止）**。
コミット前に必ず以下の統合チェックを実行し、すべてパスすることを確認してください。

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
4. **CSSレンダーブロッキング防止 & 同一オリジンアセット配信**:
   - 生成される全ルートHTMLで、メインCSSはクリティカルCSSインライン埋め込み＋非同期ロード（`media="print" onload="this.media='all'"`）を維持し、同期 `<link rel="stylesheet">` によるレンダリングブロックを防止してください。
   - ファビコン、apple-touch-icon、ロゴ画像は外部WordPressドメインではなく、必ず `public/` 内の同一オリジンアセット（`/icon-32.png`, `/icon-192.png`）から配信し、追加のDNSルックアップ・TLS接続オーバーヘッドを排除してください。
   - DaisyUI は `src/index.css` の `@plugin "daisyui"` で実際に使用するコンポーネントのみを `include` に指定し、未使用CSS（Unused CSS）によるバンドル肥大化を防止してください。

---

## 5. テスト駆動・品質維持規約 (`src/__tests__/`)

新機能追加・UI変更・ロジック修正・バグ修正を行う際は、**必ず以下の7つのテストカテゴリのうち該当するテストを新規作成または更新してください。テストコードの追加・更新が確認できない変更はコミット・プッシュしてはなりません。**

1. **単体テスト (Unit) / UIコンポーネントテスト**:
   - ロジック・ユーティリティ関数（`src/utils/`）を変更した場合は、境界値・特殊文字・異常系を含めた単体テストを追加・更新する。
   - 新規ページ（`src/pages/`）や共通コンポーネント（`src/components/`）を追加・改修した場合は、初期描画・ボタン操作・入力イベント・状態遷移を網羅するテスト（`<PageName>.test.tsx`）を必ず作成・更新する。
2. **結合テスト (Integration)**: `src/__tests__/integration.test.tsx`
   - ルーティング、Layout、グローバルメタデータ、サイドバー連携、検索フィルタリング連動、ディスカバリファイル（`ard.json` / `llms.txt`）の結合整合性を検証する。
3. **E2Eテスト (End-to-End)**: `src/__tests__/e2e.test.tsx`
   - 複数ページやツール間を横断するユーザー操作シナリオ（Journey）を維持・拡充する。
4. **ビジュアルリグレッション / UI構造テスト**: `src/__tests__/visualRegression.test.tsx`
   - 新規ページ追加時は必ず `PAGE_ENTRIES` に登録し、見出し階層（`h1`）、ボタン・入力欄のアクセシブル名、カードデザインの視覚的整合性（`card`, `border`, `shadow` 等）、SVGジオメトリを検証する。
5. **パフォーマンステスト**: `src/__tests__/performance.test.tsx`
   - 重い計算処理、大量テキスト処理、LCP即時描画（`playPageEntrance`）、初期マウント速度、バンドルサイズ予算をベンチマーク検証する。
6. **セキュリティテスト**: `src/__tests__/security.test.tsx`
   - XSS、多段サニタイズ（CodeQL `js/incomplete-multi-character-sanitization`）、ReDoS、URLスキーム、CSPRNG乱数、クエリパラメータ注入耐性を検証する。
7. **コード品質・アーキテクチャガード**: `src/__tests__/codeQualityGuard.test.ts`
   - 全ページのテストファイル存在確認、静的規約（Solid 1.x非推奨フック禁止、212KB budoux直接import禁止、低コントラスト禁止、`target="_blank"` の `noopener noreferrer` 必須等）の自動検査をパスすること。

---

## 6. プッシュ後デプロイ監視 & Lighthouse Issue 再帰修正規約

1. **プッシュ後の監視責務**:
   - `origin/main` へのプッシュを実行した後は、そこで作業を終了せず、**GitHub Actions のデプロイ・Lighthouse 監査ワークフロー（`Build and Deploy to FTP`）の完了を必ず追跡・監視してください**。
2. **Issue 検知と再帰修正**:
   - ワークフロー完了後、GitHub API 等を用いて `[PageSpeed Alert]` Issue が起票されていないか確認すること。
   - もし減点やスコア退行により Issue が起票された場合は、Issue 本文に記載された減点要因（FCP/LCP/CLS、アクセシビリティ、コントラスト比、`label-content-name-mismatch` 等）を特定し、**Issue が自動クローズされる（Open な Issue が 0 件になる）まで再帰的にコード修正・コミット・プッシュ・追跡を繰り返してください**。
3. **作業完了基準**:
   - 最新の CI 監査で全76パターン（ライト/ダーク × モバイル/デスクトップ）において Lighthouse 100/100 満点の回復が確認され、関連する Issue がすべて自動クローズ（Open Issue が 0 件）されたことをもって作業完了とします。

