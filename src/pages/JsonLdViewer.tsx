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
import {
    fetchPageSource,
    normalizeFetchUrl,
    extractJsonLdFromMicrolink,
} from "../utils/htmlFetcher";

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
                        <span class="text-emerald-700 dark:text-emerald-400 break-all font-medium">
                            "{String(props.node.value)}"
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "number"}>
                        <span class="text-amber-700 dark:text-amber-400 font-semibold">
                            {String(props.node.value)}
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "boolean"}>
                        <span class="text-blue-700 dark:text-blue-400 font-bold">
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
    const [inputMode, setInputMode] = createSignal<"url" | "direct">("url");
    const [urlInput, setUrlInput] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [fetchError, setFetchError] = createSignal("");
    const [fetchedUrl, setFetchedUrl] = createSignal("");
    const [noJsonLdNotice, setNoJsonLdNotice] = createSignal("");
    const [rawInput, setRawInput] = createSignal(
        JSON.stringify(JSON_LD_SAMPLES.article.data, null, 2),
    );
    const [selectedSample, setSelectedSample] = createSignal("article");
    const [activeTab, setActiveTab] = createSignal<ViewTab>("tree");
    const [searchTerm, setSearchTerm] = createSignal("");
    const [copyMessage, setCopyMessage] = createSignal("");

    const handleFetchUrl = async (targetOverride?: string) => {
        if (loading()) return;
        const rawTarget = (targetOverride ?? urlInput()).trim();
        if (!rawTarget) {
            setFetchError("確認したいWebページのURLを入力してください。");
            return;
        }
        const normalized = normalizeFetchUrl(rawTarget);
        try {
            new URL(normalized);
        } catch {
            setFetchError("有効なURL形式（例: https://example.com）で入力してください。");
            return;
        }

        setLoading(true);
        setFetchError("");
        setNoJsonLdNotice("");
        setUrlInput(normalized);

        try {
            const result = await fetchPageSource(normalized, { requireJsonLd: true });
            setFetchedUrl(result.finalUrl);

            if (result.kind === "html") {
                const parsed = parseJsonLd(result.html);
                if (parsed.entities.length === 0) {
                    setRawInput("");
                    setNoJsonLdNotice("指定されたページに JSON-LD 構造化データは検出されませんでした。");
                } else {
                    setRawInput(result.html);
                }
            } else {
                const blocks = extractJsonLdFromMicrolink(result.payload);
                if (blocks.length === 0) {
                    setRawInput("");
                    setNoJsonLdNotice("指定されたページに JSON-LD 構造化データは検出されませんでした。");
                } else if (blocks.length === 1) {
                    try {
                        setRawInput(JSON.stringify(JSON.parse(blocks[0]), null, 2));
                    } catch {
                        setRawInput(blocks[0]);
                    }
                } else {
                    const wrappedHtml = blocks
                        .map((b) => `<script type="application/ld+json">\n${b}\n</script>`)
                        .join("\n");
                    setRawInput(wrappedHtml);
                }
            }
        } catch (err: any) {
            setFetchError(
                (err?.message || "ページの取得に失敗しました。") +
                    " 直接入力タブからHTMLを貼り付けてお試しください。",
            );
        } finally {
            setLoading(false);
        }
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".card");
        if (typeof window !== "undefined") {
            const paramUrl = new URLSearchParams(window.location.search).get("url");
            if (paramUrl && paramUrl.trim()) {
                setInputMode("url");
                setUrlInput(paramUrl.trim());
                void handleFetchUrl(paramUrl.trim());
            }
        }
    });

    const handleLoadSample = (key: string) => {
        setSelectedSample(key);
        setFetchError("");
        setNoJsonLdNotice("");
        setFetchedUrl("");
        const sample = JSON_LD_SAMPLES[key];
        if (sample) {
            setRawInput(JSON.stringify(sample.data, null, 2));
        }
    };

    const handleClear = () => {
        setRawInput("");
        setUrlInput("");
        setSearchTerm("");
        setFetchError("");
        setNoJsonLdNotice("");
        setFetchedUrl("");
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
                                <BudouX text="WebページのURLを指定するだけでJSON-LD構造化データを自動取得し、ツリー構造・プロパティ・ネストを視覚的に表示・検証できる無料ツールです。HTML直接貼り付け、構文診断、Googleリッチリザルト連携にブラウザ完結で対応します。" />
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 入力フォームカード */}
            <div class="card bg-base-100 shadow-xl border border-base-200">
                <div class="card-body space-y-4">
                    {/* 入力モード切替タブ */}
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="tabs tabs-boxed">
                            <button
                                type="button"
                                class={`tab tab-sm ${inputMode() === "url" ? "tab-active font-bold" : ""}`}
                                onClick={() => setInputMode("url")}
                            >
                                🌐 URLから取得
                            </button>
                            <button
                                type="button"
                                class={`tab tab-sm ${inputMode() === "direct" ? "tab-active font-bold" : ""}`}
                                onClick={() => setInputMode("direct")}
                            >
                                📝 JSON-LD / HTML 直接入力
                            </button>
                        </div>

                        <Show when={fetchedUrl()}>
                            <span class="text-xs text-base-content/70 font-mono truncate max-w-md">
                                取得元: {fetchedUrl()}
                            </span>
                        </Show>
                    </div>

                    {/* 1. URLから取得モード */}
                    <Show when={inputMode() === "url"}>
                        <form
                            {...({
                                toolname: "json-ld-url-viewer",
                                tooldescription:
                                    "指定したURLのWebページからJSON-LD構造化データを取得し、階層ツリーやSchema.org診断を表示します",
                            } as Record<string, string>)}
                            class="space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void handleFetchUrl();
                            }}
                        >
                            <div>
                                <label
                                    for="json-ld-url-input"
                                    class="label text-sm font-semibold text-base-content"
                                >
                                    JSON-LDを確認したいWebページのURL
                                </label>
                                <div class="flex flex-col sm:flex-row gap-2">
                                    <input
                                        id="json-ld-url-input"
                                        type="url"
                                        class="input input-bordered flex-1 font-mono text-sm focus:input-primary"
                                        placeholder="https://example.com"
                                        value={urlInput()}
                                        onInput={(e) => setUrlInput(e.currentTarget.value)}
                                        aria-label="確認するページのURL"
                                    />
                                    <button
                                        type="submit"
                                        class="btn btn-primary font-bold"
                                        disabled={loading()}
                                    >
                                        <Show
                                            when={!loading()}
                                            fallback={
                                                <>
                                                    <span class="loading loading-spinner loading-xs" />
                                                    <span>取得中...</span>
                                                </>
                                            }
                                        >
                                            JSON-LDを取得・解析
                                        </Show>
                                    </button>
                                    <button
                                        type="button"
                                        class="btn btn-outline"
                                        onClick={() => handleLoadSample("article")}
                                    >
                                        サンプルで試す
                                    </button>
                                </div>
                            </div>

                            <Show when={fetchError()}>
                                <div class="alert alert-error text-sm shadow-sm">
                                    <span>{fetchError()}</span>
                                </div>
                            </Show>
                        </form>
                    </Show>

                    {/* 2. 直接入力モード */}
                    <Show when={inputMode() === "direct"}>
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <h2 class="text-base font-bold text-base-content">
                                JSON-LD または HTML の直接入力
                            </h2>
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
                                            >
                                                {sample.label.split(" ")[0]}
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </div>

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
                                    onInput={(e) => {
                                        setNoJsonLdNotice("");
                                        setRawInput(e.currentTarget.value);
                                    }}
                                    aria-label="JSON-LD入力テキストエリア"
                                />
                            </div>
                        </form>
                    </Show>

                    {/* 共通アクションバー */}
                    <div class="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-base-200">
                        <div class="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                class="btn btn-outline btn-sm"
                                onClick={handleClear}
                                disabled={!rawInput() && !urlInput()}
                            >
                                クリア
                            </button>
                            <button
                                type="button"
                                class="btn btn-outline btn-primary btn-sm"
                                onClick={() => handleCopy(formattedJson(), "JSON-LD")}
                                disabled={!rawInput() || parseResult().entities.length === 0}
                            >
                                整形コピー
                            </button>
                            <button
                                type="button"
                                class="btn btn-outline btn-sm"
                                onClick={handleDownload}
                                disabled={!rawInput() || parseResult().entities.length === 0}
                            >
                                .jsonld 保存
                            </button>
                        </div>

                        {/* Google / Schema.org テストへの外部リンク */}
                        <div class="flex items-center gap-2 pt-2">
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
                </div>
            </div>

            {/* 解析結果カード */}
            <div class="card bg-base-100 shadow-xl border border-base-200">
                <div class="card-body">
                    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-base-200 pb-4">
                        <h2 class="card-title text-xl font-bold flex items-center gap-2">
                            <span>構造化データの解析結果</span>
                            <Show when={parseResult().isValid}>
                                <span class="bg-emerald-800 text-white font-bold text-xs px-2.5 py-1 rounded-full">
                                    {parseResult().totalEntitiesCount} エンティティ検出
                                </span>
                            </Show>
                            <Show when={parseResult().hasGraph}>
                                <span class="bg-purple-800 text-white font-bold text-xs px-2.5 py-1 rounded-full">
                                    @graph 構造
                                </span>
                            </Show>
                            <Show when={errorCount() > 0}>
                                <span class="bg-red-800 text-white font-bold text-xs px-2.5 py-1 rounded-full">
                                    {errorCount()} エラー
                                </span>
                            </Show>
                            <Show when={warningCount() > 0}>
                                <span class="bg-amber-800 text-white font-bold text-xs px-2.5 py-1 rounded-full">
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
                            >
                                🌲 階層ツリー
                            </button>
                            <button
                                type="button"
                                class={`tab tab-sm ${activeTab() === "cards" ? "tab-active font-bold" : ""}`}
                                onClick={() => setActiveTab("cards")}
                            >
                                🏷️ エンティティ一覧
                            </button>
                            <button
                                type="button"
                                class={`tab tab-sm ${activeTab() === "diagnostics" ? "tab-active font-bold" : ""}`}
                                onClick={() => setActiveTab("diagnostics")}
                            >
                                🛡️ 診断 ({allIssues().length})
                            </button>
                            <button
                                type="button"
                                class={`tab tab-sm ${activeTab() === "code" ? "tab-active font-bold" : ""}`}
                                onClick={() => setActiveTab("code")}
                            >
                                📄 整形コード
                            </button>
                        </div>
                    </div>

                    {/* 未検出通知 */}
                    <Show when={noJsonLdNotice()}>
                        <div class="alert alert-warning my-4 text-sm font-medium">
                            <span>{noJsonLdNotice()}</span>
                        </div>
                    </Show>

                    {/* エラー表示 */}
                    <Show when={parseResult().error}>
                        <div class="alert alert-error my-4">
                            <span class="font-bold">構文エラー:</span>
                            <span>{parseResult().error}</span>
                        </div>
                    </Show>

                    {/* 入力待ち */}
                    <Show when={!rawInput().trim() && !noJsonLdNotice()}>
                        <div class="py-12 text-center text-base-content/70">
                            <p class="text-lg">URLを指定するか、JSON-LD / HTMLコードを入力してください</p>
                            <p class="text-sm mt-1">
                                「サンプルで試す」ボタンを押すと、代表的なSchema.orgデータを即座にお試しいただけます。
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
                                                        <span class="text-amber-700 dark:text-amber-400 font-semibold">
                                                            {entity.validationIssues.length} 件の留意点
                                                        </span>
                                                    }
                                                >
                                                    <span class="text-emerald-700 dark:text-emerald-400 font-semibold">
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
