// src/pages/Calculator.tsx
import { createSignal, For } from "solid-js";

export default function Calculator() {
    const [display, setDisplay] = createSignal("0");
    const [history, setHistory] = createSignal<string[]>([]);

    // 計算ボタンの配列
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

    // 履歴クリックで値を戻す関数
    const loadFromHistory = (item: string) => {
        const value = item.split(" = ")[0];
        setDisplay(value);
    };

    const getButtonClass = (btn: string) => {
        // 演算キー：コントラストを高くし、太字にするためにCSSで font-bold を追加します
        if (["÷", "×", "-", "+"].includes(btn))
            return "btn-info text-white font-bold border-2 border-info-content";

        // 計算キー：もっとも目立つように
        if (btn === "=")
            return "btn-primary text-white font-bold border-2 border-primary-content";

        // 数字キー：白背景＋非常に濃い文字＋はっきりした枠線
        return "bg-white text-slate-900 border-2 border-slate-300 hover:bg-slate-100 font-medium";
    };

    return (
        <div class="h-full w-full p-6 flex gap-6">
            {/* 左側：履歴リスト */}
            <div class="w-1/4 bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm overflow-y-auto">
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

            {/* 右側：電卓本体 */}
            <div class="w-3/4 flex flex-col gap-6 max-w-xl">
                <input
                    type="text"
                    value={display()}
                    class="input input-bordered w-full text-right text-6xl font-mono h-24 bg-white border-4 border-slate-300 text-slate-900"
                    disabled
                />

                <div class="grid grid-cols-4 gap-4">
                    <For each={buttons}>
                        {(btn) => (
                            <button
                                class={`btn text-3xl shadow-md h-24 w-full ${getButtonClass(btn)}`}
                                onClick={() => {
                                    if (btn === "=") calculate();
                                    else append(btn);
                                }}
                            >
                                {btn}
                            </button>
                        )}
                    </For>
                    <button
                        onClick={clear}
                        class="btn btn-error btn-lg text-2xl text-white col-span-4 h-20"
                    >
                        クリア
                    </button>
                </div>
            </div>
        </div>
    );
}
