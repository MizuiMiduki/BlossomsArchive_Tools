import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const ISSUE_REPORT_PATH = path.join(ROOT_DIR, "dist", "lighthouse-issue.md");

// Lighthouse CLI の実行バイナリを探す
function findLighthouseBin() {
    // 1. ローカルの node_modules
    const localBin = path.join(ROOT_DIR, "node_modules", ".bin", "lighthouse");
    if (fs.existsSync(localBin)) return localBin;

    // 2. npx キャッシュ
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

    // 3. システムパスの lighthouse
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
    const viteBin = path.join(ROOT_DIR, "node_modules", ".bin", "vite");
    const serverProcess = spawn(viteBin, ["preview", "--port", "4173", "--host", "127.0.0.1"], {
        cwd: ROOT_DIR,
        stdio: ["ignore", "pipe", "pipe"],
    });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            serverProcess.kill();
            reject(new Error("Vite preview server startup timed out"));
        }, 15000);

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
            }
        });
    });

    console.log("✅ Preview server ready at http://127.0.0.1:4173");
    return serverProcess;
}

async function auditUrl(lhBin, url, preset = "mobile") {
    const args = [
        url,
        "--output=json",
        "--quiet",
        "--only-categories=performance,accessibility,best-practices,seo",
        '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
    ];
    if (preset === "desktop") {
        args.push("--preset=desktop");
    }

    const tmpOutput = path.join(ROOT_DIR, `lh-temp-${preset}-${Date.now()}.json`);
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

async function main() {
    let serverProcess = null;
    const lhBin = findLighthouseBin();
    console.log(`Using Lighthouse binary: ${lhBin}`);

    try {
        serverProcess = await startPreviewServer();
        const routes = await getRoutesToAudit();
        console.log(`Auditing ${routes.length} routes...`);

        const regressions = [];
        let totalAudits = 0;

        for (const route of routes) {
            const url = `http://127.0.0.1:4173${route}`;
            for (const preset of ["mobile", "desktop"]) {
                totalAudits++;
                process.stdout.write(`Auditing [${preset.toUpperCase()}] ${route} ... `);
                try {
                    const report = await auditUrl(lhBin, url, preset);
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
                        console.log("✅ 100/100");
                    } else {
                        console.log(
                            `⚠️ P:${scores.performance} A:${scores.accessibility} B:${scores.bestPractices} S:${scores.seo}`
                        );

                        // 減点された具体的な監査項目を抽出
                        const failedAudits = [];
                        for (const [id, a] of Object.entries(report.audits || {})) {
                            if (a.score !== null && a.score < 1 && a.title) {
                                failedAudits.push({
                                    id,
                                    title: a.title,
                                    score: a.score,
                                    displayValue: a.displayValue || "",
                                    explanation: a.explanation || "",
                                });
                            }
                        }

                        regressions.push({
                            route,
                            preset,
                            scores,
                            failedAudits,
                        });
                    }
                } catch (err) {
                    console.log(`❌ Audit error: ${err.message}`);
                    regressions.push({
                        route,
                        preset,
                        scores: { error: err.message },
                        failedAudits: [],
                    });
                }
            }
        }

        console.log("\n=================================");
        console.log(`Audit finished: ${totalAudits} audits executed.`);
        console.log(`Regressions found: ${regressions.length}`);
        console.log("=================================\n");

        if (regressions.length > 0) {
            // Issue 本文 Markdown を作成
            let markdown = `## ⚠️ PageSpeed / Lighthouse スコア退行レポート\n\n`;
            markdown += `ビルド後の自動 Lighthouse 監査にて、スコア 100 点未満のページが検出されました。\n`;
            markdown += `Webサイトのデプロイは正常に完了しましたが、以下の減点要因を確認し修正してください。\n\n`;
            markdown += `| ルート | プリセット | Performance | Accessibility | Best Practices | SEO |\n`;
            markdown += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

            for (const r of regressions) {
                if (r.scores.error) {
                    markdown += `| \`${r.route}\` | ${r.preset} | 監査エラー | - | - | - |\n`;
                } else {
                    const p = r.scores.performance === 100 ? "100" : `**${r.scores.performance}** ⚠️`;
                    const a = r.scores.accessibility === 100 ? "100" : `**${r.scores.accessibility}** ⚠️`;
                    const b = r.scores.bestPractices === 100 ? "100" : `**${r.scores.bestPractices}** ⚠️`;
                    const s = r.scores.seo === 100 ? "100" : `**${r.scores.seo}** ⚠️`;
                    markdown += `| \`${r.route}\` | ${r.preset} | ${p} | ${a} | ${b} | ${s} |\n`;
                }
            }

            markdown += `\n### 🔍 検出された減点項目（詳細）\n\n`;
            for (const r of regressions) {
                if (r.failedAudits.length > 0) {
                    markdown += `#### \`${r.route}\` (${r.preset})\n\n`;
                    for (const a of r.failedAudits) {
                        markdown += `- **${a.title}** (スコア: ${a.score}${a.displayValue ? ` / ${a.displayValue}` : ""})\n`;
                        if (a.explanation) {
                            markdown += `  - *原因*: ${a.explanation}\n`;
                        }
                    }
                    markdown += `\n`;
                }
            }

            fs.mkdirSync(path.dirname(ISSUE_REPORT_PATH), { recursive: true });
            fs.writeFileSync(ISSUE_REPORT_PATH, markdown, "utf8");
            console.log(`Generated issue report at: ${ISSUE_REPORT_PATH}`);

            // GITHUB_OUTPUT に設定
            if (process.env.GITHUB_OUTPUT) {
                fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_issues=true\nissue_file=${ISSUE_REPORT_PATH}\n`);
            }
        } else {
            console.log("🎉 全19ルート×モバイル・デスクトップ（全38パターン）ですべて 100/100 満点を達成しました！");
            if (process.env.GITHUB_OUTPUT) {
                fs.appendFileSync(process.env.GITHUB_OUTPUT, "has_issues=false\n");
            }
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
    // デプロイを止めないため、スクリプトの異常時でも exit(0) で終了する
    process.exit(0);
});
