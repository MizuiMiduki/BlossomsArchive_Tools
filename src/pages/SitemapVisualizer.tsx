import { createSignal, createMemo, For, Show, onSettled } from "solid-js";
import AdSense from "../components/AdSense";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import {
    parseSitemapXml,
    fetchAndResolveSitemap,
    buildSiteTree,
    buildLocaleCoverageMatrix,
    analyzeSitemapEntries,
    buildSitemapTsv,
    isSafeHttpUrl,
    SITEMAP_SAMPLES,
    type SitemapUrlEntry,
    type SitemapChildEntry,
    type SiteTreeNode,
    type FetchSitemapProgress,
} from "../utils/sitemap";

type InputMode = "url" | "xml";
type ViewTab = "tree" | "table" | "locales" | "stats";
type SortKey = "loc" | "lastmod" | "priority" | "depth";

function createSafeBlobUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    if (!url.startsWith("blob:")) {
        throw new Error("Unsafe object URL scheme");
    }
    return url;
}

function SiteTreeNodeRow(props: {
    node: SiteTreeNode;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
}) {
    const isFolder = () => props.node.children.length > 0;
    const isOpen = () => props.expandedIds.has(props.node.id);
    const entry = () => props.node.urlEntry;
    const indentPx = () => Math.min(props.node.depth, 8) * 18;

    return (
        <div>
            <div
                class="ba-flex ba-items-center ba-gap-2 ba-justify-between"
                style={{
                    "padding-left": `${indentPx() + 8}px`,
                    "padding-right": "0.5rem",
                    "padding-top": "0.35rem",
                    "padding-bottom": "0.35rem",
                    "border-bottom": "1px solid var(--ba-border)",
                    "font-size": "0.8125rem",
                }}
            >
                <div class="ba-flex ba-items-center ba-gap-2 ba-min-w-0 ba-flex-1">
                    <Show
                        when={isFolder()}
                        fallback={
                            <span
                                class="ba-text-muted ba-mono ba-shrink-0"
                                style={{ width: "1.25rem", "text-align": "center" }}
                                aria-hidden="true"
                            >
                                -
                            </span>
                        }
                    >
                        <button
                            type="button"
                            onClick={() => props.onToggle(props.node.id)}
                            class="ba-btn ba-btn--ghost ba-btn--xs"
                            style={{ width: "1.5rem", height: "1.5rem", padding: 0 }}
                            aria-expanded={isOpen() ? "true" : "false"}
                            aria-label={`${props.node.segment} を${isOpen() ? "折りたたむ" : "展開する"}`}
                        >
                            {isOpen() ? "▾" : "▸"}
                        </button>
                    </Show>

                    <Show
                        when={entry() && isSafeHttpUrl(entry()!.loc)}
                        fallback={
                            <span class="ba-font-bold ba-mono ba-truncate">
                                {props.node.depth === 0 ? props.node.segment : `/${props.node.segment}`}
                            </span>
                        }
                    >
                        <a
                            href={entry()!.loc}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="ba-mono ba-truncate ba-underline"
                            style={{ color: "var(--ba-primary)", "font-weight": isFolder() ? 700 : 500 }}
                            title={entry()!.loc}
                        >
                            {props.node.depth === 0 ? props.node.segment : `/${props.node.segment}`}
                        </a>
                    </Show>

                    <Show when={isFolder()}>
                        <span class="ba-badge ba-badge--neutral ba-shrink-0">
                            {props.node.totalUrls} URL
                        </span>
                    </Show>

                    <Show when={entry() && entry()!.detectedLocale !== "default"}>
                        <span class="ba-badge ba-badge--primary ba-shrink-0">
                            {entry()!.detectedLocale}
                        </span>
                    </Show>

                    <Show when={entry() && entry()!.alternates.length > 0}>
                        <span
                            class="ba-badge ba-badge--info ba-shrink-0"
                            title={entry()!.alternates.map((a) => `${a.hreflang}: ${a.href}`).join("\n")}
                        >
                            hreflang {entry()!.alternates.length}
                        </span>
                    </Show>
                </div>

                <div class="ba-flex ba-items-center ba-gap-2 ba-shrink-0 ba-text-xs ba-text-muted ba-mono">
                    <Show when={entry()?.lastmod}>
                        <span>{entry()!.lastmod!.slice(0, 10)}</span>
                    </Show>
                    <Show when={entry()?.priority}>
                        <span class="ba-badge ba-badge--neutral">P:{entry()!.priority}</span>
                    </Show>
                </div>
            </div>

            <Show when={isFolder() && isOpen()}>
                <For each={props.node.children}>
                    {(child) => (
                        <SiteTreeNodeRow
                            node={child}
                            expandedIds={props.expandedIds}
                            onToggle={props.onToggle}
                        />
                    )}
                </For>
            </Show>
        </div>
    );
}

export default function SitemapVisualizer() {
    let containerRef: HTMLDivElement | undefined;

    const [inputMode, setInputMode] = createSignal<InputMode>("url");
    const [urlInput, setUrlInput] = createSignal("");
    const [xmlInput, setXmlInput] = createSignal("");
    const [activeTab, setActiveTab] = createSignal<ViewTab>("tree");

    const [entries, setEntries] = createSignal<SitemapUrlEntry[]>([]);
    const [childSitemaps, setChildSitemaps] = createSignal<SitemapChildEntry[]>([]);
    const [fetchedSources, setFetchedSources] = createSignal<string[]>([]);
    const [failedSources, setFailedSources] = createSignal<Array<{ url: string; reason: string }>>([]);
    const [parseNotices, setParseNotices] = createSignal<string[]>([]);
    const [discoveredVia, setDiscoveredVia] = createSignal<string>("");
    const [truncated, setTruncated] = createSignal(false);

    const [isLoading, setIsLoading] = createSignal(false);
    const [progress, setProgress] = createSignal<FetchSitemapProgress | null>(null);
    const [errorMessage, setErrorMessage] = createSignal("");

    const [selectedLocale, setSelectedLocale] = createSignal<string>("all");
    const [searchQuery, setSearchQuery] = createSignal("");
    const [sortKey, setSortKey] = createSignal<SortKey>("loc");
    const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());
    const [copiedTsv, setCopiedTsv] = createSignal(false);

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef);
    });

    const expandInitialTree = (list: SitemapUrlEntry[]) => {
        const roots = buildSiteTree(list);
        const ids = new Set<string>();
        const walk = (node: SiteTreeNode) => {
            if (node.depth <= 2) {
                ids.add(node.id);
                for (const child of node.children) {
                    walk(child);
                }
            }
        };
        for (const r of roots) walk(r);
        setExpandedIds(ids);
    };

    const handleFetchFromUrl = async (e?: Event) => {
        e?.preventDefault();
        const target = urlInput().trim();
        if (!target) {
            setErrorMessage("確認したいサイトURLまたは sitemap.xml のURLを入力してください。");
            return;
        }

        setIsLoading(true);
        setErrorMessage("");
        setParseNotices([]);
        setProgress(null);
        setSelectedLocale("all");
        setSearchQuery("");

        try {
            const result = await fetchAndResolveSitemap(target, {
                maxChildSitemaps: 15,
                maxUrls: 5000,
                onProgress: (p) => setProgress(p),
            });
            setEntries(result.urls);
            setChildSitemaps(result.childSitemaps);
            setFetchedSources(result.fetchedSources);
            setFailedSources(result.failedSources);
            setDiscoveredVia(result.discoveredVia);
            setTruncated(result.truncated);
            expandInitialTree(result.urls);
        } catch (err) {
            setErrorMessage(
                err instanceof Error ? err.message : "サイトマップの取得に失敗しました。",
            );
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    const handleParseDirectXml = (rawText: string) => {
        setXmlInput(rawText);
        setErrorMessage("");
        setFailedSources([]);
        setTruncated(false);
        setDiscoveredVia("manual");
        setSelectedLocale("all");

        if (!rawText.trim()) {
            setEntries([]);
            setChildSitemaps([]);
            setFetchedSources([]);
            setParseNotices([]);
            return;
        }

        const parsed = parseSitemapXml(rawText, "direct-input");
        setEntries(parsed.urls);
        setChildSitemaps(parsed.childSitemaps);
        setFetchedSources(["direct-input"]);
        setParseNotices(parsed.errors);
        if (parsed.urls.length === 0 && parsed.childSitemaps.length === 0 && parsed.errors.length > 0) {
            setErrorMessage(parsed.errors[0]);
        } else {
            expandInitialTree(parsed.urls);
        }
    };

    const handleLoadSample = (sampleKey: string) => {
        const sample = SITEMAP_SAMPLES[sampleKey];
        if (!sample) return;
        setInputMode("xml");
        handleParseDirectXml(sample.xml);
    };

    const handleClear = () => {
        setUrlInput("");
        setXmlInput("");
        setEntries([]);
        setChildSitemaps([]);
        setFetchedSources([]);
        setFailedSources([]);
        setParseNotices([]);
        setErrorMessage("");
        setDiscoveredVia("");
        setTruncated(false);
        setSelectedLocale("all");
        setSearchQuery("");
        setExpandedIds(new Set<string>());
    };

    const summary = createMemo(() => analyzeSitemapEntries(entries()));

    const filteredEntries = createMemo(() => {
        const locale = selectedLocale();
        const q = searchQuery().trim().toLowerCase();
        const key = sortKey();

        let list = entries();
        if (locale !== "all") {
            list = list.filter(
                (item) =>
                    item.detectedLocale === locale ||
                    item.alternates.some((a) => a.hreflang === locale),
            );
        }
        if (q) {
            list = list.filter(
                (item) =>
                    item.loc.toLowerCase().includes(q) ||
                    item.detectedLocale.toLowerCase().includes(q) ||
                    (item.lastmod || "").toLowerCase().includes(q) ||
                    item.alternates.some(
                        (a) =>
                            a.hreflang.toLowerCase().includes(q) ||
                            a.href.toLowerCase().includes(q),
                    ),
            );
        }

        const sorted = [...list];
        sorted.sort((a, b) => {
            if (key === "lastmod") {
                return (b.lastmod || "").localeCompare(a.lastmod || "");
            }
            if (key === "priority") {
                const pa = Number.parseFloat(a.priority || "-1");
                const pb = Number.parseFloat(b.priority || "-1");
                return (Number.isFinite(pb) ? pb : -1) - (Number.isFinite(pa) ? pa : -1);
            }
            if (key === "depth") {
                if (a.depth !== b.depth) return a.depth - b.depth;
                return a.loc.localeCompare(b.loc);
            }
            return a.loc.localeCompare(b.loc);
        });
        return sorted;
    });

    const treeRoots = createMemo(() => buildSiteTree(filteredEntries()));
    const localeMatrix = createMemo(() => buildLocaleCoverageMatrix(filteredEntries()));

    const toggleNode = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAllNodes = () => {
        const ids = new Set<string>();
        const walk = (node: SiteTreeNode) => {
            if (node.children.length > 0) {
                ids.add(node.id);
                for (const c of node.children) walk(c);
            }
        };
        for (const r of treeRoots()) walk(r);
        setExpandedIds(ids);
    };

    const collapseAllNodes = () => {
        setExpandedIds(new Set<string>());
    };

    const handleCopyTsv = async () => {
        const tsv = buildSitemapTsv(filteredEntries());
        try {
            await navigator.clipboard.writeText(tsv);
            setCopiedTsv(true);
            setTimeout(() => setCopiedTsv(false), 2000);
        } catch {
            // クリップボード非対応環境は無視
        }
    };

    const handleDownloadCsv = () => {
        const rows = filteredEntries();
        const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
        const header = ["URL", "言語", "階層", "最終更新日", "更新頻度", "優先度", "hreflang数", "画像数", "動画数"].join(",");
        const body = rows.map((e) =>
            [
                escapeCsv(e.loc),
                escapeCsv(e.detectedLocale),
                String(e.depth),
                escapeCsv(e.lastmod || ""),
                escapeCsv(e.changefreq || ""),
                escapeCsv(e.priority || ""),
                String(e.alternates.length),
                String(e.imageCount),
                String(e.videoCount),
            ].join(","),
        );
        const csv = `\uFEFF${[header, ...body].join("\n")}`;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const blobUrl = createSafeBlobUrl(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = "sitemap-structure.csv";
        link.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    };

    const hasResult = () => entries().length > 0 || childSitemaps().length > 0;

    return (
        <div ref={containerRef} class="ba-page ba-stack-6">
            {/* ヘッダー */}
            <div class="ba-card ba-stack-2">
                <h1 class="ba-page-title">
                    <span class="ba-icon-box">
                        <ToolIcon name="sitemap" class="ba-icon-md" />
                    </span>
                    <span>サイトマップ構造可視化</span>
                </h1>
                <p class="ba-text-sm ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                    sitemap.xml やサイトURLからサイト構造を自動解析し、ディレクトリツリー・URL一覧表・多言語（hreflang / パスロケール）対応状況を可視化できる無料ツールです。robots.txt からの自動検出や sitemapindex の再帰展開、XML直接貼り付けにも対応しています。
                </p>
            </div>

            {/* 入力カード */}
            <div class="ba-card ba-stack-4">
                <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                    <div class="ba-tabs" role="tablist" aria-label="入力方式の切り替え">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={inputMode() === "url" ? "true" : "false"}
                            class={`ba-tab ${inputMode() === "url" ? "is-active" : ""}`}
                            onClick={() => setInputMode("url")}
                        >
                            URLから自動取得
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={inputMode() === "xml" ? "true" : "false"}
                            class={`ba-tab ${inputMode() === "xml" ? "is-active" : ""}`}
                            onClick={() => setInputMode("xml")}
                        >
                            XML / URLリスト直接入力
                        </button>
                    </div>

                    <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                        <span class="ba-text-xs ba-text-muted ba-font-bold">サンプル:</span>
                        <For each={Object.entries(SITEMAP_SAMPLES)}>
                            {([key, sample]) => (
                                <button
                                    type="button"
                                    onClick={() => handleLoadSample(key)}
                                    class="ba-btn ba-btn--secondary ba-btn--xs"
                                >
                                    {sample.label}
                                </button>
                            )}
                        </For>
                        <Show when={hasResult() || urlInput() || xmlInput()}>
                            <button
                                type="button"
                                onClick={handleClear}
                                class="ba-btn ba-btn--ghost ba-btn--xs"
                            >
                                クリア
                            </button>
                        </Show>
                    </div>
                </div>

                <Show when={inputMode() === "url"}>
                    <form
                        {...({
                            toolname: "fetch_and_visualize_sitemap",
                            tooldescription:
                                "指定されたサイトURLまたはsitemap.xmlのURLを取得・再帰解析し、サイト構造と多言語対応を可視化する",
                        } as Record<string, string>)}
                        onSubmit={handleFetchFromUrl}
                        class="ba-stack-3"
                    >
                        <div class="ba-field">
                            <label for="sitemap-url-input" class="ba-label">
                                サイトURL または sitemap.xml のURL
                            </label>
                            <div class="ba-flex ba-flex-wrap ba-gap-2">
                                <input
                                    id="sitemap-url-input"
                                    type="url"
                                    inputmode="url"
                                    value={urlInput()}
                                    onInput={(e) => setUrlInput(e.currentTarget.value)}
                                    placeholder="https://example.com または https://example.com/sitemap.xml"
                                    class="ba-input ba-flex-1"
                                    style={{ "min-width": "14rem" }}
                                    aria-label="サイトURLまたはsitemap.xmlのURL"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading()}
                                    class="ba-btn ba-btn--primary"
                                >
                                    <Show when={isLoading()} fallback={<span>解析する</span>}>
                                        <>
                                            <span class="ba-spinner" />
                                            <span>取得中...</span>
                                        </>
                                    </Show>
                                </button>
                            </div>
                            <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                トップページのURLだけを入力しても robots.txt や /sitemap.xml・/sitemap_index.xml・/wp-sitemap.xml を自動探索します。
                            </p>
                        </div>
                    </form>
                </Show>

                <Show when={inputMode() === "xml"}>
                    <div class="ba-field">
                        <label for="sitemap-xml-textarea" class="ba-label">
                            sitemap.xml / sitemapindex / RSS・Atom / URLリスト（1行1URL）
                        </label>
                        <textarea
                            id="sitemap-xml-textarea"
                            value={xmlInput()}
                            onInput={(e) => handleParseDirectXml(e.currentTarget.value)}
                            placeholder={'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">...</urlset>'}
                            class="ba-textarea ba-mono"
                            rows={8}
                            aria-label="sitemap.xmlまたはURLリスト入力欄"
                        />
                    </div>
                </Show>

                <Show when={progress()}>
                    {(p) => (
                        <div class="ba-alert ba-alert--info ba-text-xs">
                            <span class="ba-spinner" />
                            <span>
                                サイトマップ取得中（{p().fetchedSitemaps} / {p().totalQueued} ファイル・収集済み {p().collectedUrls} URL）: {p().currentUrl}
                            </span>
                        </div>
                    )}
                </Show>

                <Show when={errorMessage()}>
                    <div role="alert" class="ba-alert ba-alert--danger ba-text-sm">
                        <ToolIcon name="alert" class="ba-icon-sm ba-shrink-0" />
                        <span>{errorMessage()}</span>
                    </div>
                </Show>

                <Show when={parseNotices().length > 0 && !errorMessage()}>
                    <div class="ba-alert ba-alert--warning ba-text-xs">
                        <ToolIcon name="alert" class="ba-icon-sm ba-shrink-0" />
                        <span>{parseNotices().join(" / ")}</span>
                    </div>
                </Show>
            </div>

            {/* 解析結果エリア */}
            <Show
                when={hasResult()}
                fallback={
                    <div class="ba-card ba-text-center ba-stack-2" style={{ padding: "2.5rem 1.25rem" }}>
                        <div class="ba-flex ba-justify-center">
                            <span class="ba-icon-box">
                                <ToolIcon name="sitemap" class="ba-icon-lg" />
                            </span>
                        </div>
                        <p class="ba-font-bold ba-text-sm" style={{ margin: 0 }}>
                            URLを入力して解析するか、サンプルを選択してください
                        </p>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                            多言語サイト（hreflang / パス言語 / サブドメイン言語）や sitemapindex 構造にも自動対応します。
                        </p>
                    </div>
                }
            >
                {/* サマリーKPI */}
                <div class="ba-grid-4">
                    <div class="ba-stat">
                        <div class="ba-stat-label">総URL数</div>
                        <div class="ba-stat-value">{summary().totalUrls.toLocaleString()}</div>
                        <div class="ba-stat-desc">
                            {discoveredVia() === "robots.txt"
                                ? "robots.txt から自動検出"
                                : discoveredVia() === "well-known"
                                  ? "定番パスから自動検出"
                                  : discoveredVia() === "manual"
                                    ? "直接入力から解析"
                                    : `${fetchedSources().length} ファイル取得`}
                        </div>
                    </div>
                    <div class="ba-stat">
                        <div class="ba-stat-label">検出言語 / ロケール</div>
                        <div class="ba-stat-value">{summary().locales.length}</div>
                        <div class="ba-stat-desc">
                            hreflang設定: {summary().hreflangEntryCount} 件
                        </div>
                    </div>
                    <div class="ba-stat">
                        <div class="ba-stat-label">最大階層深度</div>
                        <div class="ba-stat-value">{summary().maxDepth}</div>
                        <div class="ba-stat-desc">
                            ホスト数: {summary().uniqueHosts.length}
                        </div>
                    </div>
                    <div class="ba-stat">
                        <div class="ba-stat-label">子サイトマップ / 更新日</div>
                        <div class="ba-stat-value">{childSitemaps().length}</div>
                        <div class="ba-stat-desc">
                            lastmodあり: {summary().lastmodCount} 件
                        </div>
                    </div>
                </div>

                <Show when={truncated()}>
                    <div class="ba-alert ba-alert--warning ba-text-xs">
                        <ToolIcon name="alert" class="ba-icon-sm ba-shrink-0" />
                        <span>
                            大規模サイトのため安全上限（最大15ファイル / 5,000 URL）で読み込みを打ち切りました。個別のサブサイトマップURLを直接指定すると詳細を確認できます。
                        </span>
                    </div>
                </Show>

                {/* 言語フィルター & 検索バー & ビュータブ */}
                <div class="ba-card ba-stack-4">
                    <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3">
                        <div class="ba-tabs" role="tablist" aria-label="表示ビューの切り替え">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab() === "tree" ? "true" : "false"}
                                class={`ba-tab ${activeTab() === "tree" ? "is-active" : ""}`}
                                onClick={() => setActiveTab("tree")}
                            >
                                ディレクトリツリー ({filteredEntries().length})
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab() === "table" ? "true" : "false"}
                                class={`ba-tab ${activeTab() === "table" ? "is-active" : ""}`}
                                onClick={() => setActiveTab("table")}
                            >
                                URL一覧（表） ({filteredEntries().length})
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab() === "locales" ? "true" : "false"}
                                class={`ba-tab ${activeTab() === "locales" ? "is-active" : ""}`}
                                onClick={() => setActiveTab("locales")}
                            >
                                多言語対応表 ({localeMatrix().locales.length})
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab() === "stats" ? "true" : "false"}
                                class={`ba-tab ${activeTab() === "stats" ? "is-active" : ""}`}
                                onClick={() => setActiveTab("stats")}
                            >
                                統計・診断
                            </button>
                        </div>

                        <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                            <input
                                type="search"
                                value={searchQuery()}
                                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                placeholder="URL・パス・言語で絞り込み..."
                                class="ba-input ba-input--sm"
                                style={{ width: "14rem" }}
                                aria-label="URLおよびパスの絞り込み検索"
                            />
                            <button
                                type="button"
                                onClick={handleCopyTsv}
                                class="ba-btn ba-btn--secondary ba-btn--sm"
                                disabled={filteredEntries().length === 0}
                            >
                                {copiedTsv() ? "コピーしました" : "表をコピー (TSV)"}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadCsv}
                                class="ba-btn ba-btn--secondary ba-btn--sm"
                                disabled={filteredEntries().length === 0}
                            >
                                CSV保存
                            </button>
                        </div>
                    </div>

                    {/* 多言語フィルターチップ */}
                    <Show when={summary().locales.length > 0}>
                        <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                            <span class="ba-text-xs ba-font-bold ba-text-muted">言語フィルター:</span>
                            <button
                                type="button"
                                onClick={() => setSelectedLocale("all")}
                                class={`ba-btn ba-btn--xs ${selectedLocale() === "all" ? "ba-btn--primary" : "ba-btn--secondary"}`}
                            >
                                すべて ({entries().length})
                            </button>
                            <For each={summary().locales}>
                                {(loc) => (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLocale(loc.code)}
                                        class={`ba-btn ba-btn--xs ${selectedLocale() === loc.code ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                    >
                                        {loc.code} ({loc.count})
                                    </button>
                                )}
                            </For>
                        </div>
                    </Show>

                    {/* タブ1: ディレクトリツリー */}
                    <Show when={activeTab() === "tree"}>
                        <div class="ba-stack-3">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                <h2 class="ba-section-title" style={{ margin: 0 }}>
                                    サイト階層ツリー
                                </h2>
                                <div class="ba-flex ba-gap-2">
                                    <button
                                        type="button"
                                        onClick={expandAllNodes}
                                        class="ba-btn ba-btn--secondary ba-btn--xs"
                                    >
                                        すべて展開
                                    </button>
                                    <button
                                        type="button"
                                        onClick={collapseAllNodes}
                                        class="ba-btn ba-btn--secondary ba-btn--xs"
                                    >
                                        すべて折りたたむ
                                    </button>
                                </div>
                            </div>

                            <Show
                                when={treeRoots().length > 0}
                                fallback={
                                    <Show
                                        when={childSitemaps().length > 0}
                                        fallback={
                                            <p class="ba-text-sm ba-text-muted">
                                                条件に一致するURLがありません。
                                            </p>
                                        }
                                    >
                                        <div class="ba-panel ba-stack-2">
                                            <h3 class="ba-text-sm ba-font-bold" style={{ margin: 0 }}>
                                                検出された子サイトマップ（{childSitemaps().length}件）
                                            </h3>
                                            <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                                sitemapindex 形式のXMLが直接入力されました。「URLから自動取得」モードで元のURLを指定すると子サイトマップも自動で再帰展開できます。
                                            </p>
                                            <div class="ba-stack-1">
                                                <For each={childSitemaps()}>
                                                    {(child) => (
                                                        <div class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-text-xs ba-mono">
                                                            <a
                                                                href={child.loc}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                class="ba-underline ba-break-all"
                                                                style={{ color: "var(--ba-primary)" }}
                                                            >
                                                                {child.loc}
                                                            </a>
                                                            <Show when={child.lastmod}>
                                                                <span class="ba-text-muted ba-shrink-0">{child.lastmod}</span>
                                                            </Show>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                    </Show>
                                }
                            >
                                <div
                                    style={{
                                        border: "1px solid var(--ba-border)",
                                        "border-radius": "var(--ba-radius-sm)",
                                        "max-height": "36rem",
                                        "overflow-y": "auto",
                                    }}
                                >
                                    <For each={treeRoots()}>
                                        {(root) => (
                                            <SiteTreeNodeRow
                                                node={root}
                                                expandedIds={expandedIds()}
                                                onToggle={toggleNode}
                                            />
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </Show>

                    {/* タブ2: URL一覧（表） */}
                    <Show when={activeTab() === "table"}>
                        <div class="ba-stack-3">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                <h2 class="ba-section-title" style={{ margin: 0 }}>
                                    URL一覧テーブル
                                </h2>
                                <div class="ba-flex ba-items-center ba-gap-2">
                                    <label for="sitemap-sort-select" class="ba-text-xs ba-text-muted">
                                        並び替え:
                                    </label>
                                    <select
                                        id="sitemap-sort-select"
                                        value={sortKey()}
                                        onChange={(e) => setSortKey(e.currentTarget.value as SortKey)}
                                        class="ba-select ba-select--sm"
                                        style={{ width: "auto" }}
                                        aria-label="URL一覧の並び替え"
                                    >
                                        <option value="loc">URL順</option>
                                        <option value="lastmod">更新日が新しい順</option>
                                        <option value="priority">優先度が高い順</option>
                                        <option value="depth">階層が浅い順</option>
                                    </select>
                                </div>
                            </div>

                            <div class="ba-table-wrap" style={{ "max-height": "36rem", "overflow-y": "auto" }}>
                                <table class="ba-table">
                                    <thead>
                                        <tr>
                                            <th>URL</th>
                                            <th>言語</th>
                                            <th>階層</th>
                                            <th>最終更新日</th>
                                            <th>優先度 / 頻度</th>
                                            <th>拡張 (hreflang / 画像)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={filteredEntries().slice(0, 500)}>
                                            {(item) => (
                                                <tr>
                                                    <td class="ba-mono ba-text-xs ba-break-all" style={{ "max-width": "24rem" }}>
                                                        <a
                                                            href={item.loc}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            class="ba-underline"
                                                            style={{ color: "var(--ba-primary)" }}
                                                        >
                                                            {item.loc}
                                                        </a>
                                                    </td>
                                                    <td>
                                                        <span class="ba-badge ba-badge--primary">
                                                            {item.detectedLocale}
                                                        </span>
                                                    </td>
                                                    <td class="ba-mono ba-text-xs">{item.depth}</td>
                                                    <td class="ba-mono ba-text-xs">
                                                        {item.lastmod ? item.lastmod.slice(0, 10) : "-"}
                                                    </td>
                                                    <td class="ba-mono ba-text-xs">
                                                        {item.priority || "-"} / {item.changefreq || "-"}
                                                    </td>
                                                    <td class="ba-text-xs">
                                                        <div class="ba-flex ba-flex-wrap ba-gap-1">
                                                            <Show when={item.alternates.length > 0}>
                                                                <span class="ba-badge ba-badge--info">
                                                                    hreflang {item.alternates.length}
                                                                </span>
                                                            </Show>
                                                            <Show when={item.imageCount > 0}>
                                                                <span class="ba-badge ba-badge--neutral">
                                                                    画像 {item.imageCount}
                                                                </span>
                                                            </Show>
                                                            <Show when={item.videoCount > 0}>
                                                                <span class="ba-badge ba-badge--neutral">
                                                                    動画 {item.videoCount}
                                                                </span>
                                                            </Show>
                                                            <Show
                                                                when={
                                                                    item.alternates.length === 0 &&
                                                                    item.imageCount === 0 &&
                                                                    item.videoCount === 0
                                                                }
                                                            >
                                                                <span class="ba-text-muted">-</span>
                                                            </Show>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                            <Show when={filteredEntries().length > 500}>
                                <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                    表示パフォーマンスのため先頭500件を表示しています（全 {filteredEntries().length} 件は TSVコピー / CSV保存で全件出力されます）。
                                </p>
                            </Show>
                        </div>
                    </Show>

                    {/* タブ3: 多言語対応表 */}
                    <Show when={activeTab() === "locales"}>
                        <div class="ba-stack-4">
                            <h2 class="ba-section-title" style={{ margin: 0 }}>
                                多言語（hreflang / ロケール）対応マトリクス
                            </h2>

                            <div class="ba-panel ba-stack-2">
                                <h3 class="ba-text-xs ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                                    言語別URL比率
                                </h3>
                                <For each={summary().locales}>
                                    {(loc) => (
                                        <div class="ba-flex ba-items-center ba-gap-3 ba-text-xs">
                                            <span class="ba-mono ba-font-bold" style={{ width: "5.5rem" }}>
                                                {loc.code}
                                            </span>
                                            <progress
                                                class="ba-progress ba-flex-1"
                                                value={loc.percentage}
                                                max={100}
                                                aria-label={`${loc.code} のURL割合`}
                                            />
                                            <span class="ba-mono ba-text-muted" style={{ width: "6.5rem", "text-align": "right" }}>
                                                {loc.count} 件 ({loc.percentage}%)
                                            </span>
                                        </div>
                                    )}
                                </For>
                            </div>

                            <div class="ba-table-wrap" style={{ "max-height": "32rem", "overflow-y": "auto" }}>
                                <table class="ba-table">
                                    <thead>
                                        <tr>
                                            <th>正規化パス</th>
                                            <For each={localeMatrix().locales}>
                                                {(code) => <th class="ba-mono">{code}</th>}
                                            </For>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={localeMatrix().rows.slice(0, 300)}>
                                            {(row) => (
                                                <tr>
                                                    <td class="ba-mono ba-text-xs ba-font-bold">
                                                        {row.displayPath}
                                                    </td>
                                                    <For each={localeMatrix().locales}>
                                                        {(code) => {
                                                            const targetUrl = () => row.urlsByLocale[code];
                                                            return (
                                                                <td class="ba-text-xs">
                                                                    <Show
                                                                        when={targetUrl() && isSafeHttpUrl(targetUrl())}
                                                                        fallback={<span class="ba-text-muted">-</span>}
                                                                    >
                                                                        <a
                                                                            href={targetUrl()}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            class="ba-badge ba-badge--success"
                                                                            title={targetUrl()}
                                                                        >
                                                                            対応あり
                                                                        </a>
                                                                    </Show>
                                                                </td>
                                                            );
                                                        }}
                                                    </For>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Show>

                    {/* タブ4: 統計・診断 */}
                    <Show when={activeTab() === "stats"}>
                        <div class="ba-stack-4">
                            <h2 class="ba-section-title" style={{ margin: 0 }}>
                                構造統計・SEO診断
                            </h2>

                            <div class="ba-grid-2">
                                <div class="ba-panel ba-stack-2">
                                    <h3 class="ba-text-xs ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                                        階層深度別のURL分布
                                    </h3>
                                    <For each={summary().depthDistribution}>
                                        {(item) => {
                                            const pct = () =>
                                                summary().totalUrls > 0
                                                    ? Math.round((item.count / summary().totalUrls) * 100)
                                                    : 0;
                                            return (
                                                <div class="ba-flex ba-items-center ba-gap-3 ba-text-xs">
                                                    <span class="ba-mono ba-font-bold" style={{ width: "4.5rem" }}>
                                                        階層 {item.depth}
                                                    </span>
                                                    <progress
                                                        class="ba-progress ba-flex-1"
                                                        value={pct()}
                                                        max={100}
                                                        aria-label={`階層 ${item.depth} のURL割合`}
                                                    />
                                                    <span class="ba-mono ba-text-muted" style={{ width: "5.5rem", "text-align": "right" }}>
                                                        {item.count} 件 ({pct()}%)
                                                    </span>
                                                </div>
                                            );
                                        }}
                                    </For>
                                </div>

                                <div class="ba-panel ba-stack-2">
                                    <h3 class="ba-text-xs ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                                        診断結果
                                    </h3>
                                    <For each={summary().diagnostics}>
                                        {(diag) => (
                                            <div
                                                class={`ba-alert ${
                                                    diag.severity === "error"
                                                        ? "ba-alert--danger"
                                                        : diag.severity === "warning"
                                                          ? "ba-alert--warning"
                                                          : "ba-alert--info"
                                                } ba-text-xs`}
                                            >
                                                <div class="ba-stack-1">
                                                    <div class="ba-font-bold">{diag.title}</div>
                                                    <div>{diag.detail}</div>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>

                            <Show when={childSitemaps().length > 0}>
                                <div class="ba-panel ba-stack-2">
                                    <h3 class="ba-text-xs ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                                        子サイトマップ一覧（{childSitemaps().length}件）
                                    </h3>
                                    <div class="ba-stack-1">
                                        <For each={childSitemaps()}>
                                            {(child) => (
                                                <div class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-text-xs ba-mono">
                                                    <a
                                                        href={child.loc}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="ba-underline ba-break-all"
                                                        style={{ color: "var(--ba-primary)" }}
                                                    >
                                                        {child.loc}
                                                    </a>
                                                    <Show when={child.lastmod}>
                                                        <span class="ba-text-muted ba-shrink-0">{child.lastmod}</span>
                                                    </Show>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            <Show when={failedSources().length > 0}>
                                <div class="ba-panel ba-stack-2">
                                    <h3 class="ba-text-xs ba-font-bold ba-text-danger" style={{ margin: 0 }}>
                                        取得できなかったサイトマップ（{failedSources().length}件）
                                    </h3>
                                    <For each={failedSources()}>
                                        {(f) => (
                                            <div class="ba-text-xs ba-mono ba-break-all">
                                                {f.url} — <span class="ba-text-muted">{f.reason}</span>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>
            </Show>

            <AdSense />
        </div>
    );
}
