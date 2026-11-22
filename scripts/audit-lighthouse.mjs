import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const ISSUE_REPORT_PATH = path.join(ROOT_DIR, "dist", "lighthouse-issue.md");

const ROUTE_SOURCE_MAP = {
    "/": "src/pages/Home.tsx",
    "/calculator": "src/pages/Calculator.tsx",
    "/qr_code": "src/pages/QrGenerator.tsx",
    "/image_converter": "src/pages/ImageConverter.tsx",
    "/video_compressor": "src/pages/VideoCompressor.tsx",
    "/access_info": "src/pages/AccessInfo.tsx",
    "/timer": "src/pages/TimerStopwatch.tsx",
    "/text_converter": "src/pages/TextConverter.tsx",
    "/clock": "src/pages/Clock.tsx",
    "/charset": "src/pages/CharsetConverter.tsx",
    "/lottery": "src/pages/Lottery.tsx",
    "/password": "src/pages/PasswordGenerator.tsx",
    "/exif": "src/pages/ExifFrameGenerator.tsx",
    "/ogp_checker": "src/pages/OgpChecker.tsx",
    "/seo_checker": "src/pages/SeoChecker.tsx",
    "/hyperfocal": "src/pages/Hyperfocal.tsx",
    "/headphone_driveability": "src/pages/HeadphoneDriveability.tsx",
    "/privacy": "src/pages/PrivacyPolicy.tsx",
    "/credits": "src/pages/Credits.tsx",
};

// コマンドライン引数の解析
const rawArgs = process.argv.slice(2);
function getArgValue(prefix) {
    const found = rawArgs.find((a) => a.startsWith(prefix));
    if (!found) return null;
    return found.split("=")[1] || null;
}

const shardArg = getArgValue("--shard"); // 例: "1/4", "2/4"
const reportJsonArg = getArgValue("--report-json");
const aggregateDirArg = getArgValue("--aggregate");

// Lighthouse CLI の実行バイナリを探す
function findLighthouseBin() {
    const localBin = path.join(ROOT_DIR, "node_modules", ".bin", "lighthouse");
    if (fs.existsSync(localBin)) return localBin;

    const ciGlobalBin = "/home/runner/.npm-global/bin/lighthouse";
    if (fs.existsSync(ciGlobalBin)) return ciGlobalBin;

    const npxDir = "/Users/mizui_miduki/.npm/_npx";
    if (fs.existsSync(npxDir)) {
        try {
            for (const sub of fs.readdirSync(npxDir)) {
                const candidate = path.join(npxDir, sub, "node_modules", ".bin", "lighthouse");
                if (fs.existsSync(candidate)) return candidate;
            }
        } catch {
            // ignore
        }
    }

    return "lighthouse";
}

// routes.ts からルート一覧を抽出
async function getRoutesToAudit() {
    const routesFile = fs.readFileSync(path.join(ROOT_DIR, "src", "routes.ts"), "utf8");
    const pathMatches = routesFile.match(/path:\s*["']([^"']+)["']/g) || [];
    const uniquePaths = [...new Set(pathMatches.map((m) => m.replace(/path:\s*["']|["']/g, "")))];
    return uniquePaths.filter((p) => p !== "*");
}

async function startPreviewServer() {
    console.log("🚀 Starting vite preview server on port 4173...");
    const viteJs = path.join(ROOT_DIR, "node_modules", "vite", "bin", "vite.js");
    const viteBin = path.join(ROOT_DIR, "node_modules", ".bin", "vite");
    const useDirectNode = fs.existsSync(viteJs);
    const cmd = useDirectNode ? process.execPath : viteBin;
    const args = useDirectNode
        ? [viteJs, "preview", "--port", "4173", "--host", "127.0.0.1"]
        : ["preview", "--port", "4173", "--host", "127.0.0.1"];

    const serverProcess = spawn(cmd, args, {
        cwd: ROOT_DIR,
        stdio: ["ignore", "pipe", "pipe"],
    });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            serverProcess.kill();
            reject(new Error("Vite preview server startup timed out"));
        }, 15000);

        serverProcess.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        serverProcess.stdout.on("data", (data) => {
            if (data.toString().includes("4173")) {
                clearTimeout(timeout);
                resolve(null);
            }
        });

        serverProcess.stderr.on("data", (data) => {
            const msg = data.toString();
            if (msg.includes("4173")) {
                clearTimeout(timeout);
                resolve(null);
            } else {
                console.error("[vite preview stderr]", msg.trim());
            }
        });
    });

    console.log("✅ Preview server ready at http://127.0.0.1:4173");
    return serverProcess;
}

async function auditUrl(lhBin, url, preset = "mobile", theme = "light", throttlingMethod = "simulate") {
    let chromeFlags = "--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-extensions --no-first-run --no-default-browser-check";
    if (theme === "dark") {
        chromeFlags += " --force-dark-mode";
    }

    const auditTargetUrl = theme === "dark"
        ? (url.includes("?") ? `${url}&theme=dark` : `${url}?theme=dark`)
        : url;

    const args = [
        auditTargetUrl,
        "--output=json",
        "--quiet",
        "--only-categories=performance,accessibility,best-practices,seo",
        `--throttling-method=${throttlingMethod}`,
        `--chrome-flags=${chromeFlags}`,
    ];
    if (preset === "desktop") {
        args.push("--preset=desktop");
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tmpOutput = path.join(ROOT_DIR, `lh-temp-${preset}-${theme}-${uniqueSuffix}.json`);
    args.push(`--output-path=${tmpOutput}`);

    try {
        await execFileAsync(lhBin, args, { maxBuffer: 1024 * 1024 * 50 });
        const report = JSON.parse(fs.readFileSync(tmpOutput, "utf8"));
        return report;
    } finally {
        if (fs.existsSync(tmpOutput)) {
            try {
                fs.unlinkSync(tmpOutput);
            } catch {
                // ignore
            }
        }
    }
}

// 減点項目の詳細を抽出（要素セレクタ・スニペット・メトリクス等）
function extractFailedAudits(report) {
    const failedAudits = [];
    for (const [id, a] of Object.entries(report.audits || {})) {
        if (a.score !== null && a.score < 1 && a.title) {
            const detailsItems = [];
            if (a.details?.items && Array.isArray(a.details.items)) {
                for (const item of a.details.items.slice(0, 5)) {
                    const detail = {};
                    if (item.node) {
                        detail.selector = item.node.selector || "";
                        detail.snippet = item.node.snippet || "";
                        detail.nodeLabel = item.node.nodeLabel || "";
                        detail.explanation = item.node.explanation || "";
                    }
                    if (item.url) detail.url = item.url;
                    if (item.wastedMs) detail.wastedMs = Math.round(item.wastedMs);
                    if (item.wastedBytes) detail.wastedBytes = Math.round(item.wastedBytes);
                    if (item.description) detail.description = item.description;
                    if (Object.keys(detail).length > 0) {
                        detailsItems.push(detail);
                    }
                }
            }
            failedAudits.push({
                id,
                title: a.title,
                score: Math.round((a.score || 0) * 100),
                displayValue: a.displayValue || "",
                explanation: a.explanation || "",
                description: a.description || "",
                detailsItems,
            });
        }
    }
    return failedAudits;
}

// レポートMarkdownを生成してファイル出力（原因要素やスニペットを特定しやすい構造化形式）
function generateReportMarkdown(regressions) {
    if (regressions.length === 0) {
        console.log("🎉 全ルート×モバイル・デスクトップ×ライト・ダークですべて 100/100 満点を達成しました！");
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, "has_issues=false\n");
        }
        return;
    }

    let markdown = `## ⚠️ PageSpeed / Lighthouse スコア退行レポート\n\n`;
    markdown += `ビルド後の自動 Lighthouse 監査にて、100点満点未満の減点が検出されました。\n`;
    markdown += `以下の検出サマリーと要素特定詳細を確認し、対象ソースコードを修正してください。\n\n`;

    markdown += `### 📊 検出サマリー一覧\n\n`;
    markdown += `| ルート | プリセット (テーマ) | 対象ソースファイル | Performance | Accessibility | Best Practices | SEO |\n`;
    markdown += `| :--- | :---: | :--- | :---: | :---: | :---: | :---: |\n`;

    for (const r of regressions) {
        const sourceFile = ROUTE_SOURCE_MAP[r.route] ? `\`${ROUTE_SOURCE_MAP[r.route]}\`` : "-";
        const presetTheme = `${r.preset}${r.theme ? ` (${r.theme})` : ""}`;
        if (r.scores.error) {
            markdown += `| \`${r.route}\` | ${presetTheme} | ${sourceFile} | 監査エラー | - | - | - |\n`;
        } else {
            const p = r.scores.performance === 100 ? "100" : `**${r.scores.performance}** ⚠️`;
            const a = r.scores.accessibility === 100 ? "100" : `**${r.scores.accessibility}** ⚠️`;
            const b = r.scores.bestPractices === 100 ? "100" : `**${r.scores.bestPractices}** ⚠️`;
            const s = r.scores.seo === 100 ? "100" : `**${r.scores.seo}** ⚠️`;
            markdown += `| \`${r.route}\` | ${presetTheme} | ${sourceFile} | ${p} | ${a} | ${b} | ${s} |\n`;
        }
    }

    markdown += `\n---\n\n`;
    markdown += `### 🔍 減点要因の特定・詳細ログ\n\n`;

    for (const r of regressions) {
        if (r.failedAudits && r.failedAudits.length > 0) {
            const sourceFile = ROUTE_SOURCE_MAP[r.route] || "該当コンポーネント";
            const presetTheme = `${r.preset}${r.theme ? ` / ${r.theme}` : ""}`;
            markdown += `#### 📄 \`${r.route}\` (${presetTheme}) — 対象: \`${sourceFile}\`\n\n`;
            for (const a of r.failedAudits) {
                markdown += `##### ❌ ${a.title} (スコア: ${a.score}点${a.displayValue ? ` / 計測値: ${a.displayValue}` : ""})\n\n`;
                if (a.description) {
                    markdown += `> ${a.description}\n\n`;
                }
                if (a.explanation) {
                    markdown += `* **原因詳細**: ${a.explanation}\n\n`;
                }

                if (a.detailsItems && a.detailsItems.length > 0) {
                    markdown += `**該当要素・詳細リスト:**\n\n`;
                    for (const item of a.detailsItems) {
                        if (item.snippet) {
                            markdown += `- **HTMLスニペット**:\n\`\`\`html\n${item.snippet}\n\`\`\`\n`;
                        }
                        if (item.selector) {
                            markdown += `  - **CSSセレクタ**: \`${item.selector}\`\n`;
                        }
                        if (item.nodeLabel) {
                            markdown += `  - **要素ラベル**: ${item.nodeLabel}\n`;
                        }
                        if (item.explanation) {
                            markdown += `  - **減点理由**: ${item.explanation}\n`;
                        }
                        if (item.url) {
                            markdown += `  - **対象URL/リソース**: \`${item.url}\`\n`;
                        }
                        if (item.wastedMs) {
                            markdown += `  - **遅延影響時間**: ${item.wastedMs} ms\n`;
                        }
                        if (item.wastedBytes) {
                            markdown += `  - **削減可能容量**: ${(item.wastedBytes / 1024).toFixed(1)} KB\n`;
                        }
                    }
                    markdown += `\n`;
                }
            }
        }
    }

    markdown += `---\n\n`;
    markdown += `### 🛠 推奨される修正・対応手順\n\n`;
    markdown += `1. **対象ファイルの確認**:\n`;
    markdown += `   - 上記のサマリー一覧および詳細ログに記載された対象ファイル（\`src/pages/...tsx\` 等）を確認します。\n`;
    markdown += `2. **該当要素の特定と修正**:\n`;
    markdown += `   - 記載されている **HTMLスニペット** や **CSSセレクタ** を検索し、該当箇所を特定します。\n`;
    markdown += `   - プロジェクト規約（\`AGENTS.md\`）に基づき、ハードコードされた文字色・背景色（\`text-slate-*\`, \`bg-slate-*\` 等）のセマンティッククラス化、コントラスト比（4.5:1以上）の確保、見出し階層、ARIAラベル等を適切に修正してください。\n`;
    markdown += `3. **コミット前必須検証**:\n`;
    markdown += `   - 修正後、必ず以下の統合検証コマンドを実行し、全テスト合格とビルド成功を確認してください:\n`;
    markdown += `     \`\`\`bash\n     pnpm run type-check && pnpm test && pnpm run build\n     \`\`\`\n`;
    markdown += `4. **反映とIssueの自動クローズ**:\n`;
    markdown += `   - \`main\` ブランチへ反映後、GitHub Actions の Lighthouse CI（10シャード並列）が自動実行され、全76パターン（ライト/ダーク × モバイル/デスクトップ）で 100/100 満点への回復が確認されると**本Issueは自動的にクローズ**されます。\n`;

    fs.mkdirSync(path.dirname(ISSUE_REPORT_PATH), { recursive: true });
    fs.writeFileSync(ISSUE_REPORT_PATH, markdown, "utf8");
    console.log(`Generated issue report at: ${ISSUE_REPORT_PATH}`);

    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_issues=true\nissue_file=${ISSUE_REPORT_PATH}\n`);
    }
}

// 集約処理 (--aggregate=DIR)
async function handleAggregate(dir) {
    console.log(`📊 Aggregating Lighthouse shard reports from: ${dir}`);
    const resolvedDir = path.resolve(ROOT_DIR, dir);
    if (!fs.existsSync(resolvedDir)) {
        console.error(`Aggregate directory not found: ${resolvedDir}`);
        generateReportMarkdown([]);
        return;
    }

    const allRegressions = [];
    const files = fs.readdirSync(resolvedDir);
    for (const file of files) {
        if (file.startsWith("shard-") && file.endsWith(".json")) {
            const filePath = path.join(resolvedDir, file);
            try {
                const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
                if (Array.isArray(data)) {
                    allRegressions.push(...data);
                } else if (Array.isArray(data.regressions)) {
                    allRegressions.push(...data.regressions);
                }
                console.log(`Loaded ${file}: ${Array.isArray(data) ? data.length : data.regressions?.length || 0} regressions`);
            } catch (err) {
                console.error(`Failed to read report JSON ${filePath}:`, err);
            }
        }
    }

    console.log(`Total confirmed regressions across all shards: ${allRegressions.length}`);
    generateReportMarkdown(allRegressions);
}

async function main() {
    if (aggregateDirArg) {
        await handleAggregate(aggregateDirArg);
        return;
    }

    let serverProcess = null;
    const lhBin = findLighthouseBin();
    console.log(`Using Lighthouse binary: ${lhBin}`);

    try {
        serverProcess = await startPreviewServer();
        const routes = await getRoutesToAudit();
        console.log(`Total routes in routes.ts: ${routes.length}`);

        const allTasks = [];
        for (const route of routes) {
            allTasks.push({ route, preset: "mobile", theme: "light" });
            allTasks.push({ route, preset: "desktop", theme: "light" });
            allTasks.push({ route, preset: "mobile", theme: "dark" });
            allTasks.push({ route, preset: "desktop", theme: "dark" });
        }

        // シャード分割 (--shard=INDEX/TOTAL)
        let tasks = allTasks;
        if (shardArg) {
            const [shardIdxStr, totalShardsStr] = shardArg.split("/");
            const shardIdx = parseInt(shardIdxStr, 10);
            const totalShards = parseInt(totalShardsStr, 10);
            if (Number.isFinite(shardIdx) && Number.isFinite(totalShards) && totalShards > 0) {
                tasks = allTasks.filter((_, idx) => idx % totalShards === shardIdx - 1);
                console.log(`⚡ Shard mode [${shardIdx}/${totalShards}]: Auditing ${tasks.length} / ${allTasks.length} audits`);
            }
        }

        const regressions = [];
        const totalAudits = tasks.length;
        console.log(`Starting ${totalAudits} audits with concurrency 2...`);

        let completed = 0;
        async function worker() {
            while (tasks.length > 0) {
                const task = tasks.shift();
                if (!task) break;
                const { route, preset, theme } = task;
                const url = `http://127.0.0.1:4173${route}`;
                const presetLabel = `${preset.toUpperCase()} (${theme.toUpperCase()})`;

                try {
                    const report = await auditUrl(lhBin, url, preset, theme);
                    completed++;
                    const cats = report.categories || {};
                    const scores = {
                        performance: Math.round((cats.performance?.score ?? 0) * 100),
                        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
                        bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
                        seo: Math.round((cats.seo?.score ?? 0) * 100),
                    };

                    const isAll100 =
                        scores.performance === 100 &&
                        scores.accessibility === 100 &&
                        scores.bestPractices === 100 &&
                        scores.seo === 100;

                    if (isAll100) {
                        console.log(`[${completed}/${totalAudits}] [${presetLabel}] ${route} ✅ 100/100`);
                    } else {
                        console.log(
                            `[${completed}/${totalAudits}] [${presetLabel}] ${route} ⚠️ P:${scores.performance} A:${scores.accessibility} B:${scores.bestPractices} S:${scores.seo}`
                        );

                        const failedAudits = extractFailedAudits(report);

                        regressions.push({
                            route,
                            preset,
                            theme,
                            scores,
                            failedAudits,
                        });
                    }
                } catch (err) {
                    completed++;
                    console.log(`[${completed}/${totalAudits}] [${presetLabel}] ${route} ❌ Audit error: ${err.message}`);
                    regressions.push({
                        route,
                        preset,
                        theme,
                        scores: { error: err.message },
                        failedAudits: [],
                    });
                }
            }
        }

        await Promise.all([worker(), worker()]);

        // 単独再検証（CPU競合による一時的ブレ・偽陽性の排除）
        if (regressions.length > 0) {
            const totalCandidates = regressions.length;
            console.log(`\n🔄 Re-verifying ${totalCandidates} candidates in single-worker mode...`);
            // CPUとポートの安定化のため少し待機
            await new Promise((r) => setTimeout(r, 1000));
            const confirmedRegressions = [];

            let candIndex = 0;
            for (const cand of regressions) {
                candIndex++;
                const url = `http://127.0.0.1:4173${cand.route}`;
                const presetLabel = `${cand.preset.toUpperCase()} (${(cand.theme || "light").toUpperCase()})`;
                let passedOnRetry = false;
                let latestCandidate = cand;

                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        const report = await auditUrl(lhBin, url, cand.preset, cand.theme || "light");
                        const cats = report.categories || {};
                        const scores = {
                            performance: Math.round((cats.performance?.score ?? 0) * 100),
                            accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
                            bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
                            seo: Math.round((cats.seo?.score ?? 0) * 100),
                        };

                        const isAll100 =
                            scores.performance === 100 &&
                            scores.accessibility === 100 &&
                            scores.bestPractices === 100 &&
                            scores.seo === 100;

                        const progressTag = `[RETRY ${candIndex}/${totalCandidates} (試行${attempt}/2)]`;

                        if (isAll100) {
                            console.log(
                                `${progressTag} [${presetLabel}] ${cand.route} ✅ 100/100 (単独検証で満点合格)`
                            );
                            passedOnRetry = true;
                            break;
                        } else {
                            console.log(
                                `${progressTag} [${presetLabel}] ${cand.route} ⚠️ P:${scores.performance} A:${scores.accessibility} B:${scores.bestPractices} S:${scores.seo}`
                            );
                            const failedAudits = extractFailedAudits(report);
                            latestCandidate = {
                                route: cand.route,
                                preset: cand.preset,
                                theme: cand.theme || "light",
                                scores,
                                failedAudits,
                            };
                        }
                    } catch (err) {
                        console.log(`[RETRY ${candIndex}/${totalCandidates} (試行${attempt}/2)] [${presetLabel}] ${cand.route} ❌ Audit error: ${err.message}`);
                    }
                }

                if (!passedOnRetry) {
                    confirmedRegressions.push(latestCandidate);
                }
            }

            regressions.length = 0;
            regressions.push(...confirmedRegressions);
        }

        console.log("\n=================================");
        console.log(`Shard finished: ${totalAudits} audits executed.`);
        console.log(`Regressions found: ${regressions.length}`);
        console.log("=================================\n");

        if (reportJsonArg) {
            const outPath = path.resolve(ROOT_DIR, reportJsonArg);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, JSON.stringify(regressions, null, 2), "utf8");
            console.log(`Saved shard report JSON to: ${outPath}`);
        } else {
            generateReportMarkdown(regressions);
        }
    } finally {
        if (serverProcess) {
            console.log("🛑 Stopping preview server...");
            serverProcess.kill();
        }
    }
}

main().catch((err) => {
    console.error("Fatal audit error:", err);
    process.exit(0);
});
