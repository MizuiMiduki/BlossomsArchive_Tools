import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import AdSense from "../components/AdSense";

function formatRange(min: number, max: number, digits: number, unit: string) {
    const minText = min.toFixed(digits);
    const maxText = max.toFixed(digits);
    return minText === maxText
        ? `${minText} ${unit}`
        : `${minText}–${maxText} ${unit}`;
}

export default function HeadphoneDriveability() {
    const [impedance, setImpedance] = createSignal("32");
    const [impedanceTolerance, setImpedanceTolerance] = createSignal("0");
    const [impedanceFrequency, setImpedanceFrequency] = createSignal("1000");
    const [sensitivity, setSensitivity] = createSignal("100");
    const [sensitivityUnit, setSensitivityUnit] = createSignal("mw");
    const [sensitivityFrequency, setSensitivityFrequency] =
        createSignal("1000");
    const [targetSpl, setTargetSpl] = createSignal("110");

    onMount(() => {
        document.title = "イヤホン・ヘッドホンの鳴らしやすさ";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "インピーダンスと音圧感度から、目標音圧に必要な電圧・電流・電力と鳴らしやすさの目安を計算します。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "headphone-driveability-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "イヤホン・ヘッドホンの鳴らしやすさ",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            description:
                "インピーダンスと音圧感度から必要な電圧・電流・電力を計算するツール。",
        });
        document.head.appendChild(script);
    });

    onCleanup(() => {
        document.getElementById("headphone-driveability-jsonld")?.remove();
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
        <div class="flex w-full flex-col gap-6 p-4 lg:p-6">
            <section class="rounded-lg border border-base-300 bg-base-100 p-5 shadow-sm sm:p-8">
                <header class="mb-4 border-b border-base-300 pb-3">
                    <p class="text-sm font-bold uppercase tracking-wide text-primary">
                        Audio utility
                    </p>
                    <h1 class="mt-1 text-2xl font-black text-base-content sm:text-3xl">
                        イヤホン・ヘッドホンの鳴らしやすさ
                    </h1>
                    <p class="mt-3 max-w-3xl text-sm leading-relaxed text-base-content/70">
                        インピーダンスと音圧感度から、目標音圧に必要な出力電圧・電流・電力を見積もります。
                    </p>
                </header>

                <div class="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
                    <div class="flex flex-col gap-5">
                        <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                            <label class="form-control w-full">
                                <span class="label-text mb-2 block font-bold">
                                    インピーダンス (Ω)
                                </span>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={impedance()}
                                    onInput={(event) =>
                                        setImpedance(event.currentTarget.value)
                                    }
                                    class="input input-bordered w-full"
                                />
                            </label>
                            <label class="form-control w-full">
                                <span class="label-text mb-2 block font-bold">
                                    公差 (±%)
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    max="99.9"
                                    step="0.1"
                                    value={impedanceTolerance()}
                                    onInput={(event) =>
                                        setImpedanceTolerance(
                                            event.currentTarget.value,
                                        )
                                    }
                                    class="input input-bordered w-full"
                                />
                            </label>
                            <label class="form-control w-full">
                                <span class="label-text mb-2 block font-bold">
                                    測定周波数 (Hz)
                                </span>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    value={impedanceFrequency()}
                                    onInput={(event) =>
                                        setImpedanceFrequency(
                                            event.currentTarget.value,
                                        )
                                    }
                                    class="input input-bordered w-full"
                                />
                            </label>
                        </div>

                        <hr class="border-base-300" />

                        <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                            <label class="form-control w-full">
                                <span class="label-text mb-2 block font-bold">
                                    感度 (
                                    {sensitivityUnit() === "mw"
                                        ? "dB/mW"
                                        : "dB/Vrms"}
                                    )
                                </span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={sensitivity()}
                                    onInput={(event) =>
                                        setSensitivity(
                                            event.currentTarget.value,
                                        )
                                    }
                                    class="input input-bordered w-full"
                                />
                            </label>
                            <label class="form-control w-full">
                                <span class="label-text mb-2 block font-bold">
                                    感度の単位
                                </span>
                                <select
                                    value={sensitivityUnit()}
                                    onChange={(event) =>
                                        setSensitivityUnit(
                                            event.currentTarget.value,
                                        )
                                    }
                                    class="select select-bordered w-full"
                                >
                                    <option value="mw">dB/mW</option>
                                    <option value="v">dB/Vrms</option>
                                </select>
                            </label>
                            <label class="form-control w-full">
                                <span class="label-text mb-2 block font-bold">
                                    測定周波数 (Hz)
                                </span>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    value={sensitivityFrequency()}
                                    onInput={(event) =>
                                        setSensitivityFrequency(
                                            event.currentTarget.value,
                                        )
                                    }
                                    class="input input-bordered w-full"
                                />
                            </label>
                        </div>

                        <label class="form-control w-full">
                            <span class="label-text mb-2 block font-bold">
                                目標ピーク音圧 (dB SPL)
                            </span>
                            <input
                                type="number"
                                min="1"
                                max="140"
                                step="1"
                                value={targetSpl()}
                                onInput={(event) =>
                                    setTargetSpl(event.currentTarget.value)
                                }
                                class="input input-bordered w-full"
                            />
                            <span class="mt-2 text-xs text-base-content/60">
                                初期値は音楽の瞬間的なピークを想定した110
                                dBです。
                            </span>
                        </label>
                    </div>

                    <section
                        class="flex flex-col justify-between gap-6 rounded-lg border border-base-300 bg-base-200/60 p-5"
                        aria-live="polite"
                    >
                        <Show
                            when={result()}
                            fallback={
                                <p class="text-sm font-semibold text-error">
                                    正のインピーダンスと有効な数値を入力してください。
                                </p>
                            }
                        >
                            {(calculation) => (
                                <>
                                    <div>
                                        <p class="text-sm font-bold text-base-content/70">
                                            鳴らしやすさスコア
                                        </p>
                                        <div class="mt-2 flex items-baseline gap-2">
                                            <output class="text-6xl font-black tabular-nums text-primary">
                                                {calculation().score.toFixed(0)}
                                            </output>
                                            <span class="text-lg font-bold text-base-content/60">
                                                / 10,000
                                            </span>
                                        </div>
                                        <p class="mt-1 text-lg font-bold">
                                            {calculation().difficulty}
                                        </p>
                                    </div>
                                    <dl class="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-base-300 pt-4">
                                        <dt class="text-sm text-base-content/70">
                                            インピーダンス範囲
                                        </dt>
                                        <dd class="text-right font-bold tabular-nums">
                                            {formatRange(
                                                calculation().minOhms,
                                                calculation().maxOhms,
                                                2,
                                                "Ω",
                                            )}
                                        </dd>
                                        <dt class="text-sm text-base-content/70">
                                            必要電圧
                                        </dt>
                                        <dd class="text-right font-bold tabular-nums">
                                            {formatRange(
                                                calculation().minVoltage,
                                                calculation().maxVoltage,
                                                3,
                                                "Vrms",
                                            )}
                                        </dd>
                                        <dt class="text-sm text-base-content/70">
                                            必要電力
                                        </dt>
                                        <dd class="text-right font-bold tabular-nums">
                                            {formatRange(
                                                calculation().minPowerMw,
                                                calculation().maxPowerMw,
                                                2,
                                                "mW",
                                            )}
                                        </dd>
                                        <dt class="text-sm text-base-content/70">
                                            必要電流
                                        </dt>
                                        <dd class="text-right font-bold tabular-nums">
                                            {formatRange(
                                                calculation().minCurrentMa,
                                                calculation().maxCurrentMa,
                                                1,
                                                "mA",
                                            )}
                                        </dd>
                                    </dl>
                                    <p class="text-xs text-base-content/60">
                                        測定条件: インピーダンス @
                                        {calculation().impedanceHz.toLocaleString()}{" "}
                                        Hz / 感度 @
                                        {calculation().sensitivityHz.toLocaleString()}{" "}
                                        Hz
                                    </p>
                                </>
                            )}
                        </Show>
                        <p class="text-xs leading-relaxed text-base-content/60">
                            スコアは2 Vrms・100
                            mA出力に対する負荷率から算出する比較用の目安です。5,000点がいずれかの基準値相当です。実際の音量は再生機器の性能、出力インピーダンス、音源の録音レベルなどでも変わります。公差がある場合、インピーダンスが低い側では必要電流が増えます。高音量での長時間再生は聴覚に影響するおそれがあります。
                        </p>
                    </section>
                </div>
            </section>
            <AdSense />
        </div>
    );
}
