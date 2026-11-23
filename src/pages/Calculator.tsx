import { createSignal, For, onSettled } from "solid-js";
import { animatePop, playPageEntrance } from "../utils/animations";

function safeCalculate(expression: string): number {
    const sanitized = expression
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/\s+/g, "");

    if (!sanitized) throw new Error("Empty expression");
    if (!/^[\d+\-*/.()]+$/.test(sanitized)) {
        throw new Error("Invalid character");
    }

    let pos = 0;

    function peek(): string {
        return sanitized[pos] || "";
    }

    function parseNumber(): number {
        const start = pos;
        if (peek() === "+" || peek() === "-") {
            pos++;
        }
        let hasDigits = false;
        while (pos < sanitized.length && /[\d]/.test(sanitized[pos])) {
            pos++;
            hasDigits = true;
        }
        if (pos < sanitized.length && sanitized[pos] === ".") {
            pos++;
            while (pos < sanitized.length && /[\d]/.test(sanitized[pos])) {
                pos++;
                hasDigits = true;
            }
        }
        if (!hasDigits) {
            throw new Error("Expected number");
        }
        const numStr = sanitized.slice(start, pos);
        const val = parseFloat(numStr);
        if (isNaN(val)) throw new Error("Invalid number");
        return val;
    }

    function parseFactor(): number {
        if (peek() === "(") {
            pos++;
            const val = parseExpression();
            if (peek() !== ")") throw new Error("Expected )");
            pos++;
            return val;
        }
        return parseNumber();
    }

    function parseTerm(): number {
        let val = parseFactor();
        while (pos < sanitized.length && (peek() === "*" || peek() === "/")) {
            const op = peek();
            pos++;
            const next = parseFactor();
            if (op === "*") {
                val = val * next;
            } else {
                if (next === 0) throw new Error("Division by zero");
                val = val / next;
            }
        }
        return val;
    }

    function parseExpression(): number {
        let val = parseTerm();
        while (pos < sanitized.length && (peek() === "+" || peek() === "-")) {
            const op = peek();
            pos++;
            const next = parseTerm();
            if (op === "+") {
                val = val + next;
            } else {
                val = val - next;
            }
        }
        return val;
    }

    const result = parseExpression();
    if (pos < sanitized.length) {
        throw new Error("Unexpected characters at end");
    }
    if (!isFinite(result)) {
        throw new Error("Result is not finite");
    }
    // 浮動小数点計算の丸め誤差を補正
    return Math.round(result * 1e12) / 1e12;
}

export default function Calculator() {
    let containerRef: HTMLDivElement | undefined;
    let displayInputRef: HTMLInputElement | undefined;
    const [display, setDisplay] = createSignal("0");
    const [history, setHistory] = createSignal<string[]>([]);
    const [isScientific, setIsScientific] = createSignal(false);

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef);
    });

    const standardButtons = [
        "7", "8", "9", "÷",
        "4", "5", "6", "×",
        "1", "2", "3", "-",
        "0", ".", "=", "+",
    ];

    const scientificButtons = [
        "(", ")", "√", "x²", "±", "%",
    ];

    const handleButtonClick = (btn: string, targetEl: HTMLElement) => {
        animatePop(targetEl, 0.9, 0.15);
        if (btn === "=") {
            calculate();
        } else {
            append(btn);
        }
    };

    const handleScientificOp = (op: string, targetEl: HTMLElement) => {
        animatePop(targetEl, 0.9, 0.15);
        if (op === "(" || op === ")") {
            append(op);
            return;
        }

        try {
            const currentVal = safeCalculate(display());
            let result: number;
            if (op === "√") {
                if (currentVal < 0) throw new Error("Negative square root");
                result = Math.round(Math.sqrt(currentVal) * 1e12) / 1e12;
            } else if (op === "x²") {
                result = Math.round(Math.pow(currentVal, 2) * 1e12) / 1e12;
            } else if (op === "±") {
                result = -currentVal;
            } else if (op === "%") {
                result = Math.round((currentVal / 100) * 1e12) / 1e12;
            } else {
                return;
            }
            const entry = `${op}(${display()}) = ${result}`;
            setHistory((prev) => [entry, ...prev]);
            setDisplay(String(result));
        } catch {
            setDisplay("Error");
        }
    };

    const append = (char: string) =>
        setDisplay((prev) =>
            prev === "0" || prev === "Error"
                ? char === "."
                    ? "0."
                    : char
                : prev + char,
        );

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
            return "bg-sky-700 hover:bg-sky-800 text-white font-bold border-2 border-sky-900";
        if (btn === "=")
            return "bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-2 border-indigo-900";
        return "bg-base-100 text-base-content dark:text-white border-2 border-base-300 hover:bg-base-200 font-bold shadow-xs";
    };

    return (
        <div ref={containerRef} class="h-full w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6">
            <h1 class="sr-only">シンプル計算機</h1>
            <div class="w-full lg:w-3/4 flex flex-col gap-4 sm:gap-6 max-w-xl mx-auto lg:order-2">
                {/* モード切替とディスプレイ */}
                <div class="flex items-center justify-between px-1">
                    <span class="text-xs font-semibold text-base-content/70">
                        {isScientific() ? "関数電卓モード" : "基本電卓モード"}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsScientific(!isScientific())}
                        class="btn btn-ghost btn-xs text-xs font-bold text-primary hover:bg-primary/10"
                        aria-label={isScientific() ? "基本モードへ切替" : "関数モードへ切替"}
                    >
                        {isScientific() ? "基本モード" : "関数電卓"}
                    </button>
                </div>

                <input
                    ref={displayInputRef}
                    type="text"
                    value={display()}
                    aria-label="計算結果・入力表示"
                    class="input input-bordered w-full text-right text-3xl sm:text-4xl lg:text-6xl font-mono h-16 sm:h-20 lg:h-24 bg-base-100 border-2 sm:border-4 border-base-300 text-base-content dark:text-white shadow-sm"
                    disabled
                />

                {/* 関数電卓用ボタングリッド */}
                <div class={`grid grid-cols-6 gap-1.5 sm:gap-2 transition-all ${isScientific() ? "block" : "hidden"}`}>
                    <For each={scientificButtons}>
                        {(op) => (
                            <button
                                type="button"
                                class="btn btn-neutral btn-sm sm:btn-md font-mono text-sm sm:text-base font-bold shadow-sm"
                                onClick={(e) => handleScientificOp(op, e.currentTarget)}
                                aria-label={op}
                            >
                                {op}
                            </button>
                        )}
                    </For>
                </div>

                <div class="grid grid-cols-4 gap-1.5 sm:gap-2 lg:gap-4">
                    <For each={standardButtons}>
                        {(btn) => (
                            <button
                                class={`btn text-xl sm:text-2xl lg:text-3xl shadow-md h-14 sm:h-16 lg:h-20 min-h-0 w-full ${getButtonClass(btn)}`}
                                onClick={(e) => handleButtonClick(btn, e.currentTarget)}
                                aria-label={btn}
                            >
                                {btn}
                            </button>
                        )}
                    </For>
                    <button
                        onClick={(e) => clear(e.currentTarget)}
                        class="btn bg-red-600 hover:bg-red-700 border-red-800 btn-lg text-lg sm:text-xl lg:text-2xl !text-white font-bold col-span-4 h-12 sm:h-14 lg:h-16 min-h-0"
                        aria-label="クリア"
                    >
                        クリア
                    </button>
                </div>
            </div>

            <div class="w-full lg:w-1/4 max-h-60 lg:max-h-none lg:h-auto bg-base-100 p-3 sm:p-4 rounded-xl border border-base-200 shadow-sm overflow-y-auto lg:order-1">
                <h2 class="font-bold mb-3 sm:mb-4 border-b border-base-200 pb-2 text-sm sm:text-base dark:text-white">
                    計算履歴
                </h2>
                <ul class="space-y-2">
                    <For each={history()}>
                        {(item) => (
                            <li
                                onClick={() => loadFromHistory(item)}
                                class="p-2 sm:p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-primary hover:text-white dark:hover:text-gray-900 transition-all text-xs sm:text-sm font-mono break-all text-base-content dark:text-gray-100"
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
