import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { routes, getPageMetadata } from "../routes";

const ROOT_DIR = path.resolve(process.cwd());

function collectCodeFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectCodeFiles(fullPath));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

describe("Code Quality, Architecture & Stability Invariant Guards", () => {
    it("index.html に generate-route-pages.ts が使用する SEO 境界マーカーが存在すること", () => {
        const indexHtml = fs.readFileSync(
            path.join(ROOT_DIR, "index.html"),
            "utf8",
        );
        expect(indexHtml).toContain("<!-- BA_TOOLS_SEO_START -->");
        expect(indexHtml).toContain("<!-- BA_TOOLS_SEO_END -->");
        expect(indexHtml).toContain('<div id="root"></div>');
    });

    it("全ルートが generate-route-pages.ts の ROUTE_CHUNK_PREFIX に登録され、メタデータ文字数規約を満たすこと", () => {
        const scriptContent = fs.readFileSync(
            path.join(ROOT_DIR, "scripts", "generate-route-pages.ts"),
            "utf8",
        );

        for (const route of routes) {
            expect(scriptContent).toContain(`"${route.path}":`);

            const meta = getPageMetadata(route.path);
            // Lighthouse SEO / AI Score 基準: title 15〜60文字、description 50〜160文字
            expect(meta.title.length).toBeGreaterThanOrEqual(15);
            expect(meta.title.length).toBeLessThanOrEqual(60);
            expect(meta.description.length).toBeGreaterThanOrEqual(50);
            expect(meta.description.length).toBeLessThanOrEqual(160);
        }
    });

    it("public/.well-known/ard.json と public/ard.json が完全に同期しており、有効なJSONであること", () => {
        const wellKnownArd = fs.readFileSync(
            path.join(ROOT_DIR, "public", ".well-known", "ard.json"),
            "utf8",
        );
        const rootArd = fs.readFileSync(
            path.join(ROOT_DIR, "public", "ard.json"),
            "utf8",
        );

        expect(wellKnownArd).toBe(rootArd);
        const parsed = JSON.parse(wellKnownArd);
        expect(Array.isArray(parsed.entries)).toBe(true);
        expect(parsed.entries.length).toBeGreaterThanOrEqual(17);
    });

    it("静的コード品質検査: Solid 1.x 非推奨API・巨大budoux辞書直接import・eval・不安全なtarget='_blank'が存在しないこと", () => {
        const srcFiles = collectCodeFiles(path.join(ROOT_DIR, "src")).filter(
            (f) => !f.includes(`${path.sep}__tests__${path.sep}`),
        );
        expect(srcFiles.length).toBeGreaterThan(0);

        const violations: string[] = [];

        const evalPattern = new RegExp("\\b(?:eval|new\\s+Function)\\s*\\(");
        const budouxDirectImportPattern = new RegExp(
            "from\\s+[\"'`]budoux[\"'`]",
        );
        const solidLegacyLifecyclePattern = new RegExp(
            "\\b(?:onMount|onCleanup)\\b",
        );

        for (const filePath of srcFiles) {
            const rel = path.relative(ROOT_DIR, filePath);
            const content = fs.readFileSync(filePath, "utf8");

            if (evalPattern.test(content)) {
                violations.push(`${rel}: eval() / new Function() is forbidden`);
            }
            if (budouxDirectImportPattern.test(content)) {
                violations.push(
                    `${rel}: Direct import from 'budoux' (212KB dictionary) is forbidden; use src/utils/budoux.ts (Intl.Segmenter)`,
                );
            }
            if (solidLegacyLifecyclePattern.test(content)) {
                violations.push(
                    `${rel}: Legacy Solid 1.x onMount/onCleanup found; use Solid 2.0 onSettled`,
                );
            }

            // target="_blank" があるファイルでは noopener noreferrer が含まれていること
            if (content.includes('target="_blank"')) {
                if (
                    !content.includes("noopener") ||
                    !content.includes("noreferrer")
                ) {
                    violations.push(
                        `${rel}: target="_blank" must include rel="noopener noreferrer"`,
                    );
                }
            }
        }

        expect(violations).toEqual([]);
    });
});
