import { createSignal, onSettled, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { delayedCall, playPageEntrance, animatePop } from "../utils/gsapAnimations";
import { playNotificationSound, playClockTickSound, initAudio } from "../utils/sound";

interface HistoryItem {
    id: number;
    time: string;
    items: string[];
}

export type LotteryAnimationMode = "none" | "roulette" | "countdown";

export default function Lottery() {
    const getInitialVolume = (): number => {
        if (typeof window === "undefined") return 50;
        try {
            const raw = localStorage.getItem("ba_lottery_sound_volume");
            if (raw !== null) {
                const saved = Number(raw);
                if (Number.isFinite(saved) && saved >= 0 && saved <= 100) return Math.floor(saved);
            }
        } catch {}
        return 50;
    };

    const [inputText, setInputText] = createSignal("");
    const [results, setResults] = createSignal<string[]>([]);
    const [drawCount, setDrawCount] = createSignal(1);
    const [removeOnDraw, setRemoveOnDraw] = createSignal(false);
    const [animationMode, setAnimationMode] = createSignal<LotteryAnimationMode>("none");
    const [soundVolume, setSoundVolume] = createSignal(getInitialVolume());
    const [isAnimating, setIsAnimating] = createSignal(false);
    const [rouletteCandidate, setRouletteCandidate] = createSignal("");
    const [countdownNumber, setCountdownNumber] = createSignal<number | null>(null);
    const [copied, setCopied] = createSignal(false);
    const [shared, setShared] = createSignal(false);
    const [history, setHistory] = createSignal<HistoryItem[]>([]);

    let containerRef: HTMLDivElement | undefined;
    let drawButtonRef: HTMLButtonElement | undefined;
    let animationTimers: number[] = [];
    let pendingDrawAction: (() => void) | null = null;

    const handleVolumeChange = (vol: number) => {
        const clamped = Math.max(0, Math.min(100, Math.floor(vol)));
        setSoundVolume(clamped);
        try {
            localStorage.setItem("ba_lottery_sound_volume", String(clamped));
        } catch {}
    };

    const clearAllTimers = () => {
        animationTimers.forEach((t) => window.clearTimeout(t));
        animationTimers = [];
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".card");
        return () => {
            clearAllTimers();
        };
    });

    const finishDraw = (selectedResults: string[], remainingItems: string[]) => {
        clearAllTimers();
        pendingDrawAction = null;
        setIsAnimating(false);
        setCountdownNumber(null);
        setRouletteCandidate("");
        setResults(selectedResults);
        setCopied(false);
        setShared(false);

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

        setHistory((prev) => [
            { id: Date.now(), time: timeStr, items: selectedResults },
            ...prev,
        ]);

        if (removeOnDraw()) {
            setInputText(remainingItems.join("\n"));
        }
    };

    const skipAnimation = () => {
        if (pendingDrawAction) {
            pendingDrawAction();
        }
    };

    const startLottery = () => {
        if (isAnimating()) return;
        if (drawButtonRef) animatePop(drawButtonRef);

        let items = inputText()
            .split("\n")
            .map((item) => item.trim())
            .filter((item) => item !== "");

        if (items.length === 0) {
            setResults(["抽選対象を入力してください"]);
            return;
        }

        const rawDrawCount = drawCount();
        const currentDrawCount = Number.isFinite(rawDrawCount)
            ? Math.max(1, Math.floor(rawDrawCount))
            : 1;
        const selectedResults: string[] = [];
        const loops = Math.min(currentDrawCount, items.length);
        const randomArray = new Uint32Array(loops);
        window.crypto.getRandomValues(randomArray);

        // 抽選アイテムのインデックス選定
        const clonedItems = [...items];
        for (let i = 0; i < loops; i++) {
            const randomIndex = randomArray[i] % clonedItems.length;
            const selectedItem = clonedItems[randomIndex];
            selectedResults.push(selectedItem);

            if (removeOnDraw()) {
                clonedItems.splice(randomIndex, 1);
            }
        }

        const remainingItems = clonedItems;
        const mode = animationMode();

        // 演出なし（デフォルト: 即時決定）
        if (mode === "none") {
            finishDraw(selectedResults, remainingItems);
            return;
        }

        // 音声コンテキストの初期化
        initAudio();
        clearAllTimers();
        setIsAnimating(true);

        const volRatio = soundVolume() / 100;

        const doFinish = () => {
            if (volRatio > 0) {
                playNotificationSound({ soundType: "chime", volume: 0.8 * volRatio });
            }
            finishDraw(selectedResults, remainingItems);
        };
        pendingDrawAction = doFinish;

        // ドキドキ演出: ルーレットモード
        if (mode === "roulette") {
            // 徐々に減速するタイミングステップ（ミリ秒）
            const steps = [
                50, 50, 50, 50, 50, 60, 60, 70, 80, 100, 120, 150, 190, 240, 310, 400
            ];
            let elapsed = 0;

            steps.forEach((delay, idx) => {
                elapsed += delay;
                const timerId = window.setTimeout(() => {
                    // ランダムな候補を表示
                    const randIdx = Math.floor(Math.random() * items.length);
                    setRouletteCandidate(items[randIdx]);
                    if (volRatio > 0) {
                        playClockTickSound(idx % 2 === 0, 0.45 * volRatio);
                    }

                    // 最後のステップで確定
                    if (idx === steps.length - 1) {
                        const finalTimer = window.setTimeout(() => {
                            doFinish();
                        }, 300);
                        animationTimers.push(finalTimer);
                    }
                }, elapsed);
                animationTimers.push(timerId);
            });
            return;
        }

        // ドキドキ演出: カウントダウンモード (3, 2, 1)
        if (mode === "countdown") {
            setCountdownNumber(3);
            if (volRatio > 0) {
                playClockTickSound(true, 0.6 * volRatio);
            }

            const t1 = window.setTimeout(() => {
                setCountdownNumber(2);
                if (volRatio > 0) {
                    playClockTickSound(false, 0.6 * volRatio);
                }
            }, 700);

            const t2 = window.setTimeout(() => {
                setCountdownNumber(1);
                if (volRatio > 0) {
                    playClockTickSound(true, 0.6 * volRatio);
                }
            }, 1400);

            const t3 = window.setTimeout(() => {
                doFinish();
            }, 2100);

            animationTimers.push(t1, t2, t3);
        }
    };

    const copyResults = async () => {
        if (results().length === 0 || results()[0].startsWith("抽選対象"))
            return;
        try {
            const copyText = results()
                .map((r, i) => `結果 ${i + 1}: ${r}`)
                .join("\n");
            await navigator.clipboard.writeText(copyText);
            setCopied(true);
            delayedCall(2, () => setCopied(false));
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const shareResults = async () => {
        if (results().length === 0 || results()[0].startsWith("抽選対象"))
            return;

        const shareText = results()
            .map((r, i) => `結果 ${i + 1}: ${r}`)
            .join("\n");

        if (navigator.share) {
            try {
                await navigator.share({
                    title: "抽選結果",
                    text: shareText,
                });
                setShared(true);
                delayedCall(2, () => setShared(false));
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                setShared(true);
                delayedCall(2, () => setShared(false));
            } catch (err) {
                console.error("Clipboard fallback failed:", err);
            }
        }
    };

    const resetAll = () => {
        setInputText("");
        setResults([]);
        setDrawCount(1);
        setRemoveOnDraw(false);
        setCopied(false);
        setShared(false);
    };

    const clearHistory = () => {
        setHistory([]);
    };

    return (
        <div
            ref={containerRef}
            class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0 font-sans"
        >
            <div class="w-full flex flex-col gap-6 sm:gap-8 min-w-0">
                {/* メインツールカード：左右スプリット（2カラム） */}
                <div class="card bg-base-100 shadow-xl p-3 sm:p-6 md:p-10 w-full border border-base-300 min-w-0">
                    {/* ヘッダーセクション */}
                    <div class="mb-8 border-b border-base-300 pb-5">
                        <h1 class="text-2xl md:text-3xl font-black text-base-content">
                            <BudouX text="抽選・ランダム選定ツール" />
                        </h1>
                        <BudouX
                            as="p"
                            class="text-xs font-semibold text-base-content/70 mt-2 leading-relaxed"
                            text="テキストエリアに入力された複数の候補から、システム（CSPRNG）によってランダムに項目を抽出します。ブラウザ内のフロントエンド処理により一括選定を行い、ネットワーク通信なしで挙動が完結します。"
                        />
                    </div>

                    {/* グリッドレイアウト */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* 左側：入力とコントロール */}
                        <div class="lg:col-span-5 flex flex-col gap-5 bg-base-200/60 p-5 rounded-2xl border border-base-300">
                            <div class="form-control w-full">
                                <label class="label py-1">
                                    <span class="label-text font-bold text-sm text-base-content/90">
                                        抽選対象のリスト入力
                                    </span>
                                </label>
                                <p class="text-[10px] text-base-content/70 font-semibold mb-2">
                                    ※1行につき1つの項目（名前、番号など）を入力してください。
                                </p>
                                <textarea
                                    value={inputText()}
                                    aria-label="抽選対象のリスト入力"
                                    onInput={(e) =>
                                        setInputText(e.currentTarget.value)
                                    }
                                    class="textarea textarea-bordered w-full h-56 text-sm bg-base-100 border-2 border-base-300 text-base-content focus:border-primary font-medium p-3 focus:outline-none shadow-sm"
                                    placeholder="項目 A&#10;項目 B&#10;項目 C"
                                />
                            </div>

                            {/* 条件パラメータ設定 */}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end border-t border-base-300 pt-4">
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-xs text-base-content/80">
                                            同時選定数
                                        </span>
                                    </label>
                                    <select
                                        value={drawCount()}
                                        aria-label="同時選定数"
                                        onChange={(e) => {
                                            const v = Number(e.currentTarget.value);
                                            if (Number.isFinite(v) && v >= 1) {
                                                setDrawCount(Math.floor(v));
                                            }
                                        }}
                                        class="select select-bordered select-sm h-11 text-xs font-bold bg-base-100 border-2 border-base-300 text-base-content w-full focus:border-primary"
                                    >
                                        <option value="1">1 個</option>
                                        <option value="2">2 個</option>
                                        <option value="3">3 個</option>
                                        <option value="5">5 個</option>
                                        <option value="10">10 個</option>
                                    </select>
                                </div>

                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-xs text-base-content/80">
                                            抽選演出
                                        </span>
                                    </label>
                                    <select
                                        value={animationMode()}
                                        aria-label="抽選演出"
                                        onChange={(e) =>
                                            setAnimationMode(
                                                e.currentTarget
                                                    .value as LotteryAnimationMode,
                                            )
                                        }
                                        class="select select-bordered select-sm h-11 text-xs font-bold bg-base-100 border-2 border-base-300 text-base-content w-full focus:border-primary"
                                    >
                                        <option value="none">
                                            演出なし（即時）
                                        </option>
                                        <option value="roulette">
                                            ドキドキ演出（ルーレット）
                                        </option>
                                        <option value="countdown">
                                            カウントダウン演出（3秒）
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-control w-full border-t border-base-300 pt-3">
                                <label class="label cursor-pointer justify-start gap-3 h-11 px-3 rounded-xl border-2 border-base-300 bg-base-100 hover:bg-base-200 w-full transition-colors">
                                    <input
                                        type="checkbox"
                                        aria-label="当選時にリストから除外"
                                        checked={removeOnDraw()}
                                        onChange={(e) =>
                                            setRemoveOnDraw(
                                                e.currentTarget.checked,
                                            )
                                        }
                                        class="checkbox checkbox-sm checkbox-primary rounded-md"
                                    />
                                    <span class="label-text font-bold text-xs text-base-content/90">
                                        当選時にリストから除外
                                    </span>
                                </label>
                            </div>

                            {/* 演出用音量コントロール (演出が選択されている場合のみ表示) */}
                            <Show when={animationMode() !== "none"}>
                                <div class="form-control w-full border-t border-base-300 pt-3">
                                    <div class="flex justify-between items-center text-xs text-base-content/80 mb-1.5">
                                        <label for="lottery-sound-volume" class="font-bold">
                                            演出音量
                                        </label>
                                        <div class="flex items-center gap-2">
                                            <button
                                                type="button"
                                                class="text-[11px] text-primary hover:underline font-bold"
                                                onClick={() => handleVolumeChange(soundVolume() === 0 ? 50 : 0)}
                                            >
                                                {soundVolume() === 0 ? "ミュート解除" : "ミュート"}
                                            </button>
                                            <span class="font-mono text-xs tabular-nums font-bold w-10 text-right text-base-content/90">
                                                {soundVolume()}%
                                            </span>
                                        </div>
                                    </div>
                                    <input
                                        id="lottery-sound-volume"
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={soundVolume()}
                                        aria-label="演出音量"
                                        onInput={(e) => {
                                            const v = Number(e.currentTarget.value);
                                            if (Number.isFinite(v)) {
                                                handleVolumeChange(v);
                                            }
                                        }}
                                        class="range range-xs range-primary w-full"
                                    />
                                </div>
                            </Show>

                            {/* アクションボタン */}
                            <div class="flex gap-3 border-t border-base-300 pt-4">
                                <button
                                    ref={drawButtonRef}
                                    onClick={startLottery}
                                    disabled={isAnimating()}
                                    class="btn btn-primary text-primary-content flex-1 text-sm font-black h-12 min-h-0 shadow-md transition-all disabled:opacity-60"
                                >
                                    <Show
                                        when={isAnimating()}
                                        fallback="抽選を実行"
                                    >
                                        <span class="loading loading-spinner loading-xs mr-2" />
                                        抽選中...
                                    </Show>
                                </button>
                                <button
                                    onClick={resetAll}
                                    disabled={isAnimating()}
                                    class="btn btn-outline border-2 border-base-300 text-base-content font-bold text-xs h-12 min-h-0 px-5 hover:bg-base-200"
                                >
                                    クリア
                                </button>
                            </div>
                        </div>

                        {/* 右側：抽選結果および履歴表示 */}
                        <div class="lg:col-span-7 flex flex-col gap-5 justify-between">
                            {/* 演出中画面 */}
                            <Show when={isAnimating()}>
                                <div class="bg-base-200/90 p-6 sm:p-8 rounded-2xl border-2 border-primary/50 flex flex-col items-center justify-center gap-5 shadow-lg min-h-[280px]">
                                    <div class="flex items-center justify-between w-full border-b border-base-300 pb-3">
                                        <div class="flex items-center gap-2">
                                            <span class="badge badge-primary font-bold text-xs text-primary-content animate-pulse">
                                                🎯 抽選中
                                            </span>
                                            <span class="text-xs text-base-content/70 font-semibold">
                                                結果を選定しています...
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={skipAnimation}
                                            class="btn btn-ghost btn-xs text-xs text-primary font-bold hover:underline"
                                        >
                                            演出をスキップ ⏩
                                        </button>
                                    </div>

                                    {/* ルーレットモード */}
                                    <Show when={animationMode() === "roulette"}>
                                        <div class="flex flex-col items-center justify-center my-4 w-full">
                                            <span class="text-xs text-base-content/60 font-bold mb-2 tracking-wider">
                                                ROULETTE
                                            </span>
                                            <div class="text-xl sm:text-3xl font-black text-primary px-6 py-4 bg-base-100 border-2 border-primary rounded-2xl shadow-inner min-w-[240px] max-w-full text-center truncate animate-bounce">
                                                {rouletteCandidate() || "..."}
                                            </div>
                                        </div>
                                    </Show>

                                    {/* カウントダウンモード */}
                                    <Show when={animationMode() === "countdown"}>
                                        <div class="flex flex-col items-center justify-center my-4">
                                            <span class="text-xs text-base-content/60 font-bold mb-2 tracking-wider">
                                                COUNTDOWN
                                            </span>
                                            <div class="text-6xl sm:text-7xl font-black text-primary animate-ping">
                                                {countdownNumber() ?? "3"}
                                            </div>
                                        </div>
                                    </Show>

                                    <div class="text-[11px] text-base-content/60 font-semibold">
                                        ※ 暗号学的乱数（CSPRNG）による厳正な抽選を行っています
                                    </div>
                                </div>
                            </Show>

                            {/* 確定結果 */}
                            <Show when={!isAnimating() && results().length > 0}>
                                <div
                                    class="bg-base-200/60 p-6 rounded-2xl border border-base-300 flex flex-col gap-4 shadow-sm"
                                >
                                    <div class="flex justify-between items-center border-b border-base-300 pb-2.5">
                                        <span class="text-xs font-black text-base-content/70 tracking-wider">
                                            選定結果
                                        </span>
                                        <Show
                                            when={
                                                !results()[0].startsWith(
                                                    "抽選対象",
                                                )
                                            }
                                        >
                                            <div class="flex gap-2">
                                                <button
                                                    onClick={copyResults}
                                                    class={`btn btn-xs font-bold rounded-lg border-none transition-colors ${copied() ? "btn-success text-white" : "btn-primary text-primary-content"}`}
                                                >
                                                    {copied()
                                                        ? "コピー完了"
                                                        : "クリップボードにコピー"}
                                                </button>
                                                <button
                                                    onClick={shareResults}
                                                    class="btn btn-xs font-bold rounded-lg text-base-content border-2 border-base-300 bg-base-100 hover:bg-base-200 transition-colors"
                                                >
                                                    {shared()
                                                        ? "共有完了"
                                                        : "共有 / 出力"}
                                                </button>
                                            </div>
                                        </Show>
                                    </div>

                                    {/* 当選アイテム */}
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <For each={results()}>
                                            {(res) => (
                                                <div class="lottery-item bg-base-100 border-2 border-primary/30 rounded-xl p-4 text-center shadow-xs transition-transform hover:scale-[1.02]">
                                                    <div class="text-[10px] text-primary font-black uppercase tracking-wider mb-1">
                                                        🎉 当選
                                                    </div>
                                                    <h3 class="text-base font-black text-base-content select-all truncate">
                                                        {res}
                                                    </h3>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                             {/* 履歴セクション */}
                             <Show when={history().length > 0}>
                                 <div
                                     class="bg-base-200/40 p-5 rounded-2xl border border-base-300 flex flex-col gap-3"
                                 >
                                     <div class="flex justify-between items-center border-b border-base-300 pb-2">
                                         <span class="text-xs font-black text-base-content/70">
                                             実行ログ
                                         </span>
                                         <button
                                             onClick={clearHistory}
                                             class="btn btn-ghost btn-xs text-error font-bold hover:bg-error/10 rounded-lg"
                                         >
                                             ログを消去
                                         </button>
                                     </div>
                                     <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                                         <For each={history()}>
                                             {(hist) => (
                                                 <div class="flex items-start gap-3 p-3 bg-base-100 border border-base-300 rounded-xl text-xs shadow-xs">
                                                     <span class="font-mono font-semibold text-base-content/70 shrink-0 mt-0.5">
                                                         [{hist.time}]
                                                     </span>
                                                     <div class="flex flex-wrap gap-1.5 flex-1">
                                                         <For each={hist.items}>
                                                             {(item) => (
                                                                 <span class="badge bg-base-200 border border-base-300 text-base-content font-bold select-all rounded-md px-2 py-1">
                                                                     {item}
                                                                 </span>
                                                             )}
                                                         </For>
                                                     </div>
                                                 </div>
                                             )}
                                         </For>
                                     </div>
                                 </div>
                             </Show>

                             {/* 初期表示（未実行時） */}
                             <Show
                                 when={
                                     !isAnimating() &&
                                     results().length === 0 &&
                                     history().length === 0
                                 }
                             >
                                 <div class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-base-300 bg-base-200/40 rounded-2xl p-8 text-center min-h-[250px]">
                                     <span class="text-5xl block mb-3">📊</span>
                                     <p class="text-xs font-bold text-base-content/70">
                                         データ入力後、「抽選を実行」を押すと結果がここに表示されます。
                                     </p>
                                 </div>
                             </Show>
                         </div>
                     </div>
                 </div>

                 {/* 💡 技術仕様 ＆ 学術的なQ&Aセクション */}
                 <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                     {/* アルゴリズム仕様 */}
                     <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm justify-between">
                         <div>
                             <h2 class="text-base font-bold text-base-content border-b border-base-300 pb-3 mb-5">
                                 抽選アルゴリズムおよび実行スペック
                             </h2>
                             <div class="space-y-4 text-xs text-base-content/80 leading-relaxed font-medium">
                                 <p>
                                     本システムは、JavaScriptの一般的な
                                     `Math.random()` ではなく、Web Cryptography
                                     API に準拠した{" "}
                                     <strong>
                                         `window.crypto.getRandomValues`
                                     </strong>{" "}
                                     から高精度なシードを生成してランダム抽選を行っています。
                                 </p>
                                 <p>
                                     これにより、入力された要素数（インデックス番号）に対して数学的に偏りのない確率空間から選定結果を出力します。
                                 </p>
                                 <p>
                                     処理はすべてローカル環境（クライアントサイド）のメモリ上で行われ、入力されたデータ自体がブラウザの外へ漏出または送信されることは構造上ありません。
                                 </p>
                             </div>
                         </div>
                         <div class="mt-6 pt-4 border-t border-base-300 text-xs text-base-content/70">
                             ※データ保護方針等の規定については、当サイトの
                             <a
                                 href="/privacy"
                                 class="text-primary font-bold underline ml-1 hover:text-primary/80"
                             >
                                 プライバシーポリシー
                             </a>
                             に準拠しています。
                         </div>
                     </div>

                     <AdSense />

                     {/* 抽選技術の解説（FAQ） */}
                     <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm">
                         <h2 class="text-base font-bold text-base-content border-b border-base-300 pb-3 mb-5">
                             ランダム選定に関する基本要件（FAQ）
                         </h2>

                         <div class="space-y-2">
                             <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                 <input
                                     type="checkbox"
                                     class="peer"
                                     aria-label="FAQ: Math.randomとCrypto APIの乱数はどう違いますか？"
                                 />
                                 <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                     Q. Math.randomとCrypto
                                     APIの乱数はどう違いますか？
                                 </div>
                                 <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                     標準の `Math.random()`
                                     はブラウザエンジンごとの実装（V8の場合はxorshift128+等）に依存し、暗号的に安全ではない擬似乱数を生成するため、一部のゲーム等で偏りが生じる懸念があります。`window.crypto.getRandomValues`
                                     は OS
                                     レベルの環境ノイズをソースにした暗号学的疑似乱数生成器（CSPRNG）であり、偏りやパターンの偏向が極限まで抑えられています。
                                 </div>
                             </div>

                             <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                 <input
                                     type="checkbox"
                                     class="peer"
                                     aria-label="FAQ: 大量データの抽選時のパフォーマンスや上限は？"
                                 />
                                 <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                     Q.
                                     大量データの抽選時のパフォーマンスや上限は？
                                 </div>
                                 <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                     本システムはクライアントのブラウザのCPUおよびメモリ上で直接動作します。数千件規模のリスト入力であっても、サーバーAPI通信のボトルネックが発生しないため、ミリ秒単位での結果出力が可能です。
                                 </div>
                             </div>

                             <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                 <input
                                     type="checkbox"
                                     class="peer"
                                     aria-label="FAQ: 当選済みデータの除外アルゴリズムについて"
                                 />
                                 <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                     Q. 当選済みデータの除外アルゴリズムについて
                                 </div>
                                 <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                     「一度引いたものは消す」を有効にすると、抽出処理の終了後、入力した元の配列データから該当するインデックスを自動で
                                     `splice`
                                     して削除し、テキストエリアの値を書き換える同期処理を行います。
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
             <AdSense />
             <AdSense />
         </div>
     );
 }
