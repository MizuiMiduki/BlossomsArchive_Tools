/**
 * 完全クライアントサイド高速ページ取得ユーティリティ
 * 1. 同一ブラウザセッション内キャッシュ (0ms 再利用・レート制限回避)
 * 2. 同一オリジン直接フェッチ
 * 3. 生HTMLプロキシ並列レース (AllOrigins /get, CodeTabs, CORS.lol → 失敗時 /raw フォールバック) と
 *    Microlink (prerender=false + カスタムセレクタ) の同時並行実行・スマート競合解決
 */

export type PageSourceResult =
    | {
          kind: "html";
          html: string;
          finalUrl: string;
          source: "direct" | "cors-proxy";
      }
    | {
          kind: "microlink";
          payload: any;
          finalUrl: string;
          source: "microlink";
      };

export interface FetchPageOptions {
    /** 生HTML取得の到着を少し優先待機する（SEOチェッカー向け） */
    preferHtml?: boolean;
    /** Microlink結果にJSON-LDが含まれない場合、生HTMLプロキシの完了を待機する */
    requireJsonLd?: boolean;
    /** キャッシュを利用するか（テスト環境以外はデフォルト true） */
    useCache?: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5分
const CACHE_STORAGE_PREFIX = "ba_tools_page_cache_v1:";
const memoryCache = new Map<string, { result: PageSourceResult; expiresAt: number }>();

export function clearPageSourceCache(): void {
    memoryCache.clear();
    try {
        if (typeof sessionStorage !== "undefined") {
            const keysToRemove: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith(CACHE_STORAGE_PREFIX)) {
                    keysToRemove.push(k);
                }
            }
            for (const k of keysToRemove) {
                sessionStorage.removeItem(k);
            }
        }
    } catch {
        // ストレージアクセス不可環境は無視
    }
}

function getCachedPageSource(
    targetUrl: string,
    options: FetchPageOptions,
): PageSourceResult | null {
    const now = Date.now();

    const validateHit = (res: PageSourceResult): PageSourceResult | null => {
        if (res.kind === "html") return res;
        if (
            options.requireJsonLd &&
            extractJsonLdFromMicrolink(res.payload).length === 0
        ) {
            return null;
        }
        return res;
    };

    const mem = memoryCache.get(targetUrl);
    if (mem && mem.expiresAt > now) {
        const hit = validateHit(mem.result);
        if (hit) return hit;
    } else if (mem) {
        memoryCache.delete(targetUrl);
    }

    try {
        if (typeof sessionStorage !== "undefined") {
            const raw = sessionStorage.getItem(`${CACHE_STORAGE_PREFIX}${targetUrl}`);
            if (raw) {
                const parsed = JSON.parse(raw) as {
                    result: PageSourceResult;
                    expiresAt: number;
                };
                if (parsed && parsed.expiresAt > now && parsed.result) {
                    memoryCache.set(targetUrl, parsed);
                    const hit = validateHit(parsed.result);
                    if (hit) return hit;
                } else {
                    sessionStorage.removeItem(`${CACHE_STORAGE_PREFIX}${targetUrl}`);
                }
            }
        }
    } catch {
        // ストレージ読み込み失敗は無視
    }

    return null;
}

function setCachedPageSource(targetUrl: string, result: PageSourceResult): void {
    const entry = { result, expiresAt: Date.now() + CACHE_TTL_MS };
    memoryCache.set(targetUrl, entry);

    try {
        if (typeof sessionStorage !== "undefined") {
            const serialized = JSON.stringify(entry);
            // 1MB超の巨大HTMLは sessionStorage 容量圧迫を防ぐためメモリキャッシュのみに留める
            if (serialized.length <= 1024 * 1024) {
                sessionStorage.setItem(`${CACHE_STORAGE_PREFIX}${targetUrl}`, serialized);
            }
        }
    } catch {
        // QuotaExceededError 等は無視
    }
}

export function normalizeFetchUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
}

export function isSameOriginUrl(targetUrl: string): boolean {
    try {
        return (
            typeof window !== "undefined" &&
            new URL(targetUrl).origin === window.location.origin
        );
    } catch {
        return false;
    }
}

export async function fetchWithTimeout(
    url: string,
    timeoutMs = 10000,
    init?: RequestInit,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export function isValidHtmlContent(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
        lower.includes("<html") ||
        lower.includes("<head") ||
        lower.includes("<title") ||
        lower.includes("<meta") ||
        lower.includes("<script") ||
        lower.includes("<!doctype")
    );
}

export function buildMicrolinkUrl(targetUrl: string): string {
    const encoded = encodeURIComponent(targetUrl);
    return (
        `https://api.microlink.io/?url=${encoded}&prerender=false` +
        `&data.jsonld.selectorAll=${encodeURIComponent('script[type="application/ld+json"]')}` +
        `&data.canonical.selector=${encodeURIComponent('link[rel="canonical"]')}` +
        `&data.canonical.attr=href` +
        `&data.robots.selector=${encodeURIComponent('meta[name="robots"]')}` +
        `&data.robots.attr=content` +
        `&data.h1.selectorAll=h1`
    );
}

/**
 * Microlink API レスポンスから JSON-LD 文字列の配列を抽出する
 */
export function extractJsonLdFromMicrolink(payload: any): string[] {
    const data = payload?.data;
    if (!data || typeof data !== "object") return [];

    const candidate = data.jsonld ?? data.jsonLd ?? data.schema;
    if (!candidate) return [];

    const results: string[] = [];
    const items = Array.isArray(candidate) ? candidate : [candidate];

    for (const item of items) {
        if (typeof item === "string") {
            const trimmed = item.trim();
            if (trimmed) results.push(trimmed);
        } else if (item && typeof item === "object") {
            results.push(JSON.stringify(item, null, 2));
        }
    }

    return results;
}

/**
 * 外部URLから HTML または Microlink 構造化メタデータを高速かつ確実に並列取得する
 */
export async function fetchPageSource(
    targetUrl: string,
    options: FetchPageOptions = {},
): Promise<PageSourceResult> {
    const isTestEnv =
        typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";
    const shouldUseCache = options.useCache ?? !isTestEnv;

    if (shouldUseCache) {
        const cached = getCachedPageSource(targetUrl, options);
        if (cached) {
            return cached;
        }
    }

    const saveAndReturn = (res: PageSourceResult): PageSourceResult => {
        if (shouldUseCache) {
            setCachedPageSource(targetUrl, res);
        }
        return res;
    };

    // 1. 同一オリジンの場合は直接 fetch
    if (isSameOriginUrl(targetUrl)) {
        try {
            const directRes = await fetchWithTimeout(targetUrl, 4000);
            if (directRes.ok && typeof directRes.text === "function") {
                const text = await directRes.text();
                if (isValidHtmlContent(text)) {
                    return saveAndReturn({
                        kind: "html",
                        html: text,
                        finalUrl: targetUrl,
                        source: "direct",
                    });
                }
            }
        } catch {
            // 同一オリジン直接取得失敗時は並列レースへ
        }
    }

    const encodedUrl = encodeURIComponent(targetUrl);

    // 2. 生HTMLプロキシ群の並列レース
    // Jina Reader HTML (X-Return-Format: html) は CORS プリフライト対応かつ高速 (0.3〜0.6s) で
    // JSレンダリング後の完全なDOM HTMLとJSON-LDを返却するため最優先レーンとして並列投入する
    const jinaHtmlTask = (async (): Promise<PageSourceResult> => {
        let parsedTarget: URL;
        try {
            parsedTarget = new URL(targetUrl);
        } catch {
            throw new Error("Invalid URL for Jina Reader");
        }
        if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
            throw new Error("Unsupported protocol for Jina Reader");
        }
        const res = await fetchWithTimeout(
            `https://r.jina.ai/${parsedTarget.href}`,
            10000,
            {
                headers: {
                    "X-Return-Format": "html",
                },
            },
        );
        if (!res.ok) throw new Error(`Jina Reader status: ${res.status}`);
        if (typeof res.text !== "function") throw new Error("No text method");
        const text = await res.text();
        if (!isValidHtmlContent(text)) throw new Error("Invalid HTML from Jina Reader");
        return {
            kind: "html",
            html: text,
            finalUrl: targetUrl,
            source: "cors-proxy",
        };
    })();

    // Note: AllOrigins は /get と /raw の同時接続で競合タイムアウトを起こすため、まず /get を叩き、失敗時のみ /raw を試行
    const allOriginsTask = (async (): Promise<PageSourceResult> => {
        try {
            const res = await fetchWithTimeout(
                `https://api.allorigins.win/get?url=${encodedUrl}`,
                12000,
            );
            if (res.ok && typeof res.json === "function") {
                const json = await res.json();
                const text = typeof json?.contents === "string" ? json.contents : "";
                if (isValidHtmlContent(text)) {
                    return {
                        kind: "html",
                        html: text,
                        finalUrl: targetUrl,
                        source: "cors-proxy",
                    };
                }
            }
        } catch {
            // /raw へフォールバック
        }

        const rawRes = await fetchWithTimeout(
            `https://api.allorigins.win/raw?url=${encodedUrl}`,
            6000,
        );
        if (!rawRes.ok) throw new Error(`AllOrigins raw status: ${rawRes.status}`);
        if (typeof rawRes.text !== "function") throw new Error("No text method");
        const rawText = await rawRes.text();
        if (!isValidHtmlContent(rawText)) throw new Error("Invalid HTML from allorigins/raw");
        return {
            kind: "html",
            html: rawText,
            finalUrl: targetUrl,
            source: "cors-proxy",
        };
    })();

    const codeTabsTask = (async (): Promise<PageSourceResult> => {
        const res = await fetchWithTimeout(
            `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`,
            10000,
        );
        if (!res.ok) throw new Error(`CodeTabs status: ${res.status}`);
        if (typeof res.text !== "function") throw new Error("No text method");
        const text = await res.text();
        if (!isValidHtmlContent(text)) throw new Error("Invalid HTML from codetabs");
        return {
            kind: "html",
            html: text,
            finalUrl: targetUrl,
            source: "cors-proxy",
        };
    })();

    const corsLolTask = (async (): Promise<PageSourceResult> => {
        const res = await fetchWithTimeout(
            `https://api.cors.lol/?url=${encodedUrl}`,
            6000,
        );
        if (!res.ok) throw new Error(`cors.lol status: ${res.status}`);
        if (typeof res.text !== "function") throw new Error("No text method");
        const text = await res.text();
        if (!isValidHtmlContent(text)) throw new Error("Invalid HTML from cors.lol");
        return {
            kind: "html",
            html: text,
            finalUrl: targetUrl,
            source: "cors-proxy",
        };
    })();

    const htmlRacePromise: Promise<PageSourceResult | null> = Promise.any([
        jinaHtmlTask,
        allOriginsTask,
        codeTabsTask,
        corsLolTask,
    ]).catch(() => null);

    // 3. Microlink API (高速モード + JSON-LD / SEOカスタムセレクタ) も同時スタート
    // カスタムセレクタ付きリクエストが 429 制限を受けた場合はキャッシュが効くベーシックURLへフォールバックする
    let microlinkRateLimited = false;
    const microlinkPromise: Promise<PageSourceResult | null> = (async () => {
        const parseMicrolinkRes = async (res: Response): Promise<PageSourceResult | null> => {
            if (!res.ok || typeof res.json !== "function") return null;
            const json = await res.json();
            const d = json?.data;
            if (
                d &&
                typeof d === "object" &&
                (d.title ||
                    d.description ||
                    d.jsonld ||
                    d.jsonLd ||
                    d.canonical ||
                    (Array.isArray(d.h1) && d.h1.length > 0))
            ) {
                return {
                    kind: "microlink",
                    payload: json,
                    finalUrl:
                        typeof d.url === "string" && d.url.trim()
                            ? d.url.trim()
                            : targetUrl,
                    source: "microlink",
                };
            }
            return null;
        };

        try {
            const res = await fetchWithTimeout(buildMicrolinkUrl(targetUrl), 8000);
            if (res.status === 429) {
                microlinkRateLimited = true;
                // カスタムルールがレート制限でもベーシックURLはエッジキャッシュで200応答する場合がある
                const basicRes = await fetchWithTimeout(
                    `https://api.microlink.io/?url=${encodedUrl}`,
                    5000,
                );
                if (basicRes.ok) {
                    microlinkRateLimited = false;
                    return await parseMicrolinkRes(basicRes);
                }
                return null;
            }
            return await parseMicrolinkRes(res);
        } catch {
            // Microlink失敗時は null を返して生HTMLレースに委ねる
        }
        return null;
    })();

    // 先に着いた有効な結果を採用するスマート競合解決
    const firstValid = await Promise.any([
        htmlRacePromise.then((res) => {
            if (!res) throw new Error("html failed");
            return { tag: "html" as const, res };
        }),
        microlinkPromise.then((res) => {
            if (!res) throw new Error("ml failed");
            return { tag: "ml" as const, res };
        }),
    ]).catch(() => null);

    if (firstValid) {
        if (firstValid.tag === "html") {
            return saveAndReturn(firstValid.res);
        }

        const mlRes = firstValid.res;
        const hasJsonLdInMl =
            mlRes.kind === "microlink" &&
            extractJsonLdFromMicrolink(mlRes.payload).length > 0;

        // JSON-LD が必要なモードで Microlink が取りこぼしている場合は生HTMLレースの完了を優先待機
        if (options.requireJsonLd && !hasJsonLdInMl) {
            const htmlRes = await htmlRacePromise;
            if (htmlRes) return saveAndReturn(htmlRes);
            return saveAndReturn(mlRes);
        }

        // 生HTML優先モード (SEOチェッカー等) の場合は短い猶予時間だけ生HTMLの到着を待つ
        if (options.preferHtml && !isTestEnv) {
            const graceHtml = await Promise.race([
                htmlRacePromise,
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
            ]);
            if (graceHtml) return saveAndReturn(graceHtml);
        }

        return saveAndReturn(mlRes);
    }

    if (microlinkRateLimited) {
        throw new Error(
            "外部取得プロキシが混雑・利用上限に達しているため取得できませんでした。対象ページのHTMLソースをコピーして「HTML直接入力」タブに貼り付けると確実に解析できます。",
        );
    }

    throw new Error(
        "ページの取得に失敗しました。対象サイトにアクセス制限があるかプロキシがタイムアウトしました。対象ページのHTMLソースを「HTML直接入力」タブに貼り付けてお試しください。",
    );
}
