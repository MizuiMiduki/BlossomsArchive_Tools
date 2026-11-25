import { createMemo, createSignal, onSettled, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";

function formatRange(min: number, max: number, digits: number, unit: string) {
    const minText = min.toFixed(digits);
    const maxText = max.toFixed(digits);
    return minText === maxText
        ? `${minText} ${unit}`
        : `${minText}–${maxText} ${unit}`;
}

export default function HeadphoneDriveability() {
    const { title, description } = usePageI18n("/headphone-driveability", {
        defaultTitle: "イヤホン・ヘッドホンの鳴らしやすさ",
        defaultDescription: "インピーダンスと音圧感度から、目標音圧に必要な出力電圧・電流・電力を見積もります。",
    });
    let containerRef: HTMLDivElement | undefined;
    const [impedance, setImpedance] = createSignal("32");
    const [impedanceTolerance, setImpedanceTolerance] = createSignal("0");
    const [impedanceFrequency, setImpedanceFrequency] = createSignal("1000");
    const [sensitivity, setSensitivity] = createSignal("100");
    const [sensitivityUnit, setSensitivityUnit] = createSignal("mw");
    const [sensitivityFrequency, setSensitivityFrequency] =
        createSignal("1000");
    const [targetSpl, setTargetSpl] = createSignal("110");

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef);
    });

    const result = createMemo(() => {
        const ohms = Number(impedance());
        const tolerance = Number(impedanceTolerance());
        const impedanceHz = Number(impedanceFrequency());
        const sensitivityDb = Number(sensitivity());
        const sensitivityHz = Number(sensitivityFrequency());
        const targetDb = Number(targetSpl());

        if (
            impedance().trim() === "" ||
            impedanceTolerance().trim() === "" ||
            impedanceFrequency().trim() === "" ||
            sensitivity().trim() === "" ||
            sensitivityFrequency().trim() === "" ||
            targetSpl().trim() === "" ||
            !Number.isFinite(ohms) ||
            !Number.isFinite(tolerance) ||
            !Number.isFinite(impedanceHz) ||
            !Number.isFinite(sensitivityDb) ||
            !Number.isFinite(sensitivityHz) ||
            !Number.isFinite(targetDb) ||
            ohms <= 0 ||
            tolerance < 0 ||
            tolerance >= 100 ||
            impedanceHz <= 0 ||
            sensitivityHz <= 0 ||
            targetDb <= 0 ||
            targetDb > 140
        ) {
            return null;
        }

        const minOhms = ohms * (1 - tolerance / 100);
        const maxOhms = ohms * (1 + tolerance / 100);
        let minVoltage: number;
        let maxVoltage: number;
        let minPowerMw: number;
        let maxPowerMw: number;
        let minCurrentMa: number;
        let maxCurrentMa: number;

        if (sensitivityUnit() === "mw") {
            minPowerMw = 10 ** ((targetDb - sensitivityDb) / 10);
            maxPowerMw = minPowerMw;
            minVoltage = Math.sqrt((minPowerMw / 1000) * minOhms);
            maxVoltage = Math.sqrt((maxPowerMw / 1000) * maxOhms);
            minCurrentMa = Math.sqrt((minPowerMw / maxOhms) * 1000);
            maxCurrentMa = Math.sqrt((maxPowerMw / minOhms) * 1000);
        } else {
            minVoltage = 10 ** ((targetDb - sensitivityDb) / 20);
            maxVoltage = minVoltage;
            minPowerMw = ((minVoltage * minVoltage) / maxOhms) * 1000;
            maxPowerMw = ((maxVoltage * maxVoltage) / minOhms) * 1000;
            minCurrentMa = (minVoltage / maxOhms) * 1000;
            maxCurrentMa = (maxVoltage / minOhms) * 1000;
        }

        if (
            !Number.isFinite(minVoltage) ||
            !Number.isFinite(maxVoltage) ||
            !Number.isFinite(minPowerMw) ||
            !Number.isFinite(maxPowerMw) ||
            !Number.isFinite(minCurrentMa) ||
            !Number.isFinite(maxCurrentMa)
        ) {
            return null;
        }
        const normalizedLoad = Math.max(maxVoltage / 2, maxCurrentMa / 100);
        const score = 10000 / (1 + normalizedLoad);

        let difficulty = "出力に余裕が必要";
        if (score >= 7500) {
            difficulty = "鳴らしやすい";
        } else if (score >= 5500) {
            difficulty = "標準的";
        } else if (score >= 3500) {
            difficulty = "鳴らしにくい";
        }

        return {
            minOhms,
            maxOhms,
            impedanceHz,
            sensitivityHz,
            minVoltage,
            maxVoltage,
            minPowerMw,
            maxPowerMw,
            minCurrentMa,
            maxCurrentMa,
            score,
            difficulty,
        };
    });

    return (
        <div ref={containerRef} class="ba-page ba-page--wide">
            <section class="ba-card ba-stack-6">
                <header style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}>
                    <p
                        class="ba-text-sm ba-font-bold ba-text-primary"
                        style={{ margin: 0, "text-transform": "uppercase", "letter-spacing": "0.05em" }}
                    >
                        Audio utility
                    </p>
                    <h1 class="ba-title" style={{ "margin-top": "0.25rem" }}>
                        <BudouX text={title()} />
                    </h1>
                    <BudouX
                        as="p"
                        class="ba-text-sm ba-text-muted"
                        style={{ "margin-top": "0.75rem", "margin-bottom": 0, "max-width": "48rem", "line-height": 1.65 }}
                        text={description()}
                    />
                </header>

                <div class="ba-flex ba-flex-wrap ba-gap-6 ba-items-start">
                    <div class="ba-stack-4 ba-min-w-0" style={{ flex: "1.2 1 24rem" }}>
                        <div class="ba-grid-3">
                            <label class="ba-field">
                                <span class="ba-label">インピーダンス (Ω)</span>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={impedance()}
                                    aria-label="インピーダンス (Ω)"
                                    onInput={(event) => setImpedance(event.currentTarget.value)}
                                    class="ba-input"
                                />
                            </label>
                            <label class="ba-field">
                                <span class="ba-label">公差 (±%)</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="99.9"
                                    step="0.1"
                                    value={impedanceTolerance()}
                                    aria-label="公差 (±%)"
                                    onInput={(event) => setImpedanceTolerance(event.currentTarget.value)}
                                    class="ba-input"
                                />
                            </label>
                            <label class="ba-field">
                                <span class="ba-label">測定周波数 (Hz)</span>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    value={impedanceFrequency()}
                                    aria-label="測定周波数 (Hz)"
                                    onInput={(event) => setImpedanceFrequency(event.currentTarget.value)}
                                    class="ba-input"
                                />
                            </label>
                        </div>

                        <hr class="ba-divider" />

                        <div class="ba-grid-3">
                            <label class="ba-field">
                                <span class="ba-label">
                                    感度 ({sensitivityUnit() === "mw" ? "dB/mW" : "dB/Vrms"})
                                </span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={sensitivity()}
                                    aria-label="感度"
                                    onInput={(event) => setSensitivity(event.currentTarget.value)}
                                    class="ba-input"
                                />
                            </label>
                            <label class="ba-field">
                                <span class="ba-label">感度の単位</span>
                                <select
                                    value={sensitivityUnit()}
                                    aria-label="感度の単位"
                                    onChange={(event) => setSensitivityUnit(event.currentTarget.value)}
                                    class="ba-select"
                                >
                                    <option value="mw">dB/mW</option>
                                    <option value="v">dB/Vrms</option>
                                </select>
                            </label>
                            <label class="ba-field">
                                <span class="ba-label">測定周波数 (Hz)</span>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    value={sensitivityFrequency()}
                                    aria-label="感度測定周波数 (Hz)"
                                    onInput={(event) => setSensitivityFrequency(event.currentTarget.value)}
                                    class="ba-input"
                                />
                            </label>
                        </div>

                        <label class="ba-field">
                            <span class="ba-label">目標ピーク音圧 (dB SPL)</span>
                            <input
                                type="number"
                                min="1"
                                max="140"
                                step="1"
                                value={targetSpl()}
                                aria-label="目標ピーク音圧 (dB SPL)"
                                onInput={(event) => setTargetSpl(event.currentTarget.value)}
                                class="ba-input"
                            />
                            <span class="ba-text-xs ba-text-muted">
                                初期値は音楽の瞬間的なピークを想定した110 dBです。
                            </span>
                        </label>
                    </div>

                    <section
                        class="ba-panel ba-flex-col ba-justify-between ba-gap-6 ba-min-w-0"
                        style={{ flex: "1 1 18rem", padding: "1.25rem" }}
                        aria-live="polite"
                    >
                        <Show
                            when={result()}
                            fallback={
                                <p class="ba-text-sm ba-font-bold ba-text-danger" style={{ margin: 0 }}>
                                    正のインピーダンスと有効な数値を入力してください。
                                </p>
                            }
                        >
                            {(calculation) => (
                                <>
                                    <div class="ba-stack-1">
                                        <p class="ba-text-sm ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                                            鳴らしやすさスコア
                                        </p>
                                        <div class="ba-flex ba-gap-2" style={{ "align-items": "baseline" }}>
                                            <output
                                                class="ba-font-black ba-text-primary"
                                                style={{ "font-size": "3.5rem", "line-height": 1.1, "font-variant-numeric": "tabular-nums" }}
                                            >
                                                {calculation().score.toFixed(0)}
                                            </output>
                                            <span class="ba-text-lg ba-font-bold ba-text-muted">
                                                / 10,000
                                            </span>
                                        </div>
                                        <p class="ba-text-lg ba-font-bold" style={{ margin: 0 }}>
                                            {calculation().difficulty}
                                        </p>
                                    </div>
                                    <dl
                                        style={{
                                            display: "grid",
                                            "grid-template-columns": "repeat(2, minmax(0, 1fr))",
                                            gap: "0.75rem 1rem",
                                            "padding-top": "1rem",
                                            margin: 0,
                                            "border-top": "1px solid var(--ba-border)",
                                        }}
                                    >
                                        <dt class="ba-text-sm ba-text-muted">インピーダンス範囲</dt>
                                        <dd class="ba-text-right ba-font-bold" style={{ margin: 0, "font-variant-numeric": "tabular-nums" }}>
                                            {formatRange(calculation().minOhms, calculation().maxOhms, 2, "Ω")}
                                        </dd>
                                        <dt class="ba-text-sm ba-text-muted">必要電圧</dt>
                                        <dd class="ba-text-right ba-font-bold" style={{ margin: 0, "font-variant-numeric": "tabular-nums" }}>
                                            {formatRange(calculation().minVoltage, calculation().maxVoltage, 3, "Vrms")}
                                        </dd>
                                        <dt class="ba-text-sm ba-text-muted">必要電力</dt>
                                        <dd class="ba-text-right ba-font-bold" style={{ margin: 0, "font-variant-numeric": "tabular-nums" }}>
                                            {formatRange(calculation().minPowerMw, calculation().maxPowerMw, 2, "mW")}
                                        </dd>
                                        <dt class="ba-text-sm ba-text-muted">必要電流</dt>
                                        <dd class="ba-text-right ba-font-bold" style={{ margin: 0, "font-variant-numeric": "tabular-nums" }}>
                                            {formatRange(calculation().minCurrentMa, calculation().maxCurrentMa, 1, "mA")}
                                        </dd>
                                    </dl>
                                    <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                        測定条件: インピーダンス @{calculation().impedanceHz.toLocaleString()} Hz / 感度 @{calculation().sensitivityHz.toLocaleString()} Hz
                                    </p>
                                </>
                            )}
                        </Show>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                            スコアは2 Vrms・100 mA出力に対する負荷率から算出する比較用の目安です。5,000点がいずれかの基準値相当です。実際の音量は再生機器の性能、出力インピーダンス、音源の録音レベルなどでも変わります。公差がある場合、インピーダンスが低い側では必要電流が増えます。高音量での長時間再生は聴覚に影響するおそれがあります。
                        </p>
                    </section>
                </div>
            </section>
            <AdSense />
        </div>
    );
}
