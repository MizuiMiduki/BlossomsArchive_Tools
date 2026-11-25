import { createSignal, Switch, Match, For, Show, createEffect, onSettled } from "solid-js";
import { animatePop, playPageEntrance } from "../utils/animations";
import { initAudio, closeAudio, playNotificationSound } from "../utils/sound";
import { usePageI18n } from "../i18n/index";

export default function TimerStopwatch() {
    const { title } = usePageI18n("/timer", { defaultTitle: "タイマー・ストップウォッチ" });
    // 状態管理
    const [mode, setMode] = createSignal<"stopwatch" | "timer" | "pomodoro">(
        "stopwatch",
    );
    const [time, setTime] = createSignal(0);
    const [isRunning, setIsRunning] = createSignal(false);

    // ダイアログ操作用
    let modalRef: HTMLDialogElement | undefined;

    // ポモドーロ用の状態
    const [focusMin, setFocusMin] = createSignal(25);
    const [breakMin, setBreakMin] = createSignal(5);
    const [isBreak, setIsBreak] = createSignal(false);
    const [autoRepeat, setAutoRepeat] = createSignal(true);

    // サウンド設定用の状態 (タイマー・ポモドーロ用)
    const [soundEnabled, setSoundEnabled] = createSignal(true);
    const [soundVolume, setSoundVolume] = createSignal(100);
    const [soundType, setSoundType] = createSignal<"alarm" | "chime">("alarm");

    // H:M:S入力用の状態
    const [h, setH] = createSignal(0);
    const [m, setM] = createSignal(0);
    const [s, setS] = createSignal(0);

    let containerRef: HTMLDivElement | undefined;
    let timerId: number | undefined;
    let timeDisplayRef: HTMLDivElement | undefined;

    // 設定値が変わったら即座に時間を反映（動いていない時だけ）
    createEffect(
        () => ({
            mode: mode(),
            isRunning: isRunning(),
            isBreak: isBreak(),
            breakMin: breakMin(),
            focusMin: focusMin(),
        }),
        ({ mode, isRunning, isBreak, breakMin, focusMin }) => {
            if (mode === "pomodoro" && !isRunning) {
                setTime(isBreak ? breakMin * 60 : focusMin * 60);
            }
        }
    );

    const formatTime = (val: number, isStopwatch: boolean) => {
        const safeVal = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
        if (isStopwatch) {
            const mins = Math.floor(safeVal / 6000);
            const secs = Math.floor((safeVal % 6000) / 100);
            const ms = safeVal % 100;
            return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
        } else {
            const hours = Math.floor(safeVal / 3600);
            const mins = Math.floor((safeVal % 3600) / 60);
            const secs = safeVal % 60;
            return hours > 0
                ? `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
                : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        }
    };

    const stop = (targetEl?: HTMLElement) => {
        if (targetEl) animatePop(targetEl, 0.92, 0.15);
        setIsRunning(false);
        if (timerId !== undefined) {
            window.clearInterval(timerId);
            timerId = undefined;
        }
    };

    const start = (targetEl?: HTMLElement) => {
        if (targetEl) animatePop(targetEl, 0.92, 0.15);
        if (isRunning()) return;

        // タイマー/ポモドーロ開始時にオーディオを初期化（ブラウザのAutoplay Policy対応）
        if (mode() !== "stopwatch" && soundEnabled()) {
            initAudio();
        }

        setIsRunning(true);
        const intervalMs = mode() === "stopwatch" ? 10 : 1000;

        const tick = () => {
            if (mode() === "stopwatch") {
                setTime((t) => t + 1);
            } else {
                if (time() > 0) {
                    setTime((t) => t - 1);
                } else {
                    if (mode() === "pomodoro" && autoRepeat()) {
                        const nextIsBreak = !isBreak();
                        setIsBreak(nextIsBreak);
                        setTime((nextIsBreak ? breakMin() : focusMin()) * 60);

                        if (soundEnabled()) {
                            playNotificationSound({
                                soundType: soundType(),
                                volume: soundVolume() / 100,
                                pitchModifier: nextIsBreak ? 1.15 : 0.9,
                            });
                        }
                    } else {
                        stop();

                        if (soundEnabled()) {
                            playNotificationSound({
                                soundType: soundType(),
                                volume: soundVolume() / 100,
                            });
                        }

                        modalRef?.showModal();
                        const modalBox = modalRef?.querySelector<HTMLElement>(".ba-modal-box");
                        if (modalBox && typeof modalBox.animate === "function") {
                            modalBox.animate(
                                [
                                    { transform: "scale(0.8)", opacity: 0 },
                                    { transform: "scale(1)", opacity: 1 },
                                ],
                                { duration: 300, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
                            );
                        }
                        return;
                    }
                }
            }
        };
        timerId = window.setInterval(tick, intervalMs);
    };

    const changeMode = (newMode: "stopwatch" | "timer" | "pomodoro") => {
        stop();
        setMode(newMode);
        setIsBreak(false);

        if (newMode === "stopwatch") setTime(0);
        else if (newMode === "timer") setTime(300);
        else if (newMode === "pomodoro") setTime(focusMin() * 60);

        if (timeDisplayRef) {
            animatePop(timeDisplayRef, 0.96, 0.2);
        }
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef);
        return () => {
            if (timerId !== undefined) {
                window.clearInterval(timerId);
                timerId = undefined;
            }
            closeAudio();
        };
    });

    return (
        <div ref={containerRef} class="ba-page ba-items-center" style={{ "max-width": "28rem" }}>
            <h1 class="ba-sr-only">{title()}</h1>
            {/* ダイアログ */}
            <dialog ref={modalRef} class="ba-modal">
                <div class="ba-modal-box ba-stack-4">
                    <h2 class="ba-section-title ba-text-xl ba-font-black">
                        時間です！
                    </h2>
                    <p class="ba-text-muted" style={{ margin: 0 }}>お疲れさまでした！</p>
                    <div class="ba-flex ba-justify-end">
                        <button
                            type="button"
                            class="ba-btn ba-btn--primary"
                            onClick={() => modalRef?.close()}
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </dialog>

            {/* タブ切り替え */}
            <div
                class="ba-tabs ba-w-full"
                style={{ display: "grid", "grid-template-columns": "repeat(3, minmax(0, 1fr))" }}
            >
                <button
                    type="button"
                    class={`ba-tab ba-truncate ${mode() === "stopwatch" ? "is-active" : ""}`}
                    onClick={() => changeMode("stopwatch")}
                >
                    ストップウォッチ
                </button>
                <button
                    type="button"
                    class={`ba-tab ba-truncate ${mode() === "timer" ? "is-active" : ""}`}
                    onClick={() => changeMode("timer")}
                >
                    タイマー
                </button>
                <button
                    type="button"
                    class={`ba-tab ba-truncate ${mode() === "pomodoro" ? "is-active" : ""}`}
                    onClick={() => changeMode("pomodoro")}
                >
                    ポモドーロ
                </button>
            </div>

            {/* 表示部分 */}
            <div ref={timeDisplayRef} class="ba-text-center ba-w-full ba-min-w-0 ba-stack-2 ba-items-center">
                <Show when={mode() === "pomodoro"}>
                    <div class={`ba-badge ${isBreak() ? "ba-badge--info" : "ba-badge--primary"}`}>
                        {isBreak() ? "休憩中" : "集中タイム"}
                    </div>
                </Show>
                <div
                    class="ba-mono ba-font-black ba-text-primary"
                    style={{
                        "font-size": "clamp(2.25rem, 7vw, 3.75rem)",
                        "font-variant-numeric": "tabular-nums",
                        "letter-spacing": "-0.02em",
                    }}
                >
                    {formatTime(time(), mode() === "stopwatch")}
                </div>
            </div>

            {/* 操作ボタン */}
            <div class="ba-flex ba-gap-4">
                <button
                    type="button"
                    class="ba-btn ba-btn--primary"
                    style={{ width: "7rem" }}
                    onClick={(e) => isRunning() ? stop(e.currentTarget) : start(e.currentTarget)}
                >
                    {isRunning() ? "一時停止" : "スタート"}
                </button>
                <button
                    type="button"
                    class="ba-btn ba-btn--outline"
                    style={{ width: "7rem" }}
                    onClick={(e) => {
                        stop(e.currentTarget);
                        setTime(
                            mode() === "pomodoro"
                                ? (isBreak() ? breakMin() : focusMin()) * 60
                                : 0,
                        );
                    }}
                >
                    リセット
                </button>
            </div>

            {/* 各モードの詳細設定 */}
            <Switch>
                <Match when={mode() === "timer"}>
                    <div
                        class="ba-w-full ba-stack-4"
                        style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}
                    >
                        <div class="ba-text-sm ba-font-bold ba-text-muted">
                            時間入力 (H:M:S)
                        </div>
                        <div class="ba-flex ba-items-center ba-gap-2">
                            <input
                                type="number"
                                min="0"
                                value={h()}
                                onInput={(e) => {
                                    const v = Number(e.currentTarget.value);
                                    setH(Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
                                }}
                                class="ba-input"
                                placeholder="時"
                                aria-label="時間（時）"
                            />
                            <input
                                type="number"
                                min="0"
                                value={m()}
                                onInput={(e) => {
                                    const v = Number(e.currentTarget.value);
                                    setM(Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
                                }}
                                class="ba-input"
                                placeholder="分"
                                aria-label="時間（分）"
                            />
                            <input
                                type="number"
                                min="0"
                                value={s()}
                                onInput={(e) => {
                                    const v = Number(e.currentTarget.value);
                                    setS(Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
                                }}
                                class="ba-input"
                                placeholder="秒"
                                aria-label="時間（秒）"
                            />
                            <button
                                type="button"
                                class="ba-btn ba-btn--primary ba-shrink-0"
                                onClick={(e) => {
                                    animatePop(e.currentTarget, 0.92, 0.15);
                                    setTime(h() * 3600 + m() * 60 + s());
                                }}
                            >
                                セット
                            </button>
                        </div>

                        <div class="ba-text-sm ba-font-bold ba-text-muted">
                            プリセット設定
                        </div>
                        <div style={{ display: "grid", "grid-template-columns": "repeat(4, minmax(0, 1fr))", gap: "0.5rem" }}>
                            <For each={[1, 3, 5, 10, 15, 30, 45, 60]}>
                                {(min) => (
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--sm ba-btn--outline ba-min-w-0"
                                        onClick={(e) => {
                                            animatePop(e.currentTarget, 0.92, 0.15);
                                            setTime(min * 60);
                                        }}
                                    >
                                        {min}分
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>
                </Match>
                <Match when={mode() === "pomodoro"}>
                    <div
                        class="ba-w-full ba-stack-4"
                        style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}
                    >
                        <div style={{ display: "grid", "grid-template-columns": "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
                            <div class="ba-field">
                                <label class="ba-label ba-text-muted">
                                    集中(分)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    class="ba-input"
                                    aria-label="集中時間（分）"
                                    value={focusMin()}
                                    onInput={(e) => {
                                        const v = Number(e.currentTarget.value);
                                        setFocusMin(
                                            Number.isFinite(v)
                                                ? Math.max(1, Math.floor(v))
                                                : 25,
                                        );
                                    }}
                                />
                            </div>
                            <div class="ba-field">
                                <label class="ba-label ba-text-muted">
                                    休憩(分)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    class="ba-input"
                                    aria-label="休憩時間（分）"
                                    value={breakMin()}
                                    onInput={(e) => {
                                        const v = Number(e.currentTarget.value);
                                        setBreakMin(
                                            Number.isFinite(v)
                                                ? Math.max(1, Math.floor(v))
                                                : 5,
                                        );
                                    }}
                                />
                            </div>
                        </div>
                        <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                class="ba-toggle"
                                checked={autoRepeat()}
                                onChange={(e) =>
                                    setAutoRepeat(e.target.checked)
                                }
                            />
                            <span class="ba-text-sm">自動ループを有効にする</span>
                        </label>
                    </div>
                </Match>
            </Switch>

            {/* サウンド設定 (タイマー・ポモドーロ用) */}
            <Show when={mode() === "timer" || mode() === "pomodoro"}>
                <div
                    class="ba-w-full ba-stack-4"
                    style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}
                >
                    <div class="ba-flex ba-items-center ba-justify-between">
                        <div class="ba-text-sm ba-font-bold">
                            通知音設定
                        </div>
                        <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                            <span class="ba-text-xs ba-text-muted">
                                {soundEnabled() ? "ON" : "OFF"}
                            </span>
                            <input
                                type="checkbox"
                                class="ba-toggle ba-toggle--sm"
                                checked={soundEnabled()}
                                onChange={(e) => setSoundEnabled(e.target.checked)}
                                aria-label="通知音を有効にする"
                            />
                        </label>
                    </div>

                    <Show when={soundEnabled()}>
                        <div class="ba-panel ba-stack-3">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                <label class="ba-text-xs ba-font-bold ba-text-muted" for="sound-type-select">
                                    音の種類
                                </label>
                                <div class="ba-flex ba-items-center ba-gap-2">
                                    <select
                                        id="sound-type-select"
                                        class="ba-select ba-select--sm"
                                        style={{ width: "auto" }}
                                        value={soundType()}
                                        onChange={(e) => setSoundType(e.currentTarget.value as "alarm" | "chime")}
                                        aria-label="音の種類"
                                    >
                                        <option value="alarm">電子アラーム (ピピピッ)</option>
                                        <option value="chime">チャイム (ポーン)</option>
                                    </select>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--sm ba-btn--outline ba-shrink-0"
                                        onClick={(e) => {
                                            animatePop(e.currentTarget, 0.92, 0.15);
                                            playNotificationSound({
                                                soundType: soundType(),
                                                volume: soundVolume() / 100,
                                            });
                                        }}
                                        aria-label="試聴"
                                    >
                                        試聴
                                    </button>
                                </div>
                            </div>

                            <div class="ba-stack-1">
                                <div class="ba-flex ba-justify-between ba-items-center ba-text-xs ba-text-muted">
                                    <label for="sound-volume-range" class="ba-font-bold">
                                        音量
                                    </label>
                                    <span class="ba-mono" style={{ "font-variant-numeric": "tabular-nums" }}>{soundVolume()}%</span>
                                </div>
                                <input
                                    id="sound-volume-range"
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={soundVolume()}
                                    onInput={(e) => {
                                        const v = Number(e.currentTarget.value);
                                        setSoundVolume(
                                            Number.isFinite(v)
                                                ? Math.max(0, Math.min(100, Math.floor(v)))
                                                : 100,
                                        );
                                    }}
                                    class="ba-range ba-w-full"
                                    aria-label="音量"
                                />
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
}
