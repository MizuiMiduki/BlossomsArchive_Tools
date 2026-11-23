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
        if (containerRef) playPageEntrance(containerRef, ".card");
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
        <div ref={containerRef} class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0">
            <div class="w-full flex flex-col gap-6 sm:gap-8 min-w-0">
                <div class="card bg-base-100 shadow-xl p-4 sm:p-6 md:p-8 w-full border border-base-300 min-w-0">
                    {/* ヘッダー */}
                    <div class="mb-6 border-b border-base-300 pb-4">
                        <h1 class="text-2xl md:text-3xl font-black text-base-content">
                            <BudouX text="BPM・ディレイタイム換算機" />
                        </h1>
                        <p class="text-xs font-semibold text-base-content/70 mt-1.5 leading-relaxed">
                            楽曲のテンポ（BPM）から各音符のディレイタイム（ms）やLFOレート（Hz）を即座に算出します。タップテンポ機能も搭載。
                        </p>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* 左側：BPM入力・タップテンポ */}
                        <div class="lg:col-span-5 flex flex-col gap-5">
                            <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300">
                                <label class="label py-1">
                                    <span class="label-text font-bold text-sm text-base-content/90">
                                        テンポ (BPM)
                                    </span>
                                </label>
                                <div class="flex items-center gap-3 mt-1">
                                    <input
                                        type="number"
                                        min="20"
                                        max="400"
                                        step="0.1"
                                        value={safeBpm()}
                                        onInput={(e) => setBpm(Number(e.currentTarget.value) || 120)}
                                        class="input input-bordered input-lg w-full font-mono text-3xl font-black text-primary bg-base-100"
                                        aria-label="テンポ (BPM)"
                                    />
                                    <div class="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            class="btn btn-xs btn-outline"
                                            onClick={() => setBpm((prev) => Math.min(400, prev + 1))}
                                            aria-label="BPMを+1"
                                        >
                                            +1
                                        </button>
                                        <button
                                            type="button"
                                            class="btn btn-xs btn-outline"
                                            onClick={() => setBpm((prev) => Math.max(20, prev - 1))}
                                            aria-label="BPMを-1"
                                        >
                                            -1
                                        </button>
                                    </div>
                                </div>

                                <input
                                    type="range"
                                    min="40"
                                    max="240"
                                    value={safeBpm()}
                                    onInput={(e) => setBpm(Number(e.currentTarget.value) || 120)}
                                    class="range range-primary range-sm mt-4"
                                    aria-label="BPMスライダー"
                                />

                                {/* よく使われるテンポのショートカット */}
                                <div class="mt-4">
                                    <span class="text-[11px] font-bold text-base-content/70 block mb-1.5">
                                        定番テンポプリセット
                                    </span>
                                    <div class="grid grid-cols-4 gap-1.5 font-mono text-xs">
                                        {[70, 85, 100, 120, 128, 140, 160, 175].map((preset) => (
                                            <button
                                                type="button"
                                                class={`btn btn-xs ${safeBpm() === preset ? "btn-primary" : "btn-outline border-base-300"}`}
                                                onClick={() => setBpm(preset)}
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* タップテンポ */}
                            <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300 text-center">
                                <span class="text-xs font-bold text-base-content/80 block mb-2">
                                    タップテンポ (Tap Tempo)
                                </span>
                                <button
                                    type="button"
                                    onClick={handleTap}
                                    class="btn btn-primary btn-block h-20 text-xl font-black shadow-md rounded-xl"
                                >
                                    TAP HERE
                                </button>
                                <div class="flex items-center justify-between mt-2.5 px-1">
                                    <span class="text-xs font-mono text-base-content/70 truncate">
                                        {tapFeedback() || "拍に合わせて数回タップ"}
                                    </span>
                                    <Show when={tapTimes().length > 0}>
                                        <button
                                            type="button"
                                            onClick={resetTap}
                                            class="btn btn-ghost btn-xs text-[11px] text-base-content/60"
                                            aria-label="タップ計測をリセット"
                                        >
                                            リセット
                                        </button>
                                    </Show>
                                </div>
                            </div>
                        </div>

                        {/* 右側：音符ごとのディレイタイム＆周波数一覧 */}
                        <div class="lg:col-span-7 bg-base-200/40 p-4 sm:p-5 rounded-2xl border border-base-300">
                            <div class="flex items-center justify-between mb-3 pb-2 border-b border-base-300">
                                <h2 class="text-sm font-bold text-base-content">
                                    音符別ディレイタイム (ms) & LFOレート (Hz)
                                </h2>
                                <span class="badge badge-sm badge-outline font-mono">
                                    1拍 = {Math.round(quarterNoteMs() * 10) / 10} ms ({baseHz()} Hz)
                                </span>
                            </div>

                            <div class="overflow-x-auto">
                                <table class="table table-sm w-full font-mono text-xs">
                                    <thead>
                                        <tr class="text-base-content/70 border-b border-base-300">
                                            <th>音符</th>
                                            <th class="text-right">時間 (ms)</th>
                                            <th class="text-right">周波数 (Hz)</th>
                                            <th class="text-right">種別</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={noteTimings()}>
                                            {(timing) => (
                                                <tr class="hover:bg-base-200/80 border-b border-base-300/40">
                                                    <td class="font-bold text-base-content">
                                                        {timing.name}
                                                    </td>
                                                    <td class="text-right font-black text-primary text-sm">
                                                        {timing.ms.toLocaleString()} ms
                                                    </td>
                                                    <td class="text-right text-base-content/80">
                                                        {timing.hz} Hz
                                                    </td>
                                                    <td class="text-right">
                                                        <span
                                                            class={`badge badge-xs text-[10px] ${
                                                                timing.type === "dotted"
                                                                    ? "badge-warning badge-outline font-bold text-amber-800 dark:text-amber-300"
                                                                    : timing.type === "triplet"
                                                                      ? "badge-info badge-outline font-bold text-sky-800 dark:text-sky-300"
                                                                      : "badge-ghost border-base-300 text-base-content/80 font-medium"
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
        </div>
    );
}
