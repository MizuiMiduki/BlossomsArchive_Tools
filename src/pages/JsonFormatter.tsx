import { createSignal, createMemo, onSettled, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";

export default function JsonFormatter() {
    const { title, description } = usePageI18n("/json-formatter", {
        defaultTitle: "JSON整形・検証・ミニファイ",
        defaultDescription:
            "JSONデータの構文エラー検証、インデント整形、1行ミニファイ、サイズ統計をブラウザ内で完全ローカルに実行します。データは外部に送信されません。",
    });
    let containerRef: HTMLDivElement | undefined;
    const [rawJson, setRawJson] = createSignal("");
    const [indentSize, setIndentSize] = createSignal<number | "tab">(2);
    const [copyMessage, setCopyMessage] = createSignal("");

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
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
        <div ref={containerRef} class="ba-page ba-page--wide">
            <div class="ba-card ba-stack-4">
                {/* ヘッダー */}
                <div style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "1rem" }}>
                    <h1 class="ba-title">
                        <BudouX text={title()} />
                    </h1>
                    <p
                        class="ba-text-xs ba-text-muted"
                        style={{ "margin-top": "0.375rem", "margin-bottom": 0, "line-height": 1.6, "font-weight": 600 }}
                    >
                        {description()}
                    </p>
                </div>

                {/* コントロールツールバー */}
                <div
                    class="ba-panel ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3"
                    style={{ padding: "0.75rem" }}
                >
                    <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap">
                        <span class="ba-text-xs ba-font-bold ba-text-muted">インデント:</span>
                        <div class="ba-tabs" style={{ padding: "0.2rem" }}>
                            <button
                                type="button"
                                class={`ba-tab ${indentSize() === 2 ? "is-active" : ""}`}
                                style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                onClick={() => setIndentSize(2)}
                            >
                                2スペース
                            </button>
                            <button
                                type="button"
                                class={`ba-tab ${indentSize() === 4 ? "is-active" : ""}`}
                                style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                onClick={() => setIndentSize(4)}
                            >
                                4スペース
                            </button>
                            <button
                                type="button"
                                class={`ba-tab ${indentSize() === "tab" ? "is-active" : ""}`}
                                style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                onClick={() => setIndentSize("tab")}
                            >
                                Tab
                            </button>
                        </div>
                    </div>

                    <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap">
                        <button
                            type="button"
                            class="ba-btn ba-btn--xs ba-btn--outline"
                            onClick={loadSample}
                        >
                            サンプル読込
                        </button>
                        <button
                            type="button"
                            class="ba-btn ba-btn--xs ba-btn--primary"
                            onClick={handleFormatInPlace}
                            disabled={!parseResult().isValid}
                        >
                            整形 (Beautify)
                        </button>
                        <button
                            type="button"
                            class="ba-btn ba-btn--xs ba-btn--secondary"
                            onClick={handleMinifyInPlace}
                            disabled={!parseResult().isValid}
                        >
                            圧縮 (Minify)
                        </button>
                        <button
                            type="button"
                            class="ba-btn ba-btn--xs ba-btn--danger"
                            onClick={() => setRawJson("")}
                            disabled={!rawJson()}
                        >
                            クリア
                        </button>
                    </div>
                </div>

                {/* 入力エディタ領域 */}
                <div class="ba-grid-2">
                    {/* 左：入力 */}
                    <div class="ba-stack-2 ba-min-w-0">
                        <div class="ba-flex ba-items-center ba-justify-between" style={{ "padding-inline": "0.25rem" }}>
                            <label class="ba-label" style={{ "font-size": "0.75rem" }} for="json-input-textarea">
                                JSON入力
                            </label>
                            <span class="ba-mono ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                {rawJson().length} 文字
                            </span>
                        </div>
                        <textarea
                            id="json-input-textarea"
                            value={rawJson()}
                            onInput={(e) => setRawJson(e.currentTarget.value)}
                            class="ba-textarea ba-mono ba-text-xs"
                            style={{ height: "22rem", "line-height": 1.6 }}
                            placeholder='{"example": "ここにJSONを貼り付けてください"}'
                            aria-label="JSON入力欄"
                        />
                    </div>

                    {/* 右：プレビュー・検証結果 */}
                    <div class="ba-stack-2 ba-min-w-0">
                        <div class="ba-flex ba-items-center ba-justify-between" style={{ "padding-inline": "0.25rem" }}>
                            <div class="ba-flex ba-items-center ba-gap-2">
                                <span class="ba-text-xs ba-font-bold ba-text-muted">プレビュー / 出力</span>
                                <Show when={parseResult().isValid === true}>
                                    <span class="ba-badge ba-badge--success">構文OK</span>
                                </Show>
                                <Show when={parseResult().isValid === false}>
                                    <span class="ba-badge ba-badge--danger">構文エラー</span>
                                </Show>
                            </div>
                            <div class="ba-flex ba-items-center ba-gap-2">
                                <Show when={copyMessage()}>
                                    <span class="ba-text-xs ba-text-success ba-font-bold">
                                        {copyMessage()}
                                    </span>
                                </Show>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
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
                                    class="ba-textarea ba-mono ba-text-xs"
                                    style={{
                                        height: "22rem",
                                        "line-height": 1.6,
                                        "background-color": "var(--ba-surface-2)",
                                    }}
                                    placeholder="整形されたJSONがここに表示されます"
                                    aria-label="整形済みJSONプレビュー"
                                />
                            }
                        >
                            <div
                                class="ba-flex-col ba-justify-between"
                                style={{
                                    width: "100%",
                                    height: "22rem",
                                    "background-color": "var(--ba-danger-soft)",
                                    border: "2px solid var(--ba-danger)",
                                    "border-radius": "var(--ba-radius)",
                                    padding: "1rem",
                                }}
                            >
                                <div class="ba-stack-2">
                                    <div class="ba-flex ba-items-center ba-gap-2 ba-text-danger ba-font-bold ba-text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="ba-icon-sm ba-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>JSON構文エラー</span>
                                    </div>
                                    <p
                                        class="ba-mono ba-text-xs ba-break-all"
                                        style={{
                                            color: "var(--ba-danger-soft-fg)",
                                            "background-color": "var(--ba-surface)",
                                            padding: "0.75rem",
                                            "border-radius": "var(--ba-radius-sm)",
                                            border: "1px solid var(--ba-danger)",
                                            margin: 0,
                                        }}
                                    >
                                        {parseResult().error}
                                    </p>
                                </div>
                                <p class="ba-text-muted" style={{ "font-size": "0.6875rem", margin: 0 }}>
                                    クォートの閉じ忘れ、末尾の不要なカンマ（Trailing comma）、シングルクォート（ダブルクォート必須）などを確認してください。
                                </p>
                            </div>
                        </Show>
                    </div>
                </div>

                {/* 統計情報カード */}
                <Show when={jsonStats()}>
                    {(stats) => (
                        <div class="ba-panel ba-stack-3" style={{ "margin-top": "0.5rem" }}>
                            <h2 class="ba-text-xs ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                                データ統計情報
                            </h2>
                            <div class="ba-grid-4 ba-text-center">
                                <div
                                    style={{
                                        "background-color": "var(--ba-surface)",
                                        padding: "0.625rem",
                                        "border-radius": "var(--ba-radius-sm)",
                                        border: "1px solid var(--ba-border)",
                                    }}
                                >
                                    <span class="ba-text-muted" style={{ "font-size": "0.625rem", display: "block" }}>プロパティ数</span>
                                    <span class="ba-mono ba-font-bold ba-text-sm">{stats().keyCount}</span>
                                </div>
                                <div
                                    style={{
                                        "background-color": "var(--ba-surface)",
                                        padding: "0.625rem",
                                        "border-radius": "var(--ba-radius-sm)",
                                        border: "1px solid var(--ba-border)",
                                    }}
                                >
                                    <span class="ba-text-muted" style={{ "font-size": "0.625rem", display: "block" }}>最大ネスト階層</span>
                                    <span class="ba-mono ba-font-bold ba-text-sm">{stats().maxDepth}</span>
                                </div>
                                <div
                                    style={{
                                        "background-color": "var(--ba-surface)",
                                        padding: "0.625rem",
                                        "border-radius": "var(--ba-radius-sm)",
                                        border: "1px solid var(--ba-border)",
                                    }}
                                >
                                    <span class="ba-text-muted" style={{ "font-size": "0.625rem", display: "block" }}>圧縮後サイズ</span>
                                    <span class="ba-mono ba-font-bold ba-text-sm ba-text-primary">{stats().minBytes} bytes</span>
                                </div>
                                <div
                                    style={{
                                        "background-color": "var(--ba-surface)",
                                        padding: "0.625rem",
                                        "border-radius": "var(--ba-radius-sm)",
                                        border: "1px solid var(--ba-border)",
                                    }}
                                >
                                    <span class="ba-text-muted" style={{ "font-size": "0.625rem", display: "block" }}>圧縮削減率</span>
                                    <span class="ba-mono ba-font-bold ba-text-sm ba-text-success">{stats().savedPercent}%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </Show>
            </div>

            <AdSense />
        </div>
    );
}
