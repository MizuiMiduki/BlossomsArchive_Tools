import { createSignal, createMemo, onSettled, For, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";
import {
    parseJsonLd,
    JSON_LD_SAMPLES,
    type JsonLdTreeNode,
    type JsonLdEntitySummary,
    type JsonLdValidationIssue,
} from "../utils/jsonLd";
import { createSafeObjectUrl } from "../utils/videoCompressor";

type ViewTab = "tree" | "cards" | "diagnostics" | "code";

/**
 * ツリーの1ノードを表示する再帰コンポーネント
 */
function TreeNodeView(props: {
    node: JsonLdTreeNode;
    searchTerm: string;
    level: number;
}) {
    const [isExpanded, setIsExpanded] = createSignal(props.level < 2);

    const hasChildren = () =>
        Boolean(props.node.children && props.node.children.length > 0);

    const isMatch = createMemo(() => {
        const term = props.searchTerm.trim().toLowerCase();
        if (!term) return true;
        if (props.node.key.toLowerCase().includes(term)) return true;
        if (props.node.schemaType?.toLowerCase().includes(term)) return true;
        if (
            props.node.value !== null &&
            String(props.node.value).toLowerCase().includes(term)
        )
            return true;
        return false;
    });

    const toggle = () => {
        if (hasChildren()) {
            setIsExpanded((prev) => !prev);
        }
    };

    return (
        <Show when={isMatch()}>
            <div
                class="border-l-2 border-base-300 pl-3 my-1 font-mono text-sm"
                style={{ "margin-left": `${Math.min(props.level * 12, 96)}px` }}
            >
                <div class="flex flex-wrap items-center gap-2 py-1 px-2 rounded hover:bg-base-200 transition-colors">
                    {/* 展開/折りたたみボタン */}
                    <Show
                        when={hasChildren()}
                        fallback={<span class="w-5 inline-block text-center text-base-content/70">•</span>}
                    >
                        <button
                            type="button"
                            class="btn btn-ghost btn-xs btn-square text-base-content"
                            onClick={toggle}
                            aria-label={isExpanded() ? `${props.node.key} を折りたたむ` : `${props.node.key} を展開する`}
                        >
                            {isExpanded() ? "▼" : "▶"}
                        </button>
                    </Show>

                    {/* キー名 */}
                    <span class="font-bold text-primary break-all">
                        {props.node.key}:
                    </span>

                    {/* 型バッジ / Schema.orgリンク */}
                    <Show when={props.node.schemaType}>
                        <Show
                            when={props.node.schemaUrl}
                            fallback={
                                <span class="badge badge-primary badge-outline text-xs">
                                    {props.node.schemaType}
                                </span>
                            }
                        >
                            <a
                                href={props.node.schemaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="badge badge-primary badge-outline text-xs hover:bg-primary hover:text-primary-content transition-colors"
                                title={`Schema.org ${props.node.schemaType} の定義を確認`}
                            >
                                {props.node.schemaType} ↗
                            </a>
                        </Show>
                    </Show>

                    {/* 値の表示 */}
                    <Show when={props.node.valueType === "object"}>
                        <span class="text-xs text-base-content/70">
                            &#123;{props.node.itemCount} プロパティ&#125;
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "array"}>
                        <span class="text-xs text-base-content/70">
                            [{props.node.itemCount} 要素]
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "string"}>
                        <span class="text-success break-all">
                            "{String(props.node.value)}"
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "number"}>
                        <span class="text-warning font-semibold">
                            {String(props.node.value)}
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "boolean"}>
                        <span class="text-info font-bold">
                            {String(props.node.value)}
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "null"}>
                        <span class="text-base-content/60 italic">null</span>
                    </Show>
                </div>

                {/* 子要素 */}
                <Show when={hasChildren() && isExpanded()}>
                    <div class="mt-1">
                        <For each={props.node.children}>
                            {(child) => (
                                <TreeNodeView
                                    node={child}
                                    searchTerm={props.searchTerm}
                                    level={props.level + 1}
                                />
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        </Show>
    );
}

export default function JsonLdViewer() {
    let containerRef: HTMLDivElement | undefined;
    const [rawInput, setRawInput] = createSignal("");
    const [selectedSample, setSelectedSample] = createSignal("article");
    const [activeTab, setActiveTab] = createSignal<ViewTab>("tree");
    const [searchTerm, setSearchTerm] = createSignal("");
    const [copyMessage, setCopyMessage] = createSignal("");

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".card");
        // 初期サンプルを読み込む
        handleLoadSample("article");
    });

    const handleLoadSample = (key: string) => {
        setSelectedSample(key);
        const sample = JSON_LD_SAMPLES[key];
        if (sample) {
            setRawInput(JSON.stringify(sample.data, null, 2));
        }
    };

    const handleClear = () => {
        setRawInput("");
        setSearchTerm("");
    };

    // パース結果
    const parseResult = createMemo(() => {
        return parseJsonLd(rawInput());
    });

    // 整形JSON
    const formattedJson = createMemo(() => {
        const text = rawInput().trim();
        if (!text) return "";
        try {
            const parsed = JSON.parse(text);
            return JSON.stringify(parsed, null, 2);
        } catch {
            // HTMLや複数ブロック等の場合は抽出ブロックを整形
            const res = parseResult();
            if (res.entities.length > 0) {
                return JSON.stringify(
                    res.entities.map((e) => e.raw),
                    null,
                    2,
                );
            }
            return rawInput();
        }
    });

    // コピー処理
    const handleCopy = async (text: string, label: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage(`${label}をコピーしました！`);
            setTimeout(() => setCopyMessage(""), 2000);
        } catch {
            setCopyMessage("コピーに失敗しました");
        }
    };

    // ダウンロード処理
    const handleDownload = () => {
        const content = formattedJson();
        if (!content) return;
        try {
            const blob = new Blob([content], { type: "application/ld+json;charset=utf-8" });
            const url = createSafeObjectUrl(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "schema.jsonld";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            setCopyMessage("ダウンロードに失敗しました");
        }
    };

    // 全バリデーション結果のフラット化
    const allIssues = createMemo(() => {
        const issues: { entityType: string; issue: JsonLdValidationIssue }[] = [];
        for (const ent of parseResult().entities) {
            for (const issue of ent.validationIssues) {
                issues.push({ entityType: ent.type, issue });
            }
        }
        return issues;
    });

    const errorCount = createMemo(() =>
        allIssues().filter((i) => i.issue.severity === "error").length,
    );
    const warningCount = createMemo(() =>
        allIssues().filter((i) => i.issue.severity === "warning").length,
    );

    return (
        <div ref={containerRef} class="space-y-6 max-w-6xl mx-auto">
            {/* ヘッダーカード */}
            <div class="card bg-base-100 shadow-xl border border-base-200">
                <div class="card-body">
                    <div class="flex items-center gap-3">
                        <span class="text-4xl" role="img" aria-label="JSON-LD">
                            🧬
                        </span>
                        <div>
                            <h1 class="card-title text-2xl font-bold">
                                JSON-LD 構造可視化・検証ツール
                            </h1>
                            <p class="text-base-content/70 text-sm mt-1">
                                <BudouX text="Schema.orgやJSON-LD構造化データのツリー構造・プロパティ・ネストを視覚的に表示・検証できる無料Webツールです。HTMLからの抽出、構文エラー診断、Googleリッチリザルト連携、整形・コピーに完全ローカルで対応します。" />
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 入力フォームカード */}
            <div class="card bg-base-100 shadow-xl border border-base-200">
                <div class="card-body">
                    <h2 class="card-title text-lg font-bold flex items-center justify-between">
                        <span>JSON-LD または HTML の入力</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-base-content/70">
                                サンプル:
                            </span>
                            <div class="join">
                                <For each={Object.entries(JSON_LD_SAMPLES)}>
                                    {([key, sample]) => (
                                        <button
                                            type="button"
                                            class={`btn btn-xs join-item ${
                                                selectedSample() === key && rawInput().length > 0
                                                    ? "btn-primary"
                                                    : "btn-outline"
                                            }`}
                                            onClick={() => handleLoadSample(key)}
                                            aria-label={`${sample.label.split(" ")[0]}のサンプルデータを読み込む`}
                                        >
                                            {sample.label.split(" ")[0]}
                                        </button>
                                    )}
                                </For>
                            </div>
                        </div>
                    </h2>

                    <form
                        {...({
                            toolname: "json-ld-viewer",
                            tooldescription:
                                "JSON-LD構造化データやHTMLスニペットをパースし、型や階層ツリー、プロパティを可視化・検証します",
                        } as Record<string, string>)}
                        class="space-y-4"
                        onSubmit={(e) => e.preventDefault()}
                    >
                        <div>
                            <label
                                for="json-ld-input"
                                class="label text-sm font-semibold text-base-content"
                            >
                                JSON-LDコード または &lt;script
                                type="application/ld+json"&gt; を含むHTML
                            </label>
                            <textarea
                                id="json-ld-input"
                                class="textarea textarea-bordered w-full font-mono text-sm h-48 focus:textarea-primary"
                                placeholder='{"@context": "https://schema.org", "@type": "Article", ...} または HTMLコードを貼り付け'
                                value={rawInput()}
                                onInput={(e) => setRawInput(e.currentTarget.value)}
                                aria-label="JSON-LD入力テキストエリア"
                            />
                        </div>

                        <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    class="btn btn-outline btn-sm"
                                    onClick={handleClear}
                                    disabled={!rawInput()}
                                    aria-label="入力をクリアする"
                                >
                                    クリア
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-outline btn-primary btn-sm"
                                    onClick={() => handleCopy(formattedJson(), "JSON-LD")}
                                    disabled={!rawInput()}
                                    aria-label="整形済みJSON-LDをコピー"
                                >
                                    整形コピー
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-outline btn-sm"
                                    onClick={handleDownload}
                                    disabled={!rawInput()}
                                    aria-label="JSON-LDファイルをダウンロード"
                                >
                                    .jsonld 保存
                                </button>
                            </div>

                            {/* Google / Schema.org テストへの外部リンク */}
                            <div class="flex items-center gap-2">
                                <a
                                    href="https://search.google.com/test/rich-results"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-ghost btn-xs text-primary underline"
                                    title="Google リッチリザルト テストを別タブで開く"
                                >
                                    Google リッチリザルト テスト ↗
                                </a>
                                <a
                                    href="https://validator.schema.org/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-ghost btn-xs text-primary underline"
                                    title="Schema.org Validator を別タブで開く"
                                >
                                    Schema.org Validator ↗
                                </a>
                            </div>
                        </div>

                        <Show when={copyMessage()}>
                            <div class="alert alert-success py-2 text-sm shadow">
                                <span>{copyMessage()}</span>
                            </div>
                        </Show>
                    </form>
                </div>
            </div>

            {/* 解析結果カード */}
            <div class="card bg-base-100 shadow-xl border border-base-200">
                <div class="card-body">
                    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-base-200 pb-4">
                        <h2 class="card-title text-xl font-bold flex items-center gap-2">
                            <span>構造化データの解析結果</span>
                            <Show when={parseResult().isValid}>
                                <span class="badge badge-success text-white font-bold">
                                    {parseResult().totalEntitiesCount} エンティティ検出
                                </span>
                            </Show>
                            <Show when={parseResult().hasGraph}>
                                <span class="badge badge-secondary badge-outline text-xs">
                                    @graph 構造
                                </span>
                            </Show>
                            <Show when={errorCount() > 0}>
                                <span class="badge badge-error text-white font-bold text-xs">
                                    {errorCount()} エラー
                                </span>
                            </Show>
                            <Show when={warningCount() > 0}>
                                <span class="badge badge-warning text-base-content font-bold text-xs">
                                    {warningCount()} 警告
                                </span>
                            </Show>
                        </h2>

                        {/* タブ切り替え */}
                        <div class="tabs tabs-boxed">
                            <button
                                type="button"
                                class={`tab tab-sm ${activeTab() === "tree" ? "tab-active font-bold" : ""}`}
                                onClick={() => setActiveTab("tree")}
                                aria-label="階層ツリービューに切り替え"
                            >
                                🌲 階層ツリー
                            </button>
                            <button
                                type="button"
                                class={`tab tab-sm ${activeTab() === "cards" ? "tab-active font-bold" : ""}`}
                                onClick={() => setActiveTab("cards")}
                                aria-label="エンティティ一覧カードに切り替え"
                            >
                                🏷️ エンティティ一覧
                            </button>
                            <button
                                type="button"
                                class={`tab tab-sm ${activeTab() === "diagnostics" ? "tab-active font-bold" : ""}`}
                                onClick={() => setActiveTab("diagnostics")}
                                aria-label="バリデーション診断に切り替え"
                            >
                                🛡️ 診断 ({allIssues().length})
                            </button>
                            <button
                                type="button"
                                class={`tab tab-sm ${activeTab() === "code" ? "tab-active font-bold" : ""}`}
                                onClick={() => setActiveTab("code")}
                                aria-label="整形JSONコードに切り替え"
                            >
                                📄 整形コード
                            </button>
                        </div>
                    </div>

                    {/* エラー表示 */}
                    <Show when={parseResult().error}>
                        <div class="alert alert-error my-4">
                            <span class="font-bold">構文エラー:</span>
                            <span>{parseResult().error}</span>
                        </div>
                    </Show>

                    {/* 入力待ち */}
                    <Show when={!rawInput().trim()}>
                        <div class="py-12 text-center text-base-content/70">
                            <p class="text-lg">JSON-LDまたはHTMLコードを入力してください</p>
                            <p class="text-sm mt-1">
                                上部のサンプルボタンを押すと、代表的なSchema.orgデータを即座にお試しいただけます。
                            </p>
                        </div>
                    </Show>

                    {/* タブコンテンツ */}
                    <Show when={rawInput().trim() && parseResult().isValid}>
                        {/* 検索フィルターバー */}
                        <div class="my-3 flex items-center gap-2">
                            <input
                                type="text"
                                class="input input-bordered input-sm w-full max-w-xs"
                                placeholder="プロパティ名や値で絞り込み..."
                                value={searchTerm()}
                                onInput={(e) => setSearchTerm(e.currentTarget.value)}
                                aria-label="プロパティ検索フィルター"
                            />
                            <Show when={searchTerm()}>
                                <button
                                    type="button"
                                    class="btn btn-ghost btn-xs"
                                    onClick={() => setSearchTerm("")}
                                    aria-label="検索フィルターを解除"
                                >
                                    リセット
                                </button>
                            </Show>
                        </div>

                        {/* 1. 階層ツリービュー */}
                        <Show when={activeTab() === "tree"}>
                            <div class="bg-base-200/50 p-4 rounded-lg border border-base-300">
                                <h3 class="text-sm font-bold text-base-content mb-3 flex items-center justify-between">
                                    <span>ノード階層構造</span>
                                    <span class="text-xs text-base-content/70">
                                        クリックで展開 / 折りたたみ
                                    </span>
                                </h3>
                                <For each={parseResult().treeNodes}>
                                    {(rootNode) => (
                                        <TreeNodeView
                                            node={rootNode}
                                            searchTerm={searchTerm()}
                                            level={0}
                                        />
                                    )}
                                </For>
                            </div>
                        </Show>

                        {/* 2. エンティティ一覧カード */}
                        <Show when={activeTab() === "cards"}>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <For each={parseResult().entities}>
                                    {(entity) => (
                                        <div class="card bg-base-200/60 border border-base-300 shadow-sm p-4 space-y-2">
                                            <div class="flex items-start justify-between gap-2">
                                                <div>
                                                    <h3 class="font-bold text-lg text-primary">
                                                        {entity.type}
                                                    </h3>
                                                    <p class="text-xs text-base-content/70 font-mono">
                                                        {entity.context}
                                                    </p>
                                                </div>
                                                <a
                                                    href={`https://schema.org/${entity.type.split(",")[0].trim()}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="badge badge-outline badge-primary text-xs hover:bg-primary hover:text-primary-content"
                                                >
                                                    Schema.org ↗
                                                </a>
                                            </div>

                                            <Show when={entity.name}>
                                                <div class="text-sm font-semibold">
                                                    名前 / タイトル: {entity.name}
                                                </div>
                                            </Show>
                                            <Show when={entity.identifier}>
                                                <div class="text-xs text-base-content/70 font-mono truncate">
                                                    @id: {entity.identifier}
                                                </div>
                                            </Show>
                                            <Show when={entity.url}>
                                                <div class="text-xs text-primary underline truncate">
                                                    URL: {entity.url}
                                                </div>
                                            </Show>
                                            <Show when={entity.description}>
                                                <p class="text-xs text-base-content/80 line-clamp-2">
                                                    {entity.description}
                                                </p>
                                            </Show>

                                            <div class="pt-2 border-t border-base-300 flex items-center justify-between text-xs">
                                                <span class="text-base-content/70">
                                                    プロパティ数: {Object.keys(entity.raw).length}
                                                </span>
                                                <Show
                                                    when={entity.validationIssues.length === 0}
                                                    fallback={
                                                        <span class="text-warning font-semibold">
                                                            {entity.validationIssues.length} 件の留意点
                                                        </span>
                                                    }
                                                >
                                                    <span class="text-success font-semibold">
                                                        ✓ バリデーションOK
                                                    </span>
                                                </Show>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>

                        {/* 3. バリデーション診断 */}
                        <Show when={activeTab() === "diagnostics"}>
                            <div class="space-y-3">
                                <Show
                                    when={allIssues().length > 0}
                                    fallback={
                                        <div class="alert alert-success">
                                            <span>
                                                ✓ 主要プロパティおよび構文チェックにおいてエラーや警告は検出されませんでした。
                                            </span>
                                        </div>
                                    }
                                >
                                    <h3 class="text-base font-bold text-base-content mb-2">
                                        検出された検証項目 ({allIssues().length}件)
                                    </h3>
                                    <div class="space-y-2">
                                        <For each={allIssues()}>
                                            {({ entityType, issue }) => (
                                                <div
                                                    class={`p-3 rounded-lg border text-sm flex items-start gap-3 ${
                                                        issue.severity === "error"
                                                            ? "bg-error/10 border-error/30 text-error-content"
                                                            : issue.severity === "warning"
                                                              ? "bg-warning/10 border-warning/30 text-warning-content"
                                                              : "bg-info/10 border-info/30 text-info-content"
                                                    }`}
                                                >
                                                    <span class="font-bold text-xs uppercase px-2 py-0.5 rounded bg-base-100 text-base-content border border-base-300">
                                                        {issue.severity}
                                                    </span>
                                                    <div class="flex-1">
                                                        <div class="font-semibold text-base-content">
                                                            [{entityType}] {issue.field ? `フィールド: ${issue.field}` : "全体"}
                                                        </div>
                                                        <div class="text-xs text-base-content/80 mt-0.5">
                                                            {issue.message}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        </Show>

                        {/* 4. 整形コード */}
                        <Show when={activeTab() === "code"}>
                            <div>
                                <h3 class="sr-only">整形済みJSON-LDコード</h3>
                                <pre class="bg-base-300 text-base-content p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96">
                                    <code>{formattedJson()}</code>
                                </pre>
                            </div>
                        </Show>
                    </Show>
                </div>
            </div>

            {/* ガイド・解説カード */}
            <div class="card bg-base-100 shadow-xl border border-base-200">
                <div class="card-body">
                    <h2 class="card-title text-lg font-bold">
                        JSON-LD (構造化データ) とは？
                    </h2>
                    <div class="space-y-3 text-sm text-base-content/80">
                        <p>
                            <BudouX text="JSON-LD (JavaScript Object Notation for Linked Data) は、Webページのコンテンツの意味や構造を検索エンジン（Googleなど）に正確に伝えるためのデータ形式です。Googleのリッチリザルト（記事カルーセル、商品情報、パンくず、FAQアコーディオン等）を検索結果に表示させるための推奨フォーマットとなっています。" />
                        </p>
                        <h3 class="font-bold text-base text-base-content pt-2">
                            本ツールの特徴・活用ポイント
                        </h3>
                        <ul class="list-disc list-inside space-y-1">
                            <li>
                                <strong>HTMLコードからの自動抽出:</strong> WebページのHTMLソース全体を貼り付けるだけで、<code>&lt;script type="application/ld+json"&gt;</code> 内の構造化データを自動検出・抽出します。
                            </li>
                            <li>
                                <strong>@graph 複合構造の展開:</strong> 1つのスクリプトにまとめられた複数のエンティティを個別に可視化し、階層関係を整理します。
                            </li>
                            <li>
                                <strong>リアルタイム構文・推奨項目診断:</strong> Schema.orgの主要型（Article, Product, BreadcrumbList, FAQPage等）における必須・推奨プロパティの抜け漏れをブラウザ上で即座にチェックできます。
                            </li>
                            <li>
                                <strong>完全ローカル処理:</strong> 入力されたJSONやHTMLが外部サーバーに送信されることは一切なく、安全にご利用いただけます。
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <AdSense />
        </div>
    );
}
