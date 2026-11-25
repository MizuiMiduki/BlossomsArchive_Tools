/**
 * sitemap.xml パーサー・再帰取得・サイト構造ツリー構築・多言語(hreflang/ロケール)解析ユーティリティ
 * 完全クライアントサイド動作（DOMParser ベース、単一パス正規表現によるHTML/XMLサニタイズ不使用）
 */

import { fetchWithTimeout, isSameOriginUrl, normalizeFetchUrl } from "./htmlFetcher";

export interface SitemapAlternateLink {
    hreflang: string;
    href: string;
}

export interface SitemapUrlEntry {
    loc: string;
    host: string;
    path: string;
    depth: number;
    lastmod?: string;
    changefreq?: string;
    priority?: string;
    imageCount: number;
    videoCount: number;
    hasNews: boolean;
    alternates: SitemapAlternateLink[];
    detectedLocale: string;
    sourceSitemap?: string;
}

export interface SitemapChildEntry {
    loc: string;
    lastmod?: string;
}

export interface ParsedSitemapDocument {
    kind: "urlset" | "sitemapindex" | "text" | "feed" | "unknown";
    urls: SitemapUrlEntry[];
    childSitemaps: SitemapChildEntry[];
    errors: string[];
    rawCount: number;
}

export interface SiteTreeNode {
    id: string;
    segment: string;
    fullPath: string;
    depth: number;
    urlEntry?: SitemapUrlEntry;
    children: SiteTreeNode[];
    totalUrls: number;
    locales: string[];
}

export interface LocaleCoverageRow {
    canonicalKey: string;
    displayPath: string;
    urlsByLocale: Record<string, string>;
    hasXDefault: boolean;
}

export interface SitemapDiagnostic {
    severity: "info" | "warning" | "error";
    title: string;
    detail: string;
}

export interface SitemapAnalysisSummary {
    totalUrls: number;
    uniqueHosts: string[];
    locales: Array<{ code: string; count: number; percentage: number }>;
    maxDepth: number;
    depthDistribution: Array<{ depth: number; count: number }>;
    lastmodCount: number;
    hreflangEntryCount: number;
    imageTotal: number;
    videoTotal: number;
    diagnostics: SitemapDiagnostic[];
}

export interface FetchSitemapProgress {
    fetchedSitemaps: number;
    totalQueued: number;
    currentUrl: string;
    collectedUrls: number;
}

export interface FetchSitemapResult {
    rootUrl: string;
    discoveredVia: "direct-url" | "robots.txt" | "well-known" | "manual";
    urls: SitemapUrlEntry[];
    childSitemaps: SitemapChildEntry[];
    fetchedSources: string[];
    failedSources: Array<{ url: string; reason: string }>;
    truncated: boolean;
}

const KNOWN_LOCALE_CODES = new Set([
    "ja", "en", "zh", "ko", "fr", "de", "es", "it", "pt", "ru", "ar", "hi",
    "th", "vi", "id", "ms", "nl", "pl", "sv", "da", "fi", "no", "nb", "tr",
    "uk", "cs", "hu", "ro", "el", "he", "bg", "hr", "sk", "sl", "et", "lv",
    "lt", "fa", "bn", "ta", "te", "ur", "fil", "tl", "ca", "eu", "gl",
]);

/**
 * 安全な http: / https: URL かどうかを検証する
 */
export function isSafeHttpUrl(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

/**
 * ロケールコードを正規化する（例: ja_JP -> ja-JP, EN -> en, x-default -> x-default）
 */
export function normalizeLocaleCode(raw: string): string {
    const trimmed = raw.trim().replace(/_/g, "-");
    if (!trimmed) return "";
    if (trimmed.toLowerCase() === "x-default") return "x-default";
    const parts = trimmed.split("-").filter(Boolean);
    if (parts.length === 0) return "";
    const lang = parts[0].toLowerCase();
    if (parts.length === 1) return lang;
    const rest = parts.slice(1).map((p) => {
        if (p.length === 4) {
            return p[0].toUpperCase() + p.slice(1).toLowerCase();
        }
        if (p.length === 2 || p.length === 3) {
            return p.toUpperCase();
        }
        return p.toLowerCase();
    });
    return [lang, ...rest].join("-");
}

/**
 * パスセグメントまたはサブドメインが言語/ロケールコードかどうかを判定する
 */
export function isLikelyLocaleToken(token: string): boolean {
    const normalized = token.trim().replace(/_/g, "-").toLowerCase();
    if (!normalized) return false;
    if (normalized === "x-default") return true;
    const match = normalized.match(/^([a-z]{2})(?:-([a-z]{2}|[a-z]{4}|\d{3}))?$/);
    if (!match) return false;
    return KNOWN_LOCALE_CODES.has(match[1]);
}

/**
 * URL と hreflang リストから、そのページの言語/ロケールを推定する
 */
export function detectEntryLocale(
    loc: string,
    alternates: SitemapAlternateLink[],
): string {
    // 1. 自分自身を指す hreflang があれば最優先で採用
    const normalizedLoc = loc.replace(/\/+$/, "");
    for (const alt of alternates) {
        const altNorm = alt.href.replace(/\/+$/, "");
        if (altNorm === normalizedLoc && alt.hreflang.toLowerCase() !== "x-default") {
            return normalizeLocaleCode(alt.hreflang);
        }
    }

    // 2. パス先頭セグメント（例: /ja/..., /en-us/..., /zh-hans/...）から推定
    try {
        const parsed = new URL(loc);
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (segments.length > 0 && isLikelyLocaleToken(segments[0])) {
            return normalizeLocaleCode(segments[0]);
        }

        // 3. クエリパラメータ (?lang=en, ?hl=ja) から推定
        const queryLang =
            parsed.searchParams.get("lang") ||
            parsed.searchParams.get("hl") ||
            parsed.searchParams.get("locale");
        if (queryLang && isLikelyLocaleToken(queryLang)) {
            return normalizeLocaleCode(queryLang);
        }

        // 4. サブドメイン（例: en.example.com, ja.example.com）から推定
        const hostLabels = parsed.hostname.split(".");
        if (hostLabels.length >= 3 && isLikelyLocaleToken(hostLabels[0])) {
            return normalizeLocaleCode(hostLabels[0]);
        }
    } catch {
        // 無効なURLは未分類へ
    }

    return "default";
}

/**
 * 要素のローカル名（名前空間プレフィックス除去後）を小文字で取得する
 */
function getLocalName(el: Element): string {
    const raw = el.localName || el.tagName || "";
    const colonIdx = raw.indexOf(":");
    return (colonIdx >= 0 ? raw.slice(colonIdx + 1) : raw).toLowerCase();
}

/**
 * 直下の子要素から指定ローカル名の要素リストを返す
 */
function getDirectChildrenByLocalName(parent: Element, name: string): Element[] {
    const target = name.toLowerCase();
    const out: Element[] = [];
    for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (getLocalName(child) === target) {
            out.push(child);
        }
    }
    return out;
}

/**
 * 直下の子要素から指定ローカル名の最初のテキスト値を返す
 */
function getDirectChildText(parent: Element, name: string): string {
    const found = getDirectChildrenByLocalName(parent, name)[0];
    return found?.textContent?.trim() || "";
}

/**
 * 1件の URL 文字列と属性情報から SitemapUrlEntry を構築する
 */
function createUrlEntry(
    loc: string,
    opts: {
        lastmod?: string;
        changefreq?: string;
        priority?: string;
        imageCount?: number;
        videoCount?: number;
        hasNews?: boolean;
        alternates?: SitemapAlternateLink[];
        sourceSitemap?: string;
    } = {},
): SitemapUrlEntry | null {
    const trimmed = loc.trim();
    if (!isSafeHttpUrl(trimmed)) return null;
    try {
        const parsed = new URL(trimmed);
        const segments = parsed.pathname.split("/").filter(Boolean);
        const alternates = (opts.alternates || []).filter(
            (a) => a.hreflang && isSafeHttpUrl(a.href),
        );
        const detectedLocale = detectEntryLocale(trimmed, alternates);
        return {
            loc: trimmed,
            host: parsed.host,
            path: parsed.pathname + parsed.search,
            depth: segments.length,
            lastmod: opts.lastmod || undefined,
            changefreq: opts.changefreq || undefined,
            priority: opts.priority || undefined,
            imageCount: opts.imageCount || 0,
            videoCount: opts.videoCount || 0,
            hasNews: Boolean(opts.hasNews),
            alternates,
            detectedLocale,
            sourceSitemap: opts.sourceSitemap,
        };
    } catch {
        return null;
    }
}

/**
 * XML・RSS/Atom・プレーンテキストのサイトマップを自動判定してパースする
 */
export function parseSitemapXml(
    rawInput: string,
    sourceSitemap?: string,
): ParsedSitemapDocument {
    const trimmed = rawInput.trim();
    if (!trimmed) {
        return {
            kind: "unknown",
            urls: [],
            childSitemaps: [],
            errors: ["入力が空です。"],
            rawCount: 0,
        };
    }

    // 1. プレーンテキスト形式のサイトマップ（1行1URL）判定
    if (!trimmed.startsWith("<")) {
        const lines = trimmed
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#"));
        const urls: SitemapUrlEntry[] = [];
        for (const line of lines) {
            const entry = createUrlEntry(line, { sourceSitemap });
            if (entry) urls.push(entry);
        }
        if (urls.length > 0) {
            return {
                kind: "text",
                urls,
                childSitemaps: [],
                errors: [],
                rawCount: lines.length,
            };
        }
        return {
            kind: "unknown",
            urls: [],
            childSitemaps: [],
            errors: ["有効なXMLまたはURLリストとして解析できませんでした。"],
            rawCount: 0,
        };
    }

    // 2. DOMParser による XML パース
    const errors: string[] = [];
    const parser = new DOMParser();
    let doc = parser.parseFromString(trimmed, "application/xml");
    const parseErrorNode = doc.getElementsByTagName("parsererror")[0];

    if (parseErrorNode) {
        // 未エスケープの & 等による軽微な構文崩れを救済（HTMLパーサーではなくXML実体参照のみ補正）
        const repaired = trimmed.replace(
            /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g,
            "&amp;",
        );
        const retryDoc = parser.parseFromString(repaired, "application/xml");
        if (!retryDoc.getElementsByTagName("parsererror")[0]) {
            doc = retryDoc;
            errors.push("XML内に未エスケープの '&' が含まれていたため自動補正して解析しました。");
        } else {
            return {
                kind: "unknown",
                urls: [],
                childSitemaps: [],
                errors: ["XMLの構文エラーにより解析できませんでした。正しい sitemap.xml か確認してください。"],
                rawCount: 0,
            };
        }
    }

    const root = doc.documentElement;
    if (!root) {
        return {
            kind: "unknown",
            urls: [],
            childSitemaps: [],
            errors: ["ルートXML要素が見つかりませんでした。"],
            rawCount: 0,
        };
    }

    const rootName = getLocalName(root);

    // 3. <sitemapindex> の解析
    if (rootName === "sitemapindex") {
        const sitemapNodes = getDirectChildrenByLocalName(root, "sitemap");
        const childSitemaps: SitemapChildEntry[] = [];
        for (const node of sitemapNodes) {
            const loc = getDirectChildText(node, "loc");
            const lastmod = getDirectChildText(node, "lastmod") || undefined;
            if (isSafeHttpUrl(loc)) {
                childSitemaps.push({ loc: loc.trim(), lastmod });
            }
        }
        return {
            kind: "sitemapindex",
            urls: [],
            childSitemaps,
            errors,
            rawCount: sitemapNodes.length,
        };
    }

    // 4. <urlset> の解析
    if (rootName === "urlset") {
        const urlNodes = getDirectChildrenByLocalName(root, "url");
        const urls: SitemapUrlEntry[] = [];

        for (const node of urlNodes) {
            const loc = getDirectChildText(node, "loc");
            if (!loc) continue;
            const lastmod = getDirectChildText(node, "lastmod") || undefined;
            const changefreq = getDirectChildText(node, "changefreq") || undefined;
            const priority = getDirectChildText(node, "priority") || undefined;

            const alternates: SitemapAlternateLink[] = [];
            let imageCount = 0;
            let videoCount = 0;
            let hasNews = false;

            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                const childLocal = getLocalName(child);
                if (childLocal === "link") {
                    const rel = (child.getAttribute("rel") || "").toLowerCase();
                    const hreflang = child.getAttribute("hreflang") || "";
                    const href = child.getAttribute("href") || "";
                    if (rel === "alternate" && hreflang && isSafeHttpUrl(href)) {
                        alternates.push({
                            hreflang: normalizeLocaleCode(hreflang),
                            href: href.trim(),
                        });
                    }
                } else if (childLocal === "image") {
                    imageCount++;
                } else if (childLocal === "video") {
                    videoCount++;
                } else if (childLocal === "news") {
                    hasNews = true;
                }
            }

            const entry = createUrlEntry(loc, {
                lastmod,
                changefreq,
                priority,
                imageCount,
                videoCount,
                hasNews,
                alternates,
                sourceSitemap,
            });
            if (entry) urls.push(entry);
        }

        return {
            kind: "urlset",
            urls,
            childSitemaps: [],
            errors,
            rawCount: urlNodes.length,
        };
    }

    // 5. RSS / Atom フィードのフォールバック解析
    if (rootName === "rss" || rootName === "feed" || rootName === "rdf") {
        const urls: SitemapUrlEntry[] = [];
        const items = Array.from(doc.getElementsByTagName("item"));
        const entries = Array.from(doc.getElementsByTagName("entry"));
        const nodes = items.length > 0 ? items : entries;

        for (const item of nodes) {
            let loc = "";
            const linkEl = getDirectChildrenByLocalName(item, "link")[0];
            if (linkEl) {
                loc = linkEl.getAttribute("href") || linkEl.textContent?.trim() || "";
            }
            const lastmod =
                getDirectChildText(item, "pubdate") ||
                getDirectChildText(item, "updated") ||
                undefined;
            const entry = createUrlEntry(loc, { lastmod, sourceSitemap });
            if (entry) urls.push(entry);
        }

        return {
            kind: "feed",
            urls,
            childSitemaps: [],
            errors,
            rawCount: nodes.length,
        };
    }

    return {
        kind: "unknown",
        urls: [],
        childSitemaps: [],
        errors: [`未対応のXMLルート要素 <${rootName}> です。sitemap.xml (<urlset> / <sitemapindex>) を指定してください。`],
        rawCount: 0,
    };
}

/**
 * robots.txt から Sitemap: ディレクティブを抽出する
 */
export function extractSitemapsFromRobotsTxt(robotsText: string): string[] {
    const results: string[] = [];
    const seen = new Set<string>();
    const lines = robotsText.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^sitemap\s*:\s*(.+)$/i);
        if (match) {
            const candidate = match[1].trim();
            if (isSafeHttpUrl(candidate) && !seen.has(candidate)) {
                seen.add(candidate);
                results.push(candidate);
            }
        }
    }
    return results;
}

/**
 * テキストファイル（XML / robots.txt）を同一オリジンまたは複数のCORSプロキシ並列レースで取得する
 */
export async function fetchRawTextResource(
    targetUrl: string,
    timeoutMs = 10000,
): Promise<string> {
    if (!isSafeHttpUrl(targetUrl)) {
        throw new Error("無効なURL形式です（http:// または https:// のみ対応）。");
    }

    // 1. 同一オリジン直接取得
    if (isSameOriginUrl(targetUrl)) {
        try {
            const res = await fetchWithTimeout(targetUrl, Math.min(timeoutMs, 5000));
            if (res.ok) {
                const text = await res.text();
                if (text.trim()) return text;
            }
        } catch {
            // フォールバックへ
        }
    }

    const encoded = encodeURIComponent(targetUrl);

    const raceSources: Array<() => Promise<string>> = [
        // 直接フェッチ（CORS許可されているサイトマップでは最速）
        async () => {
            const res = await fetchWithTimeout(targetUrl, 4500);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (!text.trim()) throw new Error("Empty response");
            return text;
        },
        // AllOrigins /get
        async () => {
            const res = await fetchWithTimeout(
                `https://api.allorigins.win/get?url=${encoded}`,
                timeoutMs,
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const text = typeof data?.contents === "string" ? data.contents : "";
            if (!text.trim()) throw new Error("Empty AllOrigins contents");
            return text;
        },
        // CodeTabs proxy
        async () => {
            const res = await fetchWithTimeout(
                `https://api.codetabs.com/v1/proxy/?quest=${encoded}`,
                timeoutMs,
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (!text.trim()) throw new Error("Empty CodeTabs contents");
            return text;
        },
        // CORS.lol
        async () => {
            const res = await fetchWithTimeout(
                `https://api.cors.lol/?url=${encoded}`,
                timeoutMs,
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (!text.trim()) throw new Error("Empty CORS.lol contents");
            return text;
        },
    ];

    try {
        return await Promise.any(raceSources.map((fn) => fn()));
    } catch {
        // 最終フォールバック: AllOrigins /raw
        const res = await fetchWithTimeout(
            `https://api.allorigins.win/raw?url=${encoded}`,
            timeoutMs,
        );
        if (!res.ok) {
            throw new Error(`取得に失敗しました (HTTP ${res.status})`);
        }
        const text = await res.text();
        if (!text.trim()) {
            throw new Error("取得したコンテンツが空でした。");
        }
        return text;
    }
}

/**
 * URL またはドメインから sitemap.xml を自動検出し、sitemapindex を安全上限まで再帰取得する
 */
export async function fetchAndResolveSitemap(
    rawInputUrl: string,
    options: {
        maxChildSitemaps?: number;
        maxUrls?: number;
        onProgress?: (progress: FetchSitemapProgress) => void;
    } = {},
): Promise<FetchSitemapResult> {
    const maxChildSitemaps = Math.max(1, Math.min(30, options.maxChildSitemaps ?? 15));
    const maxUrls = Math.max(100, Math.min(20000, options.maxUrls ?? 5000));
    const normalizedUrl = normalizeFetchUrl(rawInputUrl);

    if (!isSafeHttpUrl(normalizedUrl)) {
        throw new Error("有効なURL（https://example.com または sitemap.xml のURL）を入力してください。");
    }

    const parsedInput = new URL(normalizedUrl);
    const looksLikeSitemapFile =
        /sitemap|\.xml(\?|$)|\.txt(\?|$)/i.test(parsedInput.pathname);

    let queue: string[] = [];
    let discoveredVia: FetchSitemapResult["discoveredVia"] = "direct-url";

    if (looksLikeSitemapFile) {
        queue.push(normalizedUrl);
    } else {
        // robots.txt から Sitemap: ディレクティブを探索
        const robotsUrl = `${parsedInput.origin}/robots.txt`;
        try {
            const robotsText = await fetchRawTextResource(robotsUrl, 6000);
            const foundInRobots = extractSitemapsFromRobotsTxt(robotsText);
            if (foundInRobots.length > 0) {
                queue.push(...foundInRobots);
                discoveredVia = "robots.txt";
            }
        } catch {
            // robots.txt 取得失敗時は定番パスへフォールバック
        }

        if (queue.length === 0) {
            discoveredVia = "well-known";
            const candidates = [
                `${parsedInput.origin}/sitemap.xml`,
                `${parsedInput.origin}/sitemap_index.xml`,
                `${parsedInput.origin}/wp-sitemap.xml`,
            ];
            let foundCandidate = "";
            for (const cand of candidates) {
                try {
                    const text = await fetchRawTextResource(cand, 6500);
                    const parsed = parseSitemapXml(text, cand);
                    if (parsed.urls.length > 0 || parsed.childSitemaps.length > 0) {
                        foundCandidate = cand;
                        break;
                    }
                } catch {
                    // 次の候補へ
                }
            }
            if (foundCandidate) {
                queue.push(foundCandidate);
            } else {
                queue.push(`${parsedInput.origin}/sitemap.xml`);
            }
        }
    }

    const visited = new Set<string>();
    const allUrls: SitemapUrlEntry[] = [];
    const seenLocs = new Set<string>();
    const allChildSitemaps: SitemapChildEntry[] = [];
    const fetchedSources: string[] = [];
    const failedSources: Array<{ url: string; reason: string }> = [];
    let truncated = false;

    while (queue.length > 0) {
        if (fetchedSources.length >= maxChildSitemaps || allUrls.length >= maxUrls) {
            truncated = true;
            break;
        }

        const currentUrl = queue.shift()!;
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        options.onProgress?.({
            fetchedSitemaps: fetchedSources.length,
            totalQueued: visited.size + queue.length,
            currentUrl,
            collectedUrls: allUrls.length,
        });

        try {
            const rawText = await fetchRawTextResource(currentUrl);
            const parsed = parseSitemapXml(rawText, currentUrl);
            fetchedSources.push(currentUrl);

            if (parsed.kind === "sitemapindex") {
                for (const child of parsed.childSitemaps) {
                    if (!allChildSitemaps.some((c) => c.loc === child.loc)) {
                        allChildSitemaps.push(child);
                    }
                    if (!visited.has(child.loc)) {
                        queue.push(child.loc);
                    }
                }
            } else if (parsed.urls.length > 0) {
                for (const entry of parsed.urls) {
                    if (allUrls.length >= maxUrls) {
                        truncated = true;
                        break;
                    }
                    if (!seenLocs.has(entry.loc)) {
                        seenLocs.add(entry.loc);
                        allUrls.push(entry);
                    }
                }
            } else if (parsed.errors.length > 0) {
                failedSources.push({ url: currentUrl, reason: parsed.errors[0] });
            }
        } catch (err) {
            failedSources.push({
                url: currentUrl,
                reason: err instanceof Error ? err.message : "取得に失敗しました",
            });
        }
    }

    if (allUrls.length === 0 && allChildSitemaps.length === 0 && failedSources.length > 0) {
        throw new Error(
            `サイトマップを取得できませんでした (${failedSources[0].reason})。CORS制限またはサイトマップ未設置の可能性があります。「XML直接貼り付け」タブもお試しください。`,
        );
    }

    return {
        rootUrl: fetchedSources[0] || normalizedUrl,
        discoveredVia,
        urls: allUrls,
        childSitemaps: allChildSitemaps,
        fetchedSources,
        failedSources,
        truncated,
    };
}

/**
 * URL一覧からホスト・パス階層別のサイト構造ツリーを構築する
 */
export function buildSiteTree(entries: SitemapUrlEntry[]): SiteTreeNode[] {
    const hostMap = new Map<string, SiteTreeNode>();

    const getOrCreateHostNode = (host: string): SiteTreeNode => {
        let node = hostMap.get(host);
        if (!node) {
            node = {
                id: `host:${host}`,
                segment: host,
                fullPath: `https://${host}/`,
                depth: 0,
                children: [],
                totalUrls: 0,
                locales: [],
            };
            hostMap.set(host, node);
        }
        return node;
    };

    for (const entry of entries) {
        const hostNode = getOrCreateHostNode(entry.host);
        let parsedPath = "/";
        try {
            parsedPath = new URL(entry.loc).pathname;
        } catch {
            parsedPath = entry.path;
        }

        const segments = parsedPath.split("/").filter(Boolean);
        let current = hostNode;

        if (segments.length === 0) {
            current.urlEntry = entry;
            continue;
        }

        let accPath = "";
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            accPath += `/${seg}`;
            let child = current.children.find((c) => c.segment === seg);
            if (!child) {
                child = {
                    id: `${entry.host}${accPath}`,
                    segment: seg,
                    fullPath: accPath,
                    depth: i + 1,
                    children: [],
                    totalUrls: 0,
                    locales: [],
                };
                current.children.push(child);
            }
            if (i === segments.length - 1) {
                child.urlEntry = entry;
            }
            current = child;
        }
    }

    // 配下URL数・含まれる言語・子ノードのソートを再帰集計
    const finalizeNode = (node: SiteTreeNode): { count: number; locales: Set<string> } => {
        const localeSet = new Set<string>();
        let count = 0;
        if (node.urlEntry) {
            count += 1;
            localeSet.add(node.urlEntry.detectedLocale);
            for (const alt of node.urlEntry.alternates) {
                localeSet.add(alt.hreflang);
            }
        }
        for (const child of node.children) {
            const res = finalizeNode(child);
            count += res.count;
            for (const l of res.locales) {
                localeSet.add(l);
            }
        }
        // フォルダ（子あり）を先に、同じ種別内はURL数降順→名前昇順
        node.children.sort((a, b) => {
            const aDir = a.children.length > 0 ? 1 : 0;
            const bDir = b.children.length > 0 ? 1 : 0;
            if (aDir !== bDir) return bDir - aDir;
            if (b.totalUrls !== a.totalUrls) return b.totalUrls - a.totalUrls;
            return a.segment.localeCompare(b.segment);
        });
        node.totalUrls = count;
        node.locales = Array.from(localeSet).sort();
        return { count, locales: localeSet };
    };

    const roots = Array.from(hostMap.values());
    for (const root of roots) {
        finalizeNode(root);
    }
    roots.sort((a, b) => b.totalUrls - a.totalUrls);
    return roots;
}

/**
 * URLパスからロケールプレフィックスを除いた正規化キーを生成する（多言語対応表用）
 */
function stripLocalePrefixFromUrl(urlStr: string): string {
    try {
        const parsed = new URL(urlStr);
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (segments.length > 0 && isLikelyLocaleToken(segments[0])) {
            const rest = segments.slice(1).join("/");
            return `/${rest}`;
        }
        return parsed.pathname || "/";
    } catch {
        return urlStr;
    }
}

/**
 * 多言語対応マトリクス（ページごとの言語別URL一覧）を構築する
 */
export function buildLocaleCoverageMatrix(entries: SitemapUrlEntry[]): {
    locales: string[];
    rows: LocaleCoverageRow[];
} {
    const localeSet = new Set<string>();
    const groupMap = new Map<string, LocaleCoverageRow>();

    for (const entry of entries) {
        // hreflang が定義されている場合は、グループ内最小URLまたは正規化パスをグループキーにする
        let groupKey = stripLocalePrefixFromUrl(entry.loc);
        let hasXDefault = false;

        if (entry.alternates.length > 0) {
            const xDef = entry.alternates.find((a) => a.hreflang === "x-default");
            if (xDef) {
                hasXDefault = true;
                groupKey = stripLocalePrefixFromUrl(xDef.href);
            } else {
                const sortedHrefs = [entry.loc, ...entry.alternates.map((a) => a.href)].sort();
                groupKey = stripLocalePrefixFromUrl(sortedHrefs[0]);
            }
        }

        let row = groupMap.get(groupKey);
        if (!row) {
            row = {
                canonicalKey: groupKey,
                displayPath: groupKey || "/",
                urlsByLocale: {},
                hasXDefault: false,
            };
            groupMap.set(groupKey, row);
        }

        if (hasXDefault) row.hasXDefault = true;

        if (entry.detectedLocale) {
            localeSet.add(entry.detectedLocale);
            row.urlsByLocale[entry.detectedLocale] = entry.loc;
        }

        for (const alt of entry.alternates) {
            localeSet.add(alt.hreflang);
            row.urlsByLocale[alt.hreflang] = alt.href;
            if (alt.hreflang === "x-default") {
                row.hasXDefault = true;
            }
        }
    }

    const locales = Array.from(localeSet).sort((a, b) => {
        if (a === "x-default") return 1;
        if (b === "x-default") return -1;
        if (a === "default") return 1;
        if (b === "default") return -1;
        return a.localeCompare(b);
    });

    const rows = Array.from(groupMap.values()).sort((a, b) =>
        a.displayPath.localeCompare(b.displayPath),
    );

    return { locales, rows };
}

/**
 * サイトマップ全体の統計情報・言語分布・SEO診断を生成する
 */
export function analyzeSitemapEntries(entries: SitemapUrlEntry[]): SitemapAnalysisSummary {
    const totalUrls = entries.length;
    const hostSet = new Set<string>();
    const localeCounts = new Map<string, number>();
    const depthCounts = new Map<number, number>();
    let maxDepth = 0;
    let lastmodCount = 0;
    let hreflangEntryCount = 0;
    let imageTotal = 0;
    let videoTotal = 0;

    for (const entry of entries) {
        hostSet.add(entry.host);
        localeCounts.set(entry.detectedLocale, (localeCounts.get(entry.detectedLocale) || 0) + 1);
        depthCounts.set(entry.depth, (depthCounts.get(entry.depth) || 0) + 1);
        if (entry.depth > maxDepth) maxDepth = entry.depth;
        if (entry.lastmod) lastmodCount++;
        if (entry.alternates.length > 0) hreflangEntryCount++;
        imageTotal += entry.imageCount;
        videoTotal += entry.videoCount;
    }

    const locales = Array.from(localeCounts.entries())
        .map(([code, count]) => ({
            code,
            count,
            percentage: totalUrls > 0 ? Math.round((count / totalUrls) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count);

    const depthDistribution = Array.from(depthCounts.entries())
        .map(([depth, count]) => ({ depth, count }))
        .sort((a, b) => a.depth - b.depth);

    const diagnostics: SitemapDiagnostic[] = [];
    if (totalUrls > 0) {
        const lastmodRatio = lastmodCount / totalUrls;
        if (lastmodRatio === 0) {
            diagnostics.push({
                severity: "warning",
                title: "lastmod（最終更新日）が未設定です",
                detail: "検索エンジンのクロール効率を高めるため、更新日時が分かるページには <lastmod> の記載が推奨されます。",
            });
        } else if (lastmodRatio < 1) {
            diagnostics.push({
                severity: "info",
                title: `一部URL（${totalUrls - lastmodCount}件）に lastmod がありません`,
                detail: `${lastmodCount} / ${totalUrls} 件のURLで最終更新日が設定されています。`,
            });
        }

        if (locales.length > 1) {
            const hasXDefault = entries.some((e) =>
                e.alternates.some((a) => a.hreflang === "x-default"),
            );
            if (hreflangEntryCount > 0 && !hasXDefault) {
                diagnostics.push({
                    severity: "warning",
                    title: "多言語サイトに x-default が見当たりません",
                    detail: "対象言語に一致しないユーザー向けのフォールバック先として hreflang=\"x-default\" の設定が推奨されます。",
                });
            } else if (hreflangEntryCount === 0) {
                diagnostics.push({
                    severity: "info",
                    title: "URLパス/サブドメインから複数言語を検出しました",
                    detail: "sitemap.xml 内に xhtml:link (hreflang) アノテーションがないため、パス構造から言語を推定しています。",
                });
            }
        }

        if (maxDepth >= 5) {
            diagnostics.push({
                severity: "info",
                title: `深い階層（最大 ${maxDepth} 階層）が存在します`,
                detail: "トップページからのクリック深度が深くなりすぎないよう、内部リンクやパンくずリストの設計を確認してください。",
            });
        }

        if (diagnostics.length === 0) {
            diagnostics.push({
                severity: "info",
                title: "良好なサイトマップ構成です",
                detail: "主要な構造項目（URL形式・更新日・階層構成）に目立った問題は検出されませんでした。",
            });
        }
    }

    return {
        totalUrls,
        uniqueHosts: Array.from(hostSet),
        locales,
        maxDepth,
        depthDistribution,
        lastmodCount,
        hreflangEntryCount,
        imageTotal,
        videoTotal,
        diagnostics,
    };
}

/**
 * URL一覧を Excel / Google スプレッドシート貼付用の TSV 文字列に変換する
 */
export function buildSitemapTsv(entries: SitemapUrlEntry[]): string {
    const header = ["URL", "言語", "階層", "最終更新日", "更新頻度", "優先度", "hreflang数", "画像数", "動画数"].join("\t");
    const sanitizeCell = (v: string) => v.replace(/\t|\r?\n/g, " ");
    const rows = entries.map((e) =>
        [
            sanitizeCell(e.loc),
            sanitizeCell(e.detectedLocale),
            String(e.depth),
            sanitizeCell(e.lastmod || ""),
            sanitizeCell(e.changefreq || ""),
            sanitizeCell(e.priority || ""),
            String(e.alternates.length),
            String(e.imageCount),
            String(e.videoCount),
        ].join("\t"),
    );
    return [header, ...rows].join("\n");
}

/**
 * すぐに動作を試せるサンプル sitemap.xml データ（実在URLは使用せず example.com のみ）
 */
export const SITEMAP_SAMPLES: Record<string, { label: string; description: string; xml: string }> = {
    multilingual: {
        label: "多言語サイト (hreflang)",
        description: "日本語・英語・中国語 + x-default を備えたグローバルサイト例",
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://example.com/ja/</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/" />
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://example.com/zh-hans/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/" />
    <image:image><image:loc>https://example.com/assets/hero-ja.webp</image:loc></image:image>
  </url>
  <url>
    <loc>https://example.com/en/</loc>
    <lastmod>2026-11-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/" />
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://example.com/zh-hans/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/" />
  </url>
  <url>
    <loc>https://example.com/zh-hans/</loc>
    <lastmod>2026-11-18</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/" />
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/" />
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://example.com/zh-hans/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/" />
  </url>
  <url>
    <loc>https://example.com/ja/products/camera-lens</loc>
    <lastmod>2026-11-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/products/camera-lens" />
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/products/camera-lens" />
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://example.com/zh-hans/products/camera-lens" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/products/camera-lens" />
    <image:image><image:loc>https://example.com/assets/lens-1.webp</image:loc></image:image>
    <image:image><image:loc>https://example.com/assets/lens-2.webp</image:loc></image:image>
  </url>
  <url>
    <loc>https://example.com/en/products/camera-lens</loc>
    <lastmod>2026-11-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/products/camera-lens" />
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/products/camera-lens" />
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://example.com/zh-hans/products/camera-lens" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/products/camera-lens" />
  </url>
  <url>
    <loc>https://example.com/ja/blog/seo-architecture</loc>
    <lastmod>2026-11-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/blog/seo-architecture" />
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/blog/seo-architecture" />
  </url>
  <url>
    <loc>https://example.com/en/blog/seo-architecture</loc>
    <lastmod>2026-11-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/blog/seo-architecture" />
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/blog/seo-architecture" />
  </url>
  <url>
    <loc>https://example.com/ja/company/about</loc>
    <lastmod>2026-10-01</lastmod>
    <priority>0.5</priority>
  </url>
</urlset>`,
    },
    standard: {
        label: "標準サイト (urlset)",
        description: "ブログ・製品・ドキュメントを持つ一般的なサイト構造",
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-11-24</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/docs/getting-started</loc>
    <lastmod>2026-11-22</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/docs/api/authentication</loc>
    <lastmod>2026-11-19</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://example.com/docs/api/webhooks</loc>
    <lastmod>2026-11-19</lastmod>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://example.com/blog/release-v2</loc>
    <lastmod>2026-11-14</lastmod>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://example.com/pricing</loc>
    <lastmod>2026-11-01</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>`,
    },
    index: {
        label: "大規模 (sitemapindex)",
        description: "言語別・カテゴリ別の子サイトマップを束ねるインデックス形式",
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-ja.xml</loc>
    <lastmod>2026-11-24</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-en.xml</loc>
    <lastmod>2026-11-24</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-products.xml</loc>
    <lastmod>2026-11-23</lastmod>
  </sitemap>
</sitemapindex>`,
    },
};
