import {
    createMemo,
    createSignal,
    For,
    onCleanup,
    onMount,
    Show,
} from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { getPageMetadata, routes } from "../routes";
import {
    animateFadeIn,
    animatePop,
    delayedCall,
    playPageEntrance,
} from "../utils/gsapAnimations";

export interface MetaTagItem {
    key: string;
    value: string;
    category: "ogp" | "twitter" | "basic";
}

export interface OgpData {
    pageTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    faviconUrl: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    ogImageAlt: string;
    ogUrl: string;
    ogType: string;
    ogSiteName: string;
    ogLocale: string;
    twitterCard: string;
    twitterTitle: string;
    twitterDescription: string;
    twitterImage: string;
    twitterSite: string;
    twitterCreator: string;
    rawTags: MetaTagItem[];
}

export interface DiagnosticItem {
    key: string;
    label: string;
    status: "ok" | "warn" | "missing";
    value: string;
    message: string;
}

const SAMPLE_HTML = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>サンプル記事タイトル | BlossomsArchive Tools</title>
  <meta name="description" content="OGP確認ツールのサンプルページです。SNSでシェアされた際のタイトル・説明文・サムネイル画像の見え方をリアルタイムに確認できます。" />
  <link rel="canonical" href="https://tools.blossomsarchive.com/ogp-checker" />
  <meta property="og:title" content="OGP確認・SNSシェアプレビューツール | BlossomsArchive Tools" />
  <meta property="og:description" content="URLやHTMLソースからOpen Graph Protocol (OGP) とTwitter Cardの設定状況を解析し、X (Twitter)・Facebook・LINE・Discord等での表示をシミュレーションします。" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tools.blossomsarchive.com/ogp-checker" />
  <meta property="og:image" content="https://placehold.co/1200x630/2563eb/ffffff/png?text=OGP+Preview+1200x630" />
  <meta property="og:image:alt" content="OGPプレビューのサンプル画像" />
  <meta property="og:site_name" content="BlossomsArchive Tools" />
  <meta property="og:locale" content="ja_JP" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="OGP確認・SNSシェアプレビューツール" />
  <meta name="twitter:description" content="WebページのOGPタグとSNSカード表示をブラウザ上で手軽にチェックできる無料Webツールです。" />
  <meta name="twitter:image" content="https://placehold.co/1200x630/2563eb/ffffff/png?text=OGP+Preview+1200x630" />
</head>
<body></body>
</html>`;

export function resolveUrl(rawUrl: string, baseUrl?: string): string {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    if (!baseUrl) return trimmed;
    try {
        return new URL(trimmed, baseUrl).href;
    } catch {
        return trimmed;
    }
}

export function normalizeInputUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
}

export function parseOgpFromHtml(html: string, sourceUrl = ""): OgpData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const ogMap: Record<string, string> = {};
    const twitterMap: Record<string, string> = {};
    const basicMap: Record<string, string> = {};
    const rawTags: MetaTagItem[] = [];

    const pageTitle = doc.querySelector("title")?.textContent?.trim() ?? "";
    if (pageTitle) {
        basicMap["title"] = pageTitle;
        rawTags.push({ key: "<title>", value: pageTitle, category: "basic" });
    }

    const metaElements = Array.from(doc.querySelectorAll("meta"));
    for (const meta of metaElements) {
        const property = (meta.getAttribute("property") || "").trim().toLowerCase();
        const name = (meta.getAttribute("name") || "").trim().toLowerCase();
        const content = (meta.getAttribute("content") || "").trim();

        if (!content && !property && !name) continue;

        const key = property || name;
        if (!key) continue;

        if (key.startsWith("og:")) {
            if (!ogMap[key]) ogMap[key] = content;
            rawTags.push({ key, value: content, category: "ogp" });
        } else if (key.startsWith("twitter:")) {
            if (!twitterMap[key]) twitterMap[key] = content;
            rawTags.push({ key, value: content, category: "twitter" });
        } else if (key === "description") {
            if (!basicMap["description"]) basicMap["description"] = content;
            rawTags.push({ key: "description", value: content, category: "basic" });
        }
    }

    const canonicalHref =
        doc.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ??
        "";
    const effectiveBaseUrl =
        ogMap["og:url"] || canonicalHref || sourceUrl || undefined;

    const resolvedCanonical = resolveUrl(canonicalHref, effectiveBaseUrl);
    if (resolvedCanonical) {
        rawTags.push({
            key: 'link[rel="canonical"]',
            value: resolvedCanonical,
            category: "basic",
        });
    }

    const iconHref =
        doc
            .querySelector(
                'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
            )
            ?.getAttribute("href")
            ?.trim() ?? "";
    const resolvedFavicon = resolveUrl(iconHref, effectiveBaseUrl);

    const resolvedOgUrl = resolveUrl(ogMap["og:url"] || "", sourceUrl || undefined);
    const baseForAssets = resolvedOgUrl || resolvedCanonical || sourceUrl || undefined;
    const resolvedOgImage = resolveUrl(ogMap["og:image"] || "", baseForAssets);
    const resolvedTwitterImage = resolveUrl(
        twitterMap["twitter:image"] || twitterMap["twitter:image:src"] || "",
        baseForAssets,
    );

    return {
        pageTitle,
        metaDescription: basicMap["description"] || "",
        canonicalUrl: resolvedCanonical,
        faviconUrl: resolvedFavicon,
        ogTitle: ogMap["og:title"] || "",
        ogDescription: ogMap["og:description"] || "",
        ogImage: resolvedOgImage,
        ogImageAlt: ogMap["og:image:alt"] || "",
        ogUrl: resolvedOgUrl,
        ogType: ogMap["og:type"] || "",
        ogSiteName: ogMap["og:site_name"] || "",
        ogLocale: ogMap["og:locale"] || "",
        twitterCard: twitterMap["twitter:card"] || "",
        twitterTitle: twitterMap["twitter:title"] || "",
        twitterDescription: twitterMap["twitter:description"] || "",
        twitterImage: resolvedTwitterImage,
        twitterSite: twitterMap["twitter:site"] || "",
        twitterCreator: twitterMap["twitter:creator"] || "",
        rawTags,
    };
}

export function parseOgpFromMicrolink(
    payload: any,
    sourceUrl = "",
): OgpData | null {
    const data = payload?.data;
    if (!data || typeof data !== "object") return null;

    const title = typeof data.title === "string" ? data.title.trim() : "";
    const description =
        typeof data.description === "string" ? data.description.trim() : "";
    const imageUrl =
        typeof data.image?.url === "string" ? data.image.url.trim() : "";
    const url =
        typeof data.url === "string" && data.url.trim()
            ? data.url.trim()
            : sourceUrl;
    const siteName =
        typeof data.publisher === "string" ? data.publisher.trim() : "";
    const logoUrl =
        typeof data.logo?.url === "string" ? data.logo.url.trim() : "";
    const lang = typeof data.lang === "string" ? data.lang.trim() : "";

    if (!title && !description && !imageUrl) {
        return null;
    }

    const rawTags: MetaTagItem[] = [];
    if (title) {
        rawTags.push({ key: "og:title", value: title, category: "ogp" });
    }
    if (description) {
        rawTags.push({
            key: "og:description",
            value: description,
            category: "ogp",
        });
    }
    if (imageUrl) {
        rawTags.push({ key: "og:image", value: imageUrl, category: "ogp" });
    }
    if (url) {
        rawTags.push({ key: "og:url", value: url, category: "ogp" });
    }
    if (siteName) {
        rawTags.push({ key: "og:site_name", value: siteName, category: "ogp" });
    }
    const cardType = imageUrl ? "summary_large_image" : "summary";
    rawTags.push({
        key: "twitter:card",
        value: cardType,
        category: "twitter",
    });

    return {
        pageTitle: title,
        metaDescription: description,
        canonicalUrl: url,
        faviconUrl: logoUrl,
        ogTitle: title,
        ogDescription: description,
        ogImage: imageUrl,
        ogImageAlt: "",
        ogUrl: url,
        ogType: "website",
        ogSiteName: siteName,
        ogLocale: lang,
        twitterCard: cardType,
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: imageUrl,
        twitterSite: "",
        twitterCreator: "",
        rawTags,
    };
}

export function buildDiagnostics(data: OgpData): DiagnosticItem[] {
    const items: DiagnosticItem[] = [
        {
            key: "og:title",
            label: "og:title",
            status: data.ogTitle
                ? data.ogTitle.length > 60
                    ? "warn"
                    : "ok"
                : "missing",
            value: data.ogTitle || "未設定",
            message: !data.ogTitle
                ? "未設定です（<title>タグ等で代替される場合がありますが設定推奨）"
                : data.ogTitle.length > 60
                  ? `${data.ogTitle.length}文字：長すぎるとSNS上で省略される場合があります（20〜40文字程度推奨）`
                  : `${data.ogTitle.length}文字：適切に設定されています`,
        },
        {
            key: "og:description",
            label: "og:description",
            status: data.ogDescription
                ? data.ogDescription.length > 120
                    ? "warn"
                    : "ok"
                : "missing",
            value: data.ogDescription || "未設定",
            message: !data.ogDescription
                ? "未設定です（ページの要約文を80〜90文字程度で設定することを推奨）"
                : data.ogDescription.length > 120
                  ? `${data.ogDescription.length}文字：一部SNSで後半が省略される可能性があります`
                  : `${data.ogDescription.length}文字：適切に設定されています`,
        },
        {
            key: "og:image",
            label: "og:image",
            status: data.ogImage
                ? /^https?:\/\//i.test(data.ogImage) ||
                  data.ogImage.startsWith("data:")
                    ? "ok"
                    : "warn"
                : "missing",
            value: data.ogImage || "未設定",
            message: !data.ogImage
                ? "未設定です（SNSシェア時にサムネイル画像が表示されません）"
                : /^https?:\/\//i.test(data.ogImage) ||
                    data.ogImage.startsWith("data:")
                  ? "絶対URLで設定されています（推奨サイズ: 1200×630px）"
                  : "相対パスの可能性があります。https:// から始まる絶対URLでの指定を推奨します",
        },
        {
            key: "og:url",
            label: "og:url",
            status: data.ogUrl
                ? /^https?:\/\//i.test(data.ogUrl)
                    ? "ok"
                    : "warn"
                : "missing",
            value: data.ogUrl || "未設定",
            message: !data.ogUrl
                ? "未設定です（ページの正規URLを絶対パスで指定することを推奨）"
                : /^https?:\/\//i.test(data.ogUrl)
                  ? "正規URLが絶対パスで設定されています"
                  : "https:// から始まる絶対URLでの指定を推奨します",
        },
        {
            key: "og:type",
            label: "og:type",
            status: data.ogType ? "ok" : "missing",
            value: data.ogType || "未設定",
            message: data.ogType
                ? `「${data.ogType}」が設定されています（トップページは website、記事ページは article 等）`
                : "未設定です（website または article の指定を推奨）",
        },
        {
            key: "twitter:card",
            label: "twitter:card",
            status: data.twitterCard ? "ok" : "warn",
            value: data.twitterCard || "未設定",
            message: data.twitterCard
                ? `「${data.twitterCard}」が設定されています`
                : "未設定です（X / Twitterでの表示形式を指定するため summary または summary_large_image を推奨）",
        },
    ];
    return items;
}

export default function OgpChecker() {
    let containerRef: HTMLDivElement | undefined;
    let actionButtonRef: HTMLButtonElement | undefined;

    const [inputMode, setInputMode] = createSignal<"url" | "html">("url");
    const [urlInput, setUrlInput] = createSignal("");
    const [htmlInput, setHtmlInput] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal("");
    const [ogpData, setOgpData] = createSignal<OgpData | null>(null);
    const [twitterPreviewStyle, setTwitterPreviewStyle] = createSignal<
        "auto" | "summary_large_image" | "summary"
    >("auto");
    const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
    const [allCopied, setAllCopied] = createSignal(false);
    const [imageError, setImageError] = createSignal(false);

    onMount(() => {
        document.title =
            "OGP確認・SNSシェアプレビューツール | X(Twitter)・LINE・Facebook対応";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "URLまたはHTMLソースからOGP（Open Graph Protocol）タグやTwitter Cardの設定状況を即座に解析・診断。X（旧Twitter）、Facebook、LINE、Discord等でシェアされた際のカード表示をプレビュー確認できる無料Webツールです。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "ogp-checker-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "OGP確認・SNSシェアプレビューツール",
            operatingSystem: "All",
            applicationCategory: "DeveloperApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "WebページのOGPタグおよびTwitter Cardメタデータを解析し、SNSシェア時のカード表示をシミュレーションする確認ツール。",
        });
        document.head.appendChild(script);

        if (containerRef) playPageEntrance(containerRef, ".card");
    });

    onCleanup(() => {
        document.getElementById("ogp-checker-jsonld")?.remove();
    });

    const fetchWithTimeout = async (
        url: string,
        timeoutMs = 8000,
    ): Promise<Response> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };

    const enrichDevSameOriginOgp = (
        parsed: OgpData,
        html: string,
        targetUrl: string,
    ): OgpData => {
        if (parsed.ogTitle || !html.includes("/src/index.tsx")) {
            return parsed;
        }
        try {
            const urlObj = new URL(targetUrl);
            const matched = routes.some(
                (r) => r.path === (urlObj.pathname.replace(/\/+$/, "") || "/"),
            );
            if (!matched && urlObj.origin !== window.location.origin) {
                return parsed;
            }
            const meta = getPageMetadata(urlObj.pathname);
            return {
                ...parsed,
                pageTitle: meta.title,
                metaDescription: meta.description,
                canonicalUrl: meta.url,
                ogTitle: meta.title,
                ogDescription: meta.description,
                ogUrl: meta.url,
                ogType: "website",
                ogSiteName: "BlossomsArchive Tools",
                ogLocale: "ja_JP",
                twitterCard: "summary",
                twitterTitle: meta.title,
                twitterDescription: meta.description,
                rawTags: [
                    { key: "<title>", value: meta.title, category: "basic" },
                    {
                        key: "description",
                        value: meta.description,
                        category: "basic",
                    },
                    {
                        key: 'link[rel="canonical"]',
                        value: meta.url,
                        category: "basic",
                    },
                    { key: "og:type", value: "website", category: "ogp" },
                    {
                        key: "og:site_name",
                        value: "BlossomsArchive Tools",
                        category: "ogp",
                    },
                    { key: "og:locale", value: "ja_JP", category: "ogp" },
                    { key: "og:title", value: meta.title, category: "ogp" },
                    {
                        key: "og:description",
                        value: meta.description,
                        category: "ogp",
                    },
                    { key: "og:url", value: meta.url, category: "ogp" },
                    { key: "twitter:card", value: "summary", category: "twitter" },
                    {
                        key: "twitter:title",
                        value: meta.title,
                        category: "twitter",
                    },
                    {
                        key: "twitter:description",
                        value: meta.description,
                        category: "twitter",
                    },
                ],
            };
        } catch {
            return parsed;
        }
    };

    const fetchOgpDataFromUrl = async (targetUrl: string): Promise<OgpData> => {
        // 1. 同一オリジンのサーバーサイドプロキシ (/ogp-proxy.php) を試行
        try {
            const proxyRes = await fetchWithTimeout(
                `/ogp-proxy.php?url=${encodeURIComponent(targetUrl)}`,
                10000,
            );
            if (proxyRes.ok) {
                const rawText =
                    typeof proxyRes.text === "function"
                        ? await proxyRes.text()
                        : JSON.stringify(await proxyRes.json());
                const parsedJson = JSON.parse(rawText);
                if (
                    parsedJson &&
                    parsedJson.ok &&
                    typeof parsedJson.html === "string" &&
                    parsedJson.html.trim()
                ) {
                    const effectiveUrl = parsedJson.finalUrl || targetUrl;
                    return enrichDevSameOriginOgp(
                        parseOgpFromHtml(parsedJson.html, effectiveUrl),
                        parsedJson.html,
                        effectiveUrl,
                    );
                }
            }
        } catch {
            // PHP未稼働環境やエラー時は次の取得手段へフォールバック
        }

        // 2. 直接 fetch を試行（同一オリジンやCORS許可サイト向け）
        try {
            const directRes = await fetchWithTimeout(targetUrl, 6000);
            if (directRes.ok) {
                const text = await directRes.text();
                if (text && text.includes("<")) {
                    return enrichDevSameOriginOgp(
                        parseOgpFromHtml(text, targetUrl),
                        text,
                        targetUrl,
                    );
                }
            }
        } catch {
            // CORS制限等の場合は外部プロキシ経由へフォールバック
        }

        // 3. corsproxy.io
        try {
            const corsProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
            const corsRes = await fetchWithTimeout(corsProxyUrl, 7000);
            if (corsRes.ok) {
                const text = await corsRes.text();
                if (text && text.includes("<")) {
                    return parseOgpFromHtml(text, targetUrl);
                }
            }
        } catch {
            // 次のフォールバックへ
        }

        // 4. AllOrigins (raw)
        try {
            const rawUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
            const rawRes = await fetchWithTimeout(rawUrl, 7000);
            if (rawRes.ok) {
                const text = await rawRes.text();
                if (text && text.includes("<")) {
                    return parseOgpFromHtml(text, targetUrl);
                }
            }
        } catch {
            // 次のフォールバックへ
        }

        // 5. AllOrigins (JSON)
        try {
            const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
            const allOriginsRes = await fetchWithTimeout(allOriginsUrl, 7000);
            if (allOriginsRes.ok) {
                const json = await allOriginsRes.json();
                if (
                    json &&
                    typeof json.contents === "string" &&
                    json.contents.includes("<")
                ) {
                    return parseOgpFromHtml(json.contents, targetUrl);
                }
            }
        } catch {
            // 次のフォールバックへ
        }

        // 6. CodeTabs プロキシ
        try {
            const codeTabsUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
            const codeTabsRes = await fetchWithTimeout(codeTabsUrl, 7000);
            if (codeTabsRes.ok) {
                const text = await codeTabsRes.text();
                if (text && text.includes("<")) {
                    return parseOgpFromHtml(text, targetUrl);
                }
            }
        } catch {
            // 次のフォールバックへ
        }

        // 7. Microlink メタデータ解析API (CORS対応のフォールバック)
        try {
            const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`;
            const microlinkRes = await fetchWithTimeout(microlinkUrl, 8000);
            if (microlinkRes.ok) {
                const json = await microlinkRes.json();
                const parsed = parseOgpFromMicrolink(json, targetUrl);
                if (parsed) {
                    return parsed;
                }
            }
        } catch {
            // すべて失敗した場合
        }

        throw new Error(
            "ページの取得に失敗しました。URLが正しいか確認するか、「HTMLを直接入力」タブからページのソースコードを貼り付けて解析してください。",
        );
    };

    const handleAnalyzeUrl = async () => {
        if (loading()) return;
        const normalized = normalizeInputUrl(urlInput());
        if (!normalized) {
            setError("確認したいページのURLを入力してください。");
            return;
        }

        try {
            new URL(normalized);
        } catch {
            setError("有効なURL形式（例: https://example.com）で入力してください。");
            return;
        }

        if (actionButtonRef) animatePop(actionButtonRef);
        setLoading(true);
        setError("");
        setImageError(false);

        try {
            const parsed = await fetchOgpDataFromUrl(normalized);
            setOgpData(parsed);
            setUrlInput(normalized);
        } catch (err: any) {
            setError(
                err?.message ||
                    "OGP情報の取得中にエラーが発生しました。時間を空けて再度お試しいただくか、HTML直接入力をお試しください。",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeHtml = () => {
        const raw = htmlInput().trim();
        if (!raw) {
            setError("解析するHTMLソースコードを入力してください。");
            return;
        }
        if (actionButtonRef) animatePop(actionButtonRef);
        setError("");
        setImageError(false);
        const parsed = parseOgpFromHtml(raw, normalizeInputUrl(urlInput()));
        setOgpData(parsed);
    };

    const loadSample = () => {
        setError("");
        setImageError(false);
        setInputMode("html");
        setHtmlInput(SAMPLE_HTML);
        const parsed = parseOgpFromHtml(
            SAMPLE_HTML,
            "https://tools.blossomsarchive.com/ogp-checker",
        );
        setOgpData(parsed);
    };

    const diagnostics = createMemo(() => {
        const data = ogpData();
        return data ? buildDiagnostics(data) : [];
    });

    const displayTitle = createMemo(() => {
        const data = ogpData();
        if (!data) return "";
        return (
            data.ogTitle ||
            data.twitterTitle ||
            data.pageTitle ||
            "（タイトル未設定）"
        );
    });

    const displayDescription = createMemo(() => {
        const data = ogpData();
        if (!data) return "";
        return (
            data.ogDescription ||
            data.twitterDescription ||
            data.metaDescription ||
            "（説明文未設定）"
        );
    });

    const displayImage = createMemo(() => {
        const data = ogpData();
        if (!data) return "";
        return data.ogImage || data.twitterImage || "";
    });

    const displayTwitterTitle = createMemo(() => {
        const data = ogpData();
        if (!data) return "";
        return (
            data.twitterTitle ||
            data.ogTitle ||
            data.pageTitle ||
            "（タイトル未設定）"
        );
    });

    const displayTwitterDescription = createMemo(() => {
        const data = ogpData();
        if (!data) return "";
        return (
            data.twitterDescription ||
            data.ogDescription ||
            data.metaDescription ||
            "（説明文未設定）"
        );
    });

    const displayTwitterImage = createMemo(() => {
        const data = ogpData();
        if (!data) return "";
        return data.twitterImage || data.ogImage || "";
    });

    const displayDomain = createMemo(() => {
        const data = ogpData();
        const candidate =
            data?.ogUrl || data?.canonicalUrl || normalizeInputUrl(urlInput());
        if (!candidate) return "example.com";
        try {
            return new URL(candidate).hostname;
        } catch {
            return candidate;
        }
    });

    const effectiveTwitterCardType = createMemo(() => {
        const style = twitterPreviewStyle();
        if (style !== "auto") return style;
        const card = ogpData()?.twitterCard?.toLowerCase();
        if (card === "summary_large_image") return "summary_large_image";
        return "summary";
    });

    const copyText = async (text: string, key: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            delayedCall(1.5, () => setCopiedKey(null));
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const copyAllSummary = async () => {
        const data = ogpData();
        if (!data) return;

        const lines = [
            "【OGP解析結果】",
            `og:title: ${data.ogTitle || "未設定"}`,
            `og:description: ${data.ogDescription || "未設定"}`,
            `og:image: ${data.ogImage || "未設定"}`,
            `og:url: ${data.ogUrl || "未設定"}`,
            `og:type: ${data.ogType || "未設定"}`,
            `og:site_name: ${data.ogSiteName || "未設定"}`,
            `og:locale: ${data.ogLocale || "未設定"}`,
            `twitter:card: ${data.twitterCard || "未設定"}`,
            `twitter:title: ${data.twitterTitle || "未設定"}`,
            `twitter:description: ${data.twitterDescription || "未設定"}`,
            `twitter:image: ${data.twitterImage || "未設定"}`,
            `title: ${data.pageTitle || "未設定"}`,
            `description: ${data.metaDescription || "未設定"}`,
        ];

        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            setAllCopied(true);
            delayedCall(2, () => setAllCopied(false));
        } catch (err) {
            console.error("Bulk copy failed:", err);
        }
    };

    const statusBadge = (status: DiagnosticItem["status"]) => {
        if (status === "ok") {
            return (
                <span class="badge badge-success badge-sm text-white font-bold">
                    設定済み
                </span>
            );
        }
        if (status === "warn") {
            return (
                <span class="badge badge-warning badge-sm font-bold">
                    要確認
                </span>
            );
        }
        return (
            <span class="badge badge-error badge-sm text-white font-bold">
                未設定
            </span>
        );
    };

    return (
        <div
            ref={containerRef}
            class="h-full w-full p-4 md:p-8 flex flex-col items-center bg-base-300/30 overflow-x-hidden"
        >
            <div class="w-full max-w-7xl flex flex-col gap-8">
                {/* メインカード */}
                <div class="card bg-base-100 shadow-xl p-6 md:p-10 w-full border border-base-300">
                    {/* ヘッダー */}
                    <div class="mb-6 border-b border-base-300 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <h1 class="text-2xl md:text-3xl font-black text-base-content">
                                <BudouX text="OGP確認・SNSシェアプレビューツール" />
                            </h1>
                            <BudouX
                                as="p"
                                class="text-xs font-semibold text-base-content/70 mt-2 leading-relaxed"
                                text="WebページのURLまたはHTMLソースコードからOGP（Open Graph Protocol）とTwitterカードのメタタグを解析し、X（旧Twitter）やFacebook・LINE・Discordなどでシェアされた際の表示をプレビューします。"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={loadSample}
                            class="btn btn-outline btn-sm shrink-0 self-start sm:self-auto font-bold"
                        >
                            サンプルで試す
                        </button>
                    </div>

                    {/* 入力モード切替タブ */}
                    <div class="grid grid-cols-2 gap-2 p-1.5 bg-base-200 rounded-xl mb-6 max-w-md">
                        <button
                            type="button"
                            onClick={() => {
                                setInputMode("url");
                                setError("");
                            }}
                            class={`py-2 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                inputMode() === "url"
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-base-content/70 hover:bg-base-300/50"
                            }`}
                        >
                            🌐 URLから取得
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setInputMode("html");
                                setError("");
                            }}
                            class={`py-2 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                inputMode() === "html"
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-base-content/70 hover:bg-base-300/50"
                            }`}
                        >
                            📝 HTMLを直接入力
                        </button>
                    </div>

                    {/* URL入力フォーム */}
                    <Show when={inputMode() === "url"}>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleAnalyzeUrl();
                            }}
                            class="flex flex-col sm:flex-row gap-3 w-full"
                        >
                            <input
                                type="text"
                                value={urlInput()}
                                onInput={(e) =>
                                    setUrlInput(e.currentTarget.value)
                                }
                                placeholder="https://tools.blossomsarchive.com"
                                aria-label="確認するページのURL"
                                class="input input-bordered flex-1 h-12 text-sm font-medium bg-base-100 border-2 border-base-300 focus:border-primary"
                            />
                            <button
                                ref={actionButtonRef}
                                type="submit"
                                disabled={loading() || !urlInput().trim()}
                                class="btn btn-primary text-white h-12 px-8 text-sm sm:text-base font-black shadow-md shrink-0"
                            >
                                {loading() ? (
                                    <>
                                        <span class="loading loading-spinner loading-sm"></span>
                                        解析中...
                                    </>
                                ) : (
                                    "OGPを取得・解析"
                                )}
                            </button>
                        </form>
                    </Show>

                    {/* HTML直接入力フォーム */}
                    <Show when={inputMode() === "html"}>
                        <div class="flex flex-col gap-4 w-full">
                            <div class="form-control w-full">
                                <label class="label py-1">
                                    <span class="label-text font-bold text-xs sm:text-sm text-base-content/80">
                                        HTMLソースコード（&lt;head&gt;内のメタタグまたはページ全体のHTML）
                                    </span>
                                </label>
                                <textarea
                                    value={htmlInput()}
                                    onInput={(e) =>
                                        setHtmlInput(e.currentTarget.value)
                                    }
                                    placeholder={'<meta property="og:title" content="ページタイトル" />\n<meta property="og:description" content="ページの説明文" />\n<meta property="og:image" content="https://example.com/ogp.png" />'}
                                    aria-label="解析するHTMLソースコード"
                                    class="textarea textarea-bordered w-full h-44 font-mono text-xs sm:text-sm bg-base-100 border-2 border-base-300 focus:border-primary p-3 leading-relaxed"
                                />
                            </div>
                            <div class="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHtmlInput("");
                                        setOgpData(null);
                                        setError("");
                                    }}
                                    class="btn btn-outline btn-sm h-11 px-5 font-bold"
                                >
                                    クリア
                                </button>
                                <button
                                    ref={actionButtonRef}
                                    type="button"
                                    onClick={handleAnalyzeHtml}
                                    disabled={!htmlInput().trim()}
                                    class="btn btn-primary text-white h-11 px-8 text-sm font-black shadow-md"
                                >
                                    HTMLを解析する
                                </button>
                            </div>
                        </div>
                    </Show>

                    {/* エラー表示 */}
                    <Show when={error()}>
                        <div class="alert alert-error text-white font-bold mt-6 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div class="flex items-center gap-2 text-xs sm:text-sm">
                                <span>⚠️</span>
                                <span>{error()}</span>
                            </div>
                            <Show when={inputMode() === "url"}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInputMode("html");
                                        setError("");
                                    }}
                                    class="btn btn-xs bg-base-100 text-base-content border-none hover:bg-base-200 shrink-0"
                                >
                                    HTML直接入力へ切替
                                </button>
                            </Show>
                        </div>
                    </Show>

                    {/* 未解析時の初期ガイド */}
                    <Show when={!ogpData() && !loading()}>
                        <div class="mt-8 border-2 border-dashed border-base-300 bg-base-200/40 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                            <span class="text-4xl">🔍</span>
                            <p class="text-sm font-bold text-base-content/80">
                                URLを入力して「OGPを取得・解析」を押すか、HTMLソースを貼り付けて解析してください。
                            </p>
                            <p class="text-xs text-base-content/60 max-w-xl leading-relaxed">
                                ローカル開発中のサイトや公開前のステージング環境を確認したい場合は、「HTMLを直接入力」タブにHTMLの
                                <code class="px-1.5 py-0.5 mx-1 bg-base-300 rounded font-mono">
                                    &lt;head&gt;
                                </code>
                                部分を貼り付けることで、外部通信なしで即座にプレビューできます。
                            </p>
                        </div>
                    </Show>

                    {/* 解析結果エリア */}
                    <Show when={ogpData() && !loading()}>
                        <div
                            ref={(el) => animateFadeIn(el)}
                            class="mt-8 flex flex-col gap-8 border-t border-base-300 pt-8"
                        >
                            {/* 1. SNSカード表示プレビュー */}
                            <div>
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                    <h2 class="text-lg sm:text-xl font-black text-base-content flex items-center gap-2">
                                        <span>📱</span> SNSシェア表示プレビュー
                                    </h2>
                                    {/* Xカード表示切替 */}
                                    <div class="flex items-center gap-1.5 bg-base-200 p-1 rounded-lg self-start sm:self-auto">
                                        <span class="text-[11px] font-bold text-base-content/70 px-2">
                                            Xカード形式:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setTwitterPreviewStyle("auto")
                                            }
                                            class={`btn btn-xs rounded-md ${
                                                twitterPreviewStyle() === "auto"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            自動
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setTwitterPreviewStyle(
                                                    "summary_large_image",
                                                )
                                            }
                                            class={`btn btn-xs rounded-md ${
                                                twitterPreviewStyle() ===
                                                "summary_large_image"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            大画像
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setTwitterPreviewStyle(
                                                    "summary",
                                                )
                                            }
                                            class={`btn btn-xs rounded-md ${
                                                twitterPreviewStyle() ===
                                                "summary"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            小画像
                                        </button>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* X (Twitter) プレビュー */}
                                    <div class="bg-base-200/60 border border-base-300 rounded-2xl p-5 flex flex-col gap-3">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs font-black text-base-content/80 flex items-center gap-1.5">
                                                <span>𝕏</span> X (Twitter) プレビュー
                                            </span>
                                            <span class="badge badge-neutral badge-sm font-mono text-[10px]">
                                                {effectiveTwitterCardType()}
                                            </span>
                                        </div>

                                        <Show
                                            when={
                                                effectiveTwitterCardType() ===
                                                "summary_large_image"
                                            }
                                            fallback={
                                                /* summary (横並び小型カード) */
                                                <div class="bg-base-100 border border-base-300 rounded-2xl overflow-hidden flex items-stretch shadow-xs min-h-[116px]">
                                                    <div class="w-28 sm:w-32 bg-base-200 shrink-0 flex items-center justify-center border-r border-base-300 overflow-hidden">
                                                        <Show
                                                            when={
                                                                displayTwitterImage() &&
                                                                !imageError()
                                                            }
                                                            fallback={
                                                                <span class="text-xs text-base-content/40 font-bold text-center px-2">
                                                                    No Image
                                                                </span>
                                                            }
                                                        >
                                                            <img
                                                                src={displayTwitterImage()}
                                                                alt={
                                                                    ogpData()
                                                                        ?.ogImageAlt ||
                                                                    "Twitter Card Preview"
                                                                }
                                                                onError={() =>
                                                                    setImageError(
                                                                        true,
                                                                    )
                                                                }
                                                                class="w-full h-full object-cover"
                                                            />
                                                        </Show>
                                                    </div>
                                                    <div class="p-3.5 flex flex-col justify-center gap-1 min-w-0 flex-1">
                                                        <span class="text-[11px] text-base-content/60 truncate">
                                                            {displayDomain()}
                                                        </span>
                                                        <p class="text-sm font-bold text-base-content line-clamp-1 break-all">
                                                            {displayTwitterTitle()}
                                                        </p>
                                                        <p class="text-xs text-base-content/70 line-clamp-2 break-all leading-snug">
                                                            {displayTwitterDescription()}
                                                        </p>
                                                    </div>
                                                </div>
                                            }
                                        >
                                            {/* summary_large_image (大型画像カード) */}
                                            <div class="bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-xs flex flex-col">
                                                <div class="w-full aspect-[1.91/1] bg-base-200 flex items-center justify-center border-b border-base-300 overflow-hidden relative">
                                                    <Show
                                                        when={
                                                            displayTwitterImage() &&
                                                            !imageError()
                                                        }
                                                        fallback={
                                                            <div class="flex flex-col items-center gap-1 text-base-content/40">
                                                                <span class="text-3xl">
                                                                    🖼️
                                                                </span>
                                                                <span class="text-xs font-bold">
                                                                    OGP画像未設定
                                                                </span>
                                                            </div>
                                                        }
                                                    >
                                                        <img
                                                            src={displayTwitterImage()}
                                                            alt={
                                                                ogpData()
                                                                    ?.ogImageAlt ||
                                                                "Twitter Large Card Preview"
                                                            }
                                                            onError={() =>
                                                                setImageError(
                                                                    true,
                                                                )
                                                            }
                                                            class="w-full h-full object-cover"
                                                        />
                                                    </Show>
                                                </div>
                                                <div class="p-3.5 flex flex-col gap-1">
                                                    <span class="text-[11px] text-base-content/60 truncate">
                                                        {displayDomain()}
                                                    </span>
                                                    <p class="text-sm font-bold text-base-content line-clamp-1 break-all">
                                                        {displayTwitterTitle()}
                                                    </p>
                                                    <p class="text-xs text-base-content/70 line-clamp-2 break-all leading-snug">
                                                        {displayTwitterDescription()}
                                                    </p>
                                                </div>
                                            </div>
                                        </Show>
                                    </div>

                                    {/* Facebook / LINE / Discord 汎用OGPプレビュー */}
                                    <div class="bg-base-200/60 border border-base-300 rounded-2xl p-5 flex flex-col gap-3">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs font-black text-base-content/80 flex items-center gap-1.5">
                                                <span>💬</span> Facebook / LINE / Discord プレビュー
                                            </span>
                                            <span class="badge badge-neutral badge-sm font-mono text-[10px]">
                                                Open Graph (1.91:1)
                                            </span>
                                        </div>

                                        <div class="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-xs flex flex-col">
                                            <div class="w-full aspect-[1.91/1] bg-base-200 flex items-center justify-center border-b border-base-300 overflow-hidden">
                                                <Show
                                                    when={
                                                        displayImage() &&
                                                        !imageError()
                                                    }
                                                    fallback={
                                                        <div class="flex flex-col items-center gap-1 text-base-content/40">
                                                            <span class="text-3xl">
                                                                🖼️
                                                            </span>
                                                            <span class="text-xs font-bold">
                                                                og:image 未設定
                                                            </span>
                                                        </div>
                                                    }
                                                >
                                                    <img
                                                        src={displayImage()}
                                                        alt={
                                                            ogpData()
                                                                ?.ogImageAlt ||
                                                            "OGP Image Preview"
                                                        }
                                                        onError={() =>
                                                            setImageError(true)
                                                        }
                                                        class="w-full h-full object-cover"
                                                    />
                                                </Show>
                                            </div>
                                            <div class="p-3.5 bg-base-200/30 flex flex-col gap-1">
                                                <span class="text-[11px] uppercase tracking-wider text-base-content/60 font-semibold truncate">
                                                    {ogpData()?.ogSiteName ||
                                                        displayDomain()}
                                                </span>
                                                <p class="text-sm font-bold text-primary line-clamp-1 break-all">
                                                    {displayTitle()}
                                                </p>
                                                <p class="text-xs text-base-content/70 line-clamp-2 break-all leading-snug">
                                                    {displayDescription()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. 主要OGPタグ診断チェックリスト */}
                            <div>
                                <h2 class="text-lg sm:text-xl font-black text-base-content mb-4 flex items-center gap-2">
                                    <span>✅</span> OGP設定診断チェック
                                </h2>
                                <div class="border border-base-300 rounded-2xl bg-base-100 overflow-hidden divide-y divide-base-200 shadow-xs">
                                    <For each={diagnostics()}>
                                        {(item) => (
                                            <div class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-base-200/40 transition-colors">
                                                <div class="flex items-center gap-3 md:w-52 shrink-0">
                                                    {statusBadge(item.status)}
                                                    <span class="font-mono font-bold text-xs sm:text-sm text-base-content">
                                                        {item.label}
                                                    </span>
                                                </div>
                                                <div class="flex-1 min-w-0 flex flex-col gap-1">
                                                    <p class="text-xs sm:text-sm font-semibold text-base-content break-all">
                                                        {item.value}
                                                    </p>
                                                    <p class="text-[11px] text-base-content/60">
                                                        {item.message}
                                                    </p>
                                                </div>
                                                <div class="shrink-0 self-end md:self-center">
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            item.value ===
                                                            "未設定"
                                                        }
                                                        onClick={() =>
                                                            copyText(
                                                                item.value,
                                                                `diag-${item.key}`,
                                                            )
                                                        }
                                                        class={`btn btn-xs h-7 px-3 rounded-lg text-white font-medium ${
                                                            copiedKey() ===
                                                            `diag-${item.key}`
                                                                ? "btn-success"
                                                                : "btn-neutral"
                                                        }`}
                                                    >
                                                        {copiedKey() ===
                                                        `diag-${item.key}`
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>

                            {/* 3. 検出されたメタタグ一覧 */}
                            <div>
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                    <h2 class="text-lg sm:text-xl font-black text-base-content flex items-center gap-2">
                                        <span>🏷️</span> 検出されたメタタグ一覧 (
                                        {ogpData()?.rawTags.length ?? 0}件)
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={copyAllSummary}
                                        class={`btn btn-sm text-white rounded-xl font-bold ${
                                            allCopied()
                                                ? "btn-success"
                                                : "btn-neutral"
                                        }`}
                                    >
                                        {allCopied()
                                            ? "すべてコピー完了！"
                                            : "すべての情報をコピー"}
                                    </button>
                                </div>

                                <Show
                                    when={
                                        (ogpData()?.rawTags.length ?? 0) > 0
                                    }
                                    fallback={
                                        <div class="p-6 text-center bg-base-200/50 rounded-2xl border border-base-300 text-xs text-base-content/60 font-semibold">
                                            OGP・Twitterカード関連のメタタグは検出されませんでした。
                                        </div>
                                    }
                                >
                                    <div class="border border-base-300 rounded-2xl bg-base-100 overflow-hidden divide-y divide-base-200 shadow-xs">
                                        <For each={ogpData()?.rawTags}>
                                            {(tag, idx) => (
                                                <div class="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-base-200/40 transition-colors">
                                                    <div class="flex items-center gap-2 md:w-56 shrink-0">
                                                        <span class="badge badge-ghost badge-xs font-mono uppercase">
                                                            {tag.category}
                                                        </span>
                                                        <span class="font-mono font-bold text-xs sm:text-sm text-primary break-all">
                                                            {tag.key}
                                                        </span>
                                                    </div>
                                                    <div class="flex-1 text-xs sm:text-sm text-base-content break-all font-medium md:px-4">
                                                        {tag.value || "（空）"}
                                                    </div>
                                                    <div class="shrink-0 self-end md:self-center">
                                                        <button
                                                            type="button"
                                                            disabled={!tag.value}
                                                            onClick={() =>
                                                                copyText(
                                                                    tag.value,
                                                                    `raw-${idx()}`,
                                                                )
                                                            }
                                                            class={`btn btn-xs h-7 px-3 rounded-lg text-white font-medium ${
                                                                copiedKey() ===
                                                                `raw-${idx()}`
                                                                    ? "btn-success"
                                                                    : "btn-neutral"
                                                            }`}
                                                        >
                                                            {copiedKey() ===
                                                            `raw-${idx()}`
                                                                ? "完了"
                                                                : "コピー"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </Show>
                </div>

                {/* 技術解説 ＆ FAQセクション */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm justify-between">
                        <div>
                            <h2 class="text-base font-bold text-base-content border-b border-base-300 pb-3 mb-5">
                                ⚙️ OGP（Open Graph Protocol）の基本仕様
                            </h2>
                            <div class="space-y-4 text-xs text-base-content/80 leading-relaxed font-medium">
                                <p>
                                    <strong>OGP（Open Graph Protocol）</strong>
                                    は、WebページがSNS（X / Twitter、Facebook、LINE、Discord、Slack等）で共有された際に、ページのタイトル・説明文・サムネイル画像・正規URLを正しく伝えるためのHTMLメタデータ規格です。
                                </p>
                                <p>
                                    OGP画像（
                                    <code class="px-1 py-0.5 bg-base-200 rounded font-mono">
                                        og:image
                                    </code>
                                    ）の推奨解像度は{" "}
                                    <strong>
                                        1200 × 630 ピクセル（アスペクト比 1.91 : 1）
                                    </strong>{" "}
                                    です。また、画像の指定には相対パスではなく{" "}
                                    <code class="px-1 py-0.5 bg-base-200 rounded font-mono">
                                        https://
                                    </code>{" "}
                                    から始まる絶対URLを使用する必要があります。
                                </p>
                                <p>
                                    公開前のローカル環境やアクセス制限のあるページのOGPを検証したい場合は、「HTMLを直接入力」タブにHTMLソースを貼り付けることで、ブラウザ内完結で安全に解析できます。
                                </p>
                            </div>
                        </div>
                        <div class="mt-6 pt-4 border-t border-base-200 text-xs text-base-content/60">
                            ※データの取り扱い方針については、当サイトの
                            <a
                                href="/privacy"
                                class="text-primary font-bold underline ml-1"
                            >
                                プライバシーポリシー
                            </a>
                            をご確認ください。
                        </div>
                    </div>

                    <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm">
                        <h2 class="text-base font-bold text-base-content border-b border-base-300 pb-3 mb-5">
                            ❓ よくある質問（FAQ）
                        </h2>

                        <div class="space-y-2">
                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content">
                                    Q. X（Twitter）で大きな画像カードとして表示させるには？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3">
                                    HTMLの{" "}
                                    <code class="px-1 py-0.5 bg-base-300 rounded font-mono">
                                        &lt;head&gt;
                                    </code>{" "}
                                    内に{" "}
                                    <code class="px-1 py-0.5 bg-base-300 rounded font-mono">
                                        &lt;meta name="twitter:card" content="summary_large_image" /&gt;
                                    </code>{" "}
                                    を設定してください。小さなアイコン風のカードにしたい場合は{" "}
                                    <code class="px-1 py-0.5 bg-base-300 rounded font-mono">
                                        summary
                                    </code>{" "}
                                    を指定します。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content">
                                    Q. OGPタグを更新したのにSNS側の表示が古いままなのはなぜですか？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3">
                                    各SNSのクローラーは一度取得したOGP情報を一定期間キャッシュします。本ツールで最新のHTMLに更新されていることを確認した上で、急ぎの場合は画像ファイル名にクエリパラメータ（例:{" "}
                                    <code class="px-1 py-0.5 bg-base-300 rounded font-mono">
                                        ?v=2
                                    </code>
                                    ）を付与するか、各SNSのキャッシュクリア機能をご利用ください。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content">
                                    Q. URLから取得できないサイトがあるのはなぜですか？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3">
                                    対象サイトのセキュリティ設定（WAFやBot対策、CORS制限など）やイントラネット環境によっては外部からのHTML取得がブロックされる場合があります。その場合はブラウザで対象ページの「ページのソースを表示」を開き、「HTMLを直接入力」タブへ貼り付けることで確実に確認できます。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AdSense />
            <AdSense />
        </div>
    );
}
