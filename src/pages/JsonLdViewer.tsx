import { createSignal, createMemo, onSettled, For, Show } from "solid-js";
import AdSense from "../components/AdSense";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import {
    parseJsonLd,
    flattenJsonLdProperties,
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
import { usePageI18n } from "../i18n/index";

type ViewTab = "tree" | "table" | "cards" | "diagnostics" | "code";

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
                class="ba-mono ba-text-sm"
                style={{
                    "border-left": "2px solid var(--ba-border)",
                    "padding-left": "0.75rem",
                    "margin-block": "0.25rem",
                    "margin-left": `${Math.min(props.level * 12, 96)}px`,
                }}
            >
                <div
                    class="ba-flex ba-flex-wrap ba-items-center ba-gap-2"
                    style={{ padding: "0.25rem 0.5rem", "border-radius": "var(--ba-radius-sm)" }}
                >
                    {/* 展開/折りたたみボタン */}
                    <Show
                        when={hasChildren()}
                        fallback={
                            <span
                                class="ba-text-center ba-text-muted"
                                style={{ width: "1.25rem", display: "inline-block" }}
                            >
                                •
                            </span>
                        }
                    >
                        <button
                            type="button"
                            class="ba-btn ba-btn--ghost ba-btn--xs ba-btn--square"
                            onClick={toggle}
                            aria-label={isExpanded() ? `${props.node.key} を折りたたむ` : `${props.node.key} を展開する`}
                        >
                            {isExpanded() ? "▼" : "▶"}
                        </button>
                    </Show>

                    {/* キー名 */}
                    <span class="ba-font-bold ba-text-primary ba-break-all">
                        {props.node.key}:
                    </span>

                    {/* 型バッジ / Schema.orgリンク */}
                    <Show when={props.node.schemaType}>
                        <Show
                            when={props.node.schemaUrl}
                            fallback={
                                <span
                                    class="ba-badge ba-badge--outline"
                                    style={{ "border-color": "var(--ba-primary)", color: "var(--ba-primary)" }}
                                >
                                    {props.node.schemaType}
                                </span>
                            }
                        >
                            <a
                                href={props.node.schemaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="ba-badge ba-badge--outline"
                                style={{ "border-color": "var(--ba-primary)", color: "var(--ba-primary)" }}
                                title={`Schema.org ${props.node.schemaType} の定義を確認`}
                            >
                                {props.node.schemaType} ↗
                            </a>
                        </Show>
                    </Show>

                    {/* 値の表示 */}
                    <Show when={props.node.valueType === "object"}>
                        <span class="ba-text-xs ba-text-muted">
                            &#123;{props.node.itemCount} プロパティ&#125;
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "array"}>
                        <span class="ba-text-xs ba-text-muted">
                            [{props.node.itemCount} 要素]
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "string"}>
                        <span class="ba-text-success ba-break-all" style={{ "font-weight": 500 }}>
                            "{String(props.node.value)}"
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "number"}>
                        <span class="ba-text-warning ba-font-bold">
                            {String(props.node.value)}
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "boolean"}>
                        <span class="ba-font-bold" style={{ color: "var(--ba-info)" }}>
                            {String(props.node.value)}
                        </span>
                    </Show>
                    <Show when={props.node.valueType === "null"}>
                        <span class="ba-text-muted" style={{ "font-style": "italic" }}>null</span>
                    </Show>
                </div>

                {/* 子要素 */}
                <Show when={hasChildren() && isExpanded()}>
                    <div style={{ "margin-top": "0.25rem" }}>
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
    const { title, description } = usePageI18n("/json-ld-viewer", {
        defaultTitle: "JSON-LD 構造可視化・検証ツール",
        defaultDescription:
            "WebページのURLを指定するだけでJSON-LD構造化データを自動取得し、ツリー構造・プロパティ・ネストを視覚的に表示・検証できる無料ツールです。HTML直接貼り付け、構文診断、Googleリッチリザルト連携にブラウザ完結で対応します。",
    });
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
    const [entityFilter, setEntityFilter] = createSignal("all");
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
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
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
        setEntityFilter("all");
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
        setEntityFilter("all");
        setFetchError("");
        setNoJsonLdNotice("");
        setFetchedUrl("");
    };

    // パース結果
    const parseResult = createMemo(() => {
        return parseJsonLd(rawInput());
    });

    // 全項目・値のフラット表データ
    const propertyRows = createMemo(() =>
        flattenJsonLdProperties(parseResult().entities),
    );

    const availableEntityTypes = createMemo(() => {
        const types = new Set<string>();
        for (const row of propertyRows()) {
            types.add(row.entityType);
        }
        return Array.from(types);
    });

    const filteredPropertyRows = createMemo(() => {
        const filterType = entityFilter();
        const term = searchTerm().trim().toLowerCase();
        return propertyRows().filter((row) => {
            if (filterType !== "all" && row.entityType !== filterType) {
                return false;
            }
            if (!term) return true;
            return (
                row.entityType.toLowerCase().includes(term) ||
                row.propertyPath.toLowerCase().includes(term) ||
                row.value.toLowerCase().includes(term)
            );
        });
    });

    const handleCopyTableTsv = async () => {
        const rows = filteredPropertyRows();
        if (rows.length === 0) return;
        const header = "エンティティ\t項目\t値\t型";
        const body = rows
            .map((r) => `${r.entityType}\t${r.propertyPath}\t${r.value.replace(/\r?\n/g, " ")}\t${r.valueType}`)
            .join("\n");
        try {
            await navigator.clipboard.writeText(`${header}\n${body}`);
            setCopyMessage("項目一覧をTSV形式でコピーしました");
            setTimeout(() => setCopyMessage(""), 2500);
        } catch {
            setCopyMessage("コピーに失敗しました");
            setTimeout(() => setCopyMessage(""), 2500);
        }
    };

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
        <div ref={containerRef} class="ba-page">
            {/* ヘッダーカード */}
            <div class="ba-card">
                <div class="ba-flex ba-items-center ba-gap-3">
                    <div class="ba-icon-box" style={{ padding: "0.625rem" }}>
                        <ToolIcon name="braces" class="ba-icon-lg" />
                    </div>
                    <div class="ba-min-w-0">
                        <h1 class="ba-title">
                            {title()}
                        </h1>
                        <p class="ba-text-muted ba-text-sm" style={{ "margin-top": "0.25rem", "margin-bottom": 0 }}>
                            {description()}
                        </p>
                    </div>
                </div>
            </div>

            {/* 入力フォームカード */}
            <div class="ba-card ba-stack-4">
                {/* 入力モード切替タブ */}
                <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3">
                    <div class="ba-tabs">
                        <button
                            type="button"
                            class={`ba-tab ${inputMode() === "url" ? "is-active" : ""}`}
                            onClick={() => setInputMode("url")}
                        >
                            URLから取得
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${inputMode() === "direct" ? "is-active" : ""}`}
                            onClick={() => setInputMode("direct")}
                        >
                            JSON-LD / HTML 直接入力
                        </button>
                    </div>

                    <Show when={fetchedUrl()}>
                        <span
                            class="ba-text-xs ba-text-muted ba-mono ba-truncate"
                            style={{ "max-width": "28rem" }}
                        >
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
                        class="ba-stack-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleFetchUrl();
                        }}
                    >
                        <div class="ba-field">
                            <label
                                for="json-ld-url-input"
                                class="ba-label"
                            >
                                JSON-LDを確認したいWebページのURL
                            </label>
                            <div class="ba-flex ba-flex-wrap ba-gap-2">
                                <input
                                    id="json-ld-url-input"
                                    type="url"
                                    class="ba-input ba-flex-1 ba-mono ba-text-sm"
                                    style={{ "min-width": "14rem" }}
                                    placeholder="https://example.com"
                                    value={urlInput()}
                                    onInput={(e) => setUrlInput(e.currentTarget.value)}
                                    aria-label="確認するページのURL"
                                />
                                <button
                                    type="submit"
                                    class="ba-btn ba-btn--primary"
                                    disabled={loading()}
                                >
                                    <Show
                                        when={!loading()}
                                        fallback={
                                            <>
                                                <span class="ba-spinner" />
                                                <span>取得中...</span>
                                            </>
                                        }
                                    >
                                        JSON-LDを取得・解析
                                    </Show>
                                </button>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline"
                                    onClick={() => handleLoadSample("article")}
                                >
                                    サンプルで試す
                                </button>
                            </div>
                        </div>

                        <Show when={fetchError()}>
                            <div class="ba-alert ba-alert--error">
                                <span>{fetchError()}</span>
                            </div>
                        </Show>
                    </form>
                </Show>

                {/* 2. 直接入力モード */}
                <Show when={inputMode() === "direct"}>
                    <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                        <h2 class="ba-text-base ba-font-bold" style={{ margin: 0 }}>
                            JSON-LD または HTML の直接入力
                        </h2>
                        <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap">
                            <span class="ba-text-xs ba-text-muted">
                                サンプル:
                            </span>
                            <div class="ba-flex ba-flex-wrap ba-gap-1">
                                <For each={Object.entries(JSON_LD_SAMPLES)}>
                                    {([key, sample]) => (
                                        <button
                                            type="button"
                                            class={`ba-btn ba-btn--xs ${
                                                selectedSample() === key && rawInput().length > 0
                                                    ? "ba-btn--primary"
                                                    : "ba-btn--outline"
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
                        class="ba-stack-4"
                        onSubmit={(e) => e.preventDefault()}
                    >
                        <div class="ba-field">
                            <label
                                for="json-ld-input"
                                class="ba-label"
                            >
                                JSON-LDコード または &lt;script
                                type="application/ld+json"&gt; を含むHTML
                            </label>
                            <textarea
                                id="json-ld-input"
                                class="ba-textarea ba-mono ba-text-sm"
                                style={{ height: "12rem" }}
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
                <div
                    class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3"
                    style={{ "padding-top": "0.75rem", "border-top": "1px solid var(--ba-border)" }}
                >
                    <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap">
                        <button
                            type="button"
                            class="ba-btn ba-btn--outline ba-btn--sm"
                            onClick={handleClear}
                            disabled={!rawInput() && !urlInput()}
                        >
                            クリア
                        </button>
                        <button
                            type="button"
                            class="ba-btn ba-btn--outline ba-btn--sm ba-text-primary"
                            style={{ "border-color": "var(--ba-primary)" }}
                            onClick={() => handleCopy(formattedJson(), "JSON-LD")}
                            disabled={!rawInput() || parseResult().entities.length === 0}
                        >
                            整形コピー
                        </button>
                        <button
                            type="button"
                            class="ba-btn ba-btn--outline ba-btn--sm"
                            onClick={handleDownload}
                            disabled={!rawInput() || parseResult().entities.length === 0}
                        >
                            .jsonld 保存
                        </button>
                    </div>

                    {/* Google / Schema.org テストへの外部リンク */}
                    <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap">
                        <a
                            href="https://search.google.com/test/rich-results"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary ba-underline"
                            title="Google リッチリザルト テストを別タブで開く"
                        >
                            Google リッチリザルト テスト ↗
                        </a>
                        <a
                            href="https://validator.schema.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary ba-underline"
                            title="Schema.org Validator を別タブで開く"
                        >
                            Schema.org Validator ↗
                        </a>
                    </div>
                </div>

                <Show when={copyMessage()}>
                    <div class="ba-alert ba-alert--success">
                        <span>{copyMessage()}</span>
                    </div>
                </Show>
            </div>

            {/* 解析結果カード */}
            <div class="ba-card ba-stack-4">
                <div
                    class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3"
                    style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "1rem" }}
                >
                    <h2 class="ba-section-title ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                        <span>構造化データの解析結果</span>
                        <Show when={parseResult().isValid}>
                            <span class="ba-badge ba-badge--success">
                                {parseResult().totalEntitiesCount} エンティティ検出
                            </span>
                        </Show>
                        <Show when={parseResult().hasGraph}>
                            <span class="ba-badge ba-badge--developer">
                                @graph 構造
                            </span>
                        </Show>
                        <Show when={errorCount() > 0}>
                            <span class="ba-badge ba-badge--danger">
                                {errorCount()} エラー
                            </span>
                        </Show>
                        <Show when={warningCount() > 0}>
                            <span class="ba-badge ba-badge--warning">
                                {warningCount()} 警告
                            </span>
                        </Show>
                    </h2>

                    {/* タブ切り替え */}
                    <div class="ba-tabs">
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "tree" ? "is-active" : ""}`}
                            onClick={() => setActiveTab("tree")}
                        >
                            階層ツリー
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "table" ? "is-active" : ""}`}
                            onClick={() => setActiveTab("table")}
                        >
                            項目一覧（表） ({propertyRows().length})
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "cards" ? "is-active" : ""}`}
                            onClick={() => setActiveTab("cards")}
                        >
                            エンティティ一覧
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "diagnostics" ? "is-active" : ""}`}
                            onClick={() => setActiveTab("diagnostics")}
                        >
                            診断 ({allIssues().length})
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "code" ? "is-active" : ""}`}
                            onClick={() => setActiveTab("code")}
                        >
                            整形コード
                        </button>
                    </div>
                </div>

                {/* 未検出通知 */}
                <Show when={noJsonLdNotice()}>
                    <div class="ba-alert ba-alert--warning">
                        <span>{noJsonLdNotice()}</span>
                    </div>
                </Show>

                {/* エラー表示 */}
                <Show when={parseResult().error}>
                    <div class="ba-alert ba-alert--error">
                        <span class="ba-font-bold">構文エラー:</span>
                        <span>{parseResult().error}</span>
                    </div>
                </Show>

                {/* 入力待ち */}
                <Show when={!rawInput().trim() && !noJsonLdNotice()}>
                    <div class="ba-text-center ba-text-muted" style={{ "padding-block": "3rem" }}>
                        <p class="ba-text-lg" style={{ margin: 0 }}>URLを指定するか、JSON-LD / HTMLコードを入力してください</p>
                        <p class="ba-text-sm" style={{ "margin-top": "0.25rem", "margin-bottom": 0 }}>
                            「サンプルで試す」ボタンを押すと、代表的なSchema.orgデータを即座にお試しいただけます。
                        </p>
                    </div>
                </Show>

                {/* タブコンテンツ */}
                <Show when={rawInput().trim() && parseResult().isValid}>
                    {/* 検索フィルターバー */}
                    <div class="ba-flex ba-items-center ba-gap-2">
                        <input
                            type="text"
                            class="ba-input ba-input--sm"
                            style={{ "max-width": "20rem" }}
                            placeholder="プロパティ名や値で絞り込み..."
                            value={searchTerm()}
                            onInput={(e) => setSearchTerm(e.currentTarget.value)}
                            aria-label="プロパティ検索フィルター"
                        />
                        <Show when={searchTerm()}>
                            <button
                                type="button"
                                class="ba-btn ba-btn--ghost ba-btn--xs"
                                onClick={() => setSearchTerm("")}
                                aria-label="検索フィルターを解除"
                            >
                                リセット
                            </button>
                        </Show>
                    </div>

                    {/* 1. 階層ツリービュー */}
                    <Show when={activeTab() === "tree"}>
                        <div class="ba-panel ba-stack-3">
                            <h3
                                class="ba-text-sm ba-font-bold ba-flex ba-items-center ba-justify-between"
                                style={{ margin: 0 }}
                            >
                                <span>ノード階層構造</span>
                                <span class="ba-text-xs ba-text-muted">
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

                    {/* 1.5. 項目・値一覧テーブルビュー */}
                    <Show when={activeTab() === "table"}>
                        <div class="ba-stack-3">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                                    <select
                                        class="ba-select ba-select--sm"
                                        style={{ width: "auto", "min-width": "11rem" }}
                                        value={entityFilter()}
                                        onChange={(e) => setEntityFilter(e.currentTarget.value)}
                                        aria-label="エンティティ種別で絞り込み"
                                    >
                                        <option value="all">すべてのエンティティ ({propertyRows().length}項目)</option>
                                        <For each={availableEntityTypes()}>
                                            {(typeName) => (
                                                <option value={typeName}>{typeName}</option>
                                            )}
                                        </For>
                                    </select>
                                    <span class="ba-text-xs ba-text-muted">
                                        表示中: <strong>{filteredPropertyRows().length}</strong> / {propertyRows().length} 件
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--xs"
                                    onClick={handleCopyTableTsv}
                                    disabled={filteredPropertyRows().length === 0}
                                >
                                    表をコピー (TSV)
                                </button>
                            </div>

                            <Show
                                when={filteredPropertyRows().length > 0}
                                fallback={
                                    <div class="ba-panel ba-text-center ba-text-sm ba-text-muted">
                                        条件に一致する項目が見つかりませんでした。
                                    </div>
                                }
                            >
                                <div class="ba-table-wrap">
                                    <table class="ba-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: "18%" }}>エンティティ</th>
                                                <th style={{ width: "26%" }}>項目 (プロパティ)</th>
                                                <th>設定値</th>
                                                <th style={{ width: "10%" }}>型</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={filteredPropertyRows()}>
                                                {(row) => (
                                                    <tr>
                                                        <td>
                                                            <span class="ba-badge ba-badge--neutral">
                                                                {row.entityType}
                                                            </span>
                                                        </td>
                                                        <td class="ba-mono ba-font-bold" style={{ "word-break": "break-word" }}>
                                                            {row.propertyPath}
                                                        </td>
                                                        <td style={{ "word-break": "break-word", "max-width": "32rem" }}>
                                                            <Show
                                                                when={row.isUrl}
                                                                fallback={
                                                                    <span class={row.valueType === "number" || row.valueType === "boolean" ? "ba-mono" : ""}>
                                                                        {row.value}
                                                                    </span>
                                                                }
                                                            >
                                                                <a
                                                                    href={row.value}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    class="ba-text-primary ba-underline ba-mono ba-break-all"
                                                                >
                                                                    {row.value}
                                                                </a>
                                                            </Show>
                                                        </td>
                                                        <td>
                                                            <span class="ba-badge ba-badge--outline ba-mono">
                                                                {row.valueType}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </Show>
                        </div>
                    </Show>

                    {/* 2. エンティティ一覧カード */}
                    <Show when={activeTab() === "cards"}>
                        <div class="ba-grid-2">
                            <For each={parseResult().entities}>
                                {(entity) => (
                                    <div class="ba-panel ba-stack-2">
                                        <div class="ba-flex ba-items-start ba-justify-between ba-gap-2">
                                            <div class="ba-min-w-0">
                                                <h3 class="ba-font-bold ba-text-lg ba-text-primary" style={{ margin: 0 }}>
                                                    {entity.type}
                                                </h3>
                                                <p class="ba-text-xs ba-text-muted ba-mono" style={{ margin: 0 }}>
                                                    {entity.context}
                                                </p>
                                            </div>
                                            <a
                                                href={`https://schema.org/${entity.type.split(",")[0].trim()}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="ba-badge ba-badge--outline ba-shrink-0"
                                                style={{ "border-color": "var(--ba-primary)", color: "var(--ba-primary)" }}
                                            >
                                                Schema.org ↗
                                            </a>
                                        </div>

                                        <Show when={entity.name}>
                                            <div class="ba-text-sm ba-font-bold">
                                                名前 / タイトル: {entity.name}
                                            </div>
                                        </Show>
                                        <Show when={entity.identifier}>
                                            <div class="ba-text-xs ba-text-muted ba-mono ba-truncate">
                                                @id: {entity.identifier}
                                            </div>
                                        </Show>
                                        <Show when={entity.url}>
                                            <div class="ba-text-xs ba-text-primary ba-underline ba-truncate">
                                                URL: {entity.url}
                                            </div>
                                        </Show>
                                        <Show when={entity.description}>
                                            <p
                                                class="ba-text-xs ba-text-muted"
                                                style={{
                                                    margin: 0,
                                                    display: "-webkit-box",
                                                    "-webkit-line-clamp": 2,
                                                    "-webkit-box-orient": "vertical",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {entity.description}
                                            </p>
                                        </Show>

                                        <div
                                            class="ba-flex ba-items-center ba-justify-between ba-text-xs"
                                            style={{ "padding-top": "0.5rem", "border-top": "1px solid var(--ba-border)" }}
                                        >
                                            <span class="ba-text-muted">
                                                プロパティ数: {Object.keys(entity.raw).length}
                                            </span>
                                            <Show
                                                when={entity.validationIssues.length === 0}
                                                fallback={
                                                    <span class="ba-text-warning ba-font-bold">
                                                        {entity.validationIssues.length} 件の留意点
                                                    </span>
                                                }
                                            >
                                                <span class="ba-text-success ba-font-bold">
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
                        <div class="ba-stack-3">
                            <Show
                                when={allIssues().length > 0}
                                fallback={
                                    <div class="ba-alert ba-alert--success">
                                        <span>
                                            ✓ 主要プロパティおよび構文チェックにおいてエラーや警告は検出されませんでした。
                                        </span>
                                    </div>
                                }
                            >
                                <h3 class="ba-text-base ba-font-bold" style={{ margin: 0 }}>
                                    検出された検証項目 ({allIssues().length}件)
                                </h3>
                                <div class="ba-stack-2">
                                    <For each={allIssues()}>
                                        {({ entityType, issue }) => (
                                            <div
                                                class={`ba-alert ${
                                                    issue.severity === "error"
                                                        ? "ba-alert--error"
                                                        : issue.severity === "warning"
                                                          ? "ba-alert--warning"
                                                          : "ba-alert--info"
                                                }`}
                                                style={{ "align-items": "flex-start" }}
                                            >
                                                <span
                                                    class="ba-badge ba-badge--neutral ba-shrink-0"
                                                    style={{ "text-transform": "uppercase" }}
                                                >
                                                    {issue.severity}
                                                </span>
                                                <div class="ba-flex-1 ba-min-w-0">
                                                    <div class="ba-font-bold">
                                                        [{entityType}] {issue.field ? `フィールド: ${issue.field}` : "全体"}
                                                    </div>
                                                    <div class="ba-text-xs" style={{ "margin-top": "0.15rem", "font-weight": 500 }}>
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
                            <h3 class="ba-sr-only">整形済みJSON-LDコード</h3>
                            <pre class="ba-code" style={{ "max-height": "24rem" }}>
                                <code>{formattedJson()}</code>
                            </pre>
                        </div>
                    </Show>
                </Show>
            </div>

            {/* ガイド・解説カード */}
            <div class="ba-card ba-stack-3">
                <h2 class="ba-section-title">
                    JSON-LD (構造化データ) とは？
                </h2>
                <div class="ba-stack-3 ba-text-sm ba-text-muted">
                    <p style={{ margin: 0 }}>
                        JSON-LD (JavaScript Object Notation for Linked Data) は、Webページのコンテンツの意味や構造を検索エンジン（Googleなど）に正確に伝えるためのデータ形式です。Googleのリッチリザルト（記事カルーセル、商品情報、パンくず、FAQアコーディオン等）を検索結果に表示させるための推奨フォーマットとなっています。
                    </p>
                    <h3 class="ba-font-bold ba-text-base" style={{ color: "var(--ba-text)", "margin-top": "0.5rem", "margin-bottom": 0 }}>
                        本ツールの特徴・活用ポイント
                    </h3>
                    <ul class="ba-stack-1" style={{ "padding-left": "1.25rem", margin: 0 }}>
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

            <AdSense />
        </div>
    );
}
