import {
    createMemo,
    createSignal,
    For,
    onSettled,
    Show,
} from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import {
    animatePop,
    delayedCall,
    playPageEntrance,
} from "../utils/animations";
import { fetchPageSource } from "../utils/htmlFetcher";
import { usePageI18n } from "../i18n/index";

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

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_, dec) => {
            const num = Number(dec);
            return Number.isFinite(num) ? String.fromCharCode(num) : "";
        })
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
            const num = parseInt(hex, 16);
            return Number.isFinite(num) ? String.fromCharCode(num) : "";
        })
        .replace(/&amp;/gi, "&");
}

function extractTagAttributes(tagString: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex =
        /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(tagString)) !== null) {
        const name = match[1].toLowerCase();
        const rawVal = match[2] ?? match[3] ?? match[4] ?? "";
        attrs[name] = decodeHtmlEntities(rawVal.trim());
    }
    return attrs;
}

export function parseOgpFromHtml(html: string, sourceUrl = ""): OgpData {
    const ogMap: Record<string, string> = {};
    const twitterMap: Record<string, string> = {};
    const basicMap: Record<string, string> = {};
    const rawTags: MetaTagItem[] = [];

    // 1. <title>タグの抽出
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";
    if (pageTitle) {
        basicMap["title"] = pageTitle;
        rawTags.push({ key: "<title>", value: pageTitle, category: "basic" });
    }

    // 2. <meta>タグの抽出
    const metaRegex = /<meta\b[^>]*>/gi;
    let metaMatch: RegExpExecArray | null;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
        const attrs = extractTagAttributes(metaMatch[0]);
        const property = (attrs["property"] || "").trim().toLowerCase();
        const name = (attrs["name"] || "").trim().toLowerCase();
        const content = (attrs["content"] || "").trim();

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

    // 3. <link>タグ（canonical, icon）の抽出
    let canonicalHref = "";
    let iconHref = "";
    const linkRegex = /<link\b[^>]*>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
        const attrs = extractTagAttributes(linkMatch[0]);
        const rel = (attrs["rel"] || "").toLowerCase();
        const href = (attrs["href"] || "").trim();
        if (!href) continue;

        if (rel === "canonical" && !canonicalHref) {
            canonicalHref = href;
        } else if (
            /(^|\s)(icon|shortcut icon|apple-touch-icon)($|\s)/.test(rel) &&
            !iconHref
        ) {
            iconHref = href;
        }
    }

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
                ? /^(https?:|data:|blob:)/i.test(data.ogImage)
                    ? "ok"
                    : "warn"
                : "missing",
            value: data.ogImage || "未設定",
            message: !data.ogImage
                ? "未設定です（SNSシェア時にサムネイル画像が表示されません）"
                : /^(https?:|data:|blob:)/i.test(data.ogImage)
                  ? "有効な画像URLが設定されています（推奨サイズ: 1200×630px）"
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
    const { title, description } = usePageI18n("/ogp-checker", {
        defaultTitle: "OGP確認・SNSシェアプレビューツール",
        defaultDescription:
            "WebページのURLまたはHTMLソースコード（ファイル読込対応）からOGP（Open Graph Protocol）とTwitterカードのメタタグをブラウザ上で解析し、X（旧Twitter）やFacebook・LINE・Discordなどでシェアされた際の表示をプレビューします。",
    });
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
    const [localPreviewImage, setLocalPreviewImage] = createSignal("");

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");

        return () => {
            if (localPreviewImage()) {
                URL.revokeObjectURL(localPreviewImage());
            }
        };
    });

    const enrichDevSameOriginOgp = async (
        parsed: OgpData,
        html: string,
        targetUrl: string,
    ): Promise<OgpData> => {
        if (!import.meta.env.DEV || parsed.ogTitle || !html.includes("/src/index.tsx")) {
            return parsed;
        }
        try {
            const { routes, getPageMetadata } = await import("../routes");
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
        try {
            const result = await fetchPageSource(targetUrl);
            if (result.kind === "html") {
                const parsed = parseOgpFromHtml(result.html, result.finalUrl);
                if (result.source === "direct") {
                    return await enrichDevSameOriginOgp(parsed, result.html, result.finalUrl);
                }
                if (
                    parsed.ogTitle ||
                    parsed.pageTitle ||
                    parsed.ogDescription ||
                    parsed.ogImage
                ) {
                    return parsed;
                }
            }
            if (result.kind === "microlink") {
                const parsed = parseOgpFromMicrolink(result.payload, targetUrl);
                if (parsed) return parsed;
            }
        } catch (err: any) {
            throw new Error(
                err?.message ||
                    "ページの取得に失敗しました。対象サイトへのアクセス制限がある場合は、「HTML直接入力 / ファイル読込」タブをご利用ください。",
            );
        }
        throw new Error(
            "OGP情報が見つかりませんでした。「HTML直接入力 / ファイル読込」タブからHTMLソースを貼り付けてお試しください。",
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
                    "OGP情報の取得中にエラーが発生しました。「HTMLを直接入力 / ファイル読込」をお試しください。",
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

    const handleHtmlFileUpload = async (e: Event) => {
        const target = e.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        try {
            const content = await file.text();
            setHtmlInput(content);
            setError("");
            setImageError(false);
            const parsed = parseOgpFromHtml(
                content,
                normalizeInputUrl(urlInput()),
            );
            setOgpData(parsed);
        } catch {
            setError("HTMLファイルの読み込みに失敗しました。");
        } finally {
            target.value = "";
        }
    };

    const handleLocalImageUpload = (e: Event) => {
        const target = e.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        if (localPreviewImage()) {
            URL.revokeObjectURL(localPreviewImage());
        }
        const objectUrl = URL.createObjectURL(file);
        setLocalPreviewImage(objectUrl);
        setImageError(false);
        setOgpData((prev) =>
            prev
                ? {
                      ...prev,
                      ogImage: objectUrl,
                      twitterImage: objectUrl,
                  }
                : null,
        );
        target.value = "";
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
                <span class="ba-badge ba-badge--success">
                    設定済み
                </span>
            );
        }
        if (status === "warn") {
            return (
                <span class="ba-badge ba-badge--warning">
                    要確認
                </span>
            );
        }
        return (
            <span class="ba-badge ba-badge--danger">
                未設定
            </span>
        );
    };

    return (
        <div ref={containerRef} class="ba-page ba-page--wide">
            {/* メインカード */}
            <div class="ba-card ba-stack-6">
                {/* ヘッダー */}
                <div
                    class="ba-home-header"
                    style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "1.25rem" }}
                >
                    <div class="ba-min-w-0">
                        <h1 class="ba-title">
                            <BudouX text={title()} />
                        </h1>
                        <BudouX
                            as="p"
                            class="ba-text-xs ba-text-muted"
                            style={{ "margin-top": "0.5rem", "margin-bottom": 0, "line-height": 1.6, "font-weight": 600 }}
                            text={description()}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={loadSample}
                        class="ba-btn ba-btn--outline ba-btn--sm ba-shrink-0"
                    >
                        サンプルで試す
                    </button>
                </div>

                {/* 入力モード切替タブ */}
                <div>
                    <div class="ba-tabs">
                        <button
                            type="button"
                            onClick={() => {
                                setInputMode("url");
                                setError("");
                            }}
                            class={`ba-tab ${inputMode() === "url" ? "is-active" : ""}`}
                        >
                            URLから取得
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setInputMode("html");
                                setError("");
                            }}
                            class={`ba-tab ${inputMode() === "html" ? "is-active" : ""}`}
                        >
                            HTML直接入力 / ファイル読込
                        </button>
                    </div>
                </div>

                {/* URL入力フォーム */}
                <Show when={inputMode() === "url"}>
                    <form
                        {...({
                            toolname: "analyze_ogp_url",
                            tooldescription:
                                "指定したURLのWebページからOGPタグとTwitterカードを解析してSNSシェアプレビューを表示します",
                        } as Record<string, string>)}
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleAnalyzeUrl();
                        }}
                        class="ba-flex ba-flex-wrap ba-gap-3 ba-w-full"
                    >
                        <input
                            type="text"
                            name="url"
                            title="確認するページのURL"
                            value={urlInput()}
                            onInput={(e) =>
                                setUrlInput(e.currentTarget.value)
                            }
                            placeholder="https://tools.blossomsarchive.com"
                            aria-label="確認するページのURL"
                            class="ba-input ba-flex-1"
                            style={{ "min-width": "14rem", height: "3rem" }}
                        />
                        <button
                            ref={actionButtonRef}
                            type="submit"
                            disabled={loading() || !urlInput().trim()}
                            class="ba-btn ba-btn--primary ba-btn--lg ba-shrink-0"
                            style={{ height: "3rem", "padding-inline": "1.75rem" }}
                        >
                            {loading() ? (
                                <>
                                    <span class="ba-spinner"></span>
                                    解析中...
                                </>
                            ) : (
                                "OGPを取得・解析"
                            )}
                        </button>
                    </form>
                </Show>

                {/* HTML直接入力・ローカルファイル読込フォーム */}
                <Show when={inputMode() === "html"}>
                    <div class="ba-stack-4 ba-w-full">
                        <div class="ba-field">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                <span class="ba-label">
                                    HTMLソースコード（&lt;head&gt;内のメタタグまたはページ全体のHTML）
                                </span>
                                <label class="ba-btn ba-btn--outline ba-btn--xs" style={{ cursor: "pointer" }}>
                                    HTMLファイルを読み込む
                                    <input
                                        type="file"
                                        accept=".html,.htm,text/html"
                                        aria-label="HTMLファイルを選択"
                                        onChange={handleHtmlFileUpload}
                                        hidden
                                    />
                                </label>
                            </div>
                            <textarea
                                value={htmlInput()}
                                onInput={(e) =>
                                    setHtmlInput(e.currentTarget.value)
                                }
                                placeholder={'<meta property="og:title" content="ページタイトル" />\n<meta property="og:description" content="ページの説明文" />\n<meta property="og:image" content="https://example.com/ogp.png" />'}
                                aria-label="解析するHTMLソースコード"
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{ height: "11rem", "line-height": 1.6 }}
                            />
                        </div>
                        <div class="ba-flex ba-justify-end ba-gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setHtmlInput("");
                                    setOgpData(null);
                                    setError("");
                                }}
                                class="ba-btn ba-btn--outline ba-btn--sm"
                            >
                                クリア
                            </button>
                            <button
                                ref={actionButtonRef}
                                type="button"
                                onClick={handleAnalyzeHtml}
                                disabled={!htmlInput().trim()}
                                class="ba-btn ba-btn--primary ba-btn--sm"
                                style={{ "padding-inline": "1.5rem" }}
                            >
                                HTMLを解析する
                            </button>
                        </div>
                    </div>
                </Show>

                {/* エラー表示 */}
                <Show when={error()}>
                    <div class="ba-alert ba-alert--error ba-flex-wrap ba-justify-between">
                        <div class="ba-flex ba-items-center ba-gap-2 ba-text-sm">
                            <ToolIcon name="alert" class="ba-icon-md ba-shrink-0" />
                            <span>{error()}</span>
                        </div>
                        <Show when={inputMode() === "url"}>
                            <button
                                type="button"
                                onClick={() => {
                                    setInputMode("html");
                                    setError("");
                                }}
                                class="ba-btn ba-btn--xs ba-shrink-0"
                            >
                                HTML直接入力へ切替
                            </button>
                        </Show>
                    </div>
                </Show>

                {/* 未解析時の初期ガイド */}
                <Show when={!ogpData() && !loading()}>
                    <div
                        class="ba-dropzone ba-flex-col ba-items-center ba-gap-3"
                        style={{ cursor: "default", padding: "2rem" }}
                    >
                        <div class="ba-flex ba-justify-center ba-text-muted">
                            <ToolIcon name="search" class="ba-icon-xl" />
                        </div>
                        <p class="ba-text-sm ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                            URLを入力して「OGPを取得・解析」を押すか、HTMLソース・HTMLファイルを読み込んで解析してください。
                        </p>
                        <p
                            class="ba-text-xs ba-text-muted"
                            style={{ "max-width": "36rem", "line-height": 1.6, margin: 0 }}
                        >
                            ローカル開発中のファイルや公開前のページを確認したい場合は、「HTML直接入力 / ファイル読込」タブからブラウザ内完結（外部通信なし）で即座にプレビューできます。
                        </p>
                    </div>
                </Show>

                {/* 解析結果エリア */}
                <Show when={ogpData() && !loading()}>
                    <div
                        class="ba-stack-6"
                        style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "1.75rem" }}
                    >
                        {/* 1. SNSカード表示プレビュー */}
                        <div class="ba-stack-4">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3">
                                <h2 class="ba-section-title">
                                    SNSシェア表示プレビュー
                                </h2>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                                    <label class="ba-btn ba-btn--outline ba-btn--xs" style={{ cursor: "pointer" }}>
                                        ローカル画像で試す
                                        <input
                                            type="file"
                                            accept="image/*"
                                            aria-label="ローカル画像ファイルを選択"
                                            onChange={
                                                handleLocalImageUpload
                                            }
                                            hidden
                                        />
                                    </label>
                                    {/* Xカード表示切替 */}
                                    <div class="ba-tabs" style={{ padding: "0.2rem", "align-items": "center" }}>
                                        <span
                                            class="ba-font-bold ba-text-muted"
                                            style={{ "font-size": "0.6875rem", "padding-inline": "0.5rem" }}
                                        >
                                            Xカード形式:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setTwitterPreviewStyle(
                                                    "auto",
                                                )
                                            }
                                            class={`ba-tab ${
                                                twitterPreviewStyle() === "auto"
                                                    ? "is-active"
                                                    : ""
                                            }`}
                                            style={{ padding: "0.25rem 0.55rem", "font-size": "0.75rem" }}
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
                                            class={`ba-tab ${
                                                twitterPreviewStyle() === "summary_large_image"
                                                    ? "is-active"
                                                    : ""
                                            }`}
                                            style={{ padding: "0.25rem 0.55rem", "font-size": "0.75rem" }}
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
                                            class={`ba-tab ${
                                                twitterPreviewStyle() === "summary"
                                                    ? "is-active"
                                                    : ""
                                            }`}
                                            style={{ padding: "0.25rem 0.55rem", "font-size": "0.75rem" }}
                                        >
                                            小画像
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="ba-grid-2">
                                {/* X (Twitter) プレビュー */}
                                <div class="ba-panel ba-stack-3" style={{ padding: "1.25rem" }}>
                                    <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                                        <span class="ba-text-xs ba-font-black ba-text-muted ba-flex ba-items-center ba-gap-1">
                                            <span>𝕏</span> X (Twitter) プレビュー
                                        </span>
                                        <span class="ba-badge ba-badge--neutral ba-mono">
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
                                            <div
                                                style={{
                                                    "background-color": "var(--ba-surface)",
                                                    border: "1px solid var(--ba-border)",
                                                    "border-radius": "var(--ba-radius-lg)",
                                                    overflow: "hidden",
                                                    display: "flex",
                                                    "align-items": "stretch",
                                                    "box-shadow": "var(--ba-shadow-xs)",
                                                    "min-height": "116px",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: "7.5rem",
                                                        "background-color": "var(--ba-surface-2)",
                                                        "flex-shrink": 0,
                                                        display: "flex",
                                                        "align-items": "center",
                                                        "justify-content": "center",
                                                        "border-right": "1px solid var(--ba-border)",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    <Show
                                                        when={
                                                            displayTwitterImage() &&
                                                            !imageError()
                                                        }
                                                        fallback={
                                                            <span
                                                                class="ba-text-xs ba-text-muted ba-font-bold ba-text-center"
                                                                style={{ "padding-inline": "0.5rem" }}
                                                            >
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
                                                            style={{ width: "100%", height: "100%", "object-fit": "cover" }}
                                                        />
                                                    </Show>
                                                </div>
                                                <div
                                                    class="ba-flex-col ba-justify-center ba-gap-1 ba-min-w-0 ba-flex-1"
                                                    style={{ padding: "0.875rem" }}
                                                >
                                                    <span class="ba-text-muted ba-truncate" style={{ "font-size": "0.6875rem" }}>
                                                        {displayDomain()}
                                                    </span>
                                                    <p
                                                        class="ba-text-sm ba-font-bold ba-break-all"
                                                        style={{
                                                            margin: 0,
                                                            display: "-webkit-box",
                                                            "-webkit-line-clamp": 1,
                                                            "-webkit-box-orient": "vertical",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        {displayTwitterTitle()}
                                                    </p>
                                                    <p
                                                        class="ba-text-xs ba-text-muted ba-break-all"
                                                        style={{
                                                            margin: 0,
                                                            "line-height": 1.4,
                                                            display: "-webkit-box",
                                                            "-webkit-line-clamp": 2,
                                                            "-webkit-box-orient": "vertical",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        {displayTwitterDescription()}
                                                    </p>
                                                </div>
                                            </div>
                                        }
                                    >
                                        {/* summary_large_image (大型画像カード) */}
                                        <div
                                            style={{
                                                "background-color": "var(--ba-surface)",
                                                border: "1px solid var(--ba-border)",
                                                "border-radius": "var(--ba-radius-lg)",
                                                overflow: "hidden",
                                                "box-shadow": "var(--ba-shadow-xs)",
                                                display: "flex",
                                                "flex-direction": "column",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "100%",
                                                    "aspect-ratio": "1.91 / 1",
                                                    "background-color": "var(--ba-surface-2)",
                                                    display: "flex",
                                                    "align-items": "center",
                                                    "justify-content": "center",
                                                    "border-bottom": "1px solid var(--ba-border)",
                                                    overflow: "hidden",
                                                    position: "relative",
                                                }}
                                            >
                                                <Show
                                                    when={
                                                        displayTwitterImage() &&
                                                        !imageError()
                                                    }
                                                    fallback={
                                                        <div class="ba-flex-col ba-items-center ba-gap-1 ba-text-muted">
                                                            <ToolIcon name="image" class="ba-icon-lg" />
                                                            <span class="ba-text-xs ba-font-bold">
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
                                                        style={{ width: "100%", height: "100%", "object-fit": "cover" }}
                                                    />
                                                </Show>
                                            </div>
                                            <div class="ba-stack-1" style={{ padding: "0.875rem" }}>
                                                <span class="ba-text-muted ba-truncate" style={{ "font-size": "0.6875rem" }}>
                                                    {displayDomain()}
                                                </span>
                                                <p
                                                    class="ba-text-sm ba-font-bold ba-break-all"
                                                    style={{
                                                        margin: 0,
                                                        display: "-webkit-box",
                                                        "-webkit-line-clamp": 1,
                                                        "-webkit-box-orient": "vertical",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {displayTwitterTitle()}
                                                </p>
                                                <p
                                                    class="ba-text-xs ba-text-muted ba-break-all"
                                                    style={{
                                                        margin: 0,
                                                        "line-height": 1.4,
                                                        display: "-webkit-box",
                                                        "-webkit-line-clamp": 2,
                                                        "-webkit-box-orient": "vertical",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {displayTwitterDescription()}
                                                </p>
                                            </div>
                                        </div>
                                    </Show>
                                </div>

                                {/* Facebook / LINE / Discord 汎用OGPプレビュー */}
                                <div class="ba-panel ba-stack-3" style={{ padding: "1.25rem" }}>
                                    <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                                        <span class="ba-text-xs ba-font-black ba-text-muted">
                                            Facebook / LINE / Discord プレビュー
                                        </span>
                                        <span class="ba-badge ba-badge--neutral ba-mono">
                                            Open Graph (1.91:1)
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            "background-color": "var(--ba-surface)",
                                            border: "1px solid var(--ba-border)",
                                            "border-radius": "var(--ba-radius)",
                                            overflow: "hidden",
                                            "box-shadow": "var(--ba-shadow-xs)",
                                            display: "flex",
                                            "flex-direction": "column",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "100%",
                                                "aspect-ratio": "1.91 / 1",
                                                "background-color": "var(--ba-surface-2)",
                                                display: "flex",
                                                "align-items": "center",
                                                "justify-content": "center",
                                                "border-bottom": "1px solid var(--ba-border)",
                                                overflow: "hidden",
                                            }}
                                        >
                                            <Show
                                                when={
                                                    displayImage() &&
                                                    !imageError()
                                                }
                                                fallback={
                                                    <div class="ba-flex-col ba-items-center ba-gap-1 ba-text-muted">
                                                        <ToolIcon name="image" class="ba-icon-lg" />
                                                        <span class="ba-text-xs ba-font-bold">
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
                                                    style={{ width: "100%", height: "100%", "object-fit": "cover" }}
                                                />
                                            </Show>
                                        </div>
                                        <div
                                            class="ba-stack-1"
                                            style={{ padding: "0.875rem", "background-color": "var(--ba-surface-2)" }}
                                        >
                                            <span
                                                class="ba-text-muted ba-truncate ba-font-bold"
                                                style={{
                                                    "font-size": "0.6875rem",
                                                    "text-transform": "uppercase",
                                                    "letter-spacing": "0.04em",
                                                }}
                                            >
                                                {ogpData()?.ogSiteName ||
                                                    displayDomain()}
                                            </span>
                                            <p
                                                class="ba-text-sm ba-font-bold ba-text-primary ba-break-all"
                                                style={{
                                                    margin: 0,
                                                    display: "-webkit-box",
                                                    "-webkit-line-clamp": 1,
                                                    "-webkit-box-orient": "vertical",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {displayTitle()}
                                            </p>
                                            <p
                                                class="ba-text-xs ba-text-muted ba-break-all"
                                                style={{
                                                    margin: 0,
                                                    "line-height": 1.4,
                                                    display: "-webkit-box",
                                                    "-webkit-line-clamp": 2,
                                                    "-webkit-box-orient": "vertical",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {displayDescription()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. 主要OGPタグ診断チェックリスト */}
                        <div class="ba-stack-3">
                            <h2 class="ba-section-title">
                                OGP設定診断チェック
                            </h2>
                            <div
                                style={{
                                    border: "1px solid var(--ba-border)",
                                    "border-radius": "var(--ba-radius-lg)",
                                    "background-color": "var(--ba-surface)",
                                    overflow: "hidden",
                                    "box-shadow": "var(--ba-shadow-xs)",
                                }}
                            >
                                <For each={diagnostics()}>
                                    {(item) => (
                                        <div
                                            class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3"
                                            style={{
                                                padding: "1rem",
                                                "border-bottom": "1px solid var(--ba-border)",
                                            }}
                                        >
                                            <div
                                                class="ba-flex ba-items-center ba-gap-3 ba-shrink-0"
                                                style={{ "min-width": "13rem" }}
                                            >
                                                {statusBadge(item.status)}
                                                <span class="ba-mono ba-font-bold ba-text-sm">
                                                    {item.label}
                                                </span>
                                            </div>
                                            <div class="ba-flex-1 ba-min-w-0 ba-stack-1" style={{ "min-width": "14rem" }}>
                                                <p class="ba-text-sm ba-font-bold ba-break-all" style={{ margin: 0 }}>
                                                    {item.value}
                                                </p>
                                                <p class="ba-text-muted" style={{ "font-size": "0.6875rem", margin: 0 }}>
                                                    {item.message}
                                                </p>
                                            </div>
                                            <div class="ba-shrink-0">
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
                                                    class={`ba-btn ba-btn--xs ${
                                                        copiedKey() ===
                                                        `diag-${item.key}`
                                                            ? "ba-btn--success"
                                                            : "ba-btn--secondary"
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
                        <div class="ba-stack-3">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3">
                                <h2 class="ba-section-title">
                                    検出されたメタタグ一覧 (
                                    {ogpData()?.rawTags.length ?? 0}件)
                                </h2>
                                <button
                                    type="button"
                                    onClick={copyAllSummary}
                                    class={`ba-btn ba-btn--sm ${
                                        allCopied()
                                            ? "ba-btn--success"
                                            : "ba-btn--secondary"
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
                                    <div class="ba-panel ba-text-center ba-text-xs ba-text-muted ba-font-bold" style={{ padding: "1.5rem" }}>
                                        OGP・Twitterカード関連のメタタグは検出されませんでした。
                                    </div>
                                }
                            >
                                <div
                                    style={{
                                        border: "1px solid var(--ba-border)",
                                        "border-radius": "var(--ba-radius-lg)",
                                        "background-color": "var(--ba-surface)",
                                        overflow: "hidden",
                                        "box-shadow": "var(--ba-shadow-xs)",
                                    }}
                                >
                                    <For each={ogpData()?.rawTags}>
                                        {(tag, idx) => (
                                            <div
                                                class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2"
                                                style={{
                                                    padding: "0.875rem 1rem",
                                                    "border-bottom": "1px solid var(--ba-border)",
                                                }}
                                            >
                                                <div
                                                    class="ba-flex ba-items-center ba-gap-2 ba-shrink-0"
                                                    style={{ "min-width": "14rem" }}
                                                >
                                                    <span
                                                        class="ba-badge ba-badge--neutral ba-mono"
                                                        style={{ "text-transform": "uppercase" }}
                                                    >
                                                        {tag.category}
                                                    </span>
                                                    <span class="ba-mono ba-font-bold ba-text-xs ba-text-primary ba-break-all">
                                                        {tag.key}
                                                    </span>
                                                </div>
                                                <div
                                                    class="ba-flex-1 ba-text-xs ba-break-all"
                                                    style={{ "min-width": "12rem", "font-weight": 500 }}
                                                >
                                                    {tag.value || "（空）"}
                                                </div>
                                                <div class="ba-shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={!tag.value}
                                                        onClick={() =>
                                                            copyText(
                                                                tag.value,
                                                                `raw-${idx()}`,
                                                            )
                                                        }
                                                        class={`ba-btn ba-btn--xs ${
                                                            copiedKey() ===
                                                            `raw-${idx()}`
                                                                ? "ba-btn--success"
                                                                : "ba-btn--secondary"
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

            <AdSense />
            <AdSense />
        </div>
    );
}
