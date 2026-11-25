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
import { getPageMetadata, routes } from "../routes";
import {
    animatePop,
    delayedCall,
    playPageEntrance,
} from "../utils/animations";
import {
    fetchPageSource,
    extractJsonLdFromMicrolink,
} from "../utils/htmlFetcher";

export interface MetaTagItem {
    key: string;
    value: string;
    category: "basic" | "indexing" | "social" | "structure" | "other";
}

export interface JsonLdItem {
    type: string;
    raw: string;
    parsed: any | null;
    isValid: boolean;
    error?: string;
}

export interface SeoData {
    pageTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    robots: string;
    googlebot: string;
    viewport: string;
    charset: string;
    keywords: string;
    author: string;
    faviconUrl: string;
    themeColor: string;
    h1List: string[];
    hreflangs: Array<{ lang: string; href: string }>;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    ogType: string;
    twitterCard: string;
    jsonLdList: JsonLdItem[];
    rawTags: MetaTagItem[];
}

export interface DiagnosticItem {
    key: string;
    label: string;
    status: "ok" | "warn" | "error" | "missing";
    value: string;
    message: string;
    advice: string;
}

const SAMPLE_HTML = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>メタタグ(SEO)確認ツール | Google検索結果プレビュー＆診断</title>
  <meta name="description" content="Webページのタイトル、メタディスクリプション、canonical、robots、JSON-LD構造化データ等のSEO重要タグを即座に解析。Google検索スニペットのPC・スマホ表示をリアルタイムにプレビュー確認できる無料Webツールです。" />
  <link rel="canonical" href="https://tools.blossomsarchive.com/seo-checker" />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="BlossomsArchive Tools" />
  <link rel="icon" href="https://blossomsarchive.com/wp-content/uploads/2021/10/cropped-d42dee79c2a98cc8da98f9d600398a05-32x32.png" />
  <link rel="alternate" hreflang="ja" href="https://tools.blossomsarchive.com/seo-checker" />
  <link rel="alternate" hreflang="en" href="https://tools.blossomsarchive.com/en/seo-checker" />
  <meta property="og:title" content="メタタグ(SEO)確認ツール | Google検索結果プレビュー＆診断" />
  <meta property="og:description" content="WebページのSEOメタタグをブラウザ上で解析し、検索結果での見え方や改善点を一目でチェック。" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tools.blossomsarchive.com/seo-checker" />
  <meta property="og:image" content="https://placehold.co/1200x630/2563eb/ffffff/png?text=SEO+Checker" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "メタタグ(SEO)確認ツール",
    "url": "https://tools.blossomsarchive.com/seo-checker",
    "description": "WebページのSEOメタタグを解析しGoogle検索結果プレビューと診断を行うWebツール",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "All"
  }
  </script>
</head>
<body>
  <h1>メタタグ(SEO)確認ツールのサンプル見出し</h1>
  <p>サンプルページの本文です。</p>
</body>
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

/**
 * HTML文字列からタグ構造および残存する山括弧（<, >）を文字単位走査で完全に除去しプレーンテキスト化する
 * （正規表現による単一パス置換を行わないため Incomplete multi-character sanitization を根本防止）
 */
export function stripHtmlTagsToPlainText(input: string): string {
    let out = "";
    let inTag = false;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "<") {
            inTag = true;
            continue;
        }
        if (ch === ">") {
            inTag = false;
            continue;
        }
        if (!inTag) {
            out += ch;
        }
    }
    return out;
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

/**
 * JSON-LDスクリプト内の余計なCDATAやHTMLコメント、前後のゴミを安全に除去する
 * （正規表現による単一パスマルチ文字置換を行わず、文字位置走査とスライスで確実に除去）
 */
export function cleanJsonLdRawContent(input: string): string {
    let text = input.trim();
    if (!text) return "";

    // 先頭の HTML コメント <!-- や CDATA の除去
    while (text.startsWith("<!--")) {
        text = text.slice(4).trim();
    }
    while (text.startsWith("/*<![CDATA[*/") || text.startsWith("/* <![CDATA[ */")) {
        const idx = text.indexOf("*/");
        text = text.slice(idx + 2).trim();
    }
    while (text.startsWith("//<![CDATA[") || text.startsWith("// <![CDATA[")) {
        const nextLine = text.indexOf("\n");
        text = nextLine !== -1 ? text.slice(nextLine + 1).trim() : "";
    }
    while (text.startsWith("<![CDATA[")) {
        text = text.slice(9).trim();
    }

    // 末尾の HTML コメント --> や CDATA の除去
    while (text.endsWith("-->")) {
        text = text.slice(0, -3).trim();
    }
    while (text.endsWith("/*]]>*/") || text.endsWith("/* ]]> */")) {
        const idx = text.lastIndexOf("/*");
        text = text.slice(0, idx).trim();
    }
    while (text.endsWith("//]]>") || text.endsWith("// ]]>")) {
        const idx = text.lastIndexOf("//");
        text = text.slice(0, idx).trim();
    }
    while (text.endsWith("]]>")) {
        text = text.slice(0, -3).trim();
    }

    // JSONオブジェクト { ... } または 配列 [ ... ] の有効範囲を抽出
    const firstBrace = text.indexOf("{");
    const firstBracket = text.indexOf("[");
    let startIdx = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
        startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
        startIdx = firstBrace;
    } else if (firstBracket !== -1) {
        startIdx = firstBracket;
    }

    const lastBrace = text.lastIndexOf("}");
    const lastBracket = text.lastIndexOf("]");
    const endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        text = text.slice(startIdx, endIdx + 1).trim();
    }

    return text;
}

/**
 * JSON-LDの多段パース（直接パース -> HTMLエンティティデコード後パース）
 */
export function tryParseJsonLd(raw: string): { parsed: any; cleaned: string } | null {
    const cleaned = cleanJsonLdRawContent(raw);
    if (!cleaned) return null;

    try {
        const parsed = JSON.parse(cleaned);
        return { parsed, cleaned };
    } catch {
        // フォールバック
    }

    try {
        const decoded = decodeHtmlEntities(cleaned);
        const parsed = JSON.parse(decoded);
        return { parsed, cleaned: decoded };
    } catch {
        // パース失敗
    }

    return null;
}

/**
 * DOMParser 非対応環境向けの文字単位スキャンによる JSON-LD スクリプト抽出
 * HTML仕様の終了タグ（</script>, </script >, </script attr="x"> 等）を正規表現なしで安全に処理する
 */
function scanJsonLdScriptsWithoutDomParser(html: string): string[] {
    const results: string[] = [];
    const lower = html.toLowerCase();
    let pos = 0;

    while (pos < html.length) {
        const openIdx = lower.indexOf("<script", pos);
        if (openIdx === -1) break;

        const nextChar = lower[openIdx + 7];
        if (
            nextChar !== undefined &&
            nextChar !== ">" &&
            nextChar !== "/" &&
            !/\s/.test(nextChar)
        ) {
            pos = openIdx + 7;
            continue;
        }

        const tagEndIdx = html.indexOf(">", openIdx + 7);
        if (tagEndIdx === -1) break;

        const attrs = html.slice(openIdx + 7, tagEndIdx);
        const contentStart = tagEndIdx + 1;

        // </script に続いて空白・>・/ のいずれかが来る終了タグを探索
        let searchPos = contentStart;
        let closeStart = -1;
        let closeEnd = -1;
        while (searchPos < html.length) {
            const candidate = lower.indexOf("</script", searchPos);
            if (candidate === -1) break;
            const afterName = lower[candidate + 8];
            if (
                afterName === ">" ||
                afterName === "/" ||
                (afterName !== undefined && /\s/.test(afterName))
            ) {
                const endGt = html.indexOf(">", candidate + 8);
                if (endGt !== -1) {
                    closeStart = candidate;
                    closeEnd = endGt + 1;
                    break;
                }
            }
            searchPos = candidate + 8;
        }

        if (closeStart === -1) break;

        if (attrs.toLowerCase().includes("application/ld+json")) {
            const content = html.slice(contentStart, closeStart).trim();
            if (content) {
                results.push(content);
            }
        }

        pos = closeEnd;
    }

    return results;
}

/**
 * HTML文字列からすべての JSON-LD スクリプト文字列を抽出する
 */
export function extractJsonLdRawScripts(html: string): string[] {
    const results: string[] = [];
    if (!html || !html.trim()) return results;

    if (typeof DOMParser !== "undefined") {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const scriptElements = doc.querySelectorAll("script");
            scriptElements.forEach((script) => {
                const typeAttr = script.getAttribute("type");
                if (typeAttr && typeAttr.toLowerCase().includes("application/ld+json")) {
                    const content = script.textContent?.trim();
                    if (content) {
                        results.push(content);
                    }
                }
            });
            return results;
        } catch {
            // DOMParser 失敗時は文字単位スキャンへフォールバック
        }
    }

    return scanJsonLdScriptsWithoutDomParser(html);
}

export function parseSeoFromHtml(html: string, sourceUrl = ""): SeoData {
    const rawTags: MetaTagItem[] = [];
    const hreflangs: Array<{ lang: string; href: string }> = [];
    const jsonLdList: JsonLdItem[] = [];
    const h1List: string[] = [];

    // 1. <title>タグの抽出
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";
    if (pageTitle) {
        rawTags.push({ key: "<title>", value: pageTitle, category: "basic" });
    }

    // 2. <meta>タグの抽出
    let metaDescription = "";
    let robots = "";
    let googlebot = "";
    let viewport = "";
    let charset = "";
    let keywords = "";
    let author = "";
    let themeColor = "";
    let ogTitle = "";
    let ogDescription = "";
    let ogImage = "";
    let ogType = "";
    let ogUrl = "";
    let twitterCard = "";

    // <meta charset="..."> の直接マッチ
    const metaCharsetMatch = html.match(/<meta\b[^>]*charset=["']?([^"'\s>]+)/i);
    if (metaCharsetMatch) {
        charset = metaCharsetMatch[1].trim();
        rawTags.push({
            key: "charset",
            value: charset,
            category: "basic",
        });
    }

    const metaRegex = /<meta\b[^>]*>/gi;
    let metaMatch: RegExpExecArray | null;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
        const attrs = extractTagAttributes(metaMatch[0]);
        const name = (attrs["name"] || "").trim().toLowerCase();
        const property = (attrs["property"] || "").trim().toLowerCase();
        const httpEquiv = (attrs["http-equiv"] || "").trim().toLowerCase();
        const content = (attrs["content"] || "").trim();

        if (httpEquiv === "content-type" && !charset) {
            const match = content.match(/charset=([^;]+)/i);
            if (match) {
                charset = match[1].trim();
                rawTags.push({
                    key: "http-equiv: content-type",
                    value: content,
                    category: "basic",
                });
            }
        }

        const key = property || name;
        if (!key && !content) continue;

        if (name === "description" && !metaDescription) {
            metaDescription = content;
            rawTags.push({ key: "description", value: content, category: "basic" });
        } else if (name === "robots" && !robots) {
            robots = content;
            rawTags.push({ key: "robots", value: content, category: "indexing" });
        } else if (name === "googlebot" && !googlebot) {
            googlebot = content;
            rawTags.push({ key: "googlebot", value: content, category: "indexing" });
        } else if (name === "viewport" && !viewport) {
            viewport = content;
            rawTags.push({ key: "viewport", value: content, category: "basic" });
        } else if (name === "keywords" && !keywords) {
            keywords = content;
            rawTags.push({ key: "keywords", value: content, category: "basic" });
        } else if (name === "author" && !author) {
            author = content;
            rawTags.push({ key: "author", value: content, category: "basic" });
        } else if (name === "theme-color" && !themeColor) {
            themeColor = content;
            rawTags.push({ key: "theme-color", value: content, category: "basic" });
        } else if (property === "og:title") {
            ogTitle = content;
            rawTags.push({ key: "og:title", value: content, category: "social" });
        } else if (property === "og:description") {
            ogDescription = content;
            rawTags.push({ key: "og:description", value: content, category: "social" });
        } else if (property === "og:image") {
            ogImage = content;
            rawTags.push({ key: "og:image", value: content, category: "social" });
        } else if (property === "og:type") {
            ogType = content;
            rawTags.push({ key: "og:type", value: content, category: "social" });
        } else if (property === "og:url") {
            ogUrl = content;
            rawTags.push({ key: "og:url", value: content, category: "social" });
        } else if (name === "twitter:card") {
            twitterCard = content;
            rawTags.push({ key: "twitter:card", value: content, category: "social" });
        } else if (key) {
            const cat =
                key.startsWith("og:") || key.startsWith("twitter:")
                    ? "social"
                    : "other";
            rawTags.push({ key, value: content, category: cat });
        }
    }

    // 3. <link>タグの抽出（canonical, icon, alternate/hreflang）
    let canonicalHref = "";
    let faviconHref = "";
    const linkRegex = /<link\b[^>]*>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
        const attrs = extractTagAttributes(linkMatch[0]);
        const rel = (attrs["rel"] || "").toLowerCase();
        const href = (attrs["href"] || "").trim();
        const hreflang = (attrs["hreflang"] || "").trim();

        if (rel === "canonical" && href && !canonicalHref) {
            canonicalHref = href;
        } else if (
            /(^|\s)(icon|shortcut icon|apple-touch-icon)($|\s)/.test(rel) &&
            href &&
            !faviconHref
        ) {
            faviconHref = href;
        } else if (rel === "alternate" && hreflang && href) {
            hreflangs.push({ lang: hreflang, href });
            rawTags.push({
                key: `link[rel="alternate"][hreflang="${hreflang}"]`,
                value: href,
                category: "indexing",
            });
        }
    }

    const effectiveBaseUrl = ogUrl || canonicalHref || sourceUrl || undefined;
    const resolvedCanonical = resolveUrl(canonicalHref, effectiveBaseUrl);
    if (resolvedCanonical) {
        rawTags.push({
            key: 'link[rel="canonical"]',
            value: resolvedCanonical,
            category: "indexing",
        });
    }

    const resolvedFavicon = resolveUrl(faviconHref, effectiveBaseUrl);
    if (resolvedFavicon) {
        rawTags.push({
            key: 'link[rel="icon"]',
            value: resolvedFavicon,
            category: "basic",
        });
    }

    // 4. 見出しタグ <h1> の抽出
    const h1Regex = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
    let h1Match: RegExpExecArray | null;
    while ((h1Match = h1Regex.exec(html)) !== null) {
        // タグ内部のHTMLタグを文字単位走査で除去してプレーンテキスト化
        const plainText = stripHtmlTagsToPlainText(h1Match[1]).trim();
        if (plainText) {
            const decoded = decodeHtmlEntities(plainText);
            h1List.push(decoded);
            rawTags.push({
                key: `<h1> #${h1List.length}`,
                value: decoded,
                category: "structure",
            });
        }
    }

    // 5. 構造化データ <script type="application/ld+json"> の抽出と解析
    const jsonLdScripts = extractJsonLdRawScripts(html);
    for (const rawContent of jsonLdScripts) {
        const parsedResult = tryParseJsonLd(rawContent);
        if (parsedResult) {
            const { parsed, cleaned } = parsedResult;
            let type = "Schema";
            if (typeof parsed === "object" && parsed !== null) {
                if (parsed["@type"]) {
                    type = Array.isArray(parsed["@type"])
                        ? parsed["@type"].join(", ")
                        : String(parsed["@type"]);
                } else if (Array.isArray(parsed) && parsed[0]?.["@type"]) {
                    type = parsed.map((item) => item["@type"]).join(", ");
                } else if (parsed["@graph"] && Array.isArray(parsed["@graph"])) {
                    type = parsed["@graph"]
                        .map((item: any) => item["@type"])
                        .filter(Boolean)
                        .join(", ");
                }
            }
            jsonLdList.push({
                type,
                raw: cleaned,
                parsed,
                isValid: true,
            });
            rawTags.push({
                key: `JSON-LD (${type})`,
                value: cleaned.slice(0, 150) + (cleaned.length > 150 ? "..." : ""),
                category: "structure",
            });
        } else {
            jsonLdList.push({
                type: "Error",
                raw: rawContent,
                parsed: null,
                isValid: false,
                error: "JSON構文パースエラー",
            });
            rawTags.push({
                key: "JSON-LD (無効なJSON)",
                value: rawContent.slice(0, 150),
                category: "structure",
            });
        }
    }

    const resolvedOgImage = resolveUrl(ogImage, effectiveBaseUrl);

    return {
        pageTitle,
        metaDescription,
        canonicalUrl: resolvedCanonical,
        robots,
        googlebot,
        viewport,
        charset,
        keywords,
        author,
        faviconUrl: resolvedFavicon,
        themeColor,
        h1List,
        hreflangs,
        ogTitle,
        ogDescription,
        ogImage: resolvedOgImage,
        ogType,
        twitterCard,
        jsonLdList,
        rawTags,
    };
}

export function parseSeoFromMicrolink(
    payload: any,
    sourceUrl = "",
): SeoData | null {
    const data = payload?.data;
    if (!data || typeof data !== "object") return null;

    const title = typeof data.title === "string" ? data.title.trim() : "";
    const description =
        typeof data.description === "string" ? data.description.trim() : "";
    const url =
        typeof data.url === "string" && data.url.trim()
            ? data.url.trim()
            : sourceUrl;
    const rawCanonical =
        typeof data.canonical === "string" && data.canonical.trim()
            ? resolveUrl(data.canonical.trim(), url || sourceUrl)
            : url;
    const robots =
        typeof data.robots === "string" ? data.robots.trim() : "";
    const logoUrl =
        typeof data.logo?.url === "string" ? data.logo.url.trim() : "";
    const imageUrl =
        typeof data.image?.url === "string" ? data.image.url.trim() : "";
    const author =
        typeof data.author === "string" ? data.author.trim() : "";

    // H1の抽出（配列または文字列）
    const h1List: string[] = [];
    if (Array.isArray(data.h1)) {
        for (const item of data.h1) {
            if (typeof item === "string" && item.trim()) {
                h1List.push(item.trim());
            }
        }
    } else if (typeof data.h1 === "string" && data.h1.trim()) {
        h1List.push(data.h1.trim());
    }
    if (h1List.length === 0 && title) {
        h1List.push(title);
    }

    // JSON-LDの抽出（カスタムセレクタ配列または単一）
    const jsonLdList: JsonLdItem[] = [];
    const jsonLdStrings = extractJsonLdFromMicrolink(payload);

    if (!title && !description && jsonLdStrings.length === 0) {
        return null;
    }

    const rawTags: MetaTagItem[] = [];
    if (title) {
        rawTags.push({ key: "<title>", value: title, category: "basic" });
        rawTags.push({ key: "og:title", value: title, category: "social" });
    }
    if (description) {
        rawTags.push({
            key: "description",
            value: description,
            category: "basic",
        });
        rawTags.push({
            key: "og:description",
            value: description,
            category: "social",
        });
    }
    if (rawCanonical) {
        rawTags.push({
            key: 'link[rel="canonical"]',
            value: rawCanonical,
            category: "indexing",
        });
    }
    if (robots) {
        rawTags.push({
            key: "robots",
            value: robots,
            category: "indexing",
        });
    }
    if (logoUrl) {
        rawTags.push({
            key: 'link[rel="icon"]',
            value: logoUrl,
            category: "basic",
        });
    }
    if (imageUrl) {
        rawTags.push({ key: "og:image", value: imageUrl, category: "social" });
    }
    h1List.forEach((h1Text, idx) => {
        rawTags.push({
            key: `<h1> #${idx + 1}`,
            value: h1Text,
            category: "structure",
        });
    });

    for (const rawJsonLdStr of jsonLdStrings) {
        const parsedRes = tryParseJsonLd(rawJsonLdStr);
        if (parsedRes) {
            const { parsed: parsedObj, cleaned: rawStr } = parsedRes;
            let typeStr = "Schema";
            if (typeof parsedObj === "object" && parsedObj !== null) {
                if (parsedObj["@type"]) {
                    typeStr = Array.isArray(parsedObj["@type"])
                        ? parsedObj["@type"].join(", ")
                        : String(parsedObj["@type"]);
                } else if (Array.isArray(parsedObj) && parsedObj[0]?.["@type"]) {
                    typeStr = parsedObj.map((item: any) => item["@type"]).join(", ");
                } else if (parsedObj["@graph"] && Array.isArray(parsedObj["@graph"])) {
                    typeStr = parsedObj["@graph"]
                        .map((item: any) => item["@type"])
                        .filter(Boolean)
                        .join(", ");
                }
            }
            jsonLdList.push({
                type: typeStr,
                raw: rawStr,
                parsed: parsedObj,
                isValid: true,
            });
            rawTags.push({
                key: `JSON-LD (${typeStr})`,
                value: rawStr.slice(0, 150) + (rawStr.length > 150 ? "..." : ""),
                category: "structure",
            });
        } else {
            jsonLdList.push({
                type: "Error",
                raw: rawJsonLdStr,
                parsed: null,
                isValid: false,
                error: "JSON構文パースエラー",
            });
        }
    }

    return {
        pageTitle: title,
        metaDescription: description,
        canonicalUrl: rawCanonical,
        robots,
        googlebot: "",
        viewport: "width=device-width, initial-scale=1.0",
        charset: "utf-8",
        keywords: "",
        author,
        faviconUrl: logoUrl,
        themeColor: "",
        h1List,
        hreflangs: [],
        ogTitle: title,
        ogDescription: description,
        ogImage: imageUrl,
        ogType: "website",
        twitterCard: imageUrl ? "summary_large_image" : "summary",
        jsonLdList,
        rawTags,
    };
}

export function buildSeoDiagnostics(data: SeoData): DiagnosticItem[] {
    const items: DiagnosticItem[] = [];

    // 1. タイトル
    const titleLen = data.pageTitle.length;
    if (!data.pageTitle) {
        items.push({
            key: "title",
            label: "タイトル (<title>)",
            status: "error",
            value: "未設定",
            message: "タイトルタグが設定されていません。",
            advice: "Google検索結果で最も目立つ最重要タグです。ページの主題を表す25〜35文字程度のタイトルを設定してください。",
        });
    } else if (titleLen < 15) {
        items.push({
            key: "title",
            label: "タイトル (<title>)",
            status: "warn",
            value: `${titleLen}文字: ${data.pageTitle}`,
            message: `文字数が短めです（${titleLen}文字）。`,
            advice: "検索ユーザーにページ内容が伝わりやすくなるよう、主要キーワードを含めて25〜35文字程度に拡充することを推奨します。",
        });
    } else if (titleLen > 40) {
        items.push({
            key: "title",
            label: "タイトル (<title>)",
            status: "warn",
            value: `${titleLen}文字: ${data.pageTitle}`,
            message: `文字数が多めです（${titleLen}文字）。検索結果で末尾が「...」と省略される可能性があります。`,
            advice: "Google検索結果一覧で綺麗に収まるよう、重要なキーワードを前方に配置し、30〜35文字前後に収めるのが理想的です。",
        });
    } else {
        items.push({
            key: "title",
            label: "タイトル (<title>)",
            status: "ok",
            value: `${titleLen}文字: ${data.pageTitle}`,
            message: `適切な長さです（${titleLen}文字）。Google検索結果で省略されにくい最適な範囲です。`,
            advice: "検索キーワードとクリック意欲をそそる魅力的なコピーが含まれているか確認しましょう。",
        });
    }

    // 2. メタディスクリプション
    const descLen = data.metaDescription.length;
    if (!data.metaDescription) {
        items.push({
            key: "description",
            label: "説明文 (meta description)",
            status: "warn",
            value: "未設定",
            message: "メタディスクリプションが設定されていません。",
            advice: "未設定の場合、Googleが本文から自動抜粋してスニペットを生成しますが、CTR向上のため80〜120文字程度の要約文を設定することを推奨します。",
        });
    } else if (descLen < 50) {
        items.push({
            key: "description",
            label: "説明文 (meta description)",
            status: "warn",
            value: `${descLen}文字: ${data.metaDescription}`,
            message: `文字数がやや短いです（${descLen}文字）。`,
            advice: "検索ユーザーに対してページの訴求点や価値を十分に伝えるため、80〜120文字程度（全角）で具体的に記述することを推奨します。",
        });
    } else if (descLen > 130) {
        items.push({
            key: "description",
            label: "説明文 (meta description)",
            status: "warn",
            value: `${descLen}文字: ${data.metaDescription}`,
            message: `文字数が多めです（${descLen}文字）。モバイルや一部端末で後半が省略されます。`,
            advice: "重要な訴求ポイントは先頭80文字前後にまとめ、全体を100〜120文字程度に収めるのが好ましいです。",
        });
    } else {
        items.push({
            key: "description",
            label: "説明文 (meta description)",
            status: "ok",
            value: `${descLen}文字: ${data.metaDescription}`,
            message: `適切な文字数です（${descLen}文字）。Google検索結果スニペットに最適です。`,
            advice: "本文の要約と読者の検索意図を満たす解決策が端的に書かれているか確認してください。",
        });
    }

    // 3. 正規URL (canonical)
    if (!data.canonicalUrl) {
        items.push({
            key: "canonical",
            label: "正規URL (link rel=canonical)",
            status: "warn",
            value: "未設定",
            message: "canonicalタグが未指定です。",
            advice: "URLパラメータ（utmパラメータ等）やhttps/httpの違いによる重複コンテンツ判定を防ぐため、ページの正規URLを絶対パスで明示することを推奨します。",
        });
    } else if (!/^https?:\/\//i.test(data.canonicalUrl)) {
        items.push({
            key: "canonical",
            label: "正規URL (link rel=canonical)",
            status: "warn",
            value: data.canonicalUrl,
            message: "canonicalが相対パスになっています。",
            advice: "検索エンジンが確実に解釈できるよう、https:// から始まる完全な絶対URLで記述してください。",
        });
    } else {
        items.push({
            key: "canonical",
            label: "正規URL (link rel=canonical)",
            status: "ok",
            value: data.canonicalUrl,
            message: "正規URLが完全な絶対パスで指定されています。",
            advice: "URL正規化が正しく機能しています。",
        });
    }

    // 4. Robots / インデックス制御
    const robotsLower = (data.robots || "").toLowerCase();
    const googlebotLower = (data.googlebot || "").toLowerCase();
    const hasNoIndex =
        robotsLower.includes("noindex") || googlebotLower.includes("noindex");
    const hasNoFollow =
        robotsLower.includes("nofollow") || googlebotLower.includes("nofollow");

    if (hasNoIndex) {
        items.push({
            key: "robots",
            label: "検索インデックス (robots)",
            status: "error",
            value: data.robots || data.googlebot,
            message: "「noindex」が指定されています。検索結果に表示されません。",
            advice: "本番公開ページでGoogle等の検索エンジンにヒットさせたい場合、noindexタグを削除してください（非公開ページやテスト環境なら正常です）。",
        });
    } else if (hasNoFollow) {
        items.push({
            key: "robots",
            label: "検索インデックス (robots)",
            status: "warn",
            value: data.robots || data.googlebot,
            message: "「nofollow」が指定されています。ページ内リンクがクロールされません。",
            advice: "サイト全体のクロール巡回を促進したい場合は、通常の index, follow 設定を検討してください。",
        });
    } else if (data.robots || data.googlebot) {
        items.push({
            key: "robots",
            label: "検索インデックス (robots)",
            status: "ok",
            value: data.robots || data.googlebot,
            message: `インデックス許可設定（${data.robots || data.googlebot}）が検出されました。`,
            advice: "検索エンジンによる正常なインデックスおよびリンク巡回が許可されています。",
        });
    } else {
        items.push({
            key: "robots",
            label: "検索インデックス (robots)",
            status: "ok",
            value: "デフォルト（index, follow）",
            message: "robotsメタタグなし（検索エンジンはデフォルトで index, follow として扱います）。",
            advice: "明示的にインデックスを制限する必要がない限り、このままで検索エンジンに正常収集されます。",
        });
    }

    // 5. Viewport (モバイルフレンドリー)
    if (!data.viewport) {
        items.push({
            key: "viewport",
            label: "モバイル対応 (viewport)",
            status: "error",
            value: "未設定",
            message: "viewportタグが設定されていません。",
            advice: "モバイル端末での表示が最適化されず、Googleのモバイルファーストインデックスで大幅に順位を下げる原因になります。<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"> を追加してください。",
        });
    } else if (data.viewport.includes("width=device-width")) {
        items.push({
            key: "viewport",
            label: "モバイル対応 (viewport)",
            status: "ok",
            value: data.viewport,
            message: "モバイル対応のviewportが適切に指定されています。",
            advice: "スマートフォンユーザーに対してレスポンシブに表示される設定です。",
        });
    } else {
        items.push({
            key: "viewport",
            label: "モバイル対応 (viewport)",
            status: "warn",
            value: data.viewport,
            message: "viewport設定を確認してください。",
            advice: "通常は width=device-width, initial-scale=1.0 の指定が推奨されます。",
        });
    }

    // 6. 文字コード (charset)
    if (!data.charset) {
        items.push({
            key: "charset",
            label: "文字コード (charset)",
            status: "warn",
            value: "未設定",
            message: "文字コード宣言が見つかりません。",
            advice: "文字化けや検索クローラーの文字誤認を防ぐため、<head>内の先頭付近に <meta charset=\"utf-8\"> を配置してください。",
        });
    } else if (/utf-?8/i.test(data.charset)) {
        items.push({
            key: "charset",
            label: "文字コード (charset)",
            status: "ok",
            value: data.charset,
            message: "UTF-8が正しく宣言されています。",
            advice: "標準的な多言語対応エンコーディングです。",
        });
    } else {
        items.push({
            key: "charset",
            label: "文字コード (charset)",
            status: "warn",
            value: data.charset,
            message: `「${data.charset}」が指定されています。`,
            advice: "現代のWeb標準およびSEOでは UTF-8 の利用が強く推奨されます。",
        });
    }

    // 7. H1タグ
    const h1Count = data.h1List.length;
    if (h1Count === 0) {
        items.push({
            key: "h1",
            label: "大見出し (<h1>)",
            status: "warn",
            value: "0件（見出しなし）",
            message: "ページ内にH1タグが検出されませんでした。",
            advice: "H1タグはページの最重要見出しとして検索エンジンに主題を伝える役割があります。ページごとに1つ設定することを推奨します。",
        });
    } else if (h1Count === 1) {
        items.push({
            key: "h1",
            label: "大見出し (<h1>)",
            status: "ok",
            value: `1件: ${data.h1List[0]}`,
            message: "適切な個数（1個）の大見出しH1タグが配置されています。",
            advice: "タイトルと連動した重要キーワードが含まれているか確認しましょう。",
        });
    } else {
        items.push({
            key: "h1",
            label: "大見出し (<h1>)",
            status: "warn",
            value: `${h1Count}件検出`,
            message: `H1タグが複数（${h1Count}個）配置されています。`,
            advice: "HTML5では文法上複数配置も可能ですが、検索エンジンにページの最重要テーマを明確に伝えるため、H1は1ページにつき1個に統一することがベストプラクティスです。",
        });
    }

    // 8. 構造化データ (JSON-LD)
    if (data.jsonLdList.length === 0) {
        items.push({
            key: "json-ld",
            label: "構造化データ (JSON-LD)",
            status: "missing",
            value: "未検出",
            message: "JSON-LD構造化データが埋め込まれていません。",
            advice: "Schema.org（Article, Organization, WebSite, BreadcrumbList, FAQ等）を記述することで、Google検索結果のリッチリザルト表示や正確なエンティティ理解を促進できます。",
        });
    } else {
        const hasError = data.jsonLdList.some((j) => !j.isValid);
        if (hasError) {
            items.push({
                key: "json-ld",
                label: "構造化データ (JSON-LD)",
                status: "error",
                value: "構文エラーあり",
                message: "JSON-LDスクリプト内に構文エラー（Syntax Error）が検出されました。",
                advice: "無効なJSONは検索エンジンに無視されます。カンマやクォーテーションのミスを修正してください。",
            });
        } else {
            const types = data.jsonLdList.map((j) => j.type).join(", ");
            items.push({
                key: "json-ld",
                label: "構造化データ (JSON-LD)",
                status: "ok",
                value: `${data.jsonLdList.length}件検出: ${types}`,
                message: "構文が有効なJSON-LD構造化データが検出されました。",
                advice: "Schema.orgの仕様に沿って適切なプロパティが網羅されているか確認しましょう。",
            });
        }
    }

    // 9. ソーシャル連携（OGP / Twitter Card）
    if (data.ogTitle && data.ogImage) {
        items.push({
            key: "social-ogp",
            label: "ソーシャル連携 (OGP)",
            status: "ok",
            value: `og:title, og:image 設定済み (${data.twitterCard || "twitter card未指定"})`,
            message: "OGPメタタグが適切に設定されています。",
            advice: "SNSでのシェアや外部被リンク経由のトラフィック獲得に寄与します。",
        });
    } else if (data.ogTitle || data.ogImage || data.twitterCard) {
        items.push({
            key: "social-ogp",
            label: "ソーシャル連携 (OGP)",
            status: "warn",
            value: "一部のみ設定",
            message: "OGPタイトルまたは画像が一部不足しています。",
            advice: "SNS共有時のリッチカード表示を確実にするため、og:title, og:description, og:image, og:url を一通り指定しましょう。",
        });
    } else {
        items.push({
            key: "social-ogp",
            label: "ソーシャル連携 (OGP)",
            status: "warn",
            value: "未設定",
            message: "OGPやTwitterカードタグが設定されていません。",
            advice: "直接の検索順位要因ではありませんが、SNS拡散・サイテーション向上のためOGPの設定が推奨されます。",
        });
    }

    // 10. ファビコン (Favicon)
    if (data.faviconUrl) {
        items.push({
            key: "favicon",
            label: "ファビコン (favicon)",
            status: "ok",
            value: data.faviconUrl,
            message: "ファビコンが指定されています。",
            advice: "現在のGoogle検索結果ではモバイル・PCともにタイトルの左側にファビコンが表示されるため、視認性とブランディングに効果的です。",
        });
    } else {
        items.push({
            key: "favicon",
            label: "ファビコン (favicon)",
            status: "warn",
            value: "未設定",
            message: "ファビコンが見つかりません。",
            advice: "Google検索結果でブランドアイコンを表示させるため、48×48px以上のファビコンを設定することを推奨します。",
        });
    }

    return items;
}

export function calculateSeoScore(diagnostics: DiagnosticItem[]): {
    score: number;
    passedCount: number;
    warnCount: number;
    errorCount: number;
    totalCount: number;
    rating: string;
} {
    if (!diagnostics || diagnostics.length === 0) {
        return {
            score: 0,
            passedCount: 0,
            warnCount: 0,
            errorCount: 0,
            totalCount: 0,
            rating: "-",
        };
    }

    let ok = 0;
    let warn = 0;
    let error = 0;

    for (const d of diagnostics) {
        if (d.status === "ok") ok++;
        else if (d.status === "warn") warn++;
        else error++;
    }

    // スコア計算: OKは10点、Warnは5点、Error/Missingは0点
    const maxScore = diagnostics.length * 10;
    const rawScore = ok * 10 + warn * 5;
    const score = Math.round((rawScore / maxScore) * 100);

    let rating = "C";
    if (score >= 90) rating = "S";
    else if (score >= 80) rating = "A";
    else if (score >= 65) rating = "B";

    return {
        score,
        passedCount: ok,
        warnCount: warn,
        errorCount: error,
        totalCount: diagnostics.length,
        rating,
    };
}

export default function SeoChecker() {
    let containerRef: HTMLDivElement | undefined;
    let actionButtonRef: HTMLButtonElement | undefined;

    const [inputMode, setInputMode] = createSignal<"url" | "html">("url");
    const [urlInput, setUrlInput] = createSignal("");
    const [htmlInput, setHtmlInput] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal("");
    const [seoData, setSeoData] = createSignal<SeoData | null>(null);
    const [serpViewMode, setSerpViewMode] = createSignal<"desktop" | "mobile">(
        "desktop",
    );
    const [tagFilter, setTagFilter] = createSignal<
        "all" | "basic" | "indexing" | "structure" | "social"
    >("all");
    const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
    const [allCopied, setAllCopied] = createSignal(false);

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
    });

    const enrichDevSameOriginSeo = (
        parsed: SeoData,
        html: string,
        targetUrl: string,
    ): SeoData => {
        if (parsed.pageTitle || !html.includes("/src/index.tsx")) {
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
                robots: "index, follow",
                viewport: "width=device-width, initial-scale=1.0",
                charset: "utf-8",
                ogTitle: meta.title,
                ogDescription: meta.description,
                ogType: "website",
                h1List: [meta.title],
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
                        category: "indexing",
                    },
                    {
                        key: "robots",
                        value: "index, follow",
                        category: "indexing",
                    },
                    {
                        key: "viewport",
                        value: "width=device-width, initial-scale=1.0",
                        category: "basic",
                    },
                    { key: "charset", value: "utf-8", category: "basic" },
                ],
            };
        } catch {
            return parsed;
        }
    };

    const fetchSeoDataFromUrl = async (targetUrl: string): Promise<SeoData> => {
        try {
            const result = await fetchPageSource(targetUrl, {
                preferHtml: true,
                requireJsonLd: true,
            });
            if (result.kind === "html") {
                const parsed = parseSeoFromHtml(result.html, result.finalUrl);
                if (result.source === "direct") {
                    return enrichDevSameOriginSeo(parsed, result.html, result.finalUrl);
                }
                return parsed;
            }
            const parsed = parseSeoFromMicrolink(result.payload, targetUrl);
            if (!parsed) {
                throw new Error(
                    "SEO情報が見つかりませんでした。「HTML直接入力 / ファイル読込」タブからHTMLソースを直接貼り付けてお試しください。",
                );
            }
            return parsed;
        } catch (err: any) {
            throw new Error(
                err?.message ||
                    "ページの取得に失敗しました。対象サイトにアクセス制限がある場合は、「HTML直接入力 / ファイル読込」タブをご利用ください。",
            );
        }
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

        try {
            const parsed = await fetchSeoDataFromUrl(normalized);
            setSeoData(parsed);
            setUrlInput(normalized);
        } catch (err: any) {
            setError(
                err?.message ||
                    "SEO情報の取得中にエラーが発生しました。「HTML直接入力 / ファイル読込」をお試しください。",
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
        const parsed = parseSeoFromHtml(raw, normalizeInputUrl(urlInput()));
        setSeoData(parsed);
    };

    const handleHtmlFileUpload = async (e: Event) => {
        const target = e.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        try {
            const content = await file.text();
            setHtmlInput(content);
            setError("");
            const parsed = parseSeoFromHtml(
                content,
                normalizeInputUrl(urlInput()),
            );
            setSeoData(parsed);
        } catch {
            setError("HTMLファイルの読み込みに失敗しました。");
        } finally {
            target.value = "";
        }
    };

    const loadSample = () => {
        setError("");
        setInputMode("html");
        setHtmlInput(SAMPLE_HTML);
        const parsed = parseSeoFromHtml(
            SAMPLE_HTML,
            "https://tools.blossomsarchive.com/seo-checker",
        );
        setSeoData(parsed);
    };

    const diagnostics = createMemo(() => {
        const data = seoData();
        return data ? buildSeoDiagnostics(data) : [];
    });

    const scoreData = createMemo(() => {
        return calculateSeoScore(diagnostics());
    });

    const displayDomain = createMemo(() => {
        const data = seoData();
        const candidate =
            data?.canonicalUrl ||
            data?.ogTitle ||
            normalizeInputUrl(urlInput());
        if (!candidate) return "example.com";
        try {
            return new URL(candidate).hostname;
        } catch {
            return candidate;
        }
    });

    const displayBreadcrumb = createMemo(() => {
        const data = seoData();
        const candidate = data?.canonicalUrl || normalizeInputUrl(urlInput());
        if (!candidate) return "https://example.com";
        try {
            const u = new URL(candidate);
            const pathParts = u.pathname.split("/").filter(Boolean);
            if (pathParts.length === 0) return u.origin;
            return `${u.origin} › ${pathParts.join(" › ")}`;
        } catch {
            return candidate;
        }
    });

    const filteredTags = createMemo(() => {
        const data = seoData();
        if (!data) return [];
        const filter = tagFilter();
        if (filter === "all") return data.rawTags;
        return data.rawTags.filter((t) => t.category === filter);
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
        const data = seoData();
        if (!data) return;

        const diag = diagnostics();
        const score = scoreData();

        const lines = [
            "【メタタグ(SEO)解析レポート】",
            `総合SEO健全度スコア: ${score.score}点 / 100点 (評価: ${score.rating})`,
            `Title: ${data.pageTitle || "未設定"} (${data.pageTitle.length}文字)`,
            `Meta Description: ${data.metaDescription || "未設定"} (${data.metaDescription.length}文字)`,
            `Canonical: ${data.canonicalUrl || "未設定"}`,
            `Robots: ${data.robots || "未設定 (デフォルト: index, follow)"}`,
            `Viewport: ${data.viewport || "未設定"}`,
            `Charset: ${data.charset || "未設定"}`,
            `H1見出し数: ${data.h1List.length}個 (${data.h1List.join(" / ") || "なし"})`,
            `構造化データ(JSON-LD): ${data.jsonLdList.length}件 (${data.jsonLdList.map((j) => j.type).join(", ") || "なし"})`,
            `Favicon: ${data.faviconUrl || "未設定"}`,
            "",
            "【SEOチェック診断結果】",
            ...diag.map(
                (d) =>
                    `[${d.status.toUpperCase()}] ${d.label}: ${d.value} -> ${d.message}`,
            ),
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
                    良好
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
        if (status === "error") {
            return (
                <span class="ba-badge ba-badge--danger">
                    要修正
                </span>
            );
        }
        return (
            <span class="ba-badge ba-badge--neutral">
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
                            <BudouX text="メタタグ(SEO)確認ツール" />
                        </h1>
                        <BudouX
                            as="p"
                            class="ba-text-xs ba-text-muted"
                            style={{ "margin-top": "0.5rem", "margin-bottom": 0, "line-height": 1.6, "font-weight": 600 }}
                            text="WebページのURLまたはHTMLソースコードからtitle、meta description、canonical、robots、JSON-LD構造化データ等のSEO重要タグを解析・診断。Google検索結果スニペットのPC・スマホ表示をリアルタイムにプレビュー確認できます。"
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
                            toolname: "analyze_seo_url",
                            tooldescription:
                                "指定したURLのWebページからSEOメタタグとJSON-LD構造化データを解析・診断します",
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
                                "SEOメタタグを解析"
                            )}
                        </button>
                    </form>
                </Show>

                {/* HTML直接入力・ファイル読込フォーム */}
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
                                placeholder={'<title>ページタイトル</title>\n<meta name="description" content="ページの説明文" />\n<link rel="canonical" href="https://example.com" />'}
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
                                    setSeoData(null);
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
                <Show when={!seoData() && !loading()}>
                    <div
                        class="ba-dropzone ba-flex-col ba-items-center ba-gap-3"
                        style={{ cursor: "default", padding: "2rem" }}
                    >
                        <div class="ba-flex ba-justify-center ba-text-muted">
                            <ToolIcon name="search" class="ba-icon-xl" />
                        </div>
                        <p class="ba-text-sm ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                            URLを入力して「SEOメタタグを解析」を押すか、HTMLソースコード・HTMLファイルを読み込んでください。
                        </p>
                        <p
                            class="ba-text-xs ba-text-muted"
                            style={{ "max-width": "36rem", "line-height": 1.6, margin: 0 }}
                        >
                            ローカル制作中のHTMLや公開前のWebページも「HTML直接入力 / ファイル読込」から完全オフライン（ブラウザ内完結）でGoogle検索スニペットプレビューとSEO診断を安全に実行できます。
                        </p>
                    </div>
                </Show>

                {/* 解析結果エリア */}
                <Show when={seoData() && !loading()}>
                    <div
                        class="ba-stack-6"
                        style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "1.75rem" }}
                    >
                        {/* 1. 総合スコア概要カード */}
                        <div
                            class="ba-panel ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-4"
                            style={{ padding: "1.5rem" }}
                        >
                            <div class="ba-flex ba-items-center ba-gap-4">
                                <div
                                    style={{
                                        width: "5rem",
                                        height: "5rem",
                                        "border-radius": "9999px",
                                        display: "flex",
                                        "align-items": "center",
                                        "justify-content": "center",
                                        background: `conic-gradient(var(--ba-primary) ${scoreData().score}%, var(--ba-surface-3) 0)`,
                                        "flex-shrink": 0,
                                    }}
                                >
                                    <div
                                        class="ba-font-black ba-text-lg ba-text-primary"
                                        style={{
                                            width: "4.1rem",
                                            height: "4.1rem",
                                            "border-radius": "9999px",
                                            "background-color": "var(--ba-surface)",
                                            display: "flex",
                                            "align-items": "center",
                                            "justify-content": "center",
                                        }}
                                    >
                                        {scoreData().score}点
                                    </div>
                                </div>
                                <div>
                                    <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap">
                                        <span class="ba-text-lg ba-font-black">
                                            SEO健全度スコア
                                        </span>
                                        <span class="ba-badge ba-badge--primary">
                                            ランク {scoreData().rating}
                                        </span>
                                    </div>
                                    <p class="ba-text-xs ba-text-muted" style={{ "margin-top": "0.25rem", "margin-bottom": 0 }}>
                                        全{scoreData().totalCount}項目のうち {scoreData().passedCount}項目が良好、{scoreData().warnCount}項目が要確認、{scoreData().errorCount}項目が要修正
                                    </p>
                                </div>
                            </div>
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
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
                                        ? "レポートをコピー完了！"
                                        : "SEO診断レポートを全コピー"}
                                </button>
                            </div>
                        </div>

                        {/* 2. Google検索結果（SERP）プレビュー */}
                        <div class="ba-stack-4">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3">
                                <div>
                                    <h2 class="ba-section-title">
                                        Google検索結果プレビュー (SERP Preview)
                                    </h2>
                                    <p class="ba-text-xs ba-text-muted" style={{ "margin-top": "0.15rem", "margin-bottom": 0 }}>
                                        Google等の検索結果一覧でどのように表示されるかをシミュレーションします
                                    </p>
                                </div>
                                {/* デスクトップ / モバイル切り替え */}
                                <div class="ba-tabs" style={{ padding: "0.2rem" }}>
                                    <button
                                        type="button"
                                        onClick={() => setSerpViewMode("desktop")}
                                        class={`ba-tab ${serpViewMode() === "desktop" ? "is-active" : ""}`}
                                        style={{ padding: "0.25rem 0.65rem", "font-size": "0.75rem" }}
                                    >
                                        デスクトップ (PC)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSerpViewMode("mobile")}
                                        class={`ba-tab ${serpViewMode() === "mobile" ? "is-active" : ""}`}
                                        style={{ padding: "0.25rem 0.65rem", "font-size": "0.75rem" }}
                                    >
                                        モバイル (スマホ)
                                    </button>
                                </div>
                            </div>

                            {/* プレビューコンテナ */}
                            <div class="ba-panel ba-flex-col ba-items-center" style={{ padding: "1.25rem" }}>
                                <Show
                                    when={serpViewMode() === "desktop"}
                                    fallback={
                                        /* モバイル表示 */
                                        <div
                                            class="ba-w-full ba-stack-1"
                                            style={{
                                                "max-width": "28rem",
                                                "background-color": "#ffffff",
                                                color: "#202124",
                                                "border-radius": "1rem",
                                                padding: "1rem",
                                                "box-shadow": "var(--ba-shadow-sm)",
                                                border: "1px solid #e5e7eb",
                                                "font-family": "var(--ba-font-sans)",
                                            }}
                                        >
                                            {/* 上部: ファビコン・サイト名・URL */}
                                            <div class="ba-flex ba-items-center ba-gap-2">
                                                <div
                                                    class="ba-shrink-0 ba-flex ba-items-center ba-justify-center"
                                                    style={{
                                                        width: "1.5rem",
                                                        height: "1.5rem",
                                                        "border-radius": "9999px",
                                                        "background-color": "#f3f4f6",
                                                        color: "#64748b",
                                                        overflow: "hidden",
                                                        border: "1px solid #e5e7eb",
                                                    }}
                                                >
                                                    <Show
                                                        when={seoData()?.faviconUrl}
                                                        fallback={<ToolIcon name="globe" class="ba-icon-xs" />}
                                                    >
                                                        <img
                                                            src={seoData()?.faviconUrl}
                                                            alt="Favicon"
                                                            style={{ width: "1rem", height: "1rem", "object-fit": "contain" }}
                                                            onError={(e) => {
                                                                (e.currentTarget as HTMLElement).style.display = "none";
                                                            }}
                                                        />
                                                    </Show>
                                                </div>
                                                <div class="ba-flex-col ba-min-w-0">
                                                    <span class="ba-text-xs ba-truncate" style={{ "font-weight": 500, color: "#202124" }}>
                                                        {seoData()?.ogTitle ? seoData()?.pageTitle.split(/[-|_]/)[1]?.trim() || displayDomain() : displayDomain()}
                                                    </span>
                                                    <span class="ba-truncate" style={{ "font-size": "0.6875rem", color: "#4d5156" }}>
                                                        {displayBreadcrumb()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* タイトル */}
                                            <h3
                                                class="ba-text-base"
                                                style={{
                                                    color: "#1a0dab",
                                                    "font-weight": 500,
                                                    "line-height": 1.35,
                                                    "margin-top": "0.25rem",
                                                    "margin-bottom": 0,
                                                    cursor: "pointer",
                                                    "word-break": "break-word",
                                                    display: "-webkit-box",
                                                    "-webkit-line-clamp": 2,
                                                    "-webkit-box-orient": "vertical",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {seoData()?.pageTitle || "（タイトル未設定）"}
                                            </h3>

                                            {/* 説明文 */}
                                            <p
                                                class="ba-text-xs"
                                                style={{
                                                    color: "#4d5156",
                                                    "line-height": 1.6,
                                                    "margin-top": "0.15rem",
                                                    "margin-bottom": 0,
                                                    "word-break": "break-word",
                                                    display: "-webkit-box",
                                                    "-webkit-line-clamp": 3,
                                                    "-webkit-box-orient": "vertical",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {seoData()?.metaDescription || "（メタディスクリプション未設定：検索エンジンがページ本文から自動的にスニペットを抽出します）"}
                                            </p>
                                        </div>
                                    }
                                >
                                    {/* デスクトップ表示 */}
                                    <div
                                        class="ba-w-full ba-stack-1"
                                        style={{
                                            "max-width": "42rem",
                                            "background-color": "#ffffff",
                                            color: "#202124",
                                            "border-radius": "1rem",
                                            padding: "1.25rem",
                                            "box-shadow": "var(--ba-shadow-sm)",
                                            border: "1px solid #e5e7eb",
                                            "font-family": "var(--ba-font-sans)",
                                        }}
                                    >
                                        {/* 上部: ファビコン・サイト名・URL */}
                                        <div class="ba-flex ba-items-center ba-gap-2">
                                            <div
                                                class="ba-shrink-0 ba-flex ba-items-center ba-justify-center"
                                                style={{
                                                    width: "1.5rem",
                                                    height: "1.5rem",
                                                    "border-radius": "9999px",
                                                    "background-color": "#f3f4f6",
                                                    color: "#64748b",
                                                    overflow: "hidden",
                                                    border: "1px solid #e5e7eb",
                                                }}
                                            >
                                                <Show
                                                    when={seoData()?.faviconUrl}
                                                    fallback={<ToolIcon name="globe" class="ba-icon-xs" />}
                                                >
                                                    <img
                                                        src={seoData()?.faviconUrl}
                                                        alt="Favicon"
                                                        style={{ width: "1rem", height: "1rem", "object-fit": "contain" }}
                                                        onError={(e) => {
                                                            (e.currentTarget as HTMLElement).style.display = "none";
                                                        }}
                                                    />
                                                </Show>
                                            </div>
                                            <div class="ba-flex-col ba-min-w-0" style={{ "line-height": 1.3 }}>
                                                <span class="ba-text-sm ba-truncate" style={{ color: "#202124", "font-weight": 500 }}>
                                                    {displayDomain()}
                                                </span>
                                                <span class="ba-text-xs ba-truncate" style={{ color: "#4d5156" }}>
                                                    {displayBreadcrumb()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* タイトルリンク */}
                                        <h3
                                            class="ba-text-xl"
                                            style={{
                                                color: "#1a0dab",
                                                "font-weight": 400,
                                                "line-height": 1.4,
                                                "margin-top": "0.25rem",
                                                "margin-bottom": 0,
                                                cursor: "pointer",
                                                "word-break": "break-word",
                                                display: "-webkit-box",
                                                "-webkit-line-clamp": 1,
                                                "-webkit-box-orient": "vertical",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {seoData()?.pageTitle || "（タイトル未設定）"}
                                        </h3>

                                        {/* 説明文スニペット */}
                                        <p
                                            class="ba-text-sm"
                                            style={{
                                                color: "#4d5156",
                                                "line-height": 1.6,
                                                margin: 0,
                                                "word-break": "break-word",
                                                display: "-webkit-box",
                                                "-webkit-line-clamp": 2,
                                                "-webkit-box-orient": "vertical",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {seoData()?.metaDescription || "（メタディスクリプション未設定：検索エンジンがページ本文から自動的にスニペットを抽出します）"}
                                        </p>
                                    </div>
                                </Show>

                                {/* 文字数ゲージバー */}
                                <div
                                    class="ba-w-full ba-grid-2"
                                    style={{
                                        "max-width": "42rem",
                                        "margin-top": "1.25rem",
                                        "padding-top": "1rem",
                                        "border-top": "1px solid var(--ba-border)",
                                    }}
                                >
                                    <div
                                        class="ba-stack-2"
                                        style={{
                                            "background-color": "var(--ba-surface)",
                                            padding: "0.875rem",
                                            "border-radius": "var(--ba-radius)",
                                            border: "1px solid var(--ba-border)",
                                        }}
                                    >
                                        <div class="ba-flex ba-items-center ba-justify-between ba-text-xs">
                                            <span class="ba-font-bold ba-text-muted">
                                                タイトル文字数
                                            </span>
                                            <span
                                                class={`ba-mono ba-font-bold ${
                                                    (seoData()?.pageTitle.length ?? 0) >= 25 && (seoData()?.pageTitle.length ?? 0) <= 35
                                                        ? "ba-text-success"
                                                        : (seoData()?.pageTitle.length ?? 0) > 40
                                                          ? "ba-text-warning"
                                                          : "ba-text-muted"
                                                }`}
                                            >
                                                {seoData()?.pageTitle.length ?? 0}文字 / 推奨 25〜35文字
                                            </span>
                                        </div>
                                        <progress
                                            class="ba-progress"
                                            value={Math.min(seoData()?.pageTitle.length ?? 0, 50)}
                                            max="50"
                                        ></progress>
                                    </div>

                                    <div
                                        class="ba-stack-2"
                                        style={{
                                            "background-color": "var(--ba-surface)",
                                            padding: "0.875rem",
                                            "border-radius": "var(--ba-radius)",
                                            border: "1px solid var(--ba-border)",
                                        }}
                                    >
                                        <div class="ba-flex ba-items-center ba-justify-between ba-text-xs">
                                            <span class="ba-font-bold ba-text-muted">
                                                説明文文字数
                                            </span>
                                            <span
                                                class={`ba-mono ba-font-bold ${
                                                    (seoData()?.metaDescription.length ?? 0) >= 70 && (seoData()?.metaDescription.length ?? 0) <= 120
                                                        ? "ba-text-success"
                                                        : (seoData()?.metaDescription.length ?? 0) > 130
                                                          ? "ba-text-warning"
                                                          : "ba-text-muted"
                                                }`}
                                            >
                                                {seoData()?.metaDescription.length ?? 0}文字 / 推奨 80〜120文字
                                            </span>
                                        </div>
                                        <progress
                                            class="ba-progress"
                                            value={Math.min(seoData()?.metaDescription.length ?? 0, 160)}
                                            max="160"
                                        ></progress>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. SEO設定診断チェックリスト */}
                        <div class="ba-stack-3">
                            <h2 class="ba-section-title">
                                SEO重要項目診断チェック
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
                                            class="ba-flex ba-flex-wrap ba-items-start ba-justify-between ba-gap-3"
                                            style={{
                                                padding: "1rem",
                                                "border-bottom": "1px solid var(--ba-border)",
                                            }}
                                        >
                                            <div
                                                class="ba-flex ba-items-center ba-gap-3 ba-shrink-0"
                                                style={{ "min-width": "14rem" }}
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
                                                <p class="ba-text-muted" style={{ "font-size": "0.6875rem", "font-weight": 500, margin: 0 }}>
                                                    {item.message}
                                                </p>
                                                <p
                                                    style={{
                                                        "font-size": "0.6875rem",
                                                        color: "var(--ba-primary-soft-fg)",
                                                        "background-color": "var(--ba-primary-soft)",
                                                        padding: "0.5rem",
                                                        "border-radius": "var(--ba-radius-sm)",
                                                        "line-height": 1.5,
                                                        "margin-top": "0.25rem",
                                                        "margin-bottom": 0,
                                                    }}
                                                >
                                                    改善ヒント: {item.advice}
                                                </p>
                                            </div>
                                            <div class="ba-shrink-0">
                                                <button
                                                    type="button"
                                                    disabled={item.value === "未設定" || item.value === "未検出"}
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

                        {/* 4. 構造化データ（JSON-LD）プレビュー */}
                        <Show when={(seoData()?.jsonLdList.length ?? 0) > 0}>
                            <div class="ba-stack-4">
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                    <h2 class="ba-section-title">
                                        検出された構造化データ (JSON-LD: {seoData()?.jsonLdList.length}件)
                                    </h2>
                                    <a
                                        href={
                                            urlInput().trim()
                                                ? `/json-ld-viewer?url=${encodeURIComponent(normalizeInputUrl(urlInput()))}`
                                                : "/json-ld-viewer"
                                        }
                                        class="ba-btn ba-btn--xs ba-btn--outline ba-text-primary"
                                        style={{ "border-color": "var(--ba-primary)" }}
                                        title="JSON-LD構造可視化・検証ツールでツリー構造やSchema.org診断を確認"
                                    >
                                        JSON-LDツリー可視化ツールで開く ↗
                                    </a>
                                </div>
                                <div class="ba-stack-4">
                                    <For each={seoData()?.jsonLdList}>
                                        {(jsonItem, idx) => (
                                            <div class="ba-card ba-stack-3">
                                                <div class="ba-flex ba-items-center ba-justify-between ba-flex-wrap ba-gap-2">
                                                    <div class="ba-flex ba-items-center ba-gap-2">
                                                        <span class={`ba-badge ${jsonItem.isValid ? "ba-badge--success" : "ba-badge--danger"}`}>
                                                            {jsonItem.isValid ? "有効 (Valid)" : "エラー"}
                                                        </span>
                                                        <span class="ba-font-bold ba-text-sm">
                                                            Type: {jsonItem.type}
                                                        </span>
                                                    </div>
                                                    <div class="ba-flex ba-items-center ba-gap-2">
                                                        <a
                                                            href={
                                                                urlInput().trim()
                                                                    ? `/json-ld-viewer?url=${encodeURIComponent(normalizeInputUrl(urlInput()))}`
                                                                    : "/json-ld-viewer"
                                                            }
                                                            class="ba-btn ba-btn--xs ba-btn--ghost ba-text-primary ba-underline"
                                                        >
                                                            ツリー表示 ↗
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyText(jsonItem.raw, `jsonld-${idx()}`)}
                                                            class={`ba-btn ba-btn--xs ${
                                                                copiedKey() === `jsonld-${idx()}`
                                                                    ? "ba-btn--success"
                                                                    : "ba-btn--secondary"
                                                            }`}
                                                        >
                                                            {copiedKey() === `jsonld-${idx()}` ? "コピー完了" : "JSONをコピー"}
                                                        </button>
                                                    </div>
                                                </div>
                                                <pre class="ba-code" style={{ "max-height": "15rem" }}>
                                                    {jsonItem.isValid && jsonItem.parsed
                                                        ? JSON.stringify(jsonItem.parsed, null, 2)
                                                        : jsonItem.raw}
                                                </pre>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        {/* 5. 検出された全メタタグ一覧 */}
                        <div class="ba-stack-3">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3">
                                <h2 class="ba-section-title">
                                    検出されたメタタグ・SEO要素一覧 ({filteredTags().length}件)
                                </h2>
                                {/* フィルタボタン */}
                                <div class="ba-tabs" style={{ padding: "0.2rem" }}>
                                    <button
                                        type="button"
                                        onClick={() => setTagFilter("all")}
                                        class={`ba-tab ${tagFilter() === "all" ? "is-active" : ""}`}
                                        style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                    >
                                        すべて
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTagFilter("basic")}
                                        class={`ba-tab ${tagFilter() === "basic" ? "is-active" : ""}`}
                                        style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                    >
                                        基本情報
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTagFilter("indexing")}
                                        class={`ba-tab ${tagFilter() === "indexing" ? "is-active" : ""}`}
                                        style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                    >
                                        インデックス
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTagFilter("structure")}
                                        class={`ba-tab ${tagFilter() === "structure" ? "is-active" : ""}`}
                                        style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                    >
                                        構造/見出し
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTagFilter("social")}
                                        class={`ba-tab ${tagFilter() === "social" ? "is-active" : ""}`}
                                        style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                    >
                                        OGP/SNS
                                    </button>
                                </div>
                            </div>

                            <Show
                                when={filteredTags().length > 0}
                                fallback={
                                    <div class="ba-panel ba-text-center ba-text-xs ba-text-muted ba-font-bold" style={{ padding: "1.5rem" }}>
                                        該当カテゴリのメタタグは見つかりませんでした。
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
                                    <For each={filteredTags()}>
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
