import {
    createSignal,
    createMemo,
    onSettled,
    For,
    Show,
} from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";

export default function HyperfocalCalculator() {
    const { title, description } = usePageI18n("/hyperfocal", {
        defaultTitle: "過焦点距離（パンフォーカス）計算ツール",
        defaultDescription:
            "手前の景色から、はるか遠くの背景まで、写真全体にクッキリピントが合っている「パンフォーカス写真」を撮るための最適なピント合わせ位置を計算します。",
    });
    const [sensorType, setSensorType] = createSignal("apsc-sony");
    const [customCoc, setCustomCoc] = createSignal(0.02);
    const [focalLength, setFocalLength] = createSignal(16);
    const [fNumber, setFNumber] = createSignal(2.8);
    const [customSubjectDistance, setCustomSubjectDistance] = createSignal(2.5);

    let containerRef: HTMLDivElement | undefined;

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

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
    });

    const activeCoc = createMemo<number>(() => {
        if (sensorType() === "custom") {
            const c = customCoc();
            return Number.isFinite(c) && c > 0 ? c : 0.02;
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

        if (
            !Number.isFinite(f) ||
            !Number.isFinite(n) ||
            !Number.isFinite(c) ||
            f <= 0 ||
            n <= 0 ||
            c <= 0
        ) {
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

        if (!Number.isFinite(s) || !Number.isFinite(h) || s <= 0 || h <= 0) {
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
        <div ref={containerRef} class="ba-page ba-page--wide">
            <div class="ba-card ba-stack-6 ba-w-full">
                <div style={{ "border-bottom": "2px solid var(--ba-border)", "padding-bottom": "1rem" }}>
                    <h1 class="ba-title ba-flex ba-items-center ba-gap-2">
                        <BudouX text={title()} />
                    </h1>
                    <BudouX
                        as="p"
                        class="ba-text-xs ba-text-muted ba-font-bold"
                        style={{ "margin-top": "0.5rem", "margin-bottom": 0, "line-height": 1.65 }}
                        text={description()}
                    />
                </div>

                <div class="ba-grid-2" style={{ gap: "1.5rem", "align-items": "stretch" }}>
                    {/* 左側：入力コントロール */}
                    <div
                        class="ba-panel ba-stack-4 ba-min-w-0"
                        style={{ padding: "1.25rem", "border-radius": "var(--ba-radius-lg)" }}
                    >
                        {/* 1. センサーサイズ */}
                        <div class="ba-field">
                            <label class="ba-label" style={{ "flex-direction": "column", "align-items": "flex-start", gap: "0.15rem" }}>
                                <span class="ba-font-black ba-text-sm">
                                    1. カメラのセンサーサイズを選ぶ
                                </span>
                                <BudouX
                                    as="span"
                                    class="ba-text-muted"
                                    style={{ "font-size": "0.6875rem", "font-weight": 600, "line-height": 1.4 }}
                                    text="お使いのカメラの種類を選んでください。ピントの合う範囲に影響します。"
                                />
                            </label>
                            <select
                                value={sensorType()}
                                onChange={(e) =>
                                    setSensorType(e.currentTarget.value)
                                }
                                aria-label="カメラのセンサーサイズ"
                                class="ba-select ba-select--sm ba-font-bold"
                                style={{ height: "2.5rem" }}
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
                            <div
                                class="ba-field"
                                style={{
                                    background: "var(--ba-surface)",
                                    padding: "0.75rem",
                                    "border-radius": "var(--ba-radius)",
                                    border: "1px solid var(--ba-border)",
                                }}
                            >
                                <label class="ba-label">
                                    <span class="ba-font-black ba-text-xs ba-text-primary">
                                        許容錯乱円の直径 (CoC)
                                    </span>
                                </label>
                                <div class="ba-flex ba-items-center ba-gap-2">
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        max="0.1"
                                        value={customCoc()}
                                        aria-label="許容錯乱円の直径 (CoC)"
                                        onInput={(e) => {
                                            const v = Number(e.currentTarget.value);
                                            if (Number.isFinite(v) && v > 0) {
                                                setCustomCoc(Math.min(1, v));
                                            }
                                        }}
                                        class="ba-input ba-input--sm ba-mono ba-font-bold"
                                    />
                                    <span class="ba-text-xs ba-font-black">
                                        mm
                                    </span>
                                </div>
                            </div>
                        </Show>

                        {/* 2. 焦点距離 */}
                        <div class="ba-field">
                            <div class="ba-flex ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-black ba-text-sm ba-flex-1">
                                    2. レンズの焦点距離 (mm)
                                </span>
                                <span
                                    class="ba-badge ba-font-black"
                                    style={{
                                        background: "var(--ba-primary-soft)",
                                        color: "var(--ba-primary)",
                                    }}
                                >
                                    {focalLength()} mm
                                </span>
                            </div>
                            <span
                                class="ba-text-muted"
                                style={{ "font-size": "0.6875rem", "font-weight": 600, "line-height": 1.4 }}
                            >
                                数値が小さい（広角）ほど広くピントが合い、大きい（望遠）ほどボケやすくなります。
                            </span>

                            <div class="ba-flex ba-items-center ba-gap-2" style={{ "margin-top": "0.25rem" }}>
                                <button
                                    type="button"
                                    onClick={() => changeFocalLength(-1)}
                                    aria-label="焦点距離を1mm減らす"
                                    class="ba-btn ba-btn--outline ba-btn--square ba-text-primary ba-font-bold ba-text-lg"
                                    style={{ width: "2.5rem", height: "2.5rem" }}
                                >
                                    −
                                </button>
                                <input
                                    type="range"
                                    min="8"
                                    max="200"
                                    step="1"
                                    value={focalLength()}
                                    aria-label="焦点距離スライダー"
                                    onInput={(e) => {
                                        const v = Number(e.currentTarget.value);
                                        if (Number.isFinite(v) && v > 0) {
                                            setFocalLength(Math.min(600, v));
                                        }
                                    }}
                                    class="ba-range ba-flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => changeFocalLength(1)}
                                    aria-label="焦点距離を1mm増やす"
                                    class="ba-btn ba-btn--outline ba-btn--square ba-text-primary ba-font-bold ba-text-lg"
                                    style={{ width: "2.5rem", height: "2.5rem" }}
                                >
                                    ＋
                                </button>
                            </div>

                            <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap" style={{ "margin-top": "0.35rem" }}>
                                <span class="ba-text-xs ba-font-bold ba-text-muted">
                                    キーボード入力:
                                </span>
                                <div class="ba-flex ba-items-center ba-gap-2">
                                    <input
                                        type="number"
                                        min="4"
                                        max="600"
                                        value={focalLength()}
                                        aria-label="レンズの焦点距離 (mm)"
                                        onInput={(e) => {
                                            const v = Number(e.currentTarget.value);
                                            if (Number.isFinite(v) && v > 0) {
                                                setFocalLength(Math.min(600, v));
                                            }
                                        }}
                                        class="ba-input ba-input--sm ba-font-bold ba-text-center"
                                        style={{ width: "6rem" }}
                                    />
                                    <span class="ba-text-xs ba-font-black">
                                        mm
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. 絞り値 (F値) */}
                        <div class="ba-field">
                            <div class="ba-flex ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-black ba-text-sm ba-flex-1">
                                    3. 絞り値 (F値)
                                </span>
                                <span
                                    class="ba-badge ba-font-black"
                                    style={{
                                        background: "var(--ba-primary-soft)",
                                        color: "var(--ba-primary)",
                                    }}
                                >
                                    f/{fNumber()}
                                </span>
                            </div>
                            <span
                                class="ba-text-muted"
                                style={{ "font-size": "0.6875rem", "font-weight": 600, "line-height": 1.4 }}
                            >
                                F値を大きくするほど、手前から奥まで全体にピントが合います。
                            </span>

                            <div class="ba-flex ba-items-center ba-gap-2" style={{ "margin-top": "0.25rem" }}>
                                <button
                                    type="button"
                                    onClick={() => changeFNumber(-1)}
                                    aria-label="絞り値を1段階小さくする"
                                    class="ba-btn ba-btn--outline ba-btn--square ba-text-primary ba-font-bold ba-text-lg"
                                    style={{ width: "2.5rem", height: "2.5rem" }}
                                >
                                    −
                                </button>
                                <input
                                    type="range"
                                    min="1"
                                    max="32"
                                    step="0.1"
                                    value={fNumber()}
                                    aria-label="絞り値スライダー"
                                    onInput={(e) => {
                                        const v = Number(e.currentTarget.value);
                                        if (Number.isFinite(v) && v > 0) {
                                            setFNumber(Math.min(64, v));
                                        }
                                    }}
                                    class="ba-range ba-flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => changeFNumber(1)}
                                    aria-label="絞り値を1段階大きくする"
                                    class="ba-btn ba-btn--outline ba-btn--square ba-text-primary ba-font-bold ba-text-lg"
                                    style={{ width: "2.5rem", height: "2.5rem" }}
                                >
                                    ＋
                                </button>
                            </div>

                            <div
                                class="ba-grid"
                                style={{
                                    "grid-template-columns": "repeat(5, minmax(0, 1fr))",
                                    gap: "0.25rem",
                                    "margin-block": "0.4rem",
                                }}
                            >
                                <For
                                    each={[1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22]}
                                >
                                    {(fVal) => (
                                        <button
                                            type="button"
                                            onClick={() => setFNumber(fVal)}
                                            class={`ba-btn ba-btn--xs ${fNumber() === fVal ? "ba-btn--primary" : "ba-btn--outline"}`}
                                            style={{ "min-width": 0, padding: "0.25rem" }}
                                        >
                                            {fVal}
                                        </button>
                                    )}
                                </For>
                            </div>

                            <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap" style={{ "margin-top": "0.25rem" }}>
                                <span class="ba-text-xs ba-font-bold ba-text-muted">
                                    キーボード入力:
                                </span>
                                <div class="ba-flex ba-items-center ba-gap-1">
                                    <span class="ba-text-xs ba-font-bold ba-text-muted">
                                        f/
                                    </span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.5"
                                        max="64"
                                        value={fNumber()}
                                        aria-label="絞り値 (F値)"
                                        onInput={(e) => {
                                            const v = Number(e.currentTarget.value);
                                            if (Number.isFinite(v) && v > 0) {
                                                setFNumber(Math.min(64, v));
                                            }
                                        }}
                                        class="ba-input ba-input--sm ba-font-bold ba-text-center"
                                        style={{ width: "6rem" }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 4. ピント位置 */}
                        <div
                            class="ba-field"
                            style={{
                                "border-top": "1px solid var(--ba-border)",
                                "padding-top": "1rem",
                                "margin-top": "0.25rem",
                            }}
                        >
                            <div class="ba-flex ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-black ba-text-sm ba-flex-1">
                                    4. 実際のピント合わせ位置
                                </span>
                                <span
                                    class="ba-badge ba-font-black"
                                    style={{
                                        background: "var(--ba-primary-soft)",
                                        color: "var(--ba-primary-soft-fg)",
                                    }}
                                >
                                    {customSubjectDistance()} m
                                </span>
                            </div>
                            <span
                                class="ba-text-muted"
                                style={{ "font-size": "0.6875rem", "font-weight": 600, "line-height": 1.4 }}
                            >
                                お勧めのピント位置ではなく、もしこの距離にピントを合わせた場合のシミュレーションです。
                            </span>

                            <div class="ba-flex ba-items-center ba-gap-2" style={{ "margin-top": "0.25rem" }}>
                                <button
                                    type="button"
                                    onClick={() => changeSubjectDistance(-0.1)}
                                    aria-label="ピント合わせ位置を近づける"
                                    class="ba-btn ba-btn--outline ba-btn--square ba-text-primary ba-font-bold ba-text-lg"
                                    style={{ width: "2.5rem", height: "2.5rem" }}
                                >
                                    −
                                </button>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="50"
                                    step="0.5"
                                    value={customSubjectDistance()}
                                    aria-label="ピント合わせ位置スライダー"
                                    onInput={(e) => {
                                        const v = Number(e.currentTarget.value);
                                        if (Number.isFinite(v) && v > 0) {
                                            setCustomSubjectDistance(Math.min(1000, v));
                                        }
                                    }}
                                    class="ba-range ba-flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => changeSubjectDistance(0.1)}
                                    aria-label="ピント合わせ位置を遠ざける"
                                    class="ba-btn ba-btn--outline ba-btn--square ba-text-primary ba-font-bold ba-text-lg"
                                    style={{ width: "2.5rem", height: "2.5rem" }}
                                >
                                    ＋
                                </button>
                            </div>

                            <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap" style={{ "margin-top": "0.35rem" }}>
                                <span class="ba-text-xs ba-font-bold ba-text-muted">
                                    キーボード入力:
                                </span>
                                <div class="ba-flex ba-items-center ba-gap-2">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="1000"
                                        value={customSubjectDistance()}
                                        aria-label="実際のピント合わせ位置 (m)"
                                        onInput={(e) => {
                                            const v = Number(e.currentTarget.value);
                                            if (Number.isFinite(v) && v > 0) {
                                                setCustomSubjectDistance(Math.min(1000, v));
                                            }
                                        }}
                                        class="ba-input ba-input--sm ba-font-bold ba-text-center"
                                        style={{ width: "6rem" }}
                                    />
                                    <span class="ba-text-xs ba-font-black ba-mono">
                                        m
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 右側：計算結果 ＆ 動的インジケーター */}
                    <div class="ba-stack-4 ba-min-w-0">
                        {/* 動的ビジュアルイメージ図 */}
                        <div
                            class="ba-panel ba-stack-3"
                            style={{ padding: "1.25rem", "border-radius": "var(--ba-radius-lg)", overflow: "hidden" }}
                        >
                            <h2
                                class="ba-section-title ba-flex ba-justify-between ba-items-center ba-gap-2 ba-flex-wrap"
                                style={{
                                    "font-size": "0.8125rem",
                                    "border-bottom": "1px solid var(--ba-border)",
                                    "padding-bottom": "0.5rem",
                                }}
                            >
                                <span class="ba-flex-1" style={{ "min-width": "120px" }}>
                                    被写界深度（ピントが合う範囲）のイメージ図
                                </span>
                                <span class="ba-badge ba-badge--neutral ba-mono">
                                    許容ボケ幅: {activeCoc().toFixed(3)} mm
                                </span>
                            </h2>

                            <div
                                class="ba-stack-1"
                                style={{
                                    background: "var(--ba-surface)",
                                    padding: "0.75rem",
                                    "border-radius": "var(--ba-radius-sm)",
                                    border: "1px solid var(--ba-border)",
                                    "font-size": "0.6875rem",
                                    "line-height": 1.5,
                                }}
                            >
                                <p class="ba-font-bold" style={{ margin: 0, "word-break": "keep-all", "overflow-wrap": "anywhere" }}>
                                    <strong class="ba-text-primary">
                                        過焦点距離（お勧めピント位置）
                                    </strong>{" "}
                                    <BudouX text="にピントを合わせると、手前から奥（無限遠）まで全てクッキリ写るようになります。" />
                                </p>
                                <p class="ba-text-muted" style={{ margin: 0, "word-break": "keep-all", "overflow-wrap": "anywhere" }}>
                                    <strong class="ba-text-primary">
                                        実際のピント合わせ位置
                                    </strong>{" "}
                                    <BudouX text="は、撮影者が「直接狙った特定の被写体（人物）」の位置です。その前後どこまでピントが合うかをシミュレーションしています。" />
                                </p>
                            </div>

                            <div
                                class="ba-flex-col ba-justify-between ba-w-full"
                                style={{
                                    position: "relative",
                                    background: "var(--ba-surface)",
                                    height: "12rem",
                                    "border-radius": "var(--ba-radius)",
                                    border: "1px solid var(--ba-border)",
                                    overflow: "hidden",
                                    padding: "0.75rem",
                                    "user-select": "none",
                                }}
                            >
                                <div
                                    class="ba-flex ba-justify-between"
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        "pointer-events": "none",
                                        opacity: 0.1,
                                        "padding-inline": "3rem",
                                    }}
                                >
                                    <div style={{ "border-left": "1px solid var(--ba-text)", height: "100%" }}></div>
                                    <div style={{ "border-left": "1px solid var(--ba-text)", height: "100%" }}></div>
                                    <div style={{ "border-left": "1px solid var(--ba-text)", height: "100%" }}></div>
                                    <div style={{ "border-left": "1px solid var(--ba-text)", height: "100%" }}></div>
                                </div>

                                {/* 範囲ラベル */}
                                <div
                                    class="ba-text-center ba-font-bold ba-text-success"
                                    style={{
                                        position: "absolute",
                                        top: "0.5rem",
                                        left: 0,
                                        right: 0,
                                        "font-size": "0.6875rem",
                                    }}
                                >
                                    ピントが合う範囲：
                                    {dofData().totalDepthString}
                                </div>

                                {/* 1. カメラ（左端） */}
                                <div
                                    class="ba-flex-col ba-items-center ba-text-muted"
                                    style={{ position: "absolute", left: "0.5rem", top: "5.5rem" }}
                                >
                                    <ToolIcon name="camera" class="ba-icon-lg" />
                                </div>

                                {/* 2. ピントの合う厚み（帯） */}
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "6rem",
                                        height: "1.5rem",
                                        "border-top": "2px solid var(--ba-success)",
                                        "border-bottom": "2px solid var(--ba-success)",
                                        "border-radius": "0.2rem",
                                        transition: "all 0.3s ease",
                                        left: `${Math.max(10, Math.min(95, ((dofData().nearLimitM as number) / visualScale()) * 75 + 10))}%`,
                                        width: dofData().isInfinite
                                            ? `${100 - Math.max(10, Math.min(95, ((dofData().nearLimitM as number) / visualScale()) * 75 + 10))}%`
                                            : `${Math.max(2, Math.min(75, (((dofData().farLimitM as number) - (dofData().nearLimitM as number)) / visualScale()) * 75))}%`,
                                        "background-color": dofData().isInfinite ? "transparent" : "var(--ba-success-soft)",
                                        "background-image": dofData().isInfinite
                                            ? "linear-gradient(to right, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0))"
                                            : "none",
                                        "border-right": dofData().isInfinite ? "none" : "2px solid var(--ba-success)",
                                    }}
                                >
                                    {/* 手前の限界距離ラベル */}
                                    <div
                                        class="ba-font-black ba-text-success"
                                        style={{
                                            position: "absolute",
                                            top: "-1.25rem",
                                            left: "-0.25rem",
                                            "font-size": "0.625rem",
                                            "white-space": "nowrap",
                                        }}
                                    >
                                        ◀ {dofData().nearLimitMString}m
                                    </div>
                                    {/* 奥の限界距離ラベル */}
                                    <div
                                        class="ba-font-black ba-text-success"
                                        style={{
                                            position: "absolute",
                                            top: "-1.25rem",
                                            right: 0,
                                            "font-size": "0.625rem",
                                            "white-space": "nowrap",
                                        }}
                                    >
                                        {dofData().isInfinite
                                            ? "無限遠 ▶"
                                            : `${dofData().farLimitMString}m ▶`}
                                    </div>
                                </div>

                                {/* 3. 被写体 */}
                                <div
                                    class="ba-flex-col ba-items-center"
                                    style={{
                                        position: "absolute",
                                        top: "4rem",
                                        transition: "all 0.3s ease",
                                        left: `${Math.max(12, Math.min(90, (customSubjectDistance() / visualScale()) * 75 + 10))}%`,
                                        transform: "translateX(-50%)",
                                    }}
                                >
                                    <span
                                        style={{
                                            width: "0.625rem",
                                            height: "0.625rem",
                                            "border-radius": "9999px",
                                            background: "var(--ba-primary)",
                                            "margin-bottom": "0.25rem",
                                            display: "block",
                                        }}
                                        aria-hidden="true"
                                    ></span>
                                    <span
                                        class="ba-font-black ba-truncate"
                                        style={{
                                            "font-size": "0.625rem",
                                            color: "var(--ba-primary-soft-fg)",
                                            background: "var(--ba-primary-soft)",
                                            padding: "0.1rem 0.4rem",
                                            "border-radius": "0.25rem",
                                            "max-width": "110px",
                                        }}
                                    >
                                        被写体 ({customSubjectDistance()}m)
                                    </span>
                                </div>

                                {/* 背景限界 */}
                                <div
                                    class="ba-flex-col ba-items-center"
                                    style={{ position: "absolute", right: "0.5rem", top: "5.5rem" }}
                                >
                                    <span class="ba-text-base ba-mono ba-font-black ba-text-muted" aria-hidden="true">∞</span>
                                </div>

                                {/* 下部スケール */}
                                <div
                                    class="ba-w-full ba-flex ba-justify-between ba-mono ba-font-bold ba-text-muted"
                                    style={{
                                        "font-size": "0.625rem",
                                        "padding-inline": "2rem",
                                        "margin-top": "auto",
                                        "padding-top": "0.75rem",
                                    }}
                                >
                                    <span>0m</span>
                                    <span>
                                        {(visualScale() * 0.5).toFixed(1)}m
                                    </span>
                                    <span>{visualScale().toFixed(1)}m+</span>
                                </div>
                            </div>
                        </div>

                        {/* 計算結果カードセクション */}
                        <div
                            class="ba-panel ba-stack-4"
                            style={{
                                padding: "1.25rem",
                                "border-radius": "var(--ba-radius-lg)",
                                border: "2px solid var(--ba-border)",
                                overflow: "hidden",
                            }}
                        >
                            <h2
                                class="ba-section-title"
                                style={{
                                    "font-size": "0.8125rem",
                                    "border-bottom": "2px solid var(--ba-border)",
                                    "padding-bottom": "0.5rem",
                                }}
                            >
                                計算結果
                            </h2>

                            <div class="ba-grid-2">
                                {/* 過焦点距離 */}
                                <div
                                    class="ba-stack-1"
                                    style={{
                                        background: "var(--ba-primary-soft)",
                                        border: "2px solid var(--ba-primary)",
                                        padding: "1.1rem",
                                        "border-radius": "var(--ba-radius)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <span class="ba-font-black ba-text-primary" style={{ "font-size": "0.6875rem", "line-height": 1.4 }}>
                                        一番お勧めのピント位置（過焦点距離）
                                    </span>
                                    <span
                                        class="ba-font-black ba-text-primary ba-mono"
                                        style={{ "font-size": "1.875rem", "line-height": 1.1, "margin-block": "0.25rem" }}
                                    >
                                        {hyperfocalData().distanceM.toFixed(2)}
                                        <span class="ba-text-sm"> m</span>
                                    </span>
                                    <span
                                        class="ba-font-bold ba-text-muted"
                                        style={{ "font-size": "0.6875rem", "line-height": 1.55, "word-break": "keep-all", "overflow-wrap": "anywhere" }}
                                    >
                                        <BudouX text="カメラをマニュアルフォーカス（MF）にして、この距離（約 " />
                                        <strong style={{ color: "var(--ba-text)" }}>
                                            {hyperfocalData().distanceM.toFixed(1)}m 先
                                        </strong>
                                        <BudouX text=" の地面や木にピントを合わせます。" />
                                    </span>
                                </div>

                                {/* パンフォーカス範囲 */}
                                <div
                                    class="ba-stack-1"
                                    style={{
                                        background: "var(--ba-success-soft)",
                                        border: "2px solid var(--ba-success)",
                                        padding: "1.1rem",
                                        "border-radius": "var(--ba-radius)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <span class="ba-font-black ba-text-success" style={{ "font-size": "0.6875rem", "line-height": 1.4 }}>
                                        その時にピントが合う範囲（パンフォーカス）
                                    </span>
                                    <span
                                        class="ba-font-black ba-text-success ba-mono"
                                        style={{ "font-size": "1.75rem", "line-height": 1.1, "margin-block": "0.25rem" }}
                                    >
                                        {hyperfocalData().nearLimitM.toFixed(2)}
                                        m 〜 無限遠
                                    </span>
                                    <span
                                        class="ba-font-bold"
                                        style={{
                                            "font-size": "0.6875rem",
                                            "line-height": 1.55,
                                            color: "var(--ba-success-soft-fg)",
                                            "word-break": "keep-all",
                                            "overflow-wrap": "anywhere",
                                        }}
                                    >
                                        <BudouX text="上記のお勧め距離に合わせるだけで、手前約 " />
                                        <strong>
                                            {hyperfocalData().nearLimitM.toFixed(1)}m
                                        </strong>
                                        <BudouX text=" から、一番奥の山や星空の背景まですべてが鮮明に写ります！" />
                                    </span>
                                </div>
                            </div>

                            {/* 任意指定位置のピント範囲カード */}
                            <div
                                class="ba-stack-2"
                                style={{
                                    background: "var(--ba-surface)",
                                    border: "2px solid var(--ba-border-strong)",
                                    padding: "1rem",
                                    "border-radius": "var(--ba-radius)",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-flex-wrap"
                                    style={{
                                        "border-bottom": "1px solid var(--ba-border)",
                                        "padding-bottom": "0.5rem",
                                    }}
                                >
                                    <span class="ba-font-black ba-text-primary ba-flex-1" style={{ "font-size": "0.6875rem", "min-width": "150px" }}>
                                        仮に {customSubjectDistance()}m
                                        の被写体にピントを合わせた場合
                                    </span>
                                    <span class="ba-badge ba-badge--neutral">
                                        被写界深度（ピントが合う奥行き）
                                    </span>
                                </div>
                                <div class="ba-stack-2">
                                    <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                                        <span class="ba-font-bold ba-text-muted ba-flex-1" style={{ "font-size": "0.75rem" }}>
                                            手前のピント限界（ここから）:
                                        </span>
                                        <span class="ba-text-sm ba-font-black ba-mono">
                                            {dofData().nearLimitMString} m
                                        </span>
                                    </div>
                                    <div
                                        class="ba-flex ba-items-center ba-justify-between ba-gap-2"
                                        style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "0.4rem" }}
                                    >
                                        <span class="ba-font-bold ba-text-muted ba-flex-1" style={{ "font-size": "0.75rem" }}>
                                            奥のピント限界（ここまで）:
                                        </span>
                                        <span class="ba-text-sm ba-font-black ba-mono">
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
                                    <div
                                        class="ba-flex ba-items-center ba-justify-between ba-gap-2"
                                        style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "0.4rem" }}
                                    >
                                        <span class="ba-font-bold ba-text-muted ba-flex-1" style={{ "font-size": "0.75rem" }}>
                                            ピントが綺麗に合う全体の厚み（幅）:
                                        </span>
                                        <span
                                            class="ba-text-sm ba-font-black ba-mono"
                                            style={{
                                                color: "var(--ba-primary-soft-fg)",
                                                background: "var(--ba-primary-soft)",
                                                padding: "0.15rem 0.5rem",
                                                "border-radius": "var(--ba-radius-sm)",
                                            }}
                                        >
                                            {dofData().totalDepthString}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <AdSense />

                <div
                    class="ba-grid-2 ba-w-full"
                    style={{
                        gap: "1.5rem",
                        "margin-top": "1rem",
                        "padding-top": "1.5rem",
                        "border-top": "1px solid var(--ba-border)",
                    }}
                >
                    <div class="ba-panel" style={{ padding: "1.5rem", "border-radius": "var(--ba-radius-lg)" }}>
                        <h2
                            class="ba-section-title"
                            style={{
                                "font-size": "0.9375rem",
                                "border-bottom": "1px solid var(--ba-border)",
                                "padding-bottom": "0.5rem",
                                "margin-bottom": "1rem",
                            }}
                        >
                            光学理論に基づく計算式
                        </h2>
                        <div class="ba-stack-4 ba-text-xs ba-text-muted" style={{ "line-height": 1.65 }}>
                            <p style={{ margin: 0 }}>
                                幾何光学において、過焦点距離{" "}
                                <span
                                    class="ba-mono ba-font-bold"
                                    style={{
                                        background: "var(--ba-surface)",
                                        padding: "0.1rem 0.4rem",
                                        "border-radius": "0.25rem",
                                        border: "1px solid var(--ba-border)",
                                        color: "var(--ba-text)",
                                    }}
                                >
                                    H
                                </span>{" "}
                                は、許容錯乱円の直径を{" "}
                                <span class="ba-mono ba-font-bold" style={{ color: "var(--ba-text)" }}>c</span>
                                、レンズの物理焦点距離を{" "}
                                <span class="ba-mono ba-font-bold" style={{ color: "var(--ba-text)" }}>f</span>
                                、絞り値（F値）を{" "}
                                <span class="ba-mono ba-font-bold" style={{ color: "var(--ba-text)" }}>N</span>{" "}
                                としたとき、以下の数式で定義されます。
                            </p>

                            <div
                                class="ba-flex ba-items-center ba-justify-center ba-gap-3 ba-mono"
                                style={{
                                    background: "var(--ba-surface)",
                                    padding: "1rem",
                                    "border-radius": "var(--ba-radius)",
                                    border: "1px solid var(--ba-border)",
                                    color: "var(--ba-text)",
                                }}
                            >
                                <span class="ba-text-sm ba-font-bold">H = </span>
                                <div class="ba-flex-col ba-items-center">
                                    <span style={{ "border-bottom": "1px solid var(--ba-text-muted)", "padding-inline": "0.5rem", "padding-bottom": "0.15rem" }}>
                                        f &sup2;
                                    </span>
                                    <span style={{ "padding-inline": "0.5rem", "padding-top": "0.15rem" }}>N &times; c</span>
                                </div>
                                <span class="ba-text-sm ba-font-bold">+ f</span>
                            </div>

                            <p style={{ margin: 0 }}>
                                ピント位置をこの距離{" "}
                                <span
                                    class="ba-mono ba-font-bold"
                                    style={{
                                        background: "var(--ba-surface)",
                                        padding: "0.1rem 0.4rem",
                                        "border-radius": "0.25rem",
                                        border: "1px solid var(--ba-border)",
                                        color: "var(--ba-text)",
                                    }}
                                >
                                    H
                                </span>{" "}
                                に固定した時、合焦深度の手前側限界（近点限界{" "}
                                <span class="ba-mono ba-font-bold" style={{ color: "var(--ba-text)" }}>D_near</span>
                                ）は次の値をとります。
                            </p>

                            <div
                                class="ba-flex ba-items-center ba-justify-center ba-gap-3 ba-mono"
                                style={{
                                    background: "var(--ba-surface)",
                                    padding: "1rem",
                                    "border-radius": "var(--ba-radius)",
                                    border: "1px solid var(--ba-border)",
                                    color: "var(--ba-text)",
                                }}
                            >
                                <span class="ba-text-sm ba-font-bold">D_near = </span>
                                <div class="ba-flex-col ba-items-center">
                                    <span style={{ "border-bottom": "1px solid var(--ba-text-muted)", "padding-inline": "0.5rem", "padding-bottom": "0.15rem" }}>
                                        H
                                    </span>
                                    <span style={{ "padding-inline": "0.5rem", "padding-top": "0.15rem" }}>2</span>
                                </div>
                            </div>

                            <p style={{ margin: 0 }}>
                                この時、前方側は過焦点距離の半分の地点から、後方側は理論上「無限遠」までが合焦域（パンフォーカス）に収まります。
                            </p>
                        </div>
                    </div>

                    <div class="ba-panel" style={{ padding: "1.5rem", "border-radius": "var(--ba-radius-lg)" }}>
                        <h2
                            class="ba-section-title"
                            style={{
                                "font-size": "0.9375rem",
                                "border-bottom": "1px solid var(--ba-border)",
                                "padding-bottom": "0.5rem",
                                "margin-bottom": "1rem",
                            }}
                        >
                            よくある光学の質問 (FAQ)
                        </h2>
                        <div class="ba-stack-3 ba-text-xs ba-text-muted" style={{ "line-height": 1.65 }}>
                            <div>
                                <h3 class="ba-font-bold" style={{ "font-size": "0.8125rem", "margin-top": 0, "margin-bottom": "0.25rem", color: "var(--ba-text)" }}>
                                    Q. 許容錯乱円（CoC）とは何ですか？
                                </h3>
                                <p style={{ margin: 0 }}>
                                    センサー上の1点に集まるべき光が、わずかにピンボケすることで作る「ボケの円」のことです。人間の目で「ピントが合っている」と認識できる限界の大きさを指します。
                                </p>
                            </div>
                            <div style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "0.625rem" }}>
                                <h3 class="ba-font-bold" style={{ "font-size": "0.8125rem", "margin-top": 0, "margin-bottom": "0.25rem", color: "var(--ba-text)" }}>
                                    Q.
                                    小絞りボケ（回折現象）は計算に含まれますか？
                                </h3>
                                <p style={{ margin: 0 }}>
                                    本ツールは幾何光学をベースに算出しているため、F値を絞り込みすぎた時の光の回折（画質低下）は考慮していません。実写の際はF8〜F11あたりが最もバランスがよくお勧めです。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <AdSense />
            <AdSense />
        </div>
    );
}
