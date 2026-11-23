import { createSignal, createMemo, onSettled, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";

export default function TimelapseCalculator() {
    let containerRef: HTMLDivElement | undefined;

    // 計算モード: "fromClip" (動画尺から撮影時間を逆算) または "fromShooting" (実撮影時間から動画尺を計算)
    const [calcMode, setCalcMode] = createSignal<"fromClip" | "fromShooting">("fromClip");

    // 入力パラメータ
    const [fps, setFps] = createSignal<number>(30); // 24, 30, 60
    const [intervalSec, setIntervalSec] = createSignal<number>(3); // 撮影間隔（秒）
    const [clipDurationSec, setClipDurationSec] = createSignal<number>(15); // 動画の長さ（秒）
    const [shootingHours, setShootingHours] = createSignal<number>(1); // 実撮影時間（時間）
    const [shootingMinutes, setShootingMinutes] = createSignal<number>(0); // 実撮影時間（分）
    const [fileSizeMb, setFileSizeMb] = createSignal<number>(25); // 1枚あたりの容量 (MB: RAWなら30~45MB, JPEGなら8~15MB)

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".card");
    });

    // 総撮影枚数
    const totalShots = createMemo(() => {
        const f = Math.max(1, Number.isFinite(fps()) ? fps() : 30);
        const interval = Math.max(0.1, Number.isFinite(intervalSec()) ? intervalSec() : 1);

        if (calcMode() === "fromClip") {
            const clipSec = Math.max(1, Number.isFinite(clipDurationSec()) ? clipDurationSec() : 1);
            return Math.ceil(clipSec * f);
        } else {
            const h = Math.max(0, Number.isFinite(shootingHours()) ? shootingHours() : 0);
            const m = Math.max(0, Number.isFinite(shootingMinutes()) ? shootingMinutes() : 0);
            const totalSec = h * 3600 + m * 60;
            return Math.floor(totalSec / interval);
        }
    });

    // 必要撮影時間（秒）
    const totalShootingTimeSec = createMemo(() => {
        const interval = Math.max(0.1, Number.isFinite(intervalSec()) ? intervalSec() : 1);
        if (calcMode() === "fromClip") {
            return totalShots() * interval;
        } else {
            const h = Math.max(0, Number.isFinite(shootingHours()) ? shootingHours() : 0);
            const m = Math.max(0, Number.isFinite(shootingMinutes()) ? shootingMinutes() : 0);
            return h * 3600 + m * 60;
        }
    });

    // 完成動画の長さ（秒）
    const actualClipDurationSec = createMemo(() => {
        const f = Math.max(1, Number.isFinite(fps()) ? fps() : 30);
        if (calcMode() === "fromClip") {
            return Math.max(1, Number.isFinite(clipDurationSec()) ? clipDurationSec() : 1);
        } else {
            return Math.round((totalShots() / f) * 10) / 10;
        }
    });

    // 必要ストレージ容量 (GB)
    const requiredStorageGb = createMemo(() => {
        const mb = Math.max(1, Number.isFinite(fileSizeMb()) ? fileSizeMb() : 25);
        const totalMb = totalShots() * mb;
        return Math.round((totalMb / 1024) * 100) / 100;
    });

    // 秒を「〇時間〇分〇秒」にフォーマット
    const formatDuration = (totalSec: number) => {
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = Math.floor(totalSec % 60);
        const parts: string[] = [];
        if (h > 0) parts.push(`${h}時間`);
        if (m > 0 || h > 0) parts.push(`${m}分`);
        parts.push(`${s}秒`);
        return parts.join(" ");
    };

    // 被写体別インターバル目安プリセット
    const presets = [
        { name: "歩行者・都市交通", interval: 1, note: "人の流れ、交差点、車の光跡" },
        { name: "流れる雲（速い）", interval: 2, note: "風が強い日の雲の動き" },
        { name: "夕暮れ・朝焼け", interval: 4, note: "日の出・日の入りの光の移ろい" },
        { name: "ゆっくり動く雲", interval: 8, note: "晴天時の積乱雲など" },
        { name: "星空・天の川", interval: 25, note: "長秒露光（20秒露光＋間隔5秒など）" },
        { name: "植物の開花・成長", interval: 300, note: "数分〜数時間ごとのインターバル" },
    ];

    return (
        <div ref={containerRef} class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0">
            <div class="w-full flex flex-col gap-6 sm:gap-8 min-w-0">
                <div class="card bg-base-100 shadow-xl p-4 sm:p-6 md:p-8 w-full border border-base-300 min-w-0">
                    {/* ヘッダー */}
                    <div class="mb-6 border-b border-base-300 pb-4">
                        <h1 class="text-2xl md:text-3xl font-black text-base-content">
                            <BudouX text="タイムラプス撮影計算機" />
                        </h1>
                        <p class="text-xs font-semibold text-base-content/70 mt-1.5 leading-relaxed">
                            完成動画の長さ、撮影間隔（インターバル）、実撮影時間から、総撮影枚数と必要なSDカード容量を相互シミュレーションします。
                        </p>
                    </div>

                    {/* モード切替タブ */}
                    <div class="tabs tabs-boxed bg-base-200/80 p-1 rounded-xl mb-6">
                        <button
                            type="button"
                            class={`tab flex-1 font-bold text-xs sm:text-sm rounded-lg transition-all ${
                                calcMode() === "fromClip"
                                    ? "tab-active bg-primary text-white shadow-sm"
                                    : "text-base-content/80 hover:text-base-content"
                            }`}
                            onClick={() => setCalcMode("fromClip")}
                        >
                            動画の長さから逆算（おすすめ）
                        </button>
                        <button
                            type="button"
                            class={`tab flex-1 font-bold text-xs sm:text-sm rounded-lg transition-all ${
                                calcMode() === "fromShooting"
                                    ? "tab-active bg-primary text-white shadow-sm"
                                    : "text-base-content/80 hover:text-base-content"
                            }`}
                            onClick={() => setCalcMode("fromShooting")}
                        >
                            実撮影時間から計算
                        </button>
                    </div>

                    {/* メインレイアウト */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* 設定コントロール */}
                        <div class="lg:col-span-7 flex flex-col gap-5">
                            {/* モード別入力 */}
                            {calcMode() === "fromClip" ? (
                                <div class="form-control bg-base-200/50 p-4 rounded-xl border border-base-300">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-base-content/90">
                                            作りたい動画の長さ（秒）
                                        </span>
                                        <span class="label-text-alt font-mono font-bold text-primary">
                                            {clipDurationSec()} 秒
                                        </span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="120"
                                        step="1"
                                        value={clipDurationSec()}
                                        onInput={(e) => setClipDurationSec(Math.max(1, Number(e.currentTarget.value) || 1))}
                                        class="range range-primary range-sm"
                                        aria-label="作りたい動画の長さ（秒）"
                                    />
                                    <div class="flex justify-between text-[10px] text-base-content/60 px-1 mt-1 font-mono">
                                        <span>5秒 (SNS用)</span>
                                        <span>15秒 (Shorts/Reels)</span>
                                        <span>30秒</span>
                                        <span>60秒</span>
                                        <span>120秒</span>
                                    </div>
                                </div>
                            ) : (
                                <div class="form-control bg-base-200/50 p-4 rounded-xl border border-base-300">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-base-content/90">
                                            実際の撮影時間（待機時間）
                                        </span>
                                    </label>
                                    <div class="grid grid-cols-2 gap-3 mt-1">
                                        <div>
                                            <label class="label py-0.5 text-xs text-base-content/70">時間</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="48"
                                                value={shootingHours()}
                                                onInput={(e) => setShootingHours(Math.max(0, Number(e.currentTarget.value) || 0))}
                                                class="input input-bordered input-sm w-full bg-base-100 font-mono"
                                                aria-label="撮影時間（時間）"
                                            />
                                        </div>
                                        <div>
                                            <label class="label py-0.5 text-xs text-base-content/70">分</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                value={shootingMinutes()}
                                                onInput={(e) => setShootingMinutes(Math.max(0, Math.min(59, Number(e.currentTarget.value) || 0)))}
                                                class="input input-bordered input-sm w-full bg-base-100 font-mono"
                                                aria-label="撮影時間（分）"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 撮影間隔（インターバル） */}
                            <div class="form-control bg-base-200/50 p-4 rounded-xl border border-base-300">
                                <label class="label py-1">
                                    <span class="label-text font-bold text-sm text-base-content/90">
                                        シャッター間隔（インターバル）
                                    </span>
                                    <span class="label-text-alt font-mono font-bold text-primary">
                                        {intervalSec()} 秒ごと
                                    </span>
                                </label>
                                <input
                                    type="number"
                                    min="0.5"
                                    max="600"
                                    step="0.5"
                                    value={intervalSec()}
                                    onInput={(e) => setIntervalSec(Math.max(0.1, Number(e.currentTarget.value) || 1))}
                                    class="input input-bordered input-sm w-full bg-base-100 font-mono"
                                    aria-label="シャッター間隔（インターバル秒）"
                                />

                                {/* プリセット選択ボタン */}
                                <div class="mt-3">
                                    <span class="text-[11px] font-bold text-base-content/70 block mb-1.5">
                                        被写体別プリセット
                                    </span>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        <For each={presets}>
                                            {(p) => (
                                                <button
                                                    type="button"
                                                    class={`p-2 rounded-lg text-left border text-xs transition-all ${
                                                        intervalSec() === p.interval
                                                            ? "border-primary bg-primary/20 text-primary font-bold"
                                                            : "border-base-300 bg-base-100 hover:bg-base-200 text-base-content"
                                                    }`}
                                                    onClick={() => setIntervalSec(p.interval)}
                                                >
                                                    <div class="font-bold truncate">{p.name}</div>
                                                    <div class="text-[10px] text-base-content/60 font-mono">{p.interval}秒間隔</div>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </div>

                            {/* フレームレート & 容量設定 */}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="form-control bg-base-200/50 p-3 rounded-xl border border-base-300">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-xs text-base-content/90">
                                            フレームレート (FPS)
                                        </span>
                                    </label>
                                    <div class="grid grid-cols-3 gap-2 mt-1">
                                        {[24, 30, 60].map((f) => (
                                            <button
                                                type="button"
                                                class={`btn btn-sm ${fps() === f ? "btn-primary" : "btn-outline border-base-300"}`}
                                                onClick={() => setFps(f)}
                                            >
                                                {f} fps
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div class="form-control bg-base-200/50 p-3 rounded-xl border border-base-300">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-xs text-base-content/90">
                                            写真1枚のデータサイズ
                                        </span>
                                        <span class="label-text-alt font-mono text-[11px] font-bold text-primary">
                                            {fileSizeMb()} MB
                                        </span>
                                    </label>
                                    <div class="grid grid-cols-3 gap-1.5 mt-1">
                                        <button
                                            type="button"
                                            class={`btn btn-xs ${fileSizeMb() === 8 ? "btn-primary" : "btn-outline border-base-300"}`}
                                            onClick={() => setFileSizeMb(8)}
                                        >
                                            JPEG (8MB)
                                        </button>
                                        <button
                                            type="button"
                                            class={`btn btn-xs ${fileSizeMb() === 25 ? "btn-primary" : "btn-outline border-base-300"}`}
                                            onClick={() => setFileSizeMb(25)}
                                        >
                                            RAW (25MB)
                                        </button>
                                        <button
                                            type="button"
                                            class={`btn btn-xs ${fileSizeMb() === 50 ? "btn-primary" : "btn-outline border-base-300"}`}
                                            onClick={() => setFileSizeMb(50)}
                                        >
                                            高画素 (50MB)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 計算結果ダッシュボード */}
                        <div class="lg:col-span-5 flex flex-col gap-4 bg-base-200/70 p-5 rounded-2xl border border-base-300">
                            <h2 class="text-sm font-black text-base-content border-b border-base-300 pb-2 flex items-center justify-between">
                                <span>撮影シミュレーション結果</span>
                                <span class="badge badge-primary badge-sm font-mono">{fps()} FPS</span>
                            </h2>

                            <div class="space-y-4">
                                {/* 実撮影時間 */}
                                <div class="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs">
                                    <span class="text-xs text-base-content/70 font-semibold block mb-1">
                                        必要な実撮影時間（カメラ待機時間）
                                    </span>
                                    <div class="text-2xl font-black text-primary font-mono">
                                        {formatDuration(totalShootingTimeSec())}
                                    </div>
                                    <span class="text-[10px] text-base-content/60 mt-1 block">
                                        ※カメラを設置・固定してシャッターを切り続ける時間です
                                    </span>
                                </div>

                                {/* 総撮影枚数 */}
                                <div class="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs">
                                    <span class="text-xs text-base-content/70 font-semibold block mb-1">
                                        総撮影枚数
                                    </span>
                                    <div class="text-2xl font-black text-base-content font-mono">
                                        {totalShots().toLocaleString()} <span class="text-sm font-normal">枚</span>
                                    </div>
                                </div>

                                {/* 完成動画の長さ */}
                                <div class="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs">
                                    <span class="text-xs text-base-content/70 font-semibold block mb-1">
                                        完成タイムラプス動画の長さ
                                    </span>
                                    <div class="text-xl font-black text-base-content font-mono">
                                        {actualClipDurationSec()} <span class="text-sm font-normal">秒</span>
                                    </div>
                                </div>

                                {/* 必要SDカード容量 */}
                                <div class="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs">
                                    <span class="text-xs text-base-content/70 font-semibold block mb-1">
                                        推定データ容量
                                    </span>
                                    <div class="text-xl font-black text-base-content font-mono">
                                        約 {requiredStorageGb()} <span class="text-sm font-normal">GB</span>
                                    </div>
                                    <span class="text-[10px] text-base-content/60 mt-1 block">
                                        ※32GB / 64GB / 128GBのSDカード残量を確認してください
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <AdSense />
            </div>
        </div>
    );
}
