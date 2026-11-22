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
        const lowContrastClassPattern = new RegExp(
            "text-base-content\\/(?:[1-5]0)\\b",
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
            if (lowContrastClassPattern.test(content)) {
                violations.push(
                    `${rel}: Low-contrast class text-base-content/10..50 found; use >= /60 or /75 for WCAG AA 4.5:1 contrast`,
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

    it("PageSpeed/A11y退行防止: AdSense/Layoutの遅延読込にscrollトリガーが無く、PrivacyPolicyの本文内リンクにunderlineが付与されていること", () => {
        const adSenseSrc = fs.readFileSync(
            path.join(ROOT_DIR, "src", "components", "AdSense.tsx"),
            "utf8",
        );
        const layoutSrc = fs.readFileSync(
            path.join(ROOT_DIR, "src", "components", "Layout.tsx"),
            "utf8",
        );
        const privacySrc = fs.readFileSync(
            path.join(ROOT_DIR, "src", "pages", "PrivacyPolicy.tsx"),
            "utf8",
        );

        // AdSense のマウントトリガーに scroll が混入していないこと
        expect(adSenseSrc).not.toMatch(/addEventListener\(\s*["']scroll["']/);
        // Layout で createScriptLoader の無条件読み込みが再導入されていないこと
        expect(layoutSrc).not.toContain("createScriptLoader");
        // PrivacyPolicy の外部リンクに常時下線クラスがあること（link-in-text-block 対策）
        expect(privacySrc).toContain("underline");
        expect(privacySrc).not.toContain('class="text-primary hover:underline"');

        // レンダーブロッキングCSSの防止と同一オリジンアイコン配信
        const generatePagesSrc = fs.readFileSync(
            path.join(ROOT_DIR, "scripts", "generate-route-pages.ts"),
            "utf8",
        );
        expect(generatePagesSrc).toContain("media='all'");
        expect(generatePagesSrc).toContain("preload");

        const routesSrc = fs.readFileSync(
            path.join(ROOT_DIR, "src", "routes.ts"),
            "utf8",
        );
        expect(routesSrc).not.toContain("blossomsarchive.com/wp-content");
        expect(fs.existsSync(path.join(ROOT_DIR, "public", "icon-32.png"))).toBe(true);
        expect(fs.existsSync(path.join(ROOT_DIR, "public", "icon-192.png"))).toBe(true);
    });

    it("テスト網羅ガード: src/pages 内の全ページコンポーネントに対応するテストコードが存在し、visualRegression に登録されていること", () => {
        const pagesDir = path.join(ROOT_DIR, "src", "pages");
        const testsDir = path.join(ROOT_DIR, "src", "__tests__");
        const visualRegressionSrc = fs.readFileSync(
            path.join(testsDir, "visualRegression.test.tsx"),
            "utf8",
        );

        const pageFiles = fs
            .readdirSync(pagesDir)
            .filter((f) => f.endsWith(".tsx"));
        expect(pageFiles.length).toBeGreaterThan(0);

        const testFiles = fs.readdirSync(testsDir);
        const missingTests: string[] = [];
        const missingFromVisualRegression: string[] = [];

        // 静的ページ（個別テストではなく StaticPages.test.tsx に統合されているページ）
        const staticPages = new Set(["Credits.tsx", "NotFound.tsx", "PrivacyPolicy.tsx"]);

        for (const file of pageFiles) {
            const baseName = path.basename(file, ".tsx");
            const expectedTestFile = `${baseName}.test.tsx`;

            // 1. 個別テストまたは統合テストが存在すること
            if (!staticPages.has(file)) {
                if (!testFiles.includes(expectedTestFile)) {
                    missingTests.push(`${file} -> ${expectedTestFile} が存在しません`);
                }
            } else {
                expect(testFiles).toContain("StaticPages.test.tsx");
            }

            // 2. visualRegression.test.tsx の PAGE_ENTRIES に全ページが登録されていること
            if (!visualRegressionSrc.includes(baseName)) {
                missingFromVisualRegression.push(`${baseName} が visualRegression.test.tsx に登録されていません`);
            }
        }

        expect(missingTests).toEqual([]);
        expect(missingFromVisualRegression).toEqual([]);
    });
});
