import { createSignal, createMemo, onSettled, For, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";

interface NoteTiming {
    name: string;
    beats: number;
    type: "normal" | "dotted" | "triplet";
}

export default function BpmCalculator() {
    let containerRef: HTMLDivElement | undefined;
    const [bpm, setBpm] = createSignal<number>(120);
    const [tapTimes, setTapTimes] = createSignal<number[]>([]);
    const [tapFeedback, setTapFeedback] = createSignal<string>("");

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
    });

    const safeBpm = createMemo(() => {
        const val = bpm();
        if (!Number.isFinite(val) || val <= 0) return 120;
        return Math.min(999, Math.max(1, Math.round(val * 10) / 10));
    });

    // 1拍（4分音符）あたりのミリ秒: 60,000 / BPM
    const quarterNoteMs = createMemo(() => 60000 / safeBpm());

    // 周波数（Hz）: BPM / 60
    const baseHz = createMemo(() => Math.round((safeBpm() / 60) * 1000) / 1000);

    const noteDefinitions: NoteTiming[] = [
        { name: "全音符 (1/1)", beats: 4, type: "normal" },
        { name: "付点2分音符 (1/2.)", beats: 3, type: "dotted" },
        { name: "2分音符 (1/2)", beats: 2, type: "normal" },
        { name: "付点4分音符 (1/4.)", beats: 1.5, type: "dotted" },
        { name: "4分音符 (1/4)", beats: 1, type: "normal" },
        { name: "4分3連符 (1/4T)", beats: 2 / 3, type: "triplet" },
        { name: "付点8分音符 (1/8.)", beats: 0.75, type: "dotted" },
        { name: "8分音符 (1/8)", beats: 0.5, type: "normal" },
        { name: "8分3連符 (1/8T)", beats: 1 / 3, type: "triplet" },
        { name: "付点16分音符 (1/16.)", beats: 0.375, type: "dotted" },
        { name: "16分音符 (1/16)", beats: 0.25, type: "normal" },
        { name: "16分3連符 (1/16T)", beats: 1 / 6, type: "triplet" },
        { name: "32分音符 (1/32)", beats: 0.125, type: "normal" },
        { name: "64分音符 (1/64)", beats: 0.0625, type: "normal" },
    ];

    const noteTimings = createMemo(() => {
        const base = quarterNoteMs();
        return noteDefinitions.map((def) => {
            const ms = base * def.beats;
            const hz = 1000 / ms;
            return {
                ...def,
                ms: Math.round(ms * 10) / 10,
                hz: Math.round(hz * 100) / 100,
            };
        });
    });

    // タップテンポ計測
    const handleTap = () => {
        const now = performance.now();
        const history = [...tapTimes(), now];

        // 3秒以上間隔が空いたらリセット
        if (history.length > 1 && now - history[history.length - 2] > 3000) {
            setTapTimes([now]);
            setTapFeedback("リセット - もう一度タップしてください");
            return;
        }

        // 最新8回分を保持
        const recent = history.slice(-8);
        setTapTimes(recent);

        if (recent.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < recent.length; i++) {
                intervals.push(recent[i] - recent[i - 1]);
            }
            const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const calculatedBpm = Math.round((60000 / avgIntervalMs) * 10) / 10;
            if (calculatedBpm >= 30 && calculatedBpm <= 400) {
                setBpm(calculatedBpm);
                setTapFeedback(`BPM: ${calculatedBpm} (${recent.length}タップ平均)`);
            }
        } else {
            setTapFeedback("リズムに合わせて続けてタップ...");
        }
    };

    const resetTap = () => {
        setTapTimes([]);
        setTapFeedback("");
    };

    return (
        <div ref={containerRef} class="ba-page ba-page--wide">
            <div class="ba-card ba-stack-6">
                {/* ヘッダー */}
                <div style={{ "padding-bottom": "1rem", "border-bottom": "1px solid var(--ba-border)" }}>
                    <h1 class="ba-title">
                        <BudouX text="BPM・ディレイタイム換算機" />
                    </h1>
                    <p class="ba-text-xs ba-text-muted" style={{ "margin-top": "0.375rem", "margin-bottom": 0, "font-weight": 600, "line-height": 1.6 }}>
                        楽曲のテンポ（BPM）から各音符のディレイタイム（ms）やLFOレート（Hz）を即座に算出します。タップテンポ機能も搭載。
                    </p>
                </div>

                <div class="ba-flex ba-flex-wrap ba-gap-6 ba-items-start">
                    {/* 左側：BPM入力・タップテンポ */}
                    <div class="ba-stack-4 ba-min-w-0" style={{ flex: "5 1 18rem" }}>
                        <div class="ba-panel ba-stack-4" style={{ padding: "1.25rem" }}>
                            <div class="ba-field">
                                <label class="ba-label">
                                    <span>テンポ (BPM)</span>
                                </label>
                                <div class="ba-flex ba-items-center ba-gap-3">
                                    <input
                                        type="number"
                                        min="20"
                                        max="400"
                                        step="0.1"
                                        value={safeBpm()}
                                        onInput={(e) => setBpm(Number(e.currentTarget.value) || 120)}
                                        class="ba-input ba-input--lg ba-mono ba-font-black ba-text-primary"
                                        style={{ "font-size": "1.875rem" }}
                                        aria-label="テンポ (BPM)"
                                    />
                                    <div class="ba-stack-1">
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--xs ba-btn--outline"
                                            onClick={() => setBpm((prev) => Math.min(400, prev + 1))}
                                            aria-label="BPMを+1"
                                        >
                                            +1
                                        </button>
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--xs ba-btn--outline"
                                            onClick={() => setBpm((prev) => Math.max(20, prev - 1))}
                                            aria-label="BPMを-1"
                                        >
                                            -1
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <input
                                type="range"
                                min="40"
                                max="240"
                                value={safeBpm()}
                                onInput={(e) => setBpm(Number(e.currentTarget.value) || 120)}
                                class="ba-range"
                                aria-label="BPMスライダー"
                            />

                            {/* よく使われるテンポのショートカット */}
                            <div class="ba-stack-2">
                                <span class="ba-text-xs ba-font-bold ba-text-muted">
                                    定番テンポプリセット
                                </span>
                                <div
                                    class="ba-mono ba-text-xs"
                                    style={{ display: "grid", "grid-template-columns": "repeat(4, minmax(0, 1fr))", gap: "0.375rem" }}
                                >
                                    {[70, 85, 100, 120, 128, 140, 160, 175].map((preset) => (
                                        <button
                                            type="button"
                                            class={`ba-btn ba-btn--xs ${safeBpm() === preset ? "ba-btn--primary" : "ba-btn--outline"}`}
                                            onClick={() => setBpm(preset)}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* タップテンポ */}
                        <div class="ba-panel ba-text-center ba-stack-3" style={{ padding: "1.25rem" }}>
                            <span class="ba-text-xs ba-font-bold ba-text-muted">
                                タップテンポ (Tap Tempo)
                            </span>
                            <button
                                type="button"
                                onClick={handleTap}
                                class="ba-btn ba-btn--primary ba-btn--block ba-font-black"
                                style={{ height: "5rem", "font-size": "1.25rem" }}
                            >
                                TAP HERE
                            </button>
                            <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                                <span class="ba-text-xs ba-mono ba-text-muted ba-truncate">
                                    {tapFeedback() || "拍に合わせて数回タップ"}
                                </span>
                                <Show when={tapTimes().length > 0}>
                                    <button
                                        type="button"
                                        onClick={resetTap}
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-muted"
                                        aria-label="タップ計測をリセット"
                                    >
                                        リセット
                                    </button>
                                </Show>
                            </div>
                        </div>
                    </div>

                    {/* 右側：音符ごとのディレイタイム＆周波数一覧 */}
                    <div class="ba-panel ba-stack-3 ba-min-w-0" style={{ flex: "7 1 22rem", padding: "1.25rem" }}>
                        <div
                            class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2"
                            style={{ "padding-bottom": "0.5rem", "border-bottom": "1px solid var(--ba-border)" }}
                        >
                            <h2 class="ba-section-title ba-text-sm">
                                音符別ディレイタイム (ms) & LFOレート (Hz)
                            </h2>
                            <span class="ba-badge ba-badge--outline ba-mono">
                                1拍 = {Math.round(quarterNoteMs() * 10) / 10} ms ({baseHz()} Hz)
                            </span>
                        </div>

                        <div class="ba-table-wrap">
                            <table class="ba-table ba-mono">
                                <thead>
                                    <tr>
                                        <th>音符</th>
                                        <th class="ba-text-right">時間 (ms)</th>
                                        <th class="ba-text-right">周波数 (Hz)</th>
                                        <th class="ba-text-right">種別</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={noteTimings()}>
                                        {(timing) => (
                                            <tr>
                                                <td class="ba-font-bold">{timing.name}</td>
                                                <td class="ba-text-right ba-font-black ba-text-primary ba-text-sm">
                                                    {timing.ms.toLocaleString()} ms
                                                </td>
                                                <td class="ba-text-right ba-text-muted">
                                                    {timing.hz} Hz
                                                </td>
                                                <td class="ba-text-right">
                                                    <span
                                                        class={`ba-badge ${
                                                            timing.type === "dotted"
                                                                ? "ba-badge--warning"
                                                                : timing.type === "triplet"
                                                                  ? "ba-badge--info"
                                                                  : "ba-badge--neutral"
                                                        }`}
                                                    >
                                                        {timing.type === "dotted"
                                                            ? "付点"
                                                            : timing.type === "triplet"
                                                              ? "3連符"
                                                              : "ストレート"}
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <AdSense />
        </div>
    );
}
