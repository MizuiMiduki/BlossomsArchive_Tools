import { createSignal, onSettled, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { delayedCall, playPageEntrance, animatePop } from "../utils/animations";
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
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
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
        <div ref={containerRef} class="ba-page ba-page--wide">
            {/* メインツールカード：左右スプリット（2カラム） */}
            <div class="ba-card ba-stack-6">
                {/* ヘッダーセクション */}
                <div style={{ "padding-bottom": "1.25rem", "border-bottom": "1px solid var(--ba-border)" }}>
                    <h1 class="ba-title">
                        <BudouX text="抽選・ランダム選定ツール" />
                    </h1>
                    <BudouX
                        as="p"
                        class="ba-text-xs ba-text-muted"
                        style={{ "margin-top": "0.5rem", "margin-bottom": 0, "font-weight": 600, "line-height": 1.6 }}
                        text="テキストエリアに入力された複数の候補から、システム（CSPRNG）によってランダムに項目を抽出します。ブラウザ内のフロントエンド処理により一括選定を行い、ネットワーク通信なしで挙動が完結します。"
                    />
                </div>

                {/* グリッドレイアウト */}
                <div class="ba-flex ba-flex-wrap ba-gap-6" style={{ "align-items": "stretch" }}>
                    {/* 左側：入力とコントロール */}
                    <div class="ba-panel ba-stack-4 ba-min-w-0" style={{ flex: "5 1 18rem", padding: "1.25rem" }}>
                        <div class="ba-field">
                            <label class="ba-label">
                                <span>抽選対象のリスト入力</span>
                            </label>
                            <p class="ba-text-muted" style={{ "font-size": "0.6875rem", "font-weight": 600, margin: 0 }}>
                                ※1行につき1つの項目（名前、番号など）を入力してください。
                            </p>
                            <textarea
                                value={inputText()}
                                aria-label="抽選対象のリスト入力"
                                onInput={(e) => setInputText(e.currentTarget.value)}
                                class="ba-textarea"
                                style={{ height: "14rem" }}
                                placeholder="項目 A&#10;項目 B&#10;項目 C"
                            />
                        </div>

                        {/* 条件パラメータ設定 */}
                        <div class="ba-grid-2" style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}>
                            <div class="ba-field">
                                <label class="ba-label ba-text-muted">
                                    <span>同時選定数</span>
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
                                    class="ba-select ba-select--sm ba-font-bold"
                                >
                                    <option value="1">1 個</option>
                                    <option value="2">2 個</option>
                                    <option value="3">3 個</option>
                                    <option value="5">5 個</option>
                                    <option value="10">10 個</option>
                                </select>
                            </div>

                            <div class="ba-field">
                                <label class="ba-label ba-text-muted">
                                    <span>抽選演出</span>
                                </label>
                                <select
                                    value={animationMode()}
                                    aria-label="抽選演出"
                                    onChange={(e) =>
                                        setAnimationMode(e.currentTarget.value as LotteryAnimationMode)
                                    }
                                    class="ba-select ba-select--sm ba-font-bold"
                                >
                                    <option value="none">演出なし（即時）</option>
                                    <option value="roulette">ドキドキ演出（ルーレット）</option>
                                    <option value="countdown">カウントダウン演出（3秒）</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ "padding-top": "0.75rem", "border-top": "1px solid var(--ba-border)" }}>
                            <label
                                class="ba-flex ba-items-center ba-gap-3"
                                style={{
                                    cursor: "pointer",
                                    padding: "0.65rem 0.75rem",
                                    "border-radius": "var(--ba-radius-sm)",
                                    border: "1.5px solid var(--ba-border-strong)",
                                    "background-color": "var(--ba-surface)",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    aria-label="当選時にリストから除外"
                                    checked={removeOnDraw()}
                                    onChange={(e) => setRemoveOnDraw(e.currentTarget.checked)}
                                    class="ba-checkbox"
                                />
                                <span class="ba-font-bold ba-text-xs">当選時にリストから除外</span>
                            </label>
                        </div>

                        {/* 演出用音量コントロール */}
                        <Show when={animationMode() !== "none"}>
                            <div class="ba-stack-1" style={{ "padding-top": "0.75rem", "border-top": "1px solid var(--ba-border)" }}>
                                <div class="ba-flex ba-justify-between ba-items-center ba-text-xs ba-text-muted">
                                    <label for="lottery-sound-volume" class="ba-font-bold">
                                        演出音量
                                    </label>
                                    <div class="ba-flex ba-items-center ba-gap-2">
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                            onClick={() => handleVolumeChange(soundVolume() === 0 ? 50 : 0)}
                                        >
                                            {soundVolume() === 0 ? "ミュート解除" : "ミュート"}
                                        </button>
                                        <span class="ba-mono ba-text-xs ba-font-bold ba-text-right" style={{ width: "2.5rem", "font-variant-numeric": "tabular-nums" }}>
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
                                    class="ba-range ba-w-full"
                                />
                            </div>
                        </Show>

                        {/* アクションボタン */}
                        <div class="ba-flex ba-gap-3" style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}>
                            <button
                                ref={drawButtonRef}
                                type="button"
                                onClick={startLottery}
                                disabled={isAnimating()}
                                class="ba-btn ba-btn--primary ba-flex-1 ba-font-black"
                                style={{ height: "3rem" }}
                            >
                                <Show when={isAnimating()} fallback="抽選を実行">
                                    <span class="ba-spinner" />
                                    抽選中...
                                </Show>
                            </button>
                            <button
                                type="button"
                                onClick={resetAll}
                                disabled={isAnimating()}
                                class="ba-btn ba-btn--outline"
                                style={{ height: "3rem" }}
                            >
                                クリア
                            </button>
                        </div>
                    </div>

                    {/* 右側：抽選結果および履歴表示 */}
                    <div class="ba-flex-col ba-gap-4 ba-justify-between ba-min-w-0" style={{ flex: "7 1 20rem" }}>
                        {/* 演出中画面 */}
                        <Show when={isAnimating()}>
                            <div
                                class="ba-panel ba-flex-col ba-items-center ba-justify-center ba-gap-4"
                                style={{
                                    border: "2px solid var(--ba-primary)",
                                    padding: "1.5rem",
                                    "min-height": "280px",
                                }}
                            >
                                <div
                                    class="ba-flex ba-items-center ba-justify-between ba-w-full"
                                    style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                                >
                                    <div class="ba-flex ba-items-center ba-gap-2">
                                        <span class="ba-badge ba-badge--primary">抽選中</span>
                                        <span class="ba-text-xs ba-text-muted ba-font-bold">
                                            結果を選定しています...
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={skipAnimation}
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                    >
                                        演出をスキップ
                                    </button>
                                </div>

                                {/* ルーレットモード */}
                                <Show when={animationMode() === "roulette"}>
                                    <div class="ba-flex-col ba-items-center ba-justify-center ba-w-full ba-gap-2" style={{ "margin-block": "1rem" }}>
                                        <span class="ba-text-xs ba-text-muted ba-font-bold" style={{ "letter-spacing": "0.08em" }}>
                                            ROULETTE
                                        </span>
                                        <div
                                            class="ba-font-black ba-text-primary ba-text-center ba-truncate"
                                            style={{
                                                "font-size": "clamp(1.25rem, 3vw, 1.875rem)",
                                                padding: "1rem 1.5rem",
                                                "background-color": "var(--ba-surface)",
                                                border: "2px solid var(--ba-primary)",
                                                "border-radius": "var(--ba-radius)",
                                                "min-width": "240px",
                                                "max-width": "100%",
                                            }}
                                        >
                                            {rouletteCandidate() || "..."}
                                        </div>
                                    </div>
                                </Show>

                                {/* カウントダウンモード */}
                                <Show when={animationMode() === "countdown"}>
                                    <div class="ba-flex-col ba-items-center ba-justify-center ba-gap-2" style={{ "margin-block": "1rem" }}>
                                        <span class="ba-text-xs ba-text-muted ba-font-bold" style={{ "letter-spacing": "0.08em" }}>
                                            COUNTDOWN
                                        </span>
                                        <div class="ba-font-black ba-text-primary" style={{ "font-size": "4rem", "line-height": 1 }}>
                                            {countdownNumber() ?? "3"}
                                        </div>
                                    </div>
                                </Show>

                                <div class="ba-text-muted" style={{ "font-size": "0.6875rem", "font-weight": 600 }}>
                                    ※ 暗号学的乱数（CSPRNG）による厳正な抽選を行っています
                                </div>
                            </div>
                        </Show>

                        {/* 確定結果 */}
                        <Show when={!isAnimating() && results().length > 0}>
                            <div class="ba-panel ba-stack-4" style={{ padding: "1.25rem" }}>
                                <div
                                    class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2"
                                    style={{ "padding-bottom": "0.625rem", "border-bottom": "1px solid var(--ba-border)" }}
                                >
                                    <span class="ba-text-xs ba-font-black ba-text-muted" style={{ "letter-spacing": "0.05em" }}>
                                        選定結果
                                    </span>
                                    <Show when={!results()[0].startsWith("抽選対象")}>
                                        <div class="ba-flex ba-gap-2">
                                            <button
                                                type="button"
                                                onClick={copyResults}
                                                class={`ba-btn ba-btn--xs ${copied() ? "ba-btn--success" : "ba-btn--primary"}`}
                                            >
                                                {copied() ? "コピー完了" : "クリップボードにコピー"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={shareResults}
                                                class="ba-btn ba-btn--xs ba-btn--outline"
                                            >
                                                {shared() ? "共有完了" : "共有 / 出力"}
                                            </button>
                                        </div>
                                    </Show>
                                </div>

                                {/* 当選アイテム */}
                                <div class="ba-grid-2">
                                    <For each={results()}>
                                        {(res) => (
                                            <div
                                                class="ba-text-center"
                                                style={{
                                                    "background-color": "var(--ba-surface)",
                                                    border: "2px solid var(--ba-primary)",
                                                    "border-radius": "var(--ba-radius)",
                                                    padding: "1rem",
                                                    "box-shadow": "var(--ba-shadow-xs)",
                                                }}
                                            >
                                                <div class="ba-text-primary ba-font-black" style={{ "font-size": "0.6875rem", "letter-spacing": "0.06em", "margin-bottom": "0.25rem" }}>
                                                    当選
                                                </div>
                                                <h3 class="ba-text-base ba-font-black ba-truncate" style={{ margin: 0, "user-select": "all" }}>
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
                            <div class="ba-panel ba-stack-3" style={{ padding: "1.25rem" }}>
                                <div
                                    class="ba-flex ba-justify-between ba-items-center"
                                    style={{ "padding-bottom": "0.5rem", "border-bottom": "1px solid var(--ba-border)" }}
                                >
                                    <span class="ba-text-xs ba-font-black ba-text-muted">実行ログ</span>
                                    <button
                                        type="button"
                                        onClick={clearHistory}
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-danger"
                                    >
                                        ログを消去
                                    </button>
                                </div>
                                <div class="ba-stack-2 ba-scroll-y" style={{ "max-height": "14rem", "padding-right": "0.25rem" }}>
                                    <For each={history()}>
                                        {(hist) => (
                                            <div
                                                class="ba-flex ba-items-start ba-gap-3 ba-text-xs"
                                                style={{
                                                    padding: "0.75rem",
                                                    "background-color": "var(--ba-surface)",
                                                    border: "1px solid var(--ba-border)",
                                                    "border-radius": "var(--ba-radius-sm)",
                                                }}
                                            >
                                                <span class="ba-mono ba-text-muted ba-shrink-0" style={{ "font-weight": 600 }}>
                                                    [{hist.time}]
                                                </span>
                                                <div class="ba-flex ba-flex-wrap ba-gap-1 ba-flex-1">
                                                    <For each={hist.items}>
                                                        {(item) => (
                                                            <span class="ba-badge ba-badge--neutral" style={{ "user-select": "all" }}>
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
                        <Show when={!isAnimating() && results().length === 0 && history().length === 0}>
                            <div
                                class="ba-flex-1 ba-flex-col ba-items-center ba-justify-center ba-text-center ba-gap-3 ba-text-muted"
                                style={{
                                    border: "2px dashed var(--ba-border-strong)",
                                    "background-color": "var(--ba-surface-2)",
                                    "border-radius": "var(--ba-radius-lg)",
                                    padding: "2rem",
                                    "min-height": "250px",
                                }}
                            >
                                <ToolIcon name="shuffle" class="ba-icon-xl" />
                                <p class="ba-text-xs ba-font-bold" style={{ margin: 0 }}>
                                    データ入力後、「抽選を実行」を押すと結果がここに表示されます。
                                </p>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>

            {/* 技術仕様 ＆ 学術的なQ&Aセクション */}
            <div class="ba-grid-2">
                {/* アルゴリズム仕様 */}
                <div class="ba-card ba-flex-col ba-justify-between ba-gap-6">
                    <div class="ba-stack-4">
                        <h2
                            class="ba-section-title ba-text-base"
                            style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                        >
                            抽選アルゴリズムおよび実行スペック
                        </h2>
                        <div class="ba-stack-3 ba-text-xs ba-text-muted" style={{ "line-height": 1.65 }}>
                            <p style={{ margin: 0 }}>
                                本システムは、JavaScriptの一般的な `Math.random()` ではなく、Web Cryptography API に準拠した{" "}
                                <strong>`window.crypto.getRandomValues`</strong>{" "}
                                から高精度なシードを生成してランダム抽選を行っています。
                            </p>
                            <p style={{ margin: 0 }}>
                                これにより、入力された要素数（インデックス番号）に対して数学的に偏りのない確率空間から選定結果を出力します。
                            </p>
                            <p style={{ margin: 0 }}>
                                処理はすべてローカル環境（クライアントサイド）のメモリ上で行われ、入力されたデータ自体がブラウザの外へ漏出または送信されることは構造上ありません。
                            </p>
                        </div>
                    </div>
                    <div class="ba-text-xs ba-text-muted" style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}>
                        ※データ保護方針等の規定については、当サイトの
                        <a href="/privacy" class="ba-text-primary ba-font-bold ba-underline" style={{ "margin-left": "0.25rem" }}>
                            プライバシーポリシー
                        </a>
                        に準拠しています。
                    </div>
                </div>

                {/* 抽選技術の解説（FAQ） */}
                <div class="ba-card ba-stack-4">
                    <h2
                        class="ba-section-title ba-text-base"
                        style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                    >
                        ランダム選定に関する基本要件（FAQ）
                    </h2>

                    <div class="ba-stack-2">
                        <details class="ba-accordion">
                            <summary>Q. Math.randomとCrypto APIの乱数はどう違いますか？</summary>
                            <div class="ba-accordion-body">
                                標準の `Math.random()` はブラウザエンジンごとの実装（V8の場合はxorshift128+等）に依存し、暗号的に安全ではない擬似乱数を生成するため、一部のゲーム等で偏りが生じる懸念があります。`window.crypto.getRandomValues` は OS レベルの環境ノイズをソースにした暗号学的疑似乱数生成器（CSPRNG）であり、偏りやパターンの偏向が極限まで抑えられています。
                            </div>
                        </details>

                        <details class="ba-accordion">
                            <summary>Q. 大量データの抽選時のパフォーマンスや上限は？</summary>
                            <div class="ba-accordion-body">
                                本システムはクライアントのブラウザのCPUおよびメモリ上で直接動作します。数千件規模のリスト入力であっても、サーバーAPI通信のボトルネックが発生しないため、ミリ秒単位での結果出力が可能です。
                            </div>
                        </details>

                        <details class="ba-accordion">
                            <summary>Q. 当選済みデータの除外アルゴリズムについて</summary>
                            <div class="ba-accordion-body">
                                「一度引いたものは消す」を有効にすると、抽出処理の終了後、入力した元の配列データから該当するインデックスを自動で `splice` して削除し、テキストエリアの値を書き換える同期処理を行います。
                            </div>
                        </details>
                    </div>
                </div>
            </div>

            <AdSense />
            <AdSense />
        </div>
    );
 }
