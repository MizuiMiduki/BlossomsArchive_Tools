import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    getPageMetadata,
    getPageJsonLd,
    routes,
    DEFAULT_OG_IMAGE,
    SITE_FAVICON,
    SITE_LOGO,
    SITE_TITLE,
    PUBLISHER_NAME,
} from "../src/routes";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, "../dist");
const assetsDirectory = path.join(distDirectory, "assets");
const templatePath = path.join(distDirectory, "index.html");
const template = fs.readFileSync(templatePath, "utf8");

const assetFiles = fs.existsSync(assetsDirectory)
    ? fs.readdirSync(assetsDirectory)
    : [];

const mainCssFile = assetFiles.find(
    (file) => file.startsWith("index-") && file.endsWith(".css"),
);

const mainJsFile = assetFiles.find(
    (file) => file.startsWith("index-") && file.endsWith(".js"),
);
const runtimeJsFile = assetFiles.find(
    (file) => file.startsWith("rolldown-runtime-") && file.endsWith(".js"),
);
const budouxJsFile = assetFiles.find(
    (file) => file.startsWith("BudouX-") && file.endsWith(".js"),
);

let baseTemplate = template;
if (mainCssFile) {
    const originalLinkVariants = [
        `<link rel="stylesheet" crossorigin href="/assets/${mainCssFile}">`,
        `<link rel="stylesheet" href="/assets/${mainCssFile}">`,
    ];
    const asyncCssMarkup = `<link rel="stylesheet" href="/assets/${mainCssFile}" media="print" onload="this.media='all'" />\n  <noscript><link rel="stylesheet" href="/assets/${mainCssFile}"></noscript>`;
    for (const variant of originalLinkVariants) {
        if (baseTemplate.includes(variant)) {
            const index = baseTemplate.indexOf(variant);
            baseTemplate =
                baseTemplate.slice(0, index) +
                asyncCssMarkup +
                baseTemplate.slice(index + variant.length);
            break;
        }
    }
}

if (mainJsFile) {
    const scriptTagVariants = [
        `<script type="module" crossorigin src="/assets/${mainJsFile}"></script>`,
        `<script type="module" src="/assets/${mainJsFile}"></script>`,
    ];
    for (const variant of scriptTagVariants) {
        if (baseTemplate.includes(variant)) {
            const index = baseTemplate.indexOf(variant);
            baseTemplate =
                baseTemplate.slice(0, index) +
                baseTemplate.slice(index + variant.length);
            const bodyCloseTag = "</body>";
            const bodyIndex = baseTemplate.indexOf(bodyCloseTag);
            if (bodyIndex !== -1) {
                baseTemplate =
                    baseTemplate.slice(0, bodyIndex) +
                    `  ${variant}\n` +
                    baseTemplate.slice(bodyIndex);
            }
            break;
        }
    }
}

const ROUTE_CHUNK_PREFIX: Record<string, string> = {
    "/": "Home",
    "/calculator": "Calculator",
    "/qr_code": "QrGenerator",
    "/password-generator": "PasswordGenerator",
    "/lottery": "Lottery",
    "/image_conversion": "ImageConverter",
    "/video-compressor": "VideoCompressor",
    "/charset-converter": "CharsetConverter",
    "/access-info": "AccessInfo",
    "/ogp-checker": "OgpChecker",
    "/seo-checker": "SeoChecker",
    "/exif-frame": "ExifFrameGenerator",
    "/clock": "Clock",
    "/timer": "TimerStopwatch",
    "/privacy": "PrivacyPolicy",
    "/credits": "Credits",
    "/hyperfocal": "Hyperfocal",
    "/headphone-driveability": "HeadphoneDriveability",
    "/text-converter": "TextConverter",
    "/exposure-calculator": "ExposureCalculator",
};

function findRouteChunk(routePath: string): string | undefined {
    const prefix = ROUTE_CHUNK_PREFIX[routePath];
    if (!prefix) return undefined;
    return assetFiles.find(
        (file) => file.startsWith(`${prefix}-`) && file.endsWith(".js"),
    );
}

function escapeAttribute(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return entities[character];
    });
}

const SEO_START_MARKER = "<!-- BA_TOOLS_SEO_START -->";
const SEO_END_MARKER = "<!-- BA_TOOLS_SEO_END -->";

/**
 * テンプレート内の開始〜終了マーカー間（マーカー自身を含む）を正規表現を使わず置換する
 */
function replaceBetweenMarkers(
    source: string,
    startMarker: string,
    endMarker: string,
    replacement: string,
): string {
    const startIndex = source.indexOf(startMarker);
    const endIndex = source.indexOf(endMarker);
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        throw new Error(
            `Required template markers not found: ${startMarker} ... ${endMarker}`,
        );
    }
    return (
        source.slice(0, startIndex) +
        replacement +
        source.slice(endIndex + endMarker.length)
    );
}

/**
 * 固定文字列の最初の出現位置を正規表現を使わず置換する
 */
function replaceExact(
    source: string,
    target: string,
    replacement: string,
): string {
    const index = source.indexOf(target);
    if (index === -1) {
        throw new Error(`Required template target not found: ${target}`);
    }
    return (
        source.slice(0, index) +
        replacement +
        source.slice(index + target.length)
    );
}

for (const route of routes) {
    const metadata = getPageMetadata(route.path);
    const jsonLd = getPageJsonLd(route.path);
    const routeChunk = findRouteChunk(route.path);

    const tags = [
        `<title>${escapeAttribute(metadata.title)}</title>`,
        `<meta name="description" content="${escapeAttribute(metadata.description)}" />`,
        `<link rel="canonical" href="${escapeAttribute(metadata.url)}" />`,
        '<link rel="alternate" type="text/plain" href="https://tools.blossomsarchive.com/llms.txt" title="LLMs Text" />',
        '<link rel="ard" type="application/ai-catalog+json" href="https://tools.blossomsarchive.com/.well-known/ard.json" />',
        '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
        '<meta name="format-detection" content="telephone=no" />',
        `<meta name="author" content="${escapeAttribute(PUBLISHER_NAME)}" />`,
        metadata.keywords && metadata.keywords.length > 0
            ? `<meta name="keywords" content="${escapeAttribute(metadata.keywords.join(", "))}" />`
            : "",
        `<link rel="icon" href="${escapeAttribute(SITE_FAVICON)}" />`,
        `<link rel="apple-touch-icon" href="${escapeAttribute(SITE_LOGO)}" />`,
        '<meta property="og:type" content="website" />',
        `<meta property="og:site_name" content="${escapeAttribute(SITE_TITLE)}" />`,
        '<meta property="og:locale" content="ja_JP" />',
        `<meta property="og:title" content="${escapeAttribute(metadata.title)}" />`,
        `<meta property="og:description" content="${escapeAttribute(metadata.description)}" />`,
        `<meta property="og:url" content="${escapeAttribute(metadata.url)}" />`,
        `<meta property="og:image" content="${escapeAttribute(DEFAULT_OG_IMAGE)}" />`,
        '<meta property="og:image:width" content="192" />',
        '<meta property="og:image:height" content="192" />',
        `<meta property="og:image:alt" content="${escapeAttribute(metadata.title)}" />`,
        '<meta name="twitter:card" content="summary" />',
        `<meta name="twitter:title" content="${escapeAttribute(metadata.title)}" />`,
        `<meta name="twitter:description" content="${escapeAttribute(metadata.description)}" />`,
        `<meta name="twitter:image" content="${escapeAttribute(DEFAULT_OG_IMAGE)}" />`,
    ]
        .filter(Boolean)
        .join("\n  ");

    const withSeo = replaceBetweenMarkers(
        baseTemplate,
        SEO_START_MARKER,
        SEO_END_MARKER,
        tags,
    );
    const suffix = " | BlossomsArchive Tools";
    const cleanTitle = metadata.title.endsWith(suffix)
        ? metadata.title.slice(0, -suffix.length)
        : metadata.title;

    const initialShell = `<div id="root"><div style="min-height:100dvh;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><header style="height:4rem;border-bottom:1px solid rgba(128,128,128,0.2);display:flex;align-items:center;padding:0 1rem;gap:0.75rem"><span style="font-size:1.25rem">🌸</span><span style="font-weight:700;font-size:1.125rem">BlossomsArchive Tools</span></header><main style="flex:1;max-width:64rem;width:100%;margin:0 auto;padding:1.5rem 1rem"><h1 class="sr-only">${escapeAttribute(metadata.title)}</h1><div style="background:rgba(128,128,128,0.08);border:1px solid rgba(128,128,128,0.15);border-radius:1.25rem;padding:1.5rem;display:flex;flex-direction:column;gap:1rem"><h2 style="font-size:1.75rem;font-weight:800;margin:0;line-height:1.35;contain:layout style">${escapeAttribute(cleanTitle)}</h2><p style="font-size:1.05rem;opacity:0.95;margin:0;line-height:1.75;contain:layout style">${escapeAttribute(metadata.description)} 完全無料で登録不要、すべての処理はお使いのブラウザ上で安全かつ高速に実行されます。PCやスマートフォンの大画面・小画面どちらでも快適にご利用いただけます。</p><div style="height:140px;background:rgba(128,128,128,0.05);border-radius:0.75rem;border:1px dashed rgba(128,128,128,0.2)"></div></div></main></div></div>`;

    let html = replaceExact(
        withSeo,
        '<div id="root"></div>',
        initialShell,
    );

    // FCP/LCP最優先化: modulepreloadはメインバンドルとランタイムのみに絞り、<script type="module">の直前に配置
    const modulePreloadList = [
        runtimeJsFile
            ? `<link rel="modulepreload" crossorigin href="/assets/${escapeAttribute(runtimeJsFile)}" />`
            : "",
        mainJsFile
            ? `<link rel="modulepreload" crossorigin href="/assets/${escapeAttribute(mainJsFile)}" />`
            : "",
    ].filter(Boolean);

    const jsonLdTag = `<script type="application/ld+json" id="ba-tools-global-jsonld">${JSON.stringify(jsonLd)}</script>`;

    if (modulePreloadList.length > 0) {
        const preloadMarkup = `  ${modulePreloadList.join("\n  ")}\n`;
        const scriptMarker = `<script type="module"`;
        const scriptIndex = html.indexOf(scriptMarker);
        if (scriptIndex !== -1) {
            html =
                html.slice(0, scriptIndex) +
                preloadMarkup +
                html.slice(scriptIndex);
        }
    }

    // JSON-LD構造化データはメインJSの実行開始を一切妨げないよう、</body>直前に配置
    const bodyCloseMarker = "</body>";
    const bodyCloseIndex = html.indexOf(bodyCloseMarker);
    if (bodyCloseIndex !== -1) {
        html =
            html.slice(0, bodyCloseIndex) +
            `  ${jsonLdTag}\n` +
            html.slice(bodyCloseIndex);
    }

    const outputDirectory =
        route.path === "/"
            ? distDirectory
            : path.join(distDirectory, route.path.slice(1));

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, "index.html"), html);
}

console.log(`Generated ${routes.length} route HTML pages with full SEO, modulepreload, H1 & JSON-LD`);
