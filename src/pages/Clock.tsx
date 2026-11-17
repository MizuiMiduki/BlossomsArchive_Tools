// src/pages/Clock.tsx
import { createSignal, onSettled, Switch, Match, For, createEffect } from "solid-js";
import AdSense from "../components/AdSense";
import { animateFadeIn, playPageEntrance } from "../utils/animations";

export default function Clock() {
    const [time, setTime] = createSignal(new Date());
    const [mode, setMode] = createSignal<"digital" | "analog">("digital");
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

    // SEO対策：メタデータの動的挿入
    onSettled(() => {
        document.title = "リアルタイム時計 | デジタル＆アナログ時計表示";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "ブラウザ上で現在時刻をリアルタイムに表示するWeb時計ツールです。デジタル表示とアナログ表示を切り替えて楽しめます。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "clock-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "リアルタイム時計",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "現在時刻をデジタルまたはアナログ形式で表示するシンプルなWeb時計です。",
        });
        document.head.appendChild(script);

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
            }
        };
        const intervalId = window.setInterval(tick, 200);

        // ページエントランスアニメーション
        if (containerRef) playPageEntrance(containerRef);

        return () => {
            window.clearInterval(intervalId);
            const script = document.getElementById("clock-jsonld");
            if (script) {
                script.remove();
            }
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

    return (
        <div ref={containerRef} class="flex flex-col items-center justify-center min-h-[400px] p-6">
            <h1 class="sr-only">リアルタイム時計</h1>
            {/* 切り替えボタン */}
            <div class="inline-flex p-1 bg-base-200 rounded-2xl mb-12 shadow-inner border border-base-300">
                <button
                    class={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                        mode() === "digital"
                            ? "bg-primary text-white shadow-sm"
                            : "text-base-content/70 hover:text-base-content"
                    }`}
                    onClick={() => switchMode("digital")}
                >
                    デジタル
                </button>
                <button
                    class={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
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
                        ref={(el) => animateFadeIn(el, { duration: 0.3 })}
                        class="text-6xl md:text-8xl font-mono font-black text-primary tracking-tighter"
                    >
                        {time().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        })}
                    </div>
                </Match>

                <Match when={mode() === "analog"}>
                    <div
                        ref={(el) => animateFadeIn(el, { duration: 0.4 })}
                        class="relative w-64 h-64 md:w-80 md:h-80"
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
                            {/* 目盛り */}
                            <For each={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}>
                                {(i) => (
                                    <line
                                        x1="50"
                                        y1="5"
                                        x2="50"
                                        y2="10"
                                        transform={`rotate(${i * 30} 50 50)`}
                                        stroke-width="2"
                                    />
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
                                y2="15"
                                stroke-width="3"
                                stroke-linecap="round"
                                transform={`rotate(${minAngle()} 50 50)`}
                                style={{ transition: "transform 0.4s ease-out" }}
                            />
                            {/* 秒針 */}
                            <line
                                x1="50"
                                y1="50"
                                x2="50"
                                y2="10"
                                stroke-width="1.5"
                                stroke="red"
                                stroke-linecap="round"
                                transform={`rotate(${secAngle()} 50 50)`}
                                style={{ transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                            />
                            {/* 時計の中心ピン */}
                            <circle cx="50" cy="50" r="2.5" fill="red" stroke="none" />
                        </svg>
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
