import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    getPageMetadata,
    getPageJsonLd,
    routes,
    DEFAULT_OG_IMAGE,
    SITE_LOGO,
    SITE_TITLE,
    PUBLISHER_NAME,
} from "../src/routes";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, "../dist");
const templatePath = path.join(distDirectory, "index.html");
const template = fs.readFileSync(templatePath, "utf8");

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

// 既存の動的メタタグやスクリプトをテンプレートから除去してクリーンにする
const cleanTemplate = template
    .replace(/<title>.*?<\/title>\s*/gi, "")
    .replace(/<meta\b[^>]*name=["']description["'][^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*name=["']robots["'][^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*name=["']format-detection["'][^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*name=["']keywords["'][^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*name=["']author["'][^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*rel=["']icon["'][^>]*>\s*/gi, "")
    .replace(/<link\b[^>]*rel=["']apple-touch-icon["'][^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*property=["']og:[^"']*["'][^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*name=["']twitter:[^"']*["'][^>]*>\s*/gi, "")
    .replace(/<script\b[^>]*id=["']ba-tools-global-jsonld["'][^>]*>[\s\S]*?<\/script>\s*/gi, "");

for (const route of routes) {
    const metadata = getPageMetadata(route.path);
    const jsonLd = getPageJsonLd(route.path);

    const tags = [
        `<title>${escapeAttribute(metadata.title)}</title>`,
        `<meta name="description" content="${escapeAttribute(metadata.description)}" />`,
        `<link rel="canonical" href="${escapeAttribute(metadata.url)}" />`,
        '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
        '<meta name="format-detection" content="telephone=no" />',
        `<meta name="author" content="${escapeAttribute(PUBLISHER_NAME)}" />`,
        metadata.keywords && metadata.keywords.length > 0
            ? `<meta name="keywords" content="${escapeAttribute(metadata.keywords.join(", "))}" />`
            : "",
        `<link rel="icon" href="${escapeAttribute(SITE_LOGO)}" />`,
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
        `<script type="application/ld+json" id="ba-tools-global-jsonld">${JSON.stringify(jsonLd, null, 2)}</script>`,
    ]
        .filter(Boolean)
        .join("\n  ");

    const html = cleanTemplate
        .replace(/<html lang="[^"]*">/, '<html lang="ja">')
        .replace("</head>", `  ${tags}\n</head>`);

    const outputDirectory =
        route.path === "/"
            ? distDirectory
            : path.join(distDirectory, route.path.slice(1));

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, "index.html"), html);
}

console.log(`Generated ${routes.length} route HTML pages with full SEO & JSON-LD`);
