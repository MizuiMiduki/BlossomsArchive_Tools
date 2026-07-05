import { createSignal, Switch, Match, For, createEffect } from "solid-js";

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

    let timerId: number | undefined;

    // 設定値が変わったら即座に時間を反映（動いていない時だけ）
    createEffect(() => {
        if (mode() === "pomodoro" && !isRunning()) {
            setTime(isBreak() ? breakMin() * 60 : focusMin() * 60);
        }
    });

    const formatTime = (val: number, isStopwatch: boolean) => {
        if (isStopwatch) {
            const mins = Math.floor(val / 6000);
            const secs = Math.floor((val % 6000) / 100);
            const ms = val % 100;
            return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
        } else {
            const hours = Math.floor(val / 3600);
            const mins = Math.floor((val % 3600) / 60);
            const secs = val % 60;
            return hours > 0
                ? `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
                : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        }
    };

    const stop = () => {
        setIsRunning(false);
        if (timerId) clearInterval(timerId);
    };

    const start = () => {
        if (isRunning()) return;
        setIsRunning(true);
        const interval = mode() === "stopwatch" ? 10 : 1000;
        timerId = window.setInterval(() => {
            if (mode() === "stopwatch") {
                setTime((t) => t + 1);
            } else {
                if (time() > 0) {
                    setTime((t) => t - 1);
                } else {
                    if (mode() === "pomodoro" && autoRepeat()) {
                        setIsBreak(!isBreak());
                        setTime((!isBreak() ? breakMin() : focusMin()) * 60);
                    } else {
                        stop();
                        modalRef?.showModal();
                    }
                }
            }
        }, interval);
    };

    const changeMode = (newMode: "stopwatch" | "timer" | "pomodoro") => {
        stop();
        setMode(newMode);
        setIsBreak(false);

        if (newMode === "stopwatch") setTime(0);
        else if (newMode === "timer") setTime(300);
        else if (newMode === "pomodoro") setTime(focusMin() * 60);
    };

    return (
        <div class="flex flex-col items-center justify-center p-6 space-y-8 max-w-sm mx-auto">
            {/* ダイアログ */}
            <dialog ref={modalRef} class="modal modal-bottom sm:modal-middle">
                <div class="modal-box">
                    <h3 class="font-bold text-xl text-primary">
                        時間です！
                    </h3>
                    <p class="py-4 text-base-content/70">お疲れさまでした！</p>
                    <div class="modal-action">
                        <form method="dialog">
                            <button class="btn btn-primary">閉じる</button>
                        </form>
                    </div>
                </div>
            </dialog>

            {/* タブ切り替え */}
            <div class="tabs tabs-boxed">
                <a
                    class={`tab ${mode() === "stopwatch" ? "tab-active" : ""}`}
                    onClick={() => changeMode("stopwatch")}
                >
                    ストップウォッチ
                </a>
                <a
                    class={`tab ${mode() === "timer" ? "tab-active" : ""}`}
                    onClick={() => changeMode("timer")}
                >
                    タイマー
                </a>
                <a
                    class={`tab ${mode() === "pomodoro" ? "tab-active" : ""}`}
                    onClick={() => changeMode("pomodoro")}
                >
                    ポモドーロ
                </a>
            </div>

            {/* 表示部分 */}
            <div class="text-center">
                {mode() === "pomodoro" && (
                    <div
                        class={`badge ${isBreak() ? "badge-accent" : "badge-primary"} mb-2`}
                    >
                        {isBreak() ? "休憩中" : "集中タイム"}
                    </div>
                )}
                <div class="text-6xl font-mono font-black text-primary tabular-nums">
                    {formatTime(time(), mode() === "stopwatch")}
                </div>
            </div>

            {/* 操作ボタン */}
            <div class="flex gap-4">
                <button
                    class="btn btn-primary w-28"
                    onClick={isRunning() ? stop : start}
                >
                    {isRunning() ? "一時停止" : "スタート"}
                </button>
                <button
                    class="btn btn-outline w-28"
                    onClick={() =>
                        setTime(
                            mode() === "pomodoro"
                                ? (isBreak() ? breakMin() : focusMin()) * 60
                                : 0,
                        )
                    }
                >
                    リセット
                </button>
            </div>

            {/* 各モードの詳細設定 */}
            <Switch>
                <Match when={mode() === "timer"}>
                    <div class="w-full space-y-4 pt-4 border-t border-base-200">
                        <div class="text-sm font-bold opacity-60">
                            時間入力 (H:M:S)
                        </div>
                        <div class="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                value={h()}
                                onInput={(e) =>
                                    setH(Number(e.currentTarget.value))
                                }
                                class="input input-bordered w-full"
                                placeholder="時"
                            />
                            <input
                                type="number"
                                min="0"
                                value={m()}
                                onInput={(e) =>
                                    setM(Number(e.currentTarget.value))
                                }
                                class="input input-bordered w-full"
                                placeholder="分"
                            />
                            <input
                                type="number"
                                min="0"
                                value={s()}
                                onInput={(e) =>
                                    setS(Number(e.currentTarget.value))
                                }
                                class="input input-bordered w-full"
                                placeholder="秒"
                            />
                            <button
                                class="btn btn-primary"
                                onClick={() =>
                                    setTime(h() * 3600 + m() * 60 + s())
                                }
                            >
                                セット
                            </button>
                        </div>

                        <div class="text-sm font-bold opacity-60">
                            プリセット設定
                        </div>
                        <div class="grid grid-cols-4 gap-2">
                            <For each={[1, 3, 5, 10, 15, 30, 45, 60]}>
                                {(min) => (
                                    <button
                                        class="btn btn-sm btn-ghost border-base-300"
                                        onClick={() => setTime(min * 60)}
                                    >
                                        {min}分
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>
                </Match>
                <Match when={mode() === "pomodoro"}>
                    <div class="w-full space-y-4 pt-4 border-t border-base-200">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-xs opacity-60">
                                    集中(分)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    class="input input-bordered w-full"
                                    value={focusMin()}
                                    onInput={(e) =>
                                        setFocusMin(
                                            Math.max(
                                                1,
                                                Number(e.currentTarget.value),
                                            ),
                                        )
                                    }
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
                                    value={breakMin()}
                                    onInput={(e) =>
                                        setBreakMin(
                                            Math.max(
                                                1,
                                                Number(e.currentTarget.value),
                                            ),
                                        )
                                    }
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
