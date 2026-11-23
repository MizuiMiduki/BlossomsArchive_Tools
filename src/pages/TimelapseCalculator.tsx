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
    // 撮影機材・解像度 & フォーマット設定
    type ResolutionPreset = "12" | "24" | "33" | "45" | "60" | "custom";
    type FormatType = "jpeg" | "raw_compressed" | "raw_uncompressed" | "raw_jpeg";

    const [resolution, setResolution] = createSignal<ResolutionPreset>("24");
    const [formatType, setFormatType] = createSignal<FormatType>("raw_compressed");
    const [fileSizeMb, setFileSizeMb] = createSignal<number>(25); // 1枚あたりの容量 (MB)

    // 解像度とフォーマットごとの推定ファイルサイズテーブル (MB)
    const sizeTable: Record<string, Record<FormatType, number>> = {
        "12": { jpeg: 4, raw_compressed: 14, raw_uncompressed: 24, raw_jpeg: 18 },
        "24": { jpeg: 8, raw_compressed: 25, raw_uncompressed: 48, raw_jpeg: 33 },
        "33": { jpeg: 12, raw_compressed: 35, raw_uncompressed: 66, raw_jpeg: 47 },
        "45": { jpeg: 16, raw_compressed: 48, raw_uncompressed: 90, raw_jpeg: 64 },
        "60": { jpeg: 22, raw_compressed: 65, raw_uncompressed: 120, raw_jpeg: 87 },
    };

    // 解像度やフォーマットが変更された時にファイルサイズを同期
    const updateSizeFromPreset = (res: ResolutionPreset, fmt: FormatType) => {
        if (res !== "custom" && sizeTable[res]) {
            setFileSizeMb(sizeTable[res][fmt]);
        }
    };

    const handleResolutionChange = (res: ResolutionPreset) => {
        setResolution(res);
        if (res !== "custom") {
            updateSizeFromPreset(res, formatType());
        }
    };

    const handleFormatChange = (fmt: FormatType) => {
        setFormatType(fmt);
        if (resolution() !== "custom") {
            updateSizeFromPreset(resolution(), fmt);
        }
    };

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

    // 推奨SDカード容量の算出
    const recommendedSdCard = createMemo(() => {
        const req = requiredStorageGb();
        // カード容量の80%程度までに収まる安全マージンを考慮
        if (req <= 24) return { size: "32 GB", note: "32GB以上のカードで余裕を持って撮影可能" };
        if (req <= 50) return { size: "64 GB", note: "64GB以上のカードを推奨" };
        if (req <= 100) return { size: "128 GB", note: "128GB以上の大容量カードを推奨" };
        if (req <= 200) return { size: "256 GB", note: "256GB以上のカード、または途中でカード交換が必要" };
        return { size: "512 GB〜", note: "512GBカードまたは複数枚のメディア交換を強く推奨" };
    });

    // 容量推定の根拠テキスト
    const sizeRationale = createMemo(() => {
        if (resolution() === "custom") {
            return "手動入力されたカスタム容量（" + fileSizeMb() + " MB/枚）で計算中";
        }
        const resLabels: Record<string, string> = {
            "12": "約1200万画素（スマホ・アクションカム・α7S等）",
            "24": "約2400万画素（標準フルサイズ・APS-C等）",
            "33": "約3300万画素（中高画素機・α7 IV等）",
            "45": "約4500万画素（高画素機・Z8/Z9/EOS R5等）",
            "60": "約6000万画素（超高画素機・α7R V等）",
        };
        const fmtLabels: Record<FormatType, string> = {
            jpeg: "JPEG（標準ファイン圧縮）",
            raw_compressed: "ロスレス圧縮RAW（高効率RAW）",
            raw_uncompressed: "非圧縮RAW（14bit/16bit非圧縮）",
            raw_jpeg: "RAW + JPEG同時記録",
        };
        return `${resLabels[resolution()] || ""} × ${fmtLabels[formatType()] || ""} の平均実効ファイルサイズに基づいています。`;
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
                                                            ? "border-primary bg-primary/20 text-primary font-bold shadow-xs"
                                                            : "border-base-300 bg-base-100 hover:bg-base-200 text-base-content"
                                                    }`}
                                                    onClick={() => setIntervalSec(p.interval)}
                                                >
                                                    <div class="font-bold truncate">{p.name}</div>
                                                    <div class={`text-[10px] font-mono ${intervalSec() === p.interval ? "text-primary font-bold" : "text-base-content/75"}`}>
                                                        {p.interval}秒間隔
                                                    </div>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </div>

                            {/* フレームレート設定 */}
                            <div class="form-control bg-base-200/50 p-4 rounded-xl border border-base-300">
                                <label class="label py-1">
                                    <span class="label-text font-bold text-sm text-base-content/90">
                                        完成動画のフレームレート (FPS)
                                    </span>
                                    <span class="label-text-alt font-mono font-bold text-primary">
                                        {fps()} fps
                                    </span>
                                </label>
                                <div class="grid grid-cols-3 gap-2 mt-1">
                                    {[24, 30, 60].map((f) => (
                                        <button
                                            type="button"
                                            class={`btn btn-sm ${fps() === f ? "btn-primary text-white" : "btn-outline border-base-300"}`}
                                            onClick={() => setFps(f)}
                                            aria-label={`${f} fps`}
                                        >
                                            {f} fps {f === 24 ? "(映画風)" : f === 30 ? "(標準)" : "(なめらか)"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 写真1枚のデータ容量・機材解像度設定 */}
                            <div class="form-control bg-base-200/50 p-4 rounded-xl border border-base-300">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-bold text-sm text-base-content/90">
                                        写真1枚のデータサイズ設定
                                    </span>
                                    <span class="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                        1枚 約 {fileSizeMb()} MB
                                    </span>
                                </div>

                                {/* カメラ解像度（画素数）選択 */}
                                <div class="mb-3">
                                    <label class="label py-0.5 text-xs font-bold text-base-content/70">
                                        ① カメラのセンサー解像度（有効画素数）
                                    </label>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
                                        {[
                                            { id: "12", label: "約1200万画素", sub: "スマホ・GoPro・α7S" },
                                            { id: "24", label: "約2400万画素", sub: "標準機 (α7III/R6/Z6)" },
                                            { id: "33", label: "約3300万画素", sub: "中高画素 (α7IV等)" },
                                            { id: "45", label: "約4500万画素", sub: "高画素 (α1/Z8/R5)" },
                                            { id: "60", label: "約6000万画素", sub: "超高画素 (α7RV等)" },
                                            { id: "custom", label: "カスタム指定", sub: "手動でMB直接入力" },
                                        ].map((item) => (
                                            <button
                                                type="button"
                                                class={`p-2 rounded-lg text-left border transition-all ${
                                                    resolution() === item.id
                                                        ? "border-primary bg-primary/15 text-primary font-bold shadow-xs"
                                                        : "border-base-300 bg-base-100 hover:bg-base-200 text-base-content"
                                                }`}
                                                onClick={() => handleResolutionChange(item.id as ResolutionPreset)}
                                            >
                                                <div class="text-xs font-bold truncate">{item.label}</div>
                                                <div class={`text-[10px] truncate ${
                                                    resolution() === item.id
                                                        ? "text-primary font-bold"
                                                        : "text-base-content/75"
                                                }`}>{item.sub}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 記録フォーマット選択（カスタム時は非活性または非表示） */}
                                {resolution() !== "custom" && (
                                    <div class="mb-3">
                                        <label class="label py-0.5 text-xs font-bold text-base-content/70">
                                            ② 記録フォーマット
                                        </label>
                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
                                            {[
                                                { id: "jpeg", label: "JPEG (ファイン)" },
                                                { id: "raw_compressed", label: "圧縮RAW" },
                                                { id: "raw_uncompressed", label: "非圧縮RAW" },
                                                { id: "raw_jpeg", label: "RAW + JPEG" },
                                            ].map((fmt) => (
                                                <button
                                                    type="button"
                                                    class={`btn btn-xs h-auto min-h-[32px] py-1 text-xs ${
                                                        formatType() === fmt.id
                                                            ? "btn-primary text-white"
                                                            : "btn-outline border-base-300"
                                                    }`}
                                                    onClick={() => handleFormatChange(fmt.id as FormatType)}
                                                >
                                                    {fmt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 手動微調整スライダー/数値入力 */}
                                <div class="bg-base-100 p-2.5 rounded-lg border border-base-300 mt-1">
                                    <div class="flex items-center justify-between text-xs mb-1">
                                        <span class="font-semibold text-base-content/80">
                                            {resolution() === "custom" ? "1枚あたりの容量を手動入力" : "容量の微調整"}
                                        </span>
                                        <div class="flex items-center gap-1 font-mono">
                                            <input
                                                type="number"
                                                min="1"
                                                max="200"
                                                value={fileSizeMb()}
                                                onInput={(e) => {
                                                    const val = Math.max(1, Math.min(300, Number(e.currentTarget.value) || 1));
                                                    setFileSizeMb(val);
                                                    setResolution("custom");
                                                }}
                                                class="input input-bordered input-xs w-16 text-right font-mono"
                                                aria-label="1枚あたりの容量数値入力"
                                            />
                                            <span class="text-xs text-base-content/70">MB</span>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="150"
                                        step="1"
                                        value={fileSizeMb()}
                                        onInput={(e) => {
                                            const val = Math.max(1, Number(e.currentTarget.value) || 1);
                                            setFileSizeMb(val);
                                            setResolution("custom");
                                        }}
                                        class="range range-primary range-xs"
                                        aria-label="1枚あたりの容量スライダー"
                                    />
                                </div>

                                {/* 選択根拠の説明 */}
                                <div class="mt-2.5 p-2 bg-base-200/60 rounded-lg text-[11px] text-base-content/70 leading-relaxed border border-base-300/50">
                                    <span class="font-bold text-base-content/90 mr-1">【推定根拠】</span>
                                    {sizeRationale()}
                                </div>
                            </div>
                        </div>

                        {/* 計算結果ダッシュボード */}
                        <div class="lg:col-span-5 flex flex-col gap-4 bg-base-200/70 p-5 rounded-2xl border border-base-300">
                            <h2 class="text-sm font-black text-base-content border-b border-base-300 pb-2 flex items-center justify-between">
                                <span>撮影シミュレーション結果</span>
                                <span class="inline-flex items-center text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-700 text-white">{fps()} FPS</span>
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

                                {/* 必要SDカード容量 & 推奨カード */}
                                <div class="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-xs text-base-content/70 font-semibold">
                                            推定総データ容量
                                        </span>
                                        <span class="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-700 text-white">
                                            推奨: {recommendedSdCard().size}
                                        </span>
                                    </div>
                                    <div class="text-2xl font-black text-base-content font-mono">
                                        約 {requiredStorageGb()} <span class="text-sm font-normal">GB</span>
                                    </div>
                                    <span class="text-[10px] text-base-content/60 mt-1 block">
                                        ※{recommendedSdCard().note}
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
