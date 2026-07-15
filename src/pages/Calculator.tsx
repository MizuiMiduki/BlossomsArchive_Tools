// src/pages/Calculator.tsx
import { createSignal, For, onMount, onCleanup } from "solid-js";

export default function Calculator() {
    const [display, setDisplay] = createSignal("0");
    const [history, setHistory] = createSignal<string[]>([]);

    // SEO対策：メタデータの動的挿入
    onMount(() => {
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
    });

    onCleanup(() => {
        const script = document.getElementById("calculator-jsonld");
        if (script) {
            script.remove();
        }
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

    const append = (char: string) =>
        setDisplay((prev) => (prev === "0" ? char : prev + char));

    const clear = () => setDisplay("0");

    const calculate = () => {
        try {
            const result = eval(display().replace("×", "*").replace("÷", "/"));
            const entry = `${display()} = ${result}`;
            setHistory((prev) => [entry, ...prev]);
            setDisplay(String(result));
        } catch {
            setDisplay("Error");
        }
    };

    const loadFromHistory = (item: string) => {
        const value = item.split(" = ")[0];
        setDisplay(value);
    };

    const getButtonClass = (btn: string) => {
        if (["÷", "×", "-", "+"].includes(btn))
            return "btn-info text-white font-bold border-2 border-info-content";
        if (btn === "=")
            return "btn-primary text-white font-bold border-2 border-primary-content";
        return "bg-white text-slate-900 border-2 border-slate-300 hover:bg-slate-100 font-medium";
    };

    return (
        <div class="h-full w-full p-4 lg:p-6 flex flex-col lg:flex-row gap-6">
            <div class="w-full lg:w-3/4 flex flex-col gap-6 max-w-xl mx-auto lg:order-2">
                <input
                    type="text"
                    value={display()}
                    class="input input-bordered w-full text-right text-4xl lg:text-6xl font-mono h-20 lg:h-24 bg-white border-4 border-slate-300 text-slate-900"
                    disabled
                />

                <div class="grid grid-cols-4 gap-2 lg:gap-4">
                    <For each={buttons}>
                        {(btn) => (
                            <button
                                class={`btn text-2xl lg:text-3xl shadow-md h-20 lg:h-24 w-full ${getButtonClass(btn)}`}
                                onClick={() =>
                                    btn === "=" ? calculate() : append(btn)
                                }
                            >
                                {btn}
                            </button>
                        )}
                    </For>
                    <button
                        onClick={clear}
                        class="btn btn-error btn-lg text-xl lg:text-2xl text-white col-span-4 h-16 lg:h-20"
                    >
                        クリア
                    </button>
                </div>
            </div>

            <div class="w-full lg:w-1/4 h-64 lg:h-auto bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm overflow-y-auto lg:order-1">
                <h3 class="font-bold mb-4 border-b border-base-200 pb-2">
                    計算履歴
                </h3>
                <ul class="space-y-2">
                    <For each={history()}>
                        {(item) => (
                            <li
                                onClick={() => loadFromHistory(item)}
                                class="p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-primary hover:text-white transition-all text-sm font-mono"
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
