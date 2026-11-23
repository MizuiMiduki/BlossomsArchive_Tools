import { createSignal, createMemo, onSettled, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";

export default function JsonFormatter() {
    let containerRef: HTMLDivElement | undefined;
    const [rawJson, setRawJson] = createSignal("");
    const [indentSize, setIndentSize] = createSignal<number | "tab">(2);
    const [copyMessage, setCopyMessage] = createSignal("");

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".card");
    });

    // パース・検証結果
    const parseResult = createMemo(() => {
        const text = rawJson().trim();
        if (!text) {
            return { isValid: null, data: null, error: null };
        }
        try {
            const data = JSON.parse(text);
            return { isValid: true, data, error: null };
        } catch (err: any) {
            return { isValid: false, data: null, error: err?.message || "不正なJSON形式です" };
        }
    });

    // 整形済みJSON
    const formattedJson = createMemo(() => {
        const res = parseResult();
        if (!res.isValid || res.data === null) return "";
        const space = indentSize() === "tab" ? "\t" : indentSize();
        return JSON.stringify(res.data, null, space);
    });

    // ミニファイJSON
    const minifiedJson = createMemo(() => {
        const res = parseResult();
        if (!res.isValid || res.data === null) return "";
        return JSON.stringify(res.data);
    });

    // JSON統計情報の算出
    const jsonStats = createMemo(() => {
        const res = parseResult();
        if (!res.isValid || res.data === null) return null;

        let keyCount = 0;
        let arrayCount = 0;
        let maxDepth = 0;

        function traverse(obj: any, depth: number) {
            if (depth > maxDepth) maxDepth = depth;
            if (Array.isArray(obj)) {
                arrayCount++;
                for (const item of obj) {
                    if (item && typeof item === "object") traverse(item, depth + 1);
                }
            } else if (obj && typeof obj === "object") {
                const keys = Object.keys(obj);
                keyCount += keys.length;
                for (const key of keys) {
                    const val = obj[key];
                    if (val && typeof val === "object") traverse(val, depth + 1);
                }
            }
        }

        traverse(res.data, 1);

        const rawBytes = new Blob([rawJson()]).size;
        const minBytes = new Blob([minifiedJson()]).size;
        const savedPercent = rawBytes > 0 ? Math.round(((rawBytes - minBytes) / rawBytes) * 100) : 0;

        return {
            keyCount,
            arrayCount,
            maxDepth,
            rawBytes,
            minBytes,
            savedPercent,
        };
    });

    const copyToClipboard = async (text: string, label: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage(`${label}をコピーしました！`);
            setTimeout(() => setCopyMessage(""), 2000);
        } catch {
            setCopyMessage("コピーに失敗しました");
        }
    };

    const handleFormatInPlace = () => {
        if (formattedJson()) {
            setRawJson(formattedJson());
        }
    };

    const handleMinifyInPlace = () => {
        if (minifiedJson()) {
            setRawJson(minifiedJson());
        }
    };

    const loadSample = () => {
        const sample = {
            project: "BlossomsArchive Tools",
            version: "2.0.0",
            features: [
                "100% Client Side Execution",
                "Solid.js 2.0 High Performance",
                "CSPRNG Security",
            ],
            settings: {
                darkMode: true,
                analytics: {
                    enabled: true,
                    provider: "Google Analytics 4",
                },
            },
            status: "active",
        };
        setRawJson(JSON.stringify(sample, null, 2));
    };

    return (
        <div ref={containerRef} class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0">
            <div class="w-full flex flex-col gap-6 sm:gap-8 min-w-0">
                <div class="card bg-base-100 shadow-xl p-4 sm:p-6 md:p-8 w-full border border-base-300 min-w-0">
                    {/* ヘッダー */}
                    <div class="mb-6 border-b border-base-300 pb-4">
                        <h1 class="text-2xl md:text-3xl font-black text-base-content">
                            <BudouX text="JSON整形・検証・ミニファイ" />
                        </h1>
                        <p class="text-xs font-semibold text-base-content/70 mt-1.5 leading-relaxed">
                            JSONデータの構文エラー検証、インデント整形、1行ミニファイ、サイズ統計をブラウザ内で完全ローカルに実行します。データは外部に送信されません。
                        </p>
                    </div>

                    {/* コントロールツールバー */}
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-4 bg-base-200/60 p-3 rounded-xl border border-base-300">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-bold text-base-content/80">インデント:</span>
                            <div class="join">
                                <button
                                    type="button"
                                    class={`join-item btn btn-xs ${indentSize() === 2 ? "btn-primary font-bold" : "btn-ghost"}`}
                                    onClick={() => setIndentSize(2)}
                                >
                                    2スペース
                                </button>
                                <button
                                    type="button"
                                    class={`join-item btn btn-xs ${indentSize() === 4 ? "btn-primary font-bold" : "btn-ghost"}`}
                                    onClick={() => setIndentSize(4)}
                                >
                                    4スペース
                                </button>
                                <button
                                    type="button"
                                    class={`join-item btn btn-xs ${indentSize() === "tab" ? "btn-primary font-bold" : "btn-ghost"}`}
                                    onClick={() => setIndentSize("tab")}
                                >
                                    Tab
                                </button>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                class="btn btn-xs btn-outline"
                                onClick={loadSample}
                            >
                                サンプル読込
                            </button>
                            <button
                                type="button"
                                class="btn btn-xs btn-primary text-white"
                                onClick={handleFormatInPlace}
                                disabled={!parseResult().isValid}
                            >
                                整形 (Beautify)
                            </button>
                            <button
                                type="button"
                                class="btn btn-xs btn-neutral"
                                onClick={handleMinifyInPlace}
                                disabled={!parseResult().isValid}
                            >
                                圧縮 (Minify)
                            </button>
                            <button
                                type="button"
                                class="btn btn-xs btn-error btn-outline"
                                onClick={() => setRawJson("")}
                                disabled={!rawJson()}
                            >
                                クリア
                            </button>
                        </div>
                    </div>

                    {/* 入力エディタ領域 */}
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                        {/* 左：入力 */}
                        <div class="flex flex-col gap-2">
                            <div class="flex items-center justify-between px-1">
                                <label class="text-xs font-bold text-base-content/80" for="json-input-textarea">
                                    JSON入力
                                </label>
                                <span class="text-[11px] font-mono text-base-content/60">
                                    {rawJson().length} 文字
                                </span>
                            </div>
                            <textarea
                                id="json-input-textarea"
                                value={rawJson()}
                                onInput={(e) => setRawJson(e.currentTarget.value)}
                                class="textarea textarea-bordered w-full h-80 sm:h-96 font-mono text-xs leading-relaxed bg-base-100 p-3 shadow-inner"
                                placeholder='{"example": "ここにJSONを貼り付けてください"}'
                                aria-label="JSON入力欄"
                            />
                        </div>

                        {/* 右：プレビュー・検証結果 */}
                        <div class="flex flex-col gap-2">
                            <div class="flex items-center justify-between px-1">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-bold text-base-content/80">プレビュー / 出力</span>
                                    <Show when={parseResult().isValid === true}>
                                        <span class="badge badge-success badge-xs font-bold text-white">構文OK</span>
                                    </Show>
                                    <Show when={parseResult().isValid === false}>
                                        <span class="badge badge-error badge-xs font-bold text-white">構文エラー</span>
                                    </Show>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Show when={copyMessage()}>
                                        <span class="text-xs text-success font-bold animate-pulse">
                                            {copyMessage()}
                                        </span>
                                    </Show>
                                    <button
                                        type="button"
                                        class="btn btn-ghost btn-xs text-primary font-bold"
                                        onClick={() => copyToClipboard(formattedJson() || rawJson(), "結果")}
                                        disabled={!rawJson().trim()}
                                        aria-label="結果をコピー"
                                    >
                                        コピー
                                    </button>
                                </div>
                            </div>

                            <Show
                                when={parseResult().isValid === false}
                                fallback={
                                    <textarea
                                        readonly
                                        value={formattedJson() || rawJson()}
                                        class="textarea textarea-bordered w-full h-80 sm:h-96 font-mono text-xs leading-relaxed bg-base-200/50 p-3"
                                        placeholder="整形されたJSONがここに表示されます"
                                        aria-label="整形済みJSONプレビュー"
                                    />
                                }
                            >
                                <div class="w-full h-80 sm:h-96 bg-red-500/10 border-2 border-red-500/30 rounded-xl p-4 flex flex-col justify-between">
                                    <div class="space-y-2">
                                        <div class="flex items-center gap-2 text-red-500 font-bold text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>JSON構文エラー</span>
                                        </div>
                                        <p class="font-mono text-xs text-red-600 dark:text-red-400 break-all bg-base-100 p-3 rounded-lg border border-red-500/20">
                                            {parseResult().error}
                                        </p>
                                    </div>
                                    <p class="text-[11px] text-base-content/70">
                                        クォートの閉じ忘れ、末尾の不要なカンマ（Trailing comma）、シングルクォート（ダブルクォート必須）などを確認してください。
                                    </p>
                                </div>
                            </Show>
                        </div>
                    </div>

                    {/* 統計情報カード */}
                    <Show when={jsonStats()}>
                        {(stats) => (
                            <div class="mt-6 bg-base-200/60 p-4 rounded-xl border border-base-300">
                                <h2 class="text-xs font-bold text-base-content/80 mb-3">
                                    データ統計情報
                                </h2>
                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                    <div class="bg-base-100 p-2.5 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">プロパティ数</span>
                                        <span class="font-mono font-bold text-sm text-base-content">{stats().keyCount}</span>
                                    </div>
                                    <div class="bg-base-100 p-2.5 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">最大ネスト階層</span>
                                        <span class="font-mono font-bold text-sm text-base-content">{stats().maxDepth}</span>
                                    </div>
                                    <div class="bg-base-100 p-2.5 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">圧縮後サイズ</span>
                                        <span class="font-mono font-bold text-sm text-primary">{stats().minBytes} bytes</span>
                                    </div>
                                    <div class="bg-base-100 p-2.5 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">圧縮削減率</span>
                                        <span class="font-mono font-bold text-sm text-success">{stats().savedPercent}%</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Show>
                </div>

                <AdSense />
            </div>
        </div>
    );
}
