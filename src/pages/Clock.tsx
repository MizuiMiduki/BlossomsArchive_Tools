// src/pages/Clock.tsx
import { createSignal, onMount, onCleanup, Switch, Match, For } from "solid-js";

export default function Clock() {
    const [time, setTime] = createSignal(new Date());
    const [mode, setMode] = createSignal<"digital" | "analog">("digital");

    // SEO対策：メタデータの動的挿入
    onMount(() => {
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

        // 時計のタイマー処理
        const timer = setInterval(() => setTime(new Date()), 1000);
        onCleanup(() => {
            clearInterval(timer);
            const script = document.getElementById("clock-jsonld");
            if (script) {
                script.remove();
            }
        });
    });

    const getAngles = () => {
        const s = time().getSeconds();
        const m = time().getMinutes();
        const h = time().getHours();
        return {
            sec: s * 6,
            min: m * 6 + s * 0.1,
            hour: (h % 12) * 30 + m * 0.5,
        };
    };

    return (
        <div class="flex flex-col items-center justify-center min-h-[400px] p-6">
            {/* 切り替えボタン */}
            <div class="tabs tabs-boxed mb-12">
                <a
                    class={`tab ${mode() === "digital" ? "tab-active" : ""}`}
                    onClick={() => setMode("digital")}
                >
                    デジタル
                </a>
                <a
                    class={`tab ${mode() === "analog" ? "tab-active" : ""}`}
                    onClick={() => setMode("analog")}
                >
                    アナログ
                </a>
            </div>

            <Switch>
                <Match when={mode() === "digital"}>
                    <div class="text-6xl md:text-8xl font-mono font-black text-primary tracking-tighter">
                        {time().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        })}
                    </div>
                </Match>

                <Match when={mode() === "analog"}>
                    <div class="relative w-64 h-64 md:w-80 md:h-80">
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
                            {/* 針 */}
                            <line
                                x1="50"
                                y1="50"
                                x2="50"
                                y2="25"
                                stroke-width="4"
                                stroke-linecap="round"
                                style={{
                                    transform: `rotate(${getAngles().hour}deg)`,
                                    "transform-origin": "50px 50px",
                                }}
                            />
                            <line
                                x1="50"
                                y1="50"
                                x2="50"
                                y2="15"
                                stroke-width="3"
                                stroke-linecap="round"
                                style={{
                                    transform: `rotate(${getAngles().min}deg)`,
                                    "transform-origin": "50px 50px",
                                }}
                            />
                            <line
                                x1="50"
                                y1="50"
                                x2="50"
                                y2="10"
                                stroke-width="1"
                                stroke="red"
                                style={{
                                    transform: `rotate(${getAngles().sec}deg)`,
                                    "transform-origin": "50px 50px",
                                }}
                            />
                            <circle cx="50" cy="50" r="2" fill="red" />
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
        </div>
    );
}
