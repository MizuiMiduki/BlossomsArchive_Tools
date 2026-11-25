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
        const gsapDirectImportPattern = new RegExp(
            "from\\s+[\"'`](?:gsap|.*gsapAnimations.*)[\"'`]",
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
            if (gsapDirectImportPattern.test(content)) {
                violations.push(
                    `${rel}: Direct import from 'gsap' or 'gsapAnimations' is forbidden; use src/utils/animations.ts`,
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

    it("ダークモード視認性 & 自作ピュアCSSガード: critical.css / app.css に見出し純白化・非活性ボタン・サイドバーリンク明瞭化ルールが存在し、外部CSSフレームワークに依存していないこと", () => {
        const criticalCss = fs.readFileSync(
            path.join(ROOT_DIR, "src", "styles", "critical.css"),
            "utf8",
        );
        const appCss = fs.readFileSync(
            path.join(ROOT_DIR, "src", "styles", "app.css"),
            "utf8",
        );
        expect(criticalCss).toContain('html[data-theme="dark"] h1');
        expect(criticalCss).toContain("color: #ffffff;");
        expect(criticalCss).toContain("--ba-primary: #b4b0ff;");
        expect(appCss).toContain('html[data-theme="dark"] .ba-btn:disabled');
        expect(appCss).toContain("rgba(255, 255, 255, 0.65)");
        expect(appCss).toContain('html[data-theme="dark"] aside nav a:not(.is-active)');
        expect(appCss).toContain("#f3f4f6");

        const pkgJson = JSON.parse(
            fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"),
        );
        const allDeps = {
            ...(pkgJson.dependencies || {}),
            ...(pkgJson.devDependencies || {}),
        };
        expect(allDeps).not.toHaveProperty("tailwindcss");
        expect(allDeps).not.toHaveProperty("daisyui");
        expect(allDeps).not.toHaveProperty("bulma");
        expect(allDeps).not.toHaveProperty("beercss");
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

    it("UIデザイン規約ガード: src/ 配下（テスト除く）のUIコードにUnicode絵文字が含まれていないこと", () => {
        const srcFiles = collectCodeFiles(path.join(ROOT_DIR, "src")).filter(
            (f) => !f.includes(`${path.sep}__tests__${path.sep}`),
        );
        const allowedSymbols = new Set([
            "©", "®", "™", "↩", "↪", "↔", "↕", "↗", "↘", "↖", "↙",
            "◀", "▶", "▲", "▼", "★", "☆", "♪", "♫", "×", "÷", "±", "∞", "※",
        ]);
        const emojiRe = /\p{Extended_Pictographic}/gu;
        const violations: string[] = [];

        for (const file of srcFiles) {
            const rel = path.relative(ROOT_DIR, file);
            const lines = fs.readFileSync(file, "utf8").split("\n");
            lines.forEach((line, idx) => {
                const matches = (line.match(emojiRe) || []).filter((ch) => !allowedSymbols.has(ch));
                if (matches.length > 0) {
                    violations.push(`${rel}:${idx + 1} (${[...new Set(matches)].join("")})`);
                }
            });
        }

        expect(violations).toEqual([]);
    });

    it("CodeQL再発防止ガード: js/bad-tag-filter・js/xss-through-dom・js/incomplete-url-substring-sanitization の危険パターンが src/ と scripts/ に存在しないこと", () => {
        const targetFiles = [
            ...collectCodeFiles(path.join(ROOT_DIR, "src")),
            ...collectCodeFiles(path.join(ROOT_DIR, "scripts")),
        ].filter((f) => !f.includes(`${path.sep}__tests__${path.sep}`));

        // 1. js/bad-tag-filter: 正規表現リテラルで <script>/<style> 終了タグやHTMLコメントを照合しない
        const badTagFilterRe = /<\\\/(?:script|style)|<!--\[\\s\\S\]|-->\/[gimsuy]*/i;
        // 2. js/xss-through-dom: DOMParser で text/html として再解析しない（XMLの application/xml は許可）
        const xssThroughDomRe = /parseFromString\([^)]*["'`]text\/html["'`]/;
        // 3. js/incomplete-url-substring-sanitization: ドメイン名を文字列の部分一致で判定しない
        const urlSubstringRe =
            /\.(?:includes|indexOf|startsWith|endsWith)\(\s*["'`][A-Za-z0-9.-]*\.(?:org|com|net|io|jp|dev|app|co)\/?["'`]/;

        const violations: string[] = [];
        for (const file of targetFiles) {
            const rel = path.relative(ROOT_DIR, file);
            const lines = fs.readFileSync(file, "utf8").split("\n");
            lines.forEach((line, idx) => {
                const trimmed = line.trim();
                if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
                if (badTagFilterRe.test(line)) {
                    violations.push(`[js/bad-tag-filter] ${rel}:${idx + 1}`);
                }
                if (xssThroughDomRe.test(line)) {
                    violations.push(`[js/xss-through-dom] ${rel}:${idx + 1}`);
                }
                if (urlSubstringRe.test(line)) {
                    violations.push(`[js/incomplete-url-substring-sanitization] ${rel}:${idx + 1}`);
                }
            });
        }

        expect(violations).toEqual([]);

        // 安全な共通実装が維持されていること
        const jsonLdSrc = fs.readFileSync(path.join(ROOT_DIR, "src", "utils", "jsonLd.ts"), "utf8");
        expect(jsonLdSrc).toContain("export function scanJsonLdScriptsFromHtml");
        expect(jsonLdSrc).toContain("export function isSchemaOrgContext");
        const seoSrc = fs.readFileSync(path.join(ROOT_DIR, "src", "pages", "SeoChecker.tsx"), "utf8");
        expect(seoSrc).toContain("scanJsonLdScriptsFromHtml");
    });

    it("CodeQL再発防止ガード自体が危険パターンを確実に検出できること（自己検証）", () => {
        const badTagFilterRe = /<\\\/(?:script|style)|<!--\[\\s\\S\]|-->\/[gimsuy]*/i;
        const xssThroughDomRe = /parseFromString\([^)]*["'`]text\/html["'`]/;
        const urlSubstringRe =
            /\.(?:includes|indexOf|startsWith|endsWith)\(\s*["'`][A-Za-z0-9.-]*\.(?:org|com|net|io|jp|dev|app|co)\/?["'`]/;

        expect(badTagFilterRe.test(String.raw`const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;`)).toBe(true);
        expect(xssThroughDomRe.test(`parser.parseFromString(html, "text/html")`)).toBe(true);
        expect(xssThroughDomRe.test(`parser.parseFromString(xml, "application/xml")`)).toBe(false);
        expect(urlSubstringRe.test(`if (!context.includes("schema.org")) {`)).toBe(true);
        expect(urlSubstringRe.test(`lower.includes("<script")`)).toBe(false);
    });
});
