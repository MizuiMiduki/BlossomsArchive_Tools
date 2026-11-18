import { createSignal, Switch, Match, For, Show, createEffect, onSettled } from "solid-js";
import { animatePop, playPageEntrance } from "../utils/gsapAnimations";

export default function TimerStopwatch() {
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
                    } else {
                        stop();
                        modalRef?.showModal();
                        const modalBox = modalRef?.querySelector<HTMLElement>(".modal-box");
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
        };
    });

    return (
        <div ref={containerRef} class="flex flex-col items-center justify-center p-1 sm:p-6 space-y-6 sm:space-y-8 max-w-md mx-auto w-full min-w-0">
            <h1 class="sr-only">タイマー・ストップウォッチ</h1>
            {/* ダイアログ */}
            <dialog ref={modalRef} class="modal modal-bottom sm:modal-middle">
                <div class="modal-box">
                    <h2 class="font-bold text-xl text-primary">
                        時間です！
                    </h2>
                    <p class="py-4 text-base-content/70">お疲れさまでした！</p>
                    <div class="modal-action">
                        <button
                            type="button"
                            class="btn btn-primary"
                            onClick={() => modalRef?.close()}
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </dialog>

            {/* タブ切り替え */}
            <div class="grid grid-cols-3 w-full max-w-xs sm:max-w-sm p-1 bg-base-200 rounded-2xl shadow-inner border border-base-300">
                <button
                    type="button"
                    class={`py-2 px-1 text-center rounded-xl text-[11px] sm:text-xs md:text-sm font-bold transition-all truncate ${
                        mode() === "stopwatch"
                            ? "bg-primary text-white shadow-sm"
                            : "text-base-content/70 hover:text-base-content"
                    }`}
                    onClick={() => changeMode("stopwatch")}
                >
                    ストップウォッチ
                </button>
                <button
                    type="button"
                    class={`py-2 px-1 text-center rounded-xl text-[11px] sm:text-xs md:text-sm font-bold transition-all truncate ${
                        mode() === "timer"
                            ? "bg-primary text-white shadow-sm"
                            : "text-base-content/70 hover:text-base-content"
                    }`}
                    onClick={() => changeMode("timer")}
                >
                    タイマー
                </button>
                <button
                    type="button"
                    class={`py-2 px-1 text-center rounded-xl text-[11px] sm:text-xs md:text-sm font-bold transition-all truncate ${
                        mode() === "pomodoro"
                            ? "bg-primary text-white shadow-sm"
                            : "text-base-content/70 hover:text-base-content"
                    }`}
                    onClick={() => changeMode("pomodoro")}
                >
                    ポモドーロ
                </button>
            </div>

            {/* 表示部分 */}
            <div ref={timeDisplayRef} class="text-center w-full min-w-0">
                <Show when={mode() === "pomodoro"}>
                    <div
                        class={`badge ${isBreak() ? "badge-accent" : "badge-primary"} mb-2`}
                    >
                        {isBreak() ? "休憩中" : "集中タイム"}
                    </div>
                </Show>
                <div class="text-3xl sm:text-5xl md:text-6xl font-mono font-black text-primary tabular-nums tracking-tight">
                    {formatTime(time(), mode() === "stopwatch")}
                </div>
            </div>

            {/* 操作ボタン */}
            <div class="flex gap-4">
                <button
                    class="btn btn-primary w-28"
                    onClick={(e) => isRunning() ? stop(e.currentTarget) : start(e.currentTarget)}
                >
                    {isRunning() ? "一時停止" : "スタート"}
                </button>
                <button
                    class="btn btn-outline w-28"
                    onClick={(e) => {
                        animatePop(e.currentTarget, 0.92, 0.15);
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
                        class="w-full space-y-4 pt-4 border-t border-base-200"
                    >
                        <div class="text-sm font-bold opacity-60">
                            時間入力 (H:M:S)
                        </div>
                        <div class="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                value={h()}
                                onInput={(e) => {
                                    const v = Number(e.currentTarget.value);
                                    setH(Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
                                }}
                                class="input input-bordered w-full"
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
                                class="input input-bordered w-full"
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
                                class="input input-bordered w-full"
                                placeholder="秒"
                                aria-label="時間（秒）"
                            />
                            <button
                                class="btn btn-primary"
                                onClick={(e) => {
                                    animatePop(e.currentTarget, 0.92, 0.15);
                                    setTime(h() * 3600 + m() * 60 + s());
                                }}
                            >
                                セット
                            </button>
                        </div>

                        <div class="text-sm font-bold opacity-60">
                            プリセット設定
                        </div>
                        <div class="grid grid-cols-4 gap-1.5 sm:gap-2">
                            <For each={[1, 3, 5, 10, 15, 30, 45, 60]}>
                                {(min) => (
                                    <button
                                        class="btn btn-sm btn-ghost border-base-300 px-1 text-xs sm:text-sm min-w-0"
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
                        class="w-full space-y-4 pt-4 border-t border-base-200"
                    >
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-xs opacity-60">
                                    集中(分)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    class="input input-bordered w-full"
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
                            <div>
                                <label class="text-xs opacity-60">
                                    休憩(分)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    class="input input-bordered w-full"
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
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                class="toggle toggle-primary"
                                checked={autoRepeat()}
                                onChange={(e) =>
                                    setAutoRepeat(e.target.checked)
                                }
                            />
                            <span>自動ループを有効にする</span>
                        </label>
                    </div>
                </Match>
            </Switch>
        </div>
    );
}
