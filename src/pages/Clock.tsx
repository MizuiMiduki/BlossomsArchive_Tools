// src/pages/Clock.tsx
import { createSignal, onSettled, Switch, Match, For, createEffect, Show } from "solid-js";
import AdSense from "../components/AdSense";
import { playPageEntrance } from "../utils/animations";
import { initAudio, playClockTickSound } from "../utils/sound";

// 文字盤の1〜12時の数字位置（半径35.5）
const CLOCK_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
    const rad = (h * 30 * Math.PI) / 180;
    const r = 35.5;
    return {
        hour: h,
        x: Number((50 + r * Math.sin(rad)).toFixed(2)),
        y: Number((50 - r * Math.cos(rad)).toFixed(2)),
    };
});

// 文字盤の60分割目盛り（5分ごとの時目盛り＋1分ごとの分のコマ）
const CLOCK_TICKS = Array.from({ length: 60 }, (_, i) => ({
    i,
    isHour: i % 5 === 0,
    angle: i * 6,
}));

export default function Clock() {
    const [time, setTime] = createSignal(new Date());
    const [mode, setMode] = createSignal<"digital" | "analog">("digital");
    const [soundEnabled, setSoundEnabled] = createSignal(false);
    const [soundVolume, setSoundVolume] = createSignal(100);
    let containerRef: HTMLDivElement | undefined;

    // 初期角度の計算
    const initialDate = new Date();
    const initialSec = initialDate.getSeconds() * 6;
    const initialMin = initialDate.getMinutes() * 6 + initialDate.getSeconds() * 0.1;
    const initialHour = (initialDate.getHours() % 12) * 30 + initialDate.getMinutes() * 0.5;

    const [secAngle, setSecAngle] = createSignal(initialSec);
    const [minAngle, setMinAngle] = createSignal(initialMin);
    const [hourAngle, setHourAngle] = createSignal(initialHour);

    let continuousSecAngle = initialSec;
    let isFirstTick = true;

    const updateAnalogHands = (now: Date) => {
        setSecAngle(continuousSecAngle);
        setMinAngle(now.getMinutes() * 6 + now.getSeconds() * 0.1);
        setHourAngle((now.getHours() % 12) * 30 + now.getMinutes() * 0.5);
    };

    onSettled(() => {
        // localStorage から秒針音の設定を復元
        try {
            const savedEnabled = localStorage.getItem("ba_clock_sound_enabled");
            if (savedEnabled === "true") {
                setSoundEnabled(true);
            }
            const savedVol = Number(localStorage.getItem("ba_clock_sound_volume"));
            if (Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 100) {
                setSoundVolume(savedVol);
            }
        } catch {}

        // 時計のタイマー処理 (毎秒更新)
        let lastSec = -1;
        const tick = () => {
            const current = new Date();
            const currentSec = current.getSeconds();
            if (currentSec !== lastSec) {
                lastSec = currentSec;
                setTime(current);

                // アナログ時計の秒針用連続角度（0秒通過時の逆回転防止）
                if (!isFirstTick && currentSec === 0) {
                    continuousSecAngle += 6;
                } else {
                    const baseRounds = Math.floor(continuousSecAngle / 360) * 360;
                    continuousSecAngle = baseRounds + currentSec * 6;
                }
                isFirstTick = false;

                updateAnalogHands(current);

                // アナログ時計表示時かつ秒針音が有効な場合、重厚なTick-Tock（カチッカチッ）を鳴らす
                if (mode() === "analog" && soundEnabled() && soundVolume() > 0) {
                    playClockTickSound(currentSec % 2 === 0, soundVolume() / 100);
                }
            }
        };
        const intervalId = window.setInterval(tick, 200);

        // ページエントランスアニメーション
        if (containerRef) playPageEntrance(containerRef);

        return () => {
            window.clearInterval(intervalId);
        };
    });

    // モード切り替え時に最新の針の位置を即時反映
    createEffect(
        () => ({ m: mode(), now: time() }),
        ({ m, now }) => {
            if (m === "analog") {
                const currentSec = now.getSeconds();
                const baseRounds = Math.floor(continuousSecAngle / 360) * 360;
                continuousSecAngle = baseRounds + currentSec * 6;
                setSecAngle(continuousSecAngle);
                setMinAngle(now.getMinutes() * 6 + now.getSeconds() * 0.1);
                setHourAngle((now.getHours() % 12) * 30 + now.getMinutes() * 0.5);
            }
        }
    );

    const switchMode = (newMode: "digital" | "analog") => {
        if (mode() === newMode) return;
        setMode(newMode);
    };

    const toggleSound = () => {
        const next = !soundEnabled();
        setSoundEnabled(next);
        if (next) {
            initAudio();
            const currentVol = soundVolume() > 0 ? soundVolume() : 100;
            if (soundVolume() <= 0) setSoundVolume(100);
            playClockTickSound(time().getSeconds() % 2 === 0, currentVol / 100);
        }
        try {
            localStorage.setItem("ba_clock_sound_enabled", String(next));
        } catch {}
    };

    const handleVolumeChange = (vol: number) => {
        const clamped = Math.max(0, Math.min(100, Math.floor(vol)));
        setSoundVolume(clamped);
        try {
            localStorage.setItem("ba_clock_sound_volume", String(clamped));
        } catch {}
    };

    return (
        <div ref={containerRef} class="flex flex-col items-center justify-center min-h-[350px] p-2 sm:p-6 w-full min-w-0 max-w-md mx-auto">
            <h1 class="sr-only">リアルタイム時計</h1>
            {/* 切り替えボタン */}
            <div class="inline-flex p-1 bg-base-200 rounded-2xl mb-8 sm:mb-12 shadow-inner border border-base-300">
                <button
                    class={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        mode() === "digital"
                            ? "bg-primary text-white shadow-sm"
                            : "text-base-content/70 hover:text-base-content"
                    }`}
                    onClick={() => switchMode("digital")}
                >
                    デジタル
                </button>
                <button
                    class={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        mode() === "analog"
                            ? "bg-primary text-white shadow-sm"
                            : "text-base-content/70 hover:text-base-content"
                    }`}
                    onClick={() => switchMode("analog")}
                >
                    アナログ
                </button>
            </div>

            <Switch>
                <Match when={mode() === "digital"}>
                    <div
                        class="text-4xl sm:text-6xl md:text-8xl font-mono font-black text-primary tracking-tighter text-center select-none"
                    >
                        {time().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        })}
                    </div>
                </Match>

                <Match when={mode() === "analog"}>
                    <div class="flex flex-col items-center w-full">
                        <div
                            class="relative w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 max-w-[80vw] max-h-[80vw]"
                        >
                            <svg
                                viewBox="0 0 100 100"
                                class="w-full h-full stroke-base-content"
                            >
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="48"
                                    fill="none"
                                    stroke-width="2"
                                />
                                {/* 目盛り（5分ごとの時目盛り＋1分ごとの分のコマ） */}
                                <For each={CLOCK_TICKS}>
                                    {(tick) => (
                                        <line
                                            x1="50"
                                            y1="4"
                                            x2="50"
                                            y2={tick.isHour ? "8.5" : "6.2"}
                                            transform={`rotate(${tick.angle} 50 50)`}
                                            stroke-width={tick.isHour ? "1.8" : "0.75"}
                                            opacity={tick.isHour ? "1" : "0.55"}
                                        />
                                    )}
                                </For>

                                {/* 時間の数字（1〜12） */}
                                <For each={CLOCK_HOURS}>
                                    {(item) => (
                                        <text
                                            x={item.x}
                                            y={item.y}
                                            text-anchor="middle"
                                            dominant-baseline="central"
                                            class="fill-base-content font-bold select-none text-[6.5px]"
                                            fill="currentColor"
                                            stroke="none"
                                        >
                                            {item.hour}
                                        </text>
                                    )}
                                </For>

                                {/* 針 (CSSトランジションで滑らかにアニメーション描画) */}
                                {/* 時針 */}
                                <line
                                    x1="50"
                                    y1="50"
                                    x2="50"
                                    y2="25"
                                    stroke-width="4"
                                    stroke-linecap="round"
                                    transform={`rotate(${hourAngle()} 50 50)`}
                                    style={{ transition: "transform 0.4s ease-out" }}
                                />
                                {/* 分針 */}
                                <line
                                    x1="50"
                                    y1="50"
                                    x2="50"
                                    y2="13"
                                    stroke-width="2.8"
                                    stroke-linecap="round"
                                    transform={`rotate(${minAngle()} 50 50)`}
                                    style={{ transition: "transform 0.4s ease-out" }}
                                />
                                {/* 秒針 */}
                                <line
                                    x1="50"
                                    y1="50"
                                    x2="50"
                                    y2="8"
                                    stroke-width="1.4"
                                    stroke="red"
                                    stroke-linecap="round"
                                    transform={`rotate(${secAngle()} 50 50)`}
                                    style={{ transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                                />
                                {/* 時計の中心ピン */}
                                <circle cx="50" cy="50" r="2.5" fill="red" stroke="none" />
                            </svg>
                        </div>

                        {/* アナログ時計専用: 秒針音（カチッカチッ）の音量・ON/OFFコントロール */}
                        <div class="mt-6 flex items-center gap-3 p-2.5 sm:px-4 sm:py-2.5 bg-base-200/70 rounded-2xl border border-base-300 w-full max-w-xs shadow-xs">
                            <button
                                type="button"
                                class={`btn btn-sm rounded-xl font-bold transition-all border ${
                                    soundEnabled()
                                        ? "btn-primary text-white shadow-xs"
                                        : "btn-ghost border-base-300 text-base-content/70 hover:text-base-content"
                                }`}
                                onClick={toggleSound}
                                aria-label={soundEnabled() ? "秒針音をオフにする" : "秒針音をオンにする"}
                                aria-pressed={soundEnabled() ? "true" : "false"}
                                title={soundEnabled() ? "秒針音: ON" : "秒針音: OFF"}
                            >
                                <span class="text-base" aria-hidden="true">
                                    {soundEnabled() ? "🔊" : "🔇"}
                                </span>
                                <span>{soundEnabled() ? "ON" : "OFF"}</span>
                            </button>

                            <div class="flex items-center gap-2 flex-1 min-w-0">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={soundEnabled() ? soundVolume() : 0}
                                    aria-label="秒針音の音量"
                                    onInput={(e) => {
                                        const val = Number(e.currentTarget.value);
                                        if (Number.isFinite(val)) {
                                            handleVolumeChange(val);
                                        }
                                    }}
                                    class="range range-xs range-primary flex-1"
                                />
                                <span class="font-mono text-xs tabular-nums w-10 text-right font-bold text-base-content/80">
                                    {soundEnabled() ? `${soundVolume()}%` : "0%"}
                                </span>
                            </div>
                        </div>
                    </div>
                </Match>
            </Switch>

            <div class="text-xl md:text-2xl text-base-content/60 mt-8 font-medium">
                {time().toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })}
            </div>
            <AdSense />

            <AdSense />
        </div>
    );
}
