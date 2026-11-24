/**
 * 完全クライアントサイド高速ページ取得ユーティリティ
 * 1. 同一オリジン直接フェッチ
 * 2. Microlink (prerender=false + カスタムセレクタ) と CORSプロキシ群の完全並列レース (Promise.any)
 * 3. AllOrigins /get フォールバック
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
    timeoutMs = 5000,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
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
 * 外部URLから HTML または Microlink 構造化メタデータを最速並列取得する
 */
export async function fetchPageSource(targetUrl: string): Promise<PageSourceResult> {
    // 1. 同一オリジンの場合は直接 fetch
    if (isSameOriginUrl(targetUrl)) {
        try {
            const directRes = await fetchWithTimeout(targetUrl, 4000);
            if (directRes.ok && typeof directRes.text === "function") {
                const text = await directRes.text();
                if (isValidHtmlContent(text)) {
                    return {
                        kind: "html",
                        html: text,
                        finalUrl: targetUrl,
                        source: "direct",
                    };
                }
            }
        } catch {
            // 同一オリジン直接取得失敗時は並列レースへ
        }
    }

    const encodedUrl = encodeURIComponent(targetUrl);

    // 2. クロスオリジンの場合: Microlink (prerender=false) + 生HTMLプロキシ群を完全並列レース
    const raceTasks: Array<Promise<PageSourceResult>> = [
        // Microlink API (高速モード + JSON-LD / SEOカスタムセレクタ)
        (async (): Promise<PageSourceResult> => {
            const res = await fetchWithTimeout(buildMicrolinkUrl(targetUrl), 7000);
            if (!res.ok) throw new Error(`Microlink status: ${res.status}`);
            if (typeof res.json !== "function") throw new Error("No json method");
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
                    finalUrl: typeof d.url === "string" && d.url.trim() ? d.url.trim() : targetUrl,
                    source: "microlink",
                };
            }
            throw new Error("Empty Microlink response");
        })(),
        // AllOrigins /raw
        (async (): Promise<PageSourceResult> => {
            const res = await fetchWithTimeout(
                `https://api.allorigins.win/raw?url=${encodedUrl}`,
                5000,
            );
            if (!res.ok) throw new Error(`AllOrigins raw status: ${res.status}`);
            if (typeof res.text !== "function") throw new Error("No text method");
            const text = await res.text();
            if (!isValidHtmlContent(text)) throw new Error("Invalid HTML from allorigins/raw");
            return {
                kind: "html",
                html: text,
                finalUrl: targetUrl,
                source: "cors-proxy",
            };
        })(),
        // CodeTabs proxy
        (async (): Promise<PageSourceResult> => {
            const res = await fetchWithTimeout(
                `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`,
                5000,
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
        })(),
    ];

    try {
        return await Promise.any(raceTasks);
    } catch {
        // 全滅時は AllOrigins /get フォールバックへ
    }

    // 3. 最終フォールバック: AllOrigins /get
    try {
        const res = await fetchWithTimeout(
            `https://api.allorigins.win/get?url=${encodedUrl}`,
            5000,
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
        // 最終エラーへ
    }

    throw new Error(
        "ページの取得に失敗しました。対象サイトにアクセス制限がある場合は、HTML直接入力をお試しください。",
    );
}
