import { createSignal, For, onSettled, untrack } from "solid-js";
import AdSense from "../components/AdSense";
import { animateFadeIn, animatePop, playPageEntrance } from "../utils/gsapAnimations";

function safeCalculate(expression: string): number {
    const sanitized = expression.replace(/×/g, "*").replace(/÷/g, "/");
    if (!/^[\d\s+\-*/.]+$/.test(sanitized)) {
        throw new Error("Invalid character");
    }
    const fn = new Function(`return (${sanitized})`);
    const res = fn();
    if (typeof res !== "number" || !isFinite(res)) {
        throw new Error("Invalid result");
    }
    return res;
}

export default function Calculator() {
    let containerRef: HTMLDivElement | undefined;
    let displayInputRef: HTMLInputElement | undefined;
    const [display, setDisplay] = createSignal("0");
    const [history, setHistory] = createSignal<string[]>([]);

    // SEO対策：メタデータの動的挿入
    onSettled(() => {
        document.title = "シンプル計算機 | 履歴機能付きWeb電卓";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "ブラウザ上で手軽に使えるシンプルな計算機ツールです。過去の計算履歴を保存し、クリックで再利用することも可能です。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "calculator-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "シンプル計算機",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "計算履歴機能がついた、使いやすいWebベースの電卓ツール。",
        });
        document.head.appendChild(script);

        if (containerRef) playPageEntrance(containerRef);

        return () => {
            const el = document.getElementById("calculator-jsonld");
            if (el) {
                el.remove();
            }
        };
    });

    const buttons = [
        "7",
        "8",
        "9",
        "÷",
        "4",
        "5",
        "6",
        "×",
        "1",
        "2",
        "3",
        "-",
        "0",
        ".",
        "=",
        "+",
    ];

    const handleButtonClick = (btn: string, targetEl: HTMLElement) => {
        animatePop(targetEl, 0.9, 0.15);
        if (btn === "=") {
            calculate();
        } else {
            append(btn);
        }
    };

    const append = (char: string) =>
        setDisplay((prev) => (prev === "0" ? char : prev + char));

    const clear = (targetEl?: HTMLElement) => {
        if (targetEl) animatePop(targetEl, 0.92, 0.15);
        setDisplay("0");
    };

    const calculate = () => {
        try {
            const result = safeCalculate(display());
            const entry = `${display()} = ${result}`;
            setHistory((prev) => [entry, ...prev]);
            setDisplay(String(result));

            if (displayInputRef && typeof displayInputRef.animate === "function") {
                displayInputRef.animate(
                    [{ transform: "scale(1.03)" }, { transform: "scale(1)" }],
                    { duration: 200, easing: "ease-out" },
                );
            }
        } catch {
            setDisplay("Error");
        }
    };

    const loadFromHistory = (item: string) => {
        const value = item.split(" = ")[0];
        setDisplay(value);
        if (displayInputRef) {
            animatePop(displayInputRef, 0.98, 0.2);
        }
    };

    const getButtonClass = (btn: string) => {
        if (["÷", "×", "-", "+"].includes(btn))
            return "btn-info text-white font-bold border-2 border-info-content";
        if (btn === "=")
            return "btn-primary text-white font-bold border-2 border-primary-content";
        return "bg-white text-slate-900 border-2 border-slate-300 hover:bg-slate-100 font-medium";
    };

    return (
        <div ref={containerRef} class="h-full w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6">
            <h1 class="sr-only">シンプル計算機</h1>
            <div class="w-full lg:w-3/4 flex flex-col gap-4 sm:gap-6 max-w-xl mx-auto lg:order-2">
                <input
                    ref={displayInputRef}
                    type="text"
                    value={display()}
                    aria-label="計算結果・入力表示"
                    class="input input-bordered w-full text-right text-3xl sm:text-4xl lg:text-6xl font-mono h-16 sm:h-20 lg:h-24 bg-white border-2 sm:border-4 border-slate-300 text-slate-900"
                    disabled
                />

                <div class="grid grid-cols-4 gap-1.5 sm:gap-2 lg:gap-4">
                    <For each={buttons}>
                        {(btn) => (
                            <button
                                class={`btn text-xl sm:text-2xl lg:text-3xl shadow-md h-14 sm:h-16 lg:h-20 min-h-0 w-full ${getButtonClass(btn)}`}
                                onClick={(e) => handleButtonClick(btn, e.currentTarget)}
                            >
                                {btn}
                            </button>
                        )}
                    </For>
                    <button
                        onClick={(e) => clear(e.currentTarget)}
                        class="btn btn-error btn-lg text-lg sm:text-xl lg:text-2xl text-white col-span-4 h-12 sm:h-14 lg:h-16 min-h-0"
                    >
                        クリア
                    </button>
                </div>
            </div>

            <div class="w-full lg:w-1/4 max-h-60 lg:max-h-none lg:h-auto bg-base-100 p-3 sm:p-4 rounded-xl border border-base-200 shadow-sm overflow-y-auto lg:order-1">
                <h2 class="font-bold mb-3 sm:mb-4 border-b border-base-200 pb-2 text-sm sm:text-base">
                    計算履歴
                </h2>
                <ul class="space-y-2">
                    <For each={history()}>
                        {(item, index) => (
                            <li
                                ref={(el) => {
                                    if (untrack(index) === 0) animateFadeIn(el, { duration: 0.25 });
                                }}
                                onClick={() => loadFromHistory(item)}
                                class="p-2 sm:p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-primary hover:text-white transition-all text-xs sm:text-sm font-mono break-all"
                            >
                                {item}
                            </li>
                        )}
                    </For>
                </ul>
            </div>
        </div>
    );
}
