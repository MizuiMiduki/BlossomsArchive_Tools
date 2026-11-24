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
        if (btn === "=") return "ba-btn ba-btn--primary ba-w-full";
        return "ba-btn ba-w-full";
    };

    const getButtonStyle = (btn: string) => {
        if (["÷", "×", "-", "+"].includes(btn)) {
            return {
                height: "4rem",
                "font-size": "1.5rem",
                "background-color": "var(--ba-info)",
                "border-color": "var(--ba-info)",
                color: "var(--ba-info-fg)",
            };
        }
        return {
            height: "4rem",
            "font-size": "1.5rem",
        };
    };

    return (
        <div ref={containerRef} class="ba-page">
            <h1 class="ba-sr-only">シンプル計算機</h1>
            <div class="ba-flex ba-flex-wrap ba-gap-6 ba-items-start">
                <div
                    class="ba-card ba-stack-3"
                    style={{
                        flex: "1 1 14rem",
                        "max-height": "32rem",
                        "overflow-y": "auto",
                    }}
                >
                    <h2
                        class="ba-section-title ba-text-base"
                        style={{ "padding-bottom": "0.5rem", "border-bottom": "1px solid var(--ba-border)" }}
                    >
                        計算履歴
                    </h2>
                    <ul class="ba-stack-2" style={{ "list-style": "none", margin: 0, padding: 0 }}>
                        <For each={history()}>
                            {(item) => (
                                <li
                                    onClick={() => loadFromHistory(item)}
                                    class="ba-panel ba-mono ba-text-xs ba-break-all"
                                    style={{ padding: "0.6rem 0.75rem", cursor: "pointer" }}
                                >
                                    {item}
                                </li>
                            )}
                        </For>
                    </ul>
                </div>

                <div
                    class="ba-card ba-stack-4 ba-min-w-0"
                    style={{ flex: "3 1 22rem", "max-width": "36rem", margin: "0 auto" }}
                >
                    {/* モード切替とディスプレイ */}
                    <div class="ba-flex ba-items-center ba-justify-between">
                        <span class="ba-text-xs ba-font-bold ba-text-muted">
                            {isScientific() ? "関数電卓モード" : "基本電卓モード"}
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsScientific(!isScientific())}
                            class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
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
                        class="ba-input ba-text-right ba-mono ba-font-bold"
                        style={{
                            "font-size": "clamp(1.75rem, 4vw, 3rem)",
                            height: "4.75rem",
                            "border-width": "2px",
                        }}
                        disabled
                    />

                    {/* 関数電卓用ボタングリッド */}
                    <div
                        style={{
                            display: isScientific() ? "grid" : "none",
                            "grid-template-columns": "repeat(6, minmax(0, 1fr))",
                            gap: "0.5rem",
                        }}
                    >
                        <For each={scientificButtons}>
                            {(op) => (
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--secondary ba-btn--sm ba-mono ba-font-bold"
                                    onClick={(e) => handleScientificOp(op, e.currentTarget)}
                                    aria-label={op}
                                >
                                    {op}
                                </button>
                            )}
                        </For>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            "grid-template-columns": "repeat(4, minmax(0, 1fr))",
                            gap: "0.625rem",
                        }}
                    >
                        <For each={standardButtons}>
                            {(btn) => (
                                <button
                                    type="button"
                                    class={getButtonClass(btn)}
                                    style={getButtonStyle(btn)}
                                    onClick={(e) => handleButtonClick(btn, e.currentTarget)}
                                    aria-label={btn}
                                >
                                    {btn}
                                </button>
                            )}
                        </For>
                        <button
                            type="button"
                            onClick={(e) => clear(e.currentTarget)}
                            class="ba-btn ba-btn--danger ba-btn--lg ba-w-full"
                            style={{ "grid-column": "span 4 / span 4", height: "3.5rem", "font-size": "1.2rem" }}
                            aria-label="クリア"
                        >
                            クリア
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
