import {
    createSignal,
    createMemo,
    onMount,
    onCleanup,
    For,
    Show,
} from "solid-js";

export default function HyperfocalCalculator() {
    const [sensorType, setSensorType] = createSignal("apsc-sony");
    const [customCoc, setCustomCoc] = createSignal(0.02);
    const [focalLength, setFocalLength] = createSignal(16);
    const [fNumber, setFNumber] = createSignal(2.8);
    const [customSubjectDistance, setCustomSubjectDistance] = createSignal(2.5);

    const sensors = [
        { id: "fullframe", name: "フルサイズ (35mm基準)", coc: 0.03 },
        {
            id: "apsc-sony",
            name: "APS-C (Sony/Nikon/Fuji)",
            coc: 0.02,
        },
        { id: "apsc-canon", name: "APS-C (Canon)", coc: 0.019 },
        { id: "m43", name: "マイクロフォーサーズ", coc: 0.015 },
        { id: "medium-gfx", name: "中判 (Fujifilm GFX など)", coc: 0.038 },
        { id: "custom", name: "カスタム（自分で入力する）", coc: 0.03 },
    ];

    // SEO対策：メタデータの動的挿入
    onMount(() => {
        document.title =
            "過焦点距離（パンフォーカス）計算ツール | 被写界深度シミュレーター";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "カメラのセンサーサイズ、レンズの焦点距離、F値から過焦点距離と被写界深度（DoF）を計算するシミュレーター。パンフォーカス写真の撮影に必要なピント位置を手軽に割り出せます。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "hyperfocal-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "過焦点距離・被写界深度計算ツール",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "簡単操作で被写界深度とパンフォーカス距離を算出・可視化するWebツール。",
        });
        document.head.appendChild(script);
    });

    onCleanup(() => {
        const script = document.getElementById("hyperfocal-jsonld");
        if (script) {
            script.remove();
        }
    });

    const activeCoc = createMemo<number>(() => {
        if (sensorType() === "custom") {
            return customCoc();
        }
        const selected = sensors.find((s) => s.id === sensorType());
        return selected ? selected.coc : 0.03;
    });

    const hyperfocalData = createMemo<{
        distanceMm: number;
        distanceM: number;
        nearLimitM: number;
    }>(() => {
        const f = focalLength();
        const n = fNumber();
        const c = activeCoc();

        if (f <= 0 || n <= 0 || c <= 0) {
            return { distanceMm: 0, distanceM: 0, nearLimitM: 0 };
        }

        const hMm = (f * f) / (n * c) + f;
        const hM = hMm / 1000;
        const nearM = hM / 2;

        return {
            distanceMm: hMm,
            distanceM: hM,
            nearLimitM: nearM,
        };
    });

    const dofData = createMemo(() => {
        const h = hyperfocalData().distanceM as number;
        const s = customSubjectDistance() as number;
        const f = (focalLength() / 1000) as number;

        if (s <= 0 || h <= 0) {
            return {
                nearLimitM: 0,
                farLimitM: "無限遠",
                nearLimitMString: "0.00",
                farLimitMString: "無限遠",
                totalDepthString: "無限大 (パンフォーカス成立)",
                isInfinite: true,
            };
        }

        const hMinusF = h - f;
        const denominatorFar = hMinusF - (s - f);

        const dNear = (s * hMinusF) / (hMinusF + (s - f));
        let dFar: number | string = "無限遠";
        let isInf = false;

        if (denominatorFar <= 0) {
            dFar = "無限遠";
            isInf = true;
        } else {
            dFar = (s * hMinusF) / denominatorFar;
        }

        const nearLimitRounded = parseFloat(dNear.toFixed(2));
        const farLimitRounded =
            typeof dFar === "number" ? parseFloat(dFar.toFixed(2)) : dFar;

        let totalDepthString = "無限大 (パンフォーカス成立)";
        if (!isInf && typeof farLimitRounded === "number") {
            const diff = parseFloat(
                (farLimitRounded - nearLimitRounded).toFixed(2),
            );
            totalDepthString = `${diff.toFixed(2)} m`;
        }

        return {
            nearLimitM: dNear,
            farLimitM: typeof dFar === "number" ? dFar : Infinity,
            nearLimitMString: nearLimitRounded.toFixed(2),
            farLimitMString:
                typeof farLimitRounded === "number"
                    ? farLimitRounded.toFixed(2)
                    : farLimitRounded,
            totalDepthString: totalDepthString,
            isInfinite: isInf,
        };
    });

    const changeFocalLength = (amount: number) => {
        const next = Math.max(4, Math.min(600, focalLength() + amount));
        setFocalLength(next);
    };

    const changeFNumber = (amount: number) => {
        const fSteps = [
            1.0, 1.2, 1.4, 1.8, 2.0, 2.5, 2.8, 3.2, 3.5, 4.0, 4.5, 5.0, 5.6,
            6.3, 7.1, 8.0, 9.0, 10.0, 11.0, 13.0, 14.0, 16.0, 18.0, 20.0, 22.0,
            25.0, 29.0, 32.0,
        ];
        const current = fNumber();

        if (amount > 0) {
            const nextStep = fSteps.find((step) => step > current);
            if (nextStep !== undefined) {
                setFNumber(nextStep);
            } else {
                setFNumber(Math.min(64, parseFloat((current + 1).toFixed(1))));
            }
        } else {
            const prevStep = [...fSteps]
                .reverse()
                .find((step) => step < current);
            if (prevStep !== undefined) {
                setFNumber(prevStep);
            } else {
                setFNumber(
                    Math.max(0.5, parseFloat((current - 0.5).toFixed(1))),
                );
            }
        }
    };

    const changeSubjectDistance = (amount: number) => {
        const next = Math.max(
            0.1,
            parseFloat((customSubjectDistance() + amount).toFixed(1)),
        );
        setCustomSubjectDistance(next);
    };

    const visualScale = createMemo<number>(() => {
        const subjectDist = customSubjectDistance();
        const hDist = hyperfocalData().distanceM;
        return Math.max(subjectDist * 2, hDist, 10);
    });

    return (
        <div class="h-full w-full p-4 flex flex-col gap-4 bg-base-300/40 overflow-hidden">
            <div class="card bg-base-100 shadow-2xl p-6 w-full border border-base-300">
                <div class="mb-6 border-b-2 border-base-300 pb-4">
                    <h2 class="text-2xl font-black text-primary flex items-center gap-2">
                        📐 過焦点距離（パンフォーカス）計算ツール
                    </h2>
                    <p class="text-xs text-base-content font-bold mt-2 leading-relaxed opacity-80">
                        手前の景色から、はるか遠くの背景まで、写真全体にクッキリピントが合っている「パンフォーカス写真」を撮るための最適なピント合わせ位置を計算します。
                    </p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch overflow-hidden">
                    {/* 左側：入力コントロール */}
                    <div class="lg:col-span-5 flex flex-col gap-5 bg-base-200/70 p-5 rounded-2xl border border-base-300 overflow-hidden">
                        {/* 1. センサーサイズ */}
                        <div class="form-control w-full">
                            <label class="label py-1 flex flex-col items-start gap-0.5">
                                <span class="label-text font-black text-sm text-base-content">
                                    📸 1. カメラのセンサーサイズを選ぶ
                                </span>
                                <span class="text-[10px] text-base-content/60 font-semibold leading-normal">
                                    お使いのカメラの種類を選んでください。ピントの合う範囲に影響します。
                                </span>
                            </label>
                            <select
                                value={sensorType()}
                                onChange={(e) =>
                                    setSensorType(e.currentTarget.value)
                                }
                                class="select select-bordered select-sm w-full bg-base-100 text-xs font-bold text-base-content border-base-400 focus:border-primary mt-1 h-10"
                            >
                                <For each={sensors}>
                                    {(s) => (
                                        <option value={s.id}>{s.name}</option>
                                    )}
                                </For>
                            </select>
                        </div>

                        {/* カスタムCoC設定 */}
                        <Show when={sensorType() === "custom"}>
                            <div class="form-control w-full animate-fade-in bg-base-100 p-3 rounded-xl border border-base-300 text-xs overflow-hidden">
                                <label class="label py-1 flex flex-col items-start gap-0.5">
                                    <span class="label-text font-black text-xs text-secondary">
                                        ⚙️ 許容錯乱円の直径 (CoC)
                                    </span>
                                </label>
                                <div class="flex items-center gap-2 mt-1">
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        max="0.1"
                                        value={customCoc()}
                                        onInput={(e) =>
                                            setCustomCoc(
                                                Number(e.currentTarget.value),
                                            )
                                        }
                                        class="input input-bordered input-sm w-full bg-base-100 font-mono text-xs font-bold text-base-content border-base-400 focus:border-secondary"
                                    />
                                    <span class="text-xs font-black text-base-content">
                                        mm
                                    </span>
                                </div>
                            </div>
                        </Show>

                        {/* 2. 焦点距離 */}
                        <div class="form-control w-full">
                            <div class="flex justify-between items-center label py-1 gap-2">
                                <span class="label-text font-black text-sm text-base-content flex-1 break-words">
                                    🔎 2. レンズの焦点距離 (mm)
                                </span>
                                <span class="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {focalLength()} mm
                                </span>
                            </div>
                            <span class="text-[10px] text-base-content/60 font-semibold block mb-1 leading-normal break-words">
                                数値が小さい（広角）ほど広くピントが合い、大きい（望遠）ほどボケやすくなります。
                            </span>

                            <div class="flex items-center gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={() => changeFocalLength(-1)}
                                    class="btn btn-outline btn-primary btn-sm w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg select-none"
                                >
                                    −
                                </button>
                                <input
                                    type="range"
                                    min="8"
                                    max="200"
                                    step="1"
                                    value={focalLength()}
                                    onInput={(e) =>
                                        setFocalLength(
                                            Number(e.currentTarget.value),
                                        )
                                    }
                                    class="range range-primary range-xs flex-1 mx-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => changeFocalLength(1)}
                                    class="btn btn-outline btn-primary btn-sm w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg select-none"
                                >
                                    ＋
                                </button>
                            </div>

                            <div class="flex items-center gap-2 mt-2.5 flex-wrap">
                                <span class="text-xs font-bold text-base-content/70 whitespace-nowrap">
                                    キーボード入力:
                                </span>
                                <div class="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="4"
                                        max="600"
                                        value={focalLength()}
                                        onInput={(e) =>
                                            setFocalLength(
                                                Number(e.currentTarget.value),
                                            )
                                        }
                                        class="input input-bordered input-sm w-24 bg-base-100 font-bold text-xs text-base-content border-base-400 focus:border-primary text-center"
                                    />
                                    <span class="text-xs font-black text-base-content">
                                        mm
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. 絞り値 (F値) */}
                        <div class="form-control w-full">
                            <div class="flex justify-between items-center label py-1 gap-2">
                                <span class="label-text font-black text-sm text-base-content flex-1 break-words">
                                    🔆 3. 絞り値 (F値)
                                </span>
                                <span class="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    f/{fNumber()}
                                </span>
                            </div>
                            <span class="text-[10px] text-base-content/60 font-semibold block mb-1 leading-normal break-words">
                                F値を大きくするほど、手前から奥まで全体にピントが合います。
                            </span>

                            <div class="flex items-center gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={() => changeFNumber(-1)}
                                    class="btn btn-outline btn-primary btn-sm w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg select-none"
                                >
                                    −
                                </button>
                                <input
                                    type="range"
                                    min="1"
                                    max="32"
                                    step="0.1"
                                    value={fNumber()}
                                    onInput={(e) =>
                                        setFNumber(
                                            Number(e.currentTarget.value),
                                        )
                                    }
                                    class="range range-primary range-xs flex-1 mx-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => changeFNumber(1)}
                                    class="btn btn-outline btn-primary btn-sm w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg select-none"
                                >
                                    ＋
                                </button>
                            </div>

                            <div class="grid grid-cols-5 gap-1 my-2.5">
                                <For
                                    each={[1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22]}
                                >
                                    {(fVal) => (
                                        <button
                                            type="button"
                                            onClick={() => setFNumber(fVal)}
                                            class={`btn btn-xs rounded-md font-bold h-7 ${fNumber() === fVal ? "btn-primary text-white" : "btn-outline border-base-400 text-base-content hover:bg-base-300"}`}
                                        >
                                            {fVal}
                                        </button>
                                    )}
                                </For>
                            </div>

                            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span class="text-xs font-bold text-base-content/70 whitespace-nowrap">
                                    キーボード入力:
                                </span>
                                <div class="flex items-center gap-1.5 whitespace-nowrap">
                                    <span class="text-xs font-bold text-base-content/60">
                                        f/
                                    </span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.5"
                                        max="64"
                                        value={fNumber()}
                                        onInput={(e) =>
                                            setFNumber(
                                                Number(e.currentTarget.value),
                                            )
                                        }
                                        class="input input-bordered input-sm w-24 bg-base-100 font-bold text-xs text-base-content border-base-400 focus:border-primary text-center"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 4. ピント位置 */}
                        <div class="form-control w-full border-t border-base-300 pt-4 mt-2">
                            <div class="flex justify-between items-center label py-1 gap-2">
                                <span class="label-text font-black text-sm text-base-content flex-1 break-words">
                                    🎯 4. 実際のピント合わせ位置
                                </span>
                                <span class="text-xs font-black text-secondary bg-secondary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {customSubjectDistance()} m
                                </span>
                            </div>
                            <span class="text-[10px] text-base-content/60 font-semibold block mb-1 leading-normal break-words">
                                お勧めのピント位置ではなく、もしこの距離にピントを合わせた場合のシミュレーションです。
                            </span>

                            <div class="flex items-center gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={() => changeSubjectDistance(-0.1)}
                                    class="btn btn-outline btn-secondary btn-sm w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg select-none"
                                >
                                    −
                                </button>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="50"
                                    step="0.5"
                                    value={customSubjectDistance()}
                                    onInput={(e) =>
                                        setCustomSubjectDistance(
                                            Number(e.currentTarget.value),
                                        )
                                    }
                                    class="range range-secondary range-xs flex-1 mx-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => changeSubjectDistance(0.1)}
                                    class="btn btn-outline btn-secondary btn-sm w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg select-none"
                                >
                                    ＋
                                </button>
                            </div>

                            <div class="flex items-center gap-2 mt-2.5 flex-wrap">
                                <span class="text-xs font-bold text-base-content/70 whitespace-nowrap">
                                    キーボード入力:
                                </span>
                                <div class="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="1000"
                                        value={customSubjectDistance()}
                                        onInput={(e) =>
                                            setCustomSubjectDistance(
                                                Number(e.currentTarget.value),
                                            )
                                        }
                                        class="input input-bordered input-sm w-24 bg-base-100 font-bold text-xs text-base-content border-base-400 focus:border-secondary text-center"
                                    />
                                    <span class="text-xs font-black text-base-content font-mono">
                                        m
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 右側：計算結果 ＆ 動的インジケーター */}
                    <div class="lg:col-span-7 flex flex-col gap-5 justify-between overflow-hidden">
                        {/* 動的ビジュアルイメージ図 */}
                        <div class="bg-base-200 p-5 rounded-2xl border border-base-300 flex flex-col gap-3 shadow-xs overflow-hidden">
                            <h3 class="text-xs font-black text-base-content/80 tracking-wider uppercase border-b border-base-300 pb-2 flex justify-between items-center gap-2 flex-wrap leading-normal">
                                <span class="break-words flex-1 min-w-[120px]">
                                    🗺️
                                    被写界深度（ピントが合う範囲）のイメージ図
                                </span>
                                <span class="badge badge-neutral font-mono font-bold text-[10px] whitespace-nowrap">
                                    許容ボケ幅: {activeCoc().toFixed(3)} mm
                                </span>
                            </h3>

                            <div class="bg-base-100 p-3 rounded-lg border border-base-300/60 text-[11px] leading-normal space-y-1">
                                <p class="text-base-content font-bold">
                                    💡{" "}
                                    <strong class="text-primary">
                                        過焦点距離（お勧めピント位置）
                                    </strong>{" "}
                                    にピントを合わせると、手前から奥（無限遠）まで全てクッキリ写るようになります。
                                </p>
                                <p class="text-base-content opacity-80">
                                    💡{" "}
                                    <strong class="text-secondary">
                                        実際のピント合わせ位置
                                    </strong>{" "}
                                    は、撮影者が「直接狙った特定の被写体（人物）」の位置です。その前後どこまでピントが合うかをシミュレーションしています。
                                </p>
                            </div>

                            <div class="relative w-full bg-base-100 h-48 rounded-xl border border-base-300 overflow-hidden flex flex-col justify-between p-3 select-none">
                                <div class="absolute inset-0 flex justify-between pointer-events-none opacity-10 px-12">
                                    <div class="border-l border-base-content h-full"></div>
                                    <div class="border-l border-base-content h-full"></div>
                                    <div class="border-l border-base-content h-full"></div>
                                    <div class="border-l border-base-content h-full"></div>
                                </div>

                                {/* 範囲ラベル */}
                                <div class="absolute top-2 left-0 right-0 text-center text-[10.5px] font-bold text-emerald-700">
                                    ピントが合う範囲：
                                    {dofData().totalDepthString}
                                </div>

                                {/* 1. カメラ（左端） */}
                                <div class="absolute left-2 top-20 flex flex-col items-center">
                                    <span class="text-2xl">📷</span>
                                </div>

                                {/* 2. ピントの合う厚み（帯） */}
                                <div
                                    class="absolute top-24 h-6 bg-emerald-500/30 border-y-2 border-emerald-400 transition-all duration-300 rounded-sm"
                                    style={{
                                        left: `${Math.max(10, Math.min(95, ((dofData().nearLimitM as number) / visualScale()) * 75 + 10))}%`,
                                        width: dofData().isInfinite
                                            ? `${100 - Math.max(10, Math.min(95, ((dofData().nearLimitM as number) / visualScale()) * 75 + 10))}%`
                                            : `${Math.max(2, Math.min(75, (((dofData().farLimitM as number) - (dofData().nearLimitM as number)) / visualScale()) * 75))}%`,
                                        "background-image": dofData().isInfinite
                                            ? "linear-gradient(to right, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0))"
                                            : "none",
                                        "border-right-style": dofData()
                                            .isInfinite
                                            ? "none"
                                            : "solid",
                                        "border-right-color":
                                            "rgb(52, 211, 153)",
                                    }}
                                >
                                    {/* 手前の限界距離ラベル */}
                                    <div class="absolute -top-5 -left-1 text-[9px] font-black text-emerald-700 whitespace-nowrap">
                                        ◀ {dofData().nearLimitMString}m
                                    </div>
                                    {/* 奥の限界距離ラベル */}
                                    <div class="absolute -top-5 right-0 text-[9px] font-black text-emerald-700 whitespace-nowrap">
                                        {dofData().isInfinite
                                            ? "無限遠 ▶"
                                            : `${dofData().farLimitMString}m ▶`}
                                    </div>
                                </div>

                                {/* 3. 被写体 */}
                                <div
                                    class="absolute top-16 flex flex-col items-center transition-all duration-300"
                                    style={{
                                        left: `${Math.max(12, Math.min(90, (customSubjectDistance() / visualScale()) * 75 + 10))}%`,
                                        transform: "translateX(-50%)",
                                    }}
                                >
                                    <span class="text-xl">🚶</span>
                                    <span class="text-[9.5px] font-black text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-sm whitespace-nowrap overflow-hidden truncate max-w-[110px]">
                                        被写体 ({customSubjectDistance()}m)
                                    </span>
                                </div>

                                {/* 背景限界 */}
                                <div class="absolute right-2 top-20 flex flex-col items-center">
                                    <span class="text-xl">🏔️</span>
                                </div>

                                {/* 下部スケール */}
                                <div class="w-full flex justify-between text-[9px] font-mono opacity-50 px-8 mt-auto pt-3">
                                    <span>0m</span>
                                    <span>
                                        {(visualScale() * 0.5).toFixed(1)}m
                                    </span>
                                    <span>{visualScale().toFixed(1)}m+</span>
                                </div>
                            </div>
                        </div>

                        {/* 計算結果カードセクション */}
                        <div class="bg-base-200 p-6 rounded-2xl border-2 border-base-300 flex flex-col gap-5 shadow-inner overflow-hidden">
                            <h3 class="text-xs font-black text-base-content/80 tracking-wider uppercase border-b-2 border-base-300 pb-2">
                                📊 計算結果
                            </h3>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 過焦点距離 */}
                                <div class="bg-primary/10 border-2 border-primary/45 p-5 rounded-xl flex flex-col gap-1.5 shadow-xs overflow-hidden">
                                    <span class="text-[10px] font-black text-primary uppercase tracking-wider leading-normal break-words">
                                        一番お勧めのピント位置（過焦点距離）
                                    </span>
                                    <span class="text-3xl font-black text-primary font-mono leading-none my-1 break-words overflow-hidden text-ellipsis">
                                        {hyperfocalData().distanceM.toFixed(2)}
                                        <span class="text-sm"> m</span>
                                    </span>
                                    <span class="text-[10px] text-base-content font-bold leading-relaxed opacity-80 mt-1 break-words">
                                        カメラをマニュアルフォーカス（MF）にして、
                                        <strong>
                                            この距離（約{" "}
                                            {hyperfocalData().distanceM.toFixed(
                                                1,
                                            )}
                                            m 先）の地面や木
                                        </strong>
                                        にピントを合わせます。
                                    </span>
                                </div>

                                {/* パンフォーカス範囲 */}
                                <div class="bg-emerald-50 border-2 border-emerald-300 p-5 rounded-xl flex flex-col gap-1.5 shadow-xs overflow-hidden">
                                    <span class="text-[10.5px] font-black text-emerald-800 uppercase tracking-wider leading-normal break-words">
                                        その時にピントが合う範囲（パンフォーカス）
                                    </span>
                                    <span class="text-3xl font-black text-emerald-700 font-mono leading-none my-1 break-words overflow-hidden text-ellipsis">
                                        {hyperfocalData().nearLimitM.toFixed(2)}
                                        m 〜 無限遠
                                    </span>
                                    <span class="text-[10px] text-emerald-900/80 font-bold leading-relaxed mt-1 break-words">
                                        上記のお勧め距離に合わせるだけで、
                                        <strong>
                                            手前約{" "}
                                            {hyperfocalData().nearLimitM.toFixed(
                                                1,
                                            )}
                                            m
                                            から、一番奥の山や星空の背景まですべて
                                        </strong>
                                        が鮮明に写ります！
                                    </span>
                                </div>
                            </div>

                            {/* 任意指定位置のピント範囲カード */}
                            <div class="bg-secondary/10 border-2 border-secondary/45 p-4 rounded-xl flex flex-col gap-2.5 mt-1 shadow-xs overflow-hidden">
                                <div class="flex items-center justify-between border-b border-secondary/20 pb-2 gap-2 flex-wrap leading-normal">
                                    <span class="text-[10px] font-black text-secondary uppercase tracking-wider break-words flex-1 min-w-[150px]">
                                        仮に {customSubjectDistance()}m
                                        の被写体にピントを合わせた場合
                                    </span>
                                    <span class="badge badge-secondary badge-xs font-black text-[9px] px-2 whitespace-nowrap">
                                        被写界深度（ピントが合う奥行き）
                                    </span>
                                </div>
                                <div class="flex flex-col gap-2">
                                    <div class="flex items-baseline justify-between gap-2 leading-tight">
                                        <span class="text-[11px] font-black text-base-content opacity-80 flex-1 break-words min-w-[100px]">
                                            手前のピント限界（ここから）:
                                        </span>
                                        <span class="text-sm font-black font-mono text-base-content whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">
                                            {dofData().nearLimitMString} m
                                        </span>
                                    </div>
                                    <div class="flex items-baseline justify-between border-t border-base-300/60 pt-1.5 gap-2 leading-tight">
                                        <span class="text-[11px] font-black text-base-content opacity-80 flex-1 break-words min-w-[100px]">
                                            奥のピント限界（ここまで）:
                                        </span>
                                        <span class="text-sm font-black font-mono text-base-content whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                                            {dofData().farLimitMString}
                                            {typeof dofData()
                                                .farLimitMString === "number" ||
                                            !isNaN(
                                                Number(
                                                    dofData().farLimitMString,
                                                ),
                                            )
                                                ? "m"
                                                : ""}
                                        </span>
                                    </div>
                                    <div class="flex items-baseline justify-between border-t border-base-300/60 pt-1.5 gap-2 leading-tight">
                                        <span class="text-[11px] font-black text-base-content opacity-80 flex-1 break-words min-w-[120px]">
                                            ピントが綺麗に合う全体の厚み（幅）:
                                        </span>
                                        <span class="text-sm font-black text-secondary font-mono bg-secondary/10 px-2 py-0.5 rounded-md break-words max-w-full leading-normal">
                                            {dofData().totalDepthString}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mt-8 pt-6 border-t border-base-300">
                    <div class="card bg-base-200/50 p-6 rounded-2xl border border-base-300">
                        <h3 class="text-sm font-bold text-base-content border-b border-base-300 pb-2 mb-4">
                            📘 光学理論に基づく計算式
                        </h3>
                        <div class="space-y-6 text-xs text-base-content/85 leading-relaxed">
                            <p>
                                幾何光学において、過焦点距離{" "}
                                <span class="font-mono font-bold bg-base-100 px-1.5 py-0.5 rounded border border-base-300">
                                    H
                                </span>{" "}
                                は、許容錯乱円の直径を{" "}
                                <span class="font-mono font-bold">c</span>
                                、レンズの物理焦点距離を{" "}
                                <span class="font-mono font-bold">f</span>
                                、絞り値（F値）を{" "}
                                <span class="font-mono font-bold">N</span>{" "}
                                としたとき、以下の数式で定義されます。
                            </p>

                            <div class="bg-base-100 p-4 rounded-xl flex items-center justify-center gap-3 font-mono text-base-content border border-base-300 shadow-sm">
                                <span class="text-sm font-bold">H = </span>
                                <div class="flex flex-col items-center">
                                    <span class="border-b border-base-content/60 px-2 pb-0.5">
                                        f &sup2;
                                    </span>
                                    <span class="px-2 pt-0.5">N &times; c</span>
                                </div>
                                <span class="text-sm font-bold">+ f</span>
                            </div>

                            <p>
                                ピント位置をこの距離{" "}
                                <span class="font-mono font-bold bg-base-100 px-1.5 py-0.5 rounded border border-base-300">
                                    H
                                </span>{" "}
                                に固定した時、合焦深度の手前側限界（近点限界{" "}
                                <span class="font-mono font-bold">D_near</span>
                                ）は次の値をとります。
                            </p>

                            <div class="bg-base-100 p-4 rounded-xl flex items-center justify-center gap-3 font-mono text-base-content border border-base-300 shadow-sm">
                                <span class="text-sm font-bold">D_near = </span>
                                <div class="flex flex-col items-center">
                                    <span class="border-b border-base-content/60 px-2 pb-0.5">
                                        H
                                    </span>
                                    <span class="px-2 pt-0.5">2</span>
                                </div>
                            </div>

                            <p>
                                この時、前方側は過焦点距離の半分の地点から、後方側は理論上「無限遠」までが合焦域（パンフォーカス）に収まります。
                            </p>
                        </div>
                    </div>

                    <div class="card bg-base-200/50 p-6 rounded-2xl border border-base-300">
                        <h3 class="text-sm font-bold text-base-content border-b border-base-300 pb-2 mb-4">
                            ❓ よくある光学の質問 (FAQ)
                        </h3>
                        <div class="space-y-3 text-xs leading-relaxed text-base-content/80">
                            <div>
                                <h4 class="font-bold text-base-content mb-1">
                                    Q. 許容錯乱円（CoC）とは何ですか？
                                </h4>
                                <p>
                                    センサー上の1点に集まるべき光が、わずかにピンボケすることで作る「ボケの円」のことです。人間の目で「ピントが合っている」と認識できる限界の大きさを指します。
                                </p>
                            </div>
                            <div class="border-t border-base-300 pt-2">
                                <h4 class="font-bold text-base-content mb-1">
                                    Q.
                                    小絞りボケ（回折現象）は計算に含まれますか？
                                </h4>
                                <p>
                                    本ツールは幾何光学をベースに算出しているため、F値を絞り込みすぎた時の光の回折（画質低下）は考慮していません。実写の際はF8〜F11あたりが最もバランスがよくお勧めです。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
