import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPageMetadata, routes } from "../src/routes";

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

for (const route of routes) {
    const metadata = getPageMetadata(route.path);
    const tags = [
        `<meta name="description" content="${escapeAttribute(metadata.description)}" />`,
        `<link rel="canonical" href="${escapeAttribute(metadata.url)}" />`,
        '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="BlossomsArchive Tools" />',
        '<meta property="og:locale" content="ja_JP" />',
        `<meta property="og:title" content="${escapeAttribute(metadata.title)}" />`,
        `<meta property="og:description" content="${escapeAttribute(metadata.description)}" />`,
        `<meta property="og:url" content="${escapeAttribute(metadata.url)}" />`,
        '<meta name="twitter:card" content="summary" />',
        `<meta name="twitter:title" content="${escapeAttribute(metadata.title)}" />`,
        `<meta name="twitter:description" content="${escapeAttribute(metadata.description)}" />`,
    ].join("\n  ");
    const html = template
        .replace(/<html lang="[^"]*">/, '<html lang="ja">')
        .replace(
            /<title>.*?<\/title>/,
            `<title>${escapeAttribute(metadata.title)}</title>`,
        )
        .replace("</head>", `  ${tags}\n</head>`);
    const outputDirectory =
        route.path === "/"
            ? distDirectory
            : path.join(distDirectory, route.path.slice(1));

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, "index.html"), html);
}

console.log(`Generated ${routes.length} route HTML pages`);
