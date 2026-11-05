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
        // タグ内部のHTMLタグを除去してプレーンテキスト化
        const plainText = h1Match[1].replace(/<[^>]+>/g, "").trim();
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

    // 5. 構造化データ <script type="application/ld+json"> の抽出
    const jsonLdRegex =
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonLdMatch: RegExpExecArray | null;
    while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
        const rawContent = jsonLdMatch[1].trim();
        if (!rawContent) continue;

        try {
            const parsed = JSON.parse(rawContent);
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
                raw: rawContent,
                parsed,
                isValid: true,
            });
            rawTags.push({
                key: `JSON-LD (${type})`,
                value: rawContent.slice(0, 150) + (rawContent.length > 150 ? "..." : ""),
                category: "structure",
            });
        } catch (err: any) {
            jsonLdList.push({
                type: "Error",
                raw: rawContent,
                parsed: null,
                isValid: false,
                error: err?.message || "JSONパースエラー",
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
    const logoUrl =
        typeof data.logo?.url === "string" ? data.logo.url.trim() : "";
    const imageUrl =
        typeof data.image?.url === "string" ? data.image.url.trim() : "";
    const author =
        typeof data.author === "string" ? data.author.trim() : "";

    if (!title && !description) {
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
    if (url) {
        rawTags.push({
            key: 'link[rel="canonical"]',
            value: url,
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

    return {
        pageTitle: title,
        metaDescription: description,
        canonicalUrl: url,
        robots: "",
        googlebot: "",
        viewport: "width=device-width, initial-scale=1.0",
        charset: "utf-8",
        keywords: "",
        author,
        faviconUrl: logoUrl,
        themeColor: "",
        h1List: title ? [title] : [],
        hreflangs: [],
        ogTitle: title,
        ogDescription: description,
        ogImage: imageUrl,
        ogType: "website",
        twitterCard: imageUrl ? "summary_large_image" : "summary",
        jsonLdList: [],
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
            message: "⚠️ 「noindex」が指定されています！検索結果に表示されません。",
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

    onMount(() => {
        document.title =
            "メタタグ(SEO)確認ツール | Google検索結果プレビュー＆診断";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "WebページのURLまたはHTMLソースから、title・description・canonical・robots・JSON-LD構造化データ・H1などのSEO重要メタタグを解析。Google検索結果スニペット表示のプレビューとSEO健全度スコア診断ができる無料Webツールです。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "seo-checker-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "メタタグ(SEO)確認ツール",
            operatingSystem: "All",
            applicationCategory: "DeveloperApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "WebページのSEOメタタグおよび構造化データを解析し、Google検索結果でのスニペット表示シミュレーションと設定診断を行うWebツール。",
        });
        document.head.appendChild(script);

        if (containerRef) playPageEntrance(containerRef, ".card");
    });

    onCleanup(() => {
        document.getElementById("seo-checker-jsonld")?.remove();
    });

    const fetchWithTimeout = async (
        url: string,
        timeoutMs = 7000,
    ): Promise<Response> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };

    const isSameOrigin = (targetUrl: string): boolean => {
        try {
            return (
                typeof window !== "undefined" &&
                new URL(targetUrl).origin === window.location.origin
            );
        } catch {
            return false;
        }
    };

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
        // 1. 同一オリジンの場合は直接 fetch
        if (isSameOrigin(targetUrl)) {
            try {
                const directRes = await fetchWithTimeout(targetUrl, 4000);
                if (directRes.ok) {
                    const text = await directRes.text();
                    if (text && text.includes("<")) {
                        return enrichDevSameOriginSeo(
                            parseSeoFromHtml(text, targetUrl),
                            text,
                            targetUrl,
                        );
                    }
                }
            } catch {
                // フォールバックへ
            }
        }

        // 2. クロスオリジンの場合: まず AllOrigins プロキシで生のHTML取得を試行
        try {
            const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
            const res = await fetchWithTimeout(allOriginsUrl, 6000);
            if (res.ok) {
                const text = await res.text();
                if (text && (text.includes("<html") || text.includes("<head") || text.includes("<title"))) {
                    return parseSeoFromHtml(text, targetUrl);
                }
            }
        } catch {
            // 次のフォールバックへ
        }

        // 3. Microlink API フォールバック
        const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetchWithTimeout(microlinkUrl, 8000).catch(() => {
            throw new Error(
                "ページの取得に失敗しました。対象サイトにアクセス制限がある場合は、「HTML直接入力 / ファイル読込」タブをご利用ください。",
            );
        });

        if (!res.ok) {
            throw new Error(
                `ページの取得に失敗しました（HTTPステータス: ${res.status}）。「HTML直接入力 / ファイル読込」タブをご利用ください。`,
            );
        }

        const json = await res.json().catch(() => {
            throw new Error("データの解析に失敗しました。");
        });

        const parsed = parseSeoFromMicrolink(json, targetUrl);
        if (!parsed) {
            throw new Error(
                "SEO情報が見つかりませんでした。「HTML直接入力 / ファイル読込」タブからHTMLソースを直接貼り付けてお試しください。",
            );
        }
        return parsed;
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
                <span class="badge badge-success badge-sm text-white font-bold">
                    良好
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
        if (status === "error") {
            return (
                <span class="badge badge-error badge-sm text-white font-bold">
                    要修正
                </span>
            );
        }
        return (
            <span class="badge badge-neutral badge-sm font-bold">
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
                                <BudouX text="メタタグ(SEO)確認ツール" />
                            </h1>
                            <BudouX
                                as="p"
                                class="text-xs font-semibold text-base-content/70 mt-2 leading-relaxed"
                                text="WebページのURLまたはHTMLソースコードからtitle、meta description、canonical、robots、JSON-LD構造化データ等のSEO重要タグを解析・診断。Google検索結果スニペットのPC・スマホ表示をリアルタイムにプレビュー確認できます。"
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
                    <div class="grid grid-cols-2 gap-2 p-1.5 bg-base-200 rounded-xl mb-6 max-w-lg">
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
                            📝 HTML直接入力 / ファイル読込
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
                                    "SEOメタタグを解析"
                                )}
                            </button>
                        </form>
                    </Show>

                    {/* HTML直接入力・ファイル読込フォーム */}
                    <Show when={inputMode() === "html"}>
                        <div class="flex flex-col gap-4 w-full">
                            <div class="form-control w-full">
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 mb-1">
                                    <span class="label-text font-bold text-xs sm:text-sm text-base-content/80">
                                        HTMLソースコード（&lt;head&gt;内のメタタグまたはページ全体のHTML）
                                    </span>
                                    <label class="btn btn-outline btn-xs h-8 px-3 font-bold cursor-pointer self-start sm:self-auto">
                                        📂 HTMLファイルを読み込む
                                        <input
                                            type="file"
                                            accept=".html,.htm,text/html"
                                            onChange={handleHtmlFileUpload}
                                            class="hidden"
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
                                    class="textarea textarea-bordered w-full h-44 font-mono text-xs sm:text-sm bg-base-100 border-2 border-base-300 focus:border-primary p-3 leading-relaxed"
                                />
                            </div>
                            <div class="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHtmlInput("");
                                        setSeoData(null);
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
                    <Show when={!seoData() && !loading()}>
                        <div class="mt-8 border-2 border-dashed border-base-300 bg-base-200/40 rounded-2xl p-8 text-center flex flex-col items-center gap-3">
                            <span class="text-4xl">🔎</span>
                            <p class="text-sm font-bold text-base-content/80">
                                URLを入力して「SEOメタタグを解析」を押すか、HTMLソースコード・HTMLファイルを読み込んでください。
                            </p>
                            <p class="text-xs text-base-content/60 max-w-xl leading-relaxed">
                                ローカル制作中のHTMLや公開前のWebページも「HTML直接入力 / ファイル読込」から完全オフライン（ブラウザ内完結）でGoogle検索スニペットプレビューとSEO診断を安全に実行できます。
                            </p>
                        </div>
                    </Show>

                    {/* 解析結果エリア */}
                    <Show when={seoData() && !loading()}>
                        <div
                            ref={(el) => animateFadeIn(el)}
                            class="mt-8 flex flex-col gap-8 border-t border-base-300 pt-8"
                        >
                            {/* 1. 総合スコア概要カード */}
                            <div class="bg-base-200/50 border border-base-300 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs">
                                <div class="flex items-center gap-5">
                                    <div class="radial-progress bg-base-100 text-primary border-4 border-base-200 font-black text-xl" style={{
                                        "--value": scoreData().score,
                                        "--size": "5rem",
                                        "--thickness": "6px",
                                    } as any}>
                                        {scoreData().score}点
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-base sm:text-lg font-black text-base-content">
                                                SEO健全度スコア
                                            </span>
                                            <span class="badge badge-primary font-black">
                                                ランク {scoreData().rating}
                                            </span>
                                        </div>
                                        <p class="text-xs text-base-content/70 mt-1">
                                            全{scoreData().totalCount}項目のうち {scoreData().passedCount}項目が良好、{scoreData().warnCount}項目が要確認、{scoreData().errorCount}項目が要修正
                                        </p>
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
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
                                            ? "レポートをコピー完了！"
                                            : "📋 SEO診断レポートを全コピー"}
                                    </button>
                                </div>
                            </div>

                            {/* 2. Google検索結果（SERP）プレビュー */}
                            <div>
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                    <div>
                                        <h2 class="text-lg sm:text-xl font-black text-base-content flex items-center gap-2">
                                            <span>🔍</span> Google検索結果プレビュー (SERP Preview)
                                        </h2>
                                        <p class="text-xs text-base-content/60 mt-0.5">
                                            Google等の検索結果一覧でどのように表示されるかをシミュレーションします
                                        </p>
                                    </div>
                                    {/* デスクトップ / モバイル切り替え */}
                                    <div class="flex items-center gap-1.5 bg-base-200 p-1 rounded-xl self-start sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={() => setSerpViewMode("desktop")}
                                            class={`btn btn-xs rounded-lg font-bold ${
                                                serpViewMode() === "desktop"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            💻 デスクトップ (PC)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSerpViewMode("mobile")}
                                            class={`btn btn-xs rounded-lg font-bold ${
                                                serpViewMode() === "mobile"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            📱 モバイル (スマホ)
                                        </button>
                                    </div>
                                </div>

                                {/* プレビューコンテナ */}
                                <div class="bg-base-200/40 border border-base-300 rounded-2xl p-4 sm:p-6 flex flex-col items-center">
                                    <Show
                                        when={serpViewMode() === "desktop"}
                                        fallback={
                                            /* モバイル表示 */
                                            <div class="w-full max-w-md bg-white text-[#202124] rounded-2xl p-4 shadow-sm border border-gray-200 font-sans flex flex-col gap-1.5">
                                                {/* 上部: ファビコン・サイト名・URL */}
                                                <div class="flex items-center gap-2.5">
                                                    <div class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shrink-0">
                                                        <Show
                                                            when={seoData()?.faviconUrl}
                                                            fallback={<span class="text-xs">🌐</span>}
                                                        >
                                                            <img
                                                                src={seoData()?.faviconUrl}
                                                                alt="Favicon"
                                                                class="w-4 h-4 object-contain"
                                                                onError={(e) => {
                                                                    (e.currentTarget as HTMLElement).style.display = "none";
                                                                }}
                                                            />
                                                        </Show>
                                                    </div>
                                                    <div class="flex flex-col min-w-0">
                                                        <span class="text-xs font-medium text-[#202124] truncate">
                                                            {seoData()?.ogTitle ? seoData()?.pageTitle.split(/[-|_]/)[1]?.trim() || displayDomain() : displayDomain()}
                                                        </span>
                                                        <span class="text-[11px] text-[#4d5156] truncate">
                                                            {displayBreadcrumb()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* タイトル */}
                                                <h3 class="text-base sm:text-lg text-[#1a0dab] font-medium leading-snug line-clamp-2 hover:underline cursor-pointer break-words mt-1">
                                                    {seoData()?.pageTitle || "（タイトル未設定）"}
                                                </h3>

                                                {/* 説明文 */}
                                                <p class="text-xs sm:text-sm text-[#4d5156] leading-relaxed line-clamp-3 break-words mt-0.5">
                                                    {seoData()?.metaDescription || "（メタディスクリプション未設定：検索エンジンがページ本文から自動的にスニペットを抽出します）"}
                                                </p>
                                            </div>
                                        }
                                    >
                                        {/* デスクトップ表示 */}
                                        <div class="w-full max-w-2xl bg-white text-[#202124] rounded-2xl p-5 shadow-sm border border-gray-200 font-sans flex flex-col gap-1">
                                            {/* 上部: ファビコン・サイト名・URL */}
                                            <div class="flex items-center gap-2">
                                                <div class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shrink-0">
                                                    <Show
                                                        when={seoData()?.faviconUrl}
                                                        fallback={<span class="text-xs">🌐</span>}
                                                    >
                                                        <img
                                                            src={seoData()?.faviconUrl}
                                                            alt="Favicon"
                                                            class="w-4 h-4 object-contain"
                                                            onError={(e) => {
                                                                (e.currentTarget as HTMLElement).style.display = "none";
                                                            }}
                                                        />
                                                    </Show>
                                                </div>
                                                <div class="flex flex-col min-w-0 leading-tight">
                                                    <span class="text-sm text-[#202124] font-medium truncate">
                                                        {displayDomain()}
                                                    </span>
                                                    <span class="text-xs text-[#4d5156] truncate">
                                                        {displayBreadcrumb()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* タイトルリンク */}
                                            <h3 class="text-lg sm:text-xl text-[#1a0dab] font-normal leading-normal line-clamp-1 hover:underline cursor-pointer break-words mt-1">
                                                {seoData()?.pageTitle || "（タイトル未設定）"}
                                            </h3>

                                            {/* 説明文スニペット */}
                                            <p class="text-sm text-[#4d5156] leading-relaxed line-clamp-2 break-words">
                                                {seoData()?.metaDescription || "（メタディスクリプション未設定：検索エンジンがページ本文から自動的にスニペットを抽出します）"}
                                            </p>
                                        </div>
                                    </Show>

                                    {/* 文字数ゲージバー */}
                                    <div class="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4 border-t border-base-300">
                                        <div class="bg-base-100 p-3.5 rounded-xl border border-base-300 flex flex-col gap-1.5">
                                            <div class="flex items-center justify-between text-xs">
                                                <span class="font-bold text-base-content/80">
                                                    タイトル文字数
                                                </span>
                                                <span class={`font-mono font-bold ${
                                                    (seoData()?.pageTitle.length ?? 0) >= 25 && (seoData()?.pageTitle.length ?? 0) <= 35
                                                        ? "text-success"
                                                        : (seoData()?.pageTitle.length ?? 0) > 40
                                                          ? "text-warning"
                                                          : "text-base-content/70"
                                                }`}>
                                                    {seoData()?.pageTitle.length ?? 0}文字 / 推奨 25〜35文字
                                                </span>
                                            </div>
                                            <progress
                                                class={`progress w-full h-2 ${
                                                    (seoData()?.pageTitle.length ?? 0) >= 25 && (seoData()?.pageTitle.length ?? 0) <= 35
                                                        ? "progress-success"
                                                        : (seoData()?.pageTitle.length ?? 0) > 40
                                                          ? "progress-warning"
                                                          : "progress-primary"
                                                }`}
                                                value={Math.min(seoData()?.pageTitle.length ?? 0, 50)}
                                                max="50"
                                            ></progress>
                                        </div>

                                        <div class="bg-base-100 p-3.5 rounded-xl border border-base-300 flex flex-col gap-1.5">
                                            <div class="flex items-center justify-between text-xs">
                                                <span class="font-bold text-base-content/80">
                                                    説明文文字数
                                                </span>
                                                <span class={`font-mono font-bold ${
                                                    (seoData()?.metaDescription.length ?? 0) >= 70 && (seoData()?.metaDescription.length ?? 0) <= 120
                                                        ? "text-success"
                                                        : (seoData()?.metaDescription.length ?? 0) > 130
                                                          ? "text-warning"
                                                          : "text-base-content/70"
                                                }`}>
                                                    {seoData()?.metaDescription.length ?? 0}文字 / 推奨 80〜120文字
                                                </span>
                                            </div>
                                            <progress
                                                class={`progress w-full h-2 ${
                                                    (seoData()?.metaDescription.length ?? 0) >= 70 && (seoData()?.metaDescription.length ?? 0) <= 120
                                                        ? "progress-success"
                                                        : (seoData()?.metaDescription.length ?? 0) > 130
                                                          ? "progress-warning"
                                                          : "progress-primary"
                                                }`}
                                                value={Math.min(seoData()?.metaDescription.length ?? 0, 160)}
                                                max="160"
                                            ></progress>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. SEO設定診断チェックリスト */}
                            <div>
                                <h2 class="text-lg sm:text-xl font-black text-base-content mb-4 flex items-center gap-2">
                                    <span>✅</span> SEO重要項目診断チェック
                                </h2>
                                <div class="border border-base-300 rounded-2xl bg-base-100 overflow-hidden divide-y divide-base-200 shadow-xs">
                                    <For each={diagnostics()}>
                                        {(item) => (
                                            <div class="p-4 flex flex-col md:flex-row md:items-start justify-between gap-3 hover:bg-base-200/40 transition-colors">
                                                <div class="flex items-center gap-3 md:w-56 shrink-0">
                                                    {statusBadge(item.status)}
                                                    <span class="font-mono font-bold text-xs sm:text-sm text-base-content">
                                                        {item.label}
                                                    </span>
                                                </div>
                                                <div class="flex-1 min-w-0 flex flex-col gap-1">
                                                    <p class="text-xs sm:text-sm font-semibold text-base-content break-all">
                                                        {item.value}
                                                    </p>
                                                    <p class="text-[11px] text-base-content/80 font-medium">
                                                        {item.message}
                                                    </p>
                                                    <p class="text-[10px] text-primary/90 mt-0.5 leading-relaxed bg-primary/5 p-2 rounded-lg border border-primary/10">
                                                        💡 改善ヒント: {item.advice}
                                                    </p>
                                                </div>
                                                <div class="shrink-0 self-end md:self-start">
                                                    <button
                                                        type="button"
                                                        disabled={item.value === "未設定" || item.value === "未検出"}
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

                            {/* 4. 構造化データ（JSON-LD）プレビュー */}
                            <Show when={(seoData()?.jsonLdList.length ?? 0) > 0}>
                                <div>
                                    <h2 class="text-lg sm:text-xl font-black text-base-content mb-4 flex items-center gap-2">
                                        <span>🧬</span> 検出された構造化データ (JSON-LD: {seoData()?.jsonLdList.length}件)
                                    </h2>
                                    <div class="flex flex-col gap-4">
                                        <For each={seoData()?.jsonLdList}>
                                            {(jsonItem, idx) => (
                                                <div class="bg-base-100 border border-base-300 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                                                    <div class="flex items-center justify-between">
                                                        <div class="flex items-center gap-2">
                                                            <span class={`badge ${jsonItem.isValid ? "badge-success text-white" : "badge-error text-white"} font-bold text-xs`}>
                                                                {jsonItem.isValid ? "有効 (Valid)" : "エラー"}
                                                            </span>
                                                            <span class="font-bold text-sm text-base-content">
                                                                Type: {jsonItem.type}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyText(jsonItem.raw, `jsonld-${idx()}`)}
                                                            class={`btn btn-xs rounded-lg font-bold text-white ${
                                                                copiedKey() === `jsonld-${idx()}`
                                                                    ? "btn-success"
                                                                    : "btn-neutral"
                                                            }`}
                                                        >
                                                            {copiedKey() === `jsonld-${idx()}` ? "コピー完了" : "JSONをコピー"}
                                                        </button>
                                                    </div>
                                                    <pre class="bg-base-200/70 p-3.5 rounded-xl font-mono text-xs overflow-x-auto text-base-content/90 max-h-60 leading-relaxed">
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
                            <div>
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                    <h2 class="text-lg sm:text-xl font-black text-base-content flex items-center gap-2">
                                        <span>🏷️</span> 検出されたメタタグ・SEO要素一覧 ({filteredTags().length}件)
                                    </h2>
                                    {/* フィルタボタン */}
                                    <div class="flex items-center gap-1 bg-base-200 p-1 rounded-xl flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setTagFilter("all")}
                                            class={`btn btn-xs rounded-lg ${
                                                tagFilter() === "all"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            すべて
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTagFilter("basic")}
                                            class={`btn btn-xs rounded-lg ${
                                                tagFilter() === "basic"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            基本情報
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTagFilter("indexing")}
                                            class={`btn btn-xs rounded-lg ${
                                                tagFilter() === "indexing"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            インデックス
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTagFilter("structure")}
                                            class={`btn btn-xs rounded-lg ${
                                                tagFilter() === "structure"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            構造/見出し
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTagFilter("social")}
                                            class={`btn btn-xs rounded-lg ${
                                                tagFilter() === "social"
                                                    ? "btn-primary text-white"
                                                    : "btn-ghost"
                                            }`}
                                        >
                                            OGP/SNS
                                        </button>
                                    </div>
                                </div>

                                <Show
                                    when={filteredTags().length > 0}
                                    fallback={
                                        <div class="p-6 text-center bg-base-200/50 rounded-2xl border border-base-300 text-xs text-base-content/60 font-semibold">
                                            該当カテゴリのメタタグは見つかりませんでした。
                                        </div>
                                    }
                                >
                                    <div class="border border-base-300 rounded-2xl bg-base-100 overflow-hidden divide-y divide-base-200 shadow-xs">
                                        <For each={filteredTags()}>
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
            </div>

            <AdSense />
            <AdSense />
        </div>
    );
}
