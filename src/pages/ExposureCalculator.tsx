import {
    createSignal,
    createMemo,
    createEffect,
    onSettled,
    For,
    Show,
} from "solid-js";
import AdSense from "../components/AdSense";
import ToolIcon from "../components/ToolIcon";
import BudouX from "../components/BudouX";
import { playPageEntrance, animatePop } from "../utils/animations";
import { initAudio, closeAudio, playNotificationSound } from "../utils/sound";
import { usePageI18n } from "../i18n/index";
import {
    calculateEv100,
    calculateShutterSpeed,
    calculateAperture,
    calculateIso,
    findClosestStandardValue,
    calculateNdExposure,
    formatShutterSpeed,
    calculateAstroShutterLimit,
    calculateLuminanceFromImageData,
    estimateEvFromLuminance,
    calculateEvFromCameraSettings,
    type MeteringMode,
    STANDARD_APERTURES,
    STANDARD_ISOS,
    STANDARD_SHUTTER_SPEEDS,
    ND_FILTER_PRESETS,
    SCENE_PRESETS,
    SENSOR_PRESETS,
} from "../utils/exposureCalculator";

type CalculatorMode = "meter" | "simulator" | "nd-bulb" | "equivalent" | "astro";
type SolveTarget = "shutter" | "aperture" | "iso";

export default function ExposureCalculator() {
    const { title, description } = usePageI18n("/exposure-calculator", {
        defaultTitle: "カメラ露出計算機",
        defaultDescription:
            "リアルタイム露出計(測光)からND長秒露光・星空撮影まで、絞り(F値)・シャッター速度・ISO・NDの適正露出をシミュレーション・換算できます。",
    });
    let containerRef: HTMLDivElement | undefined;
    let videoRef: HTMLVideoElement | undefined;
    let canvasRef: HTMLCanvasElement | undefined;

    // 現在のタブ
    const [activeTab, setActiveTab] = createSignal<CalculatorMode>("simulator");

    // ==========================================
    // 0. カメラ露出計（リアルタイム測光）用状態
    // ==========================================
    const [isCameraActive, setIsCameraActive] = createSignal(false);
    const [cameraFacing, setCameraFacing] = createSignal<"environment" | "user">("environment");
    const [meterMode, setMeterMode] = createSignal<MeteringMode>("center");
    const [calibrationOffset, setCalibrationOffset] = createSignal(0);
    const [measuredEv, setMeasuredEv] = createSignal(12.0);
    const [measuredLux, setMeasuredLux] = createSignal(10000);
    const [isHardwareMode, setIsHardwareMode] = createSignal(false);
    const [cameraError, setCameraError] = createSignal<string | null>(null);

    let mediaStream: MediaStream | null = null;
    let meteringIntervalId: number | undefined;

    // ==========================================
    // 1. 適正露出シミュレーター用状態
    // ==========================================
    const [selectedScene, setSelectedScene] = createSignal("sunny-16");
    const [manualEv, setManualEv] = createSignal<number | "">(15);
    const [isManualEv, setIsManualEv] = createSignal(false);
    const [evCompensation, setEvCompensation] = createSignal(0);
    const [solveTarget, setSolveTarget] = createSignal<SolveTarget>("shutter");

    const [simAperture, setSimAperture] = createSignal<number>(8.0);
    const [simShutter, setSimShutter] = createSignal<number>(1 / 250);
    const [simIso, setSimIso] = createSignal<number>(100);
    const [simNdStops, setSimNdStops] = createSignal<number>(0);

    // ==========================================
    // 2. ND長秒露光 & バルブタイマー用状態
    // ==========================================
    const [ndBaseShutter, setNdBaseShutter] = createSignal<number>(1 / 125);
    const [selectedNdFilter, setSelectedNdFilter] = createSignal("nd1000");
    const [customNdStops, setCustomNdStops] = createSignal<number | "">(10);

    // タイマー関連状態
    const [timerRemainingSeconds, setTimerRemainingSeconds] = createSignal(0);
    const [timerTotalSeconds, setTimerTotalSeconds] = createSignal(0);
    const [isTimerRunning, setIsTimerRunning] = createSignal(false);
    const [soundAlert, setSoundAlert] = createSignal(true);
    let timerIntervalId: number | undefined;

    // ==========================================
    // 3. 等価露出換算用状態
    // ==========================================
    const [eqBaseAperture, setEqBaseAperture] = createSignal(8.0);
    const [eqBaseShutter, setEqBaseShutter] = createSignal(1 / 250);
    const [eqBaseIso, setEqBaseIso] = createSignal(100);
    const [eqBaseNdStops, setEqBaseNdStops] = createSignal(0);

    const [eqTargetParam, setEqTargetParam] =
        createSignal<SolveTarget>("shutter");
    const [eqNewAperture, setEqNewAperture] = createSignal(2.8);
    const [eqNewShutter, setEqNewShutter] = createSignal(1 / 1000);
    const [eqNewIso, setEqNewIso] = createSignal(100);
    const [eqNewNdStops, setEqNewNdStops] = createSignal(0);

    // ==========================================
    // 4. 星空限界シャッター速度用状態
    // ==========================================
    const [astroSensor, setAstroSensor] = createSignal("fullframe");
    const [astroCropFactor, setAstroCropFactor] = createSignal<number | "">(1.0);
    const [astroPixelPitch, setAstroPixelPitch] = createSignal(5.9);
    const [astroFocalLength, setAstroFocalLength] = createSignal<number | "">(24);
    const [astroAperture, setAstroAperture] = createSignal(2.8);

    // ライフサイクル
    onSettled(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".ba-card");
        }
        return () => {
            stopCamera();
            if (timerIntervalId !== undefined) {
                window.clearInterval(timerIntervalId);
                timerIntervalId = undefined;
            }
            closeAudio();
        };
    });

    const stopCamera = () => {
        setIsCameraActive(false);
        if (meteringIntervalId !== undefined) {
            window.clearInterval(meteringIntervalId);
            meteringIntervalId = undefined;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = null;
        }
        if (videoRef) {
            videoRef.srcObject = null;
        }
    };

    const startCamera = async () => {
        setCameraError(null);
        stopCamera();

        if (
            typeof navigator === "undefined" ||
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            setCameraError(
                "お使いのブラウザまたは端末はカメラアクセスAPIに対応していません。",
            );
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: cameraFacing() },
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
                audio: false,
            });

            mediaStream = stream;
            if (videoRef) {
                videoRef.srcObject = stream;
                await videoRef.play().catch(() => {});
            }
            setIsCameraActive(true);

            // 測光ループ（約120ms間隔でフレーム解析）
            meteringIntervalId = window.setInterval(() => {
                if (!videoRef || !canvasRef || videoRef.readyState < 2) return;
                const ctx = canvasRef.getContext("2d", { willReadFrequently: true });
                if (!ctx) return;

                const w = canvasRef.width;
                const h = canvasRef.height;
                ctx.drawImage(videoRef, 0, 0, w, h);

                const track = mediaStream?.getVideoTracks()[0];
                const settings = track?.getSettings?.() as any;

                // ハードウェア露光情報がある場合
                const hwEv = calculateEvFromCameraSettings(
                    settings?.exposureTime,
                    settings?.iso,
                );

                if (hwEv !== null && Number.isFinite(hwEv)) {
                    setIsHardwareMode(true);
                    const finalEv = Math.round((hwEv + calibrationOffset()) * 10) / 10;
                    setMeasuredEv(finalEv);
                    setMeasuredLux(Math.round(2.5 * Math.pow(2, finalEv)));
                } else {
                    setIsHardwareMode(false);
                    // 画像フレーム輝度からの推定
                    try {
                        const imgData = ctx.getImageData(0, 0, w, h);
                        const lum = calculateLuminanceFromImageData(imgData, meterMode());
                        const res = estimateEvFromLuminance(lum, 11.5, calibrationOffset());
                        setMeasuredEv(res.ev);
                        setMeasuredLux(res.lux);
                    } catch {
                        // 読み取りスキップ
                    }
                }
            }, 120);
        } catch (err: any) {
            stopCamera();
            if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
                setCameraError("カメラへのアクセス権限が拒否されました。ブラウザの設定でカメラを許可してください。");
            } else {
                setCameraError(`カメラの起動に失敗しました: ${err?.message || "エラーが発生しました"}`);
            }
        }
    };

    const applyMeasuredEvToSimulator = () => {
        setManualEv(measuredEv());
        setIsManualEv(true);
        setActiveTab("simulator");
        stopCamera();
    };

    const switchToScenePresets = () => {
        stopCamera();
        setIsManualEv(false);
        setActiveTab("simulator");
    };

    // ------------------------------------------
    // シーン選択連動
    // ------------------------------------------
    createEffect(
        () => ({ sceneId: selectedScene(), isManual: isManualEv() }),
        ({ sceneId, isManual }) => {
            if (!isManual) {
                const found = SCENE_PRESETS.find((s) => s.id === sceneId);
                if (found) {
                    setManualEv(found.ev100);
                }
            }
        },
    );

    // センサー選択連動
    createEffect(
        () => astroSensor(),
        (sensorId) => {
            const found = SENSOR_PRESETS.find((s) => s.id === sensorId);
            if (found && sensorId !== "custom") {
                setAstroCropFactor(found.cropFactor);
                setAstroPixelPitch(found.defaultPixelPitchUm);
            }
        },
    );

    // 目標実効EV (EV100 + 補正)
    const currentTargetEv = createMemo(() => {
        let base = 15;
        if (isManualEv()) {
            const raw = manualEv();
            base = typeof raw === "number" && Number.isFinite(raw) ? raw : 15;
        } else {
            base = SCENE_PRESETS.find((s) => s.id === selectedScene())?.ev100 ?? 15;
        }
        const comp = evCompensation();
        return base + (Number.isFinite(comp) ? comp : 0);
    });

    // ==========================================
    // 1. シミュレーター計算結果
    // ==========================================
    const simResult = createMemo(() => {
        const targetEv = currentTargetEv();
        const target = solveTarget();
        const nd = simNdStops();

        if (target === "shutter") {
            const aperture = simAperture();
            const iso = simIso();
            const calculatedSec = calculateShutterSpeed(
                targetEv,
                aperture,
                iso,
                nd,
            );
            const standard = findClosestStandardValue(
                calculatedSec,
                STANDARD_SHUTTER_SPEEDS,
                (s) => s.value,
            );
            return {
                type: "shutter" as const,
                exactValue: calculatedSec,
                displayExact: formatShutterSpeed(calculatedSec),
                standardLabel: standard.label,
                standardValue: standard.value,
            };
        } else if (target === "aperture") {
            const shutter = simShutter();
            const iso = simIso();
            const calculatedF = calculateAperture(
                targetEv,
                shutter,
                iso,
                nd,
            );
            const standard = findClosestStandardValue(
                calculatedF,
                STANDARD_APERTURES,
                (v) => v,
            );
            return {
                type: "aperture" as const,
                exactValue: calculatedF,
                displayExact: `f/${calculatedF.toFixed(1)}`,
                standardLabel: `f/${standard}`,
                standardValue: standard,
            };
        } else {
            const aperture = simAperture();
            const shutter = simShutter();
            const calculatedIso = calculateIso(
                targetEv,
                aperture,
                shutter,
                nd,
            );
            const standard = findClosestStandardValue(
                calculatedIso,
                STANDARD_ISOS,
                (v) => v,
            );
            return {
                type: "iso" as const,
                exactValue: calculatedIso,
                displayExact: `ISO ${calculatedIso}`,
                standardLabel: `ISO ${standard}`,
                standardValue: standard,
            };
        }
    });

    // ==========================================
    // 2. ND長秒露光計算結果
    // ==========================================
    const activeNdStops = createMemo(() => {
        const sel = selectedNdFilter();
        if (sel === "custom") {
            const c = customNdStops();
            return typeof c === "number" && Number.isFinite(c) && c >= 0 ? c : 0;
        }
        const found = ND_FILTER_PRESETS.find((p) => p.id === sel);
        return found ? found.stops : 0;
    });

    const ndCalculatedSeconds = createMemo(() => {
        const base = ndBaseShutter();
        const stops = activeNdStops();
        return calculateNdExposure(base, stops);
    });

    // ------------------------------------------
    // タイマー操作
    // ------------------------------------------
    const setTimerFromNd = () => {
        const secs = Math.max(1, Math.round(ndCalculatedSeconds()));
        setTimerTotalSeconds(secs);
        setTimerRemainingSeconds(secs);
    };

    const toggleTimer = (el?: HTMLElement) => {
        if (el) animatePop(el, 0.94, 0.15);
        if (isTimerRunning()) {
            // 一時停止
            setIsTimerRunning(false);
            if (timerIntervalId !== undefined) {
                window.clearInterval(timerIntervalId);
                timerIntervalId = undefined;
            }
        } else {
            // 開始
            initAudio();
            let rem = timerRemainingSeconds();
            if (rem <= 0) {
                const initSec = Math.max(1, Math.round(ndCalculatedSeconds()));
                setTimerTotalSeconds(initSec);
                setTimerRemainingSeconds(initSec);
                rem = initSec;
            }
            setIsTimerRunning(true);
            timerIntervalId = window.setInterval(() => {
                setTimerRemainingSeconds((prev) => {
                    if (prev <= 1) {
                        // タイマー終了
                        if (timerIntervalId !== undefined) {
                            window.clearInterval(timerIntervalId);
                            timerIntervalId = undefined;
                        }
                        setIsTimerRunning(false);
                        if (soundAlert()) {
                            playNotificationSound({ soundType: "chime" });
                        }
                        if (
                            typeof navigator !== "undefined" &&
                            "vibrate" in navigator
                        ) {
                            try {
                                navigator.vibrate([300, 150, 300, 150, 500]);
                            } catch {
                                // 無視
                            }
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    const resetTimer = (el?: HTMLElement) => {
        if (el) animatePop(el, 0.94, 0.15);
        setIsTimerRunning(false);
        if (timerIntervalId !== undefined) {
            window.clearInterval(timerIntervalId);
            timerIntervalId = undefined;
        }
        const total = timerTotalSeconds() > 0
            ? timerTotalSeconds()
            : Math.max(1, Math.round(ndCalculatedSeconds()));
        setTimerRemainingSeconds(total);
    };

    // ==========================================
    // 3. 等価露出換算計算結果
    // ==========================================
    const eqBaseEv = createMemo(() => {
        return calculateEv100(
            eqBaseAperture(),
            eqBaseShutter(),
            eqBaseIso(),
            eqBaseNdStops(),
        );
    });

    const eqResult = createMemo(() => {
        const targetEv = eqBaseEv();
        const targetParam = eqTargetParam();
        const nd = eqNewNdStops();

        if (targetParam === "shutter") {
            const calculatedSec = calculateShutterSpeed(
                targetEv,
                eqNewAperture(),
                eqNewIso(),
                nd,
            );
            const standard = findClosestStandardValue(
                calculatedSec,
                STANDARD_SHUTTER_SPEEDS,
                (s) => s.value,
            );
            return {
                label: "必要シャッタースピード",
                exact: formatShutterSpeed(calculatedSec),
                standard: standard.label,
                raw: calculatedSec,
            };
        } else if (targetParam === "aperture") {
            const calculatedF = calculateAperture(
                targetEv,
                eqNewShutter(),
                eqNewIso(),
                nd,
            );
            const standard = findClosestStandardValue(
                calculatedF,
                STANDARD_APERTURES,
                (v) => v,
            );
            return {
                label: "必要絞り値(F値)",
                exact: `f/${calculatedF.toFixed(1)}`,
                standard: `f/${standard}`,
                raw: calculatedF,
            };
        } else {
            const calculatedIso = calculateIso(
                targetEv,
                eqNewAperture(),
                eqNewShutter(),
                nd,
            );
            const standard = findClosestStandardValue(
                calculatedIso,
                STANDARD_ISOS,
                (v) => v,
            );
            return {
                label: "必要ISO感度",
                exact: `ISO ${calculatedIso}`,
                standard: `ISO ${standard}`,
                raw: calculatedIso,
            };
        }
    });

    // ==========================================
    // 4. 星景シャッター速度限界
    // ==========================================
    const astroResult = createMemo(() => {
        const rawFocal = astroFocalLength();
        const focal =
            typeof rawFocal === "number" && Number.isFinite(rawFocal) && rawFocal > 0
                ? rawFocal
                : 24;
        const rawCrop = astroCropFactor();
        const crop =
            typeof rawCrop === "number" && Number.isFinite(rawCrop) && rawCrop > 0
                ? rawCrop
                : 1.0;
        const aperture = astroAperture();
        const pixelPitch = astroPixelPitch();

        return calculateAstroShutterLimit(focal, crop, aperture, pixelPitch);
    });

    return (
        <div ref={containerRef} class="ba-page">
            {/* ページタイトル & リード文 */}
            <div class="ba-card ba-stack-3">
                <h1 class="ba-title ba-flex ba-items-center ba-gap-2">
                    <span class="ba-icon-box" aria-hidden="true">
                        <ToolIcon name="camera" class="ba-icon-md" />
                    </span>
                    {title()}
                </h1>
                <p class="ba-text-sm ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                    {description()}
                </p>

                {/* タブナビゲーション */}
                <div class="ba-tabs ba-w-full" style={{ "margin-top": "0.25rem" }}>
                    <button
                        type="button"
                        class={`ba-tab ba-flex-1 ${activeTab() === "meter" ? "is-active" : ""}`}
                        style={{ "min-width": "120px", "min-height": "2.6rem" }}
                        onClick={() => setActiveTab("meter")}
                    >
                        カメラ露出計
                    </button>
                    <button
                        type="button"
                        class={`ba-tab ba-flex-1 ${activeTab() === "simulator" ? "is-active" : ""}`}
                        style={{ "min-width": "120px", "min-height": "2.6rem" }}
                        onClick={() => setActiveTab("simulator")}
                    >
                        適正露出計算
                    </button>
                    <button
                        type="button"
                        class={`ba-tab ba-flex-1 ${activeTab() === "nd-bulb" ? "is-active" : ""}`}
                        style={{ "min-width": "120px", "min-height": "2.6rem" }}
                        onClick={() => setActiveTab("nd-bulb")}
                    >
                        ND長秒・バルブ
                    </button>
                    <button
                        type="button"
                        class={`ba-tab ba-flex-1 ${activeTab() === "equivalent" ? "is-active" : ""}`}
                        style={{ "min-width": "120px", "min-height": "2.6rem" }}
                        onClick={() => setActiveTab("equivalent")}
                    >
                        等価露出換算
                    </button>
                    <button
                        type="button"
                        class={`ba-tab ba-flex-1 ${activeTab() === "astro" ? "is-active" : ""}`}
                        style={{ "min-width": "120px", "min-height": "2.6rem" }}
                        onClick={() => setActiveTab("astro")}
                    >
                        星空限界速度
                    </button>
                </div>
            </div>

            {/* ======================================================== */}
            {/* 0. リアルタイムカメラ露出計 */}
            {/* ======================================================== */}
            <Show when={activeTab() === "meter"}>
                <form
                    class="ba-stack-4"
                    {...({
                        toolname: "camera-realtime-light-meter",
                        tooldescription:
                            "端末のカメラを用いて被写体の明るさ・EV値・照度Luxをリアルタイムに測光・計測します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div class="ba-card ba-stack-4">
                        <div
                            class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2"
                            style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                        >
                            <h2 class="ba-section-title ba-flex ba-items-center ba-gap-2">
                                スマホカメラ リアルタイム露出計
                            </h2>
                            <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap">
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--sm"
                                    onClick={() => switchToScenePresets()}
                                >
                                    選択式(シーン)に戻る
                                </button>
                                <span class="ba-badge ba-badge--outline ba-hidden-mobile">
                                    完全ローカル解析
                                </span>
                            </div>
                        </div>

                        {/* カメラエラー表示 */}
                        <Show when={cameraError()}>
                            <div class="ba-alert ba-alert--error">
                                <span class="ba-inline-flex ba-items-center ba-gap-2">
                                    <ToolIcon name="alert" class="ba-icon-sm ba-shrink-0" /> {cameraError()}
                                </span>
                            </div>
                        </Show>

                        {/* ビデオプレビューコンテナ */}
                        <div
                            class="ba-flex ba-items-center ba-justify-center ba-w-full"
                            style={{
                                position: "relative",
                                "max-width": "28rem",
                                margin: "0 auto",
                                "border-radius": "var(--ba-radius-lg)",
                                overflow: "hidden",
                                background: "#000000",
                                "aspect-ratio": "4 / 3",
                                "max-height": "15rem",
                                border: "1px solid var(--ba-border)",
                            }}
                        >
                            <video
                                ref={videoRef}
                                playsinline
                                muted
                                autoplay
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    "object-fit": "cover",
                                    display: isCameraActive() ? "block" : "none",
                                }}
                            />
                            <canvas
                                ref={canvasRef}
                                width="160"
                                height="120"
                                style={{ display: "none" }}
                            />

                            {/* 測光照準オーバーレイ */}
                            <Show when={isCameraActive()}>
                                <div
                                    class="ba-flex ba-items-center ba-justify-center"
                                    style={{ position: "absolute", inset: 0, "pointer-events": "none" }}
                                >
                                    <Show when={meterMode() === "spot"}>
                                        <div
                                            class="ba-flex ba-items-center ba-justify-center"
                                            style={{
                                                width: "3.5rem",
                                                height: "3.5rem",
                                                border: "2px solid var(--ba-primary)",
                                                "border-radius": "9999px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "0.375rem",
                                                    height: "0.375rem",
                                                    background: "var(--ba-primary)",
                                                    "border-radius": "9999px",
                                                }}
                                            ></div>
                                        </div>
                                    </Show>
                                    <Show when={meterMode() === "center"}>
                                        <div
                                            class="ba-flex ba-items-center ba-justify-center"
                                            style={{
                                                width: "8rem",
                                                height: "8rem",
                                                border: "2px dashed var(--ba-primary)",
                                                "border-radius": "9999px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "0.5rem",
                                                    height: "0.5rem",
                                                    background: "var(--ba-primary)",
                                                    "border-radius": "9999px",
                                                }}
                                            ></div>
                                        </div>
                                    </Show>
                                    <Show when={meterMode() === "matrix"}>
                                        <div
                                            class="ba-flex ba-items-center ba-justify-center"
                                            style={{
                                                width: "85%",
                                                height: "85%",
                                                border: "2px solid var(--ba-primary)",
                                                "border-radius": "var(--ba-radius)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "0.5rem",
                                                    height: "0.5rem",
                                                    background: "var(--ba-primary)",
                                                    "border-radius": "9999px",
                                                }}
                                            ></div>
                                        </div>
                                    </Show>
                                </div>
                                <div
                                    class="ba-mono ba-flex ba-items-center ba-gap-2"
                                    style={{
                                        position: "absolute",
                                        top: "0.5rem",
                                        left: "0.5rem",
                                        background: "rgba(0, 0, 0, 0.65)",
                                        padding: "0.15rem 0.625rem",
                                        "border-radius": "9999px",
                                        "font-size": "0.6875rem",
                                        color: "#ffffff",
                                    }}
                                >
                                    <span
                                        style={{
                                            width: "0.5rem",
                                            height: "0.5rem",
                                            "border-radius": "9999px",
                                            background: "#34d399",
                                        }}
                                    ></span>
                                    測光中: {meterMode() === "spot" ? "スポット" : meterMode() === "center" ? "中央重点" : "全体平均"}
                                </div>
                            </Show>

                            {/* 未起動時のプレースホルダー */}
                            <Show when={!isCameraActive()}>
                                <div class="ba-text-center ba-stack-3" style={{ padding: "1rem" }}>
                                    <div class="ba-flex ba-justify-center" style={{ color: "rgba(255, 255, 255, 0.7)" }} aria-hidden="true">
                                        <ToolIcon name="camera" class="ba-icon-xl" />
                                    </div>
                                    <div class="ba-text-sm" style={{ color: "rgba(255, 255, 255, 0.85)", "font-weight": 500 }}>
                                        カメラを起動して明るさをリアルタイム測光
                                    </div>
                                    <div class="ba-flex ba-items-center ba-justify-center ba-gap-2 ba-flex-wrap">
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--primary ba-btn--sm"
                                            onClick={() => startCamera()}
                                        >
                                            カメラを起動する
                                        </button>
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--ghost ba-btn--sm"
                                            style={{ color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.3)" }}
                                            onClick={() => switchToScenePresets()}
                                        >
                                            選択式に戻る
                                        </button>
                                    </div>
                                </div>
                            </Show>
                        </div>

                        {/* カメラ起動時の操作ボタン */}
                        <Show when={isCameraActive()}>
                            <div class="ba-flex ba-flex-wrap ba-justify-center ba-gap-2">
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--danger ba-btn--sm"
                                    onClick={() => stopCamera()}
                                >
                                    カメラを停止
                                </button>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--sm"
                                    onClick={() => {
                                        setCameraFacing((prev) =>
                                            prev === "environment"
                                                ? "user"
                                                : "environment",
                                        );
                                        startCamera();
                                    }}
                                >
                                    {cameraFacing() === "environment" ? "インカメラに切替" : "背面カメラに切替"}
                                </button>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--sm"
                                    onClick={() => switchToScenePresets()}
                                >
                                    選択式(シーン)に戻る
                                </button>
                            </div>
                        </Show>

                        {/* 測定結果表示カード */}
                        <div
                            class="ba-card"
                            style={{
                                background: "#0f172a",
                                color: "#ffffff",
                                "border-color": "#1e293b",
                            }}
                        >
                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-3">
                                <div>
                                    <div class="ba-flex ba-items-center ba-gap-2">
                                        <span
                                            class="ba-text-xs ba-font-bold"
                                            style={{ color: "#e2e8f0", "letter-spacing": "0.04em" }}
                                        >
                                            現在測定中の露出値 (EV 100)
                                        </span>
                                        <Show when={isHardwareMode()}>
                                            <span
                                                class="ba-badge ba-mono"
                                                style={{
                                                    background: "rgba(0, 0, 0, 0.6)",
                                                    color: "#ffffff",
                                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                                }}
                                            >
                                                カメラAE連動中
                                            </span>
                                        </Show>
                                    </div>
                                    <div class="ba-flex ba-items-end ba-gap-3" style={{ "margin-top": "0.25rem" }}>
                                        <div
                                            class="ba-font-black ba-mono"
                                            style={{ "font-size": "2rem", "line-height": 1.1, color: "#ffffff" }}
                                        >
                                            EV {measuredEv().toFixed(1)}
                                        </div>
                                        <span class="ba-text-xs" style={{ color: "#cbd5e1" }}>
                                            約 {measuredLux().toLocaleString()} Lux
                                        </span>
                                    </div>
                                </div>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--primary ba-btn--sm"
                                        onClick={() => applyMeasuredEvToSimulator()}
                                    >
                                        この露出値で計算する
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--sm"
                                        style={{ color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.3)" }}
                                        onClick={() => switchToScenePresets()}
                                    >
                                        選択式に戻る
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 測光方式とキャリブレーション（詳細設定アコーディオン） */}
                        <details class="ba-accordion">
                            <summary>
                                測光方式・EVキャリブレーション補正の設定
                            </summary>
                            <div class="ba-accordion-body ba-stack-3">
                                {/* 測光方式の選択 */}
                                <div class="ba-grid-3">
                                    <label
                                        class="ba-flex ba-items-center ba-gap-2"
                                        style={{
                                            padding: "0.625rem",
                                            border: "1px solid var(--ba-border)",
                                            "border-radius": "var(--ba-radius-sm)",
                                            background: "var(--ba-surface)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="meterMode"
                                            class="ba-radio"
                                            checked={meterMode() === "center"}
                                            onChange={() => setMeterMode("center")}
                                            aria-label="中央重点測光モード"
                                        />
                                        <div>
                                            <div class="ba-font-bold ba-text-xs" style={{ color: "var(--ba-text)" }}>
                                                中央重点測光
                                            </div>
                                            <div class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                中央被写体を重視（標準的）
                                            </div>
                                        </div>
                                    </label>
                                    <label
                                        class="ba-flex ba-items-center ba-gap-2"
                                        style={{
                                            padding: "0.625rem",
                                            border: "1px solid var(--ba-border)",
                                            "border-radius": "var(--ba-radius-sm)",
                                            background: "var(--ba-surface)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="meterMode"
                                            class="ba-radio"
                                            checked={meterMode() === "spot"}
                                            onChange={() => setMeterMode("spot")}
                                            aria-label="スポット測光モード"
                                        />
                                        <div>
                                            <div class="ba-font-bold ba-text-xs" style={{ color: "var(--ba-text)" }}>
                                                スポット測光
                                            </div>
                                            <div class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                中央の狭い一点のみを測定
                                            </div>
                                        </div>
                                    </label>
                                    <label
                                        class="ba-flex ba-items-center ba-gap-2"
                                        style={{
                                            padding: "0.625rem",
                                            border: "1px solid var(--ba-border)",
                                            "border-radius": "var(--ba-radius-sm)",
                                            background: "var(--ba-surface)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="meterMode"
                                            class="ba-radio"
                                            checked={meterMode() === "matrix"}
                                            onChange={() => setMeterMode("matrix")}
                                            aria-label="平均測光モード"
                                        />
                                        <div>
                                            <div class="ba-font-bold ba-text-xs" style={{ color: "var(--ba-text)" }}>
                                                全画面平均測光
                                            </div>
                                            <div class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                画面全体の明るさを均等評価
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* キャリブレーション補正 */}
                                <div
                                    class="ba-stack-1"
                                    style={{
                                        background: "var(--ba-surface)",
                                        padding: "0.75rem",
                                        "border-radius": "var(--ba-radius-sm)",
                                        border: "1px solid var(--ba-border)",
                                    }}
                                >
                                    <div class="ba-flex ba-justify-between ba-items-center ba-text-xs">
                                        <span class="ba-font-bold" style={{ color: "var(--ba-text)" }}>
                                            EVキャリブレーション補正
                                        </span>
                                        <span class="ba-mono ba-font-bold ba-text-primary">
                                            {calibrationOffset() > 0
                                                ? `+${calibrationOffset().toFixed(1)}`
                                                : calibrationOffset().toFixed(1)}{" "}
                                            EV
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-6"
                                        max="6"
                                        step="0.5"
                                        class="ba-range"
                                        value={calibrationOffset()}
                                        onInput={(e) => {
                                            const v = parseFloat(
                                                e.currentTarget.value,
                                            );
                                            setCalibrationOffset(
                                                Number.isFinite(v) ? v : 0,
                                            );
                                        }}
                                        aria-label="露出計キャリブレーションスライダー"
                                    />
                                    <div class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                        端末ごとの自動露出特性やグレーカードに合わせて基準オフセットを微調整できます。
                                    </div>
                                </div>
                            </div>
                        </details>
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 1. 適正露出シミュレーター */}
            {/* ======================================================== */}
            <Show when={activeTab() === "simulator"}>
                <form
                    class="ba-stack-4"
                    {...({
                        toolname: "camera-exposure-simulator",
                        tooldescription:
                            "撮影環境の明るさ(EV)から、適正露出となるシャッター速度・絞り・ISO感度を自動算出します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    {/* 計算結果カード */}
                    <div
                        class="ba-card ba-stack-3"
                        style={{
                            background: "#0f172a",
                            color: "#ffffff",
                            "border-color": "#1e293b",
                        }}
                    >
                        <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-3">
                            <div>
                                <div class="ba-flex ba-items-center ba-gap-2">
                                    <span
                                        class="ba-text-xs ba-font-bold"
                                        style={{ color: "#e2e8f0", "letter-spacing": "0.04em" }}
                                    >
                                        計算された最適露出設定
                                    </span>
                                    <span
                                        class="ba-badge ba-mono"
                                        style={{
                                            background: "rgba(0, 0, 0, 0.6)",
                                            color: "#ffffff",
                                            border: "1px solid rgba(255, 255, 255, 0.3)",
                                        }}
                                    >
                                        目標 EV {currentTargetEv().toFixed(1)}
                                    </span>
                                </div>
                                <div
                                    class="ba-font-black ba-mono"
                                    style={{ "font-size": "2rem", "line-height": 1.15, "margin-top": "0.2rem", color: "#ffffff" }}
                                >
                                    {simResult().standardLabel}
                                </div>
                                <div class="ba-text-sm" style={{ color: "#cbd5e1", "margin-top": "0.15rem" }}>
                                    理論値: {simResult().displayExact}
                                </div>
                            </div>
                            <div
                                class="ba-text-xs ba-stack-1"
                                style={{
                                    background: "rgba(255, 255, 255, 0.1)",
                                    padding: "0.5rem 0.75rem",
                                    "border-radius": "var(--ba-radius)",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                }}
                            >
                                <div style={{ color: "#ffffff", "font-weight": 500 }}>
                                    前提設定:{" "}
                                    {simResult().type === "shutter"
                                        ? `f/${simAperture()} / ISO ${simIso()}`
                                        : simResult().type === "aperture"
                                          ? `${formatShutterSpeed(simShutter())} / ISO ${simIso()}`
                                          : `f/${simAperture()} / ${formatShutterSpeed(simShutter())}`}
                                </div>
                                <div style={{ color: "#ffffff", "font-weight": 500 }}>
                                    {simNdStops() > 0
                                        ? `ND -${simNdStops()}段 装着中`
                                        : "NDなし (標準適正)"}
                                </div>
                            </div>
                        </div>

                        {/* 長秒露光ワンクリック連携 */}
                        <Show
                            when={
                                simResult().type === "shutter" &&
                                simResult().exactValue >= 1
                            }
                        >
                            <div
                                class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2"
                                style={{
                                    "padding-top": "0.5rem",
                                    "border-top": "1px solid rgba(255, 255, 255, 0.2)",
                                }}
                            >
                                <span class="ba-text-sm" style={{ color: "#ffffff" }}>
                                    1秒以上の露光時間です。バルブタイマーにセットしますか？
                                </span>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--primary ba-btn--sm"
                                    onClick={() => {
                                        const sec = Math.max(
                                            1,
                                            Math.round(simResult().exactValue),
                                        );
                                        setTimerTotalSeconds(sec);
                                        setTimerRemainingSeconds(sec);
                                        setActiveTab("nd-bulb");
                                    }}
                                >
                                    バルブタイマーを開く →
                                </button>
                            </div>
                        </Show>
                    </div>

                    <div class="ba-card ba-stack-4">
                        <div
                            class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2"
                            style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                        >
                            <h2 class="ba-section-title">
                                1. 撮影環境・シーンの選択 (目標EV)
                            </h2>
                            <button
                                type="button"
                                class="ba-btn ba-btn--outline ba-btn--sm ba-text-primary"
                                onClick={() => {
                                    setActiveTab("meter");
                                    startCamera();
                                }}
                            >
                                カメラで測光する
                            </button>
                        </div>

                        {/* セグメント切り替え（シーン選択式 vs 手動EV/測光値） */}
                        <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                            <div class="ba-tabs">
                                <button
                                    type="button"
                                    class={`ba-tab ${!isManualEv() ? "is-active" : ""}`}
                                    onClick={() => setIsManualEv(false)}
                                >
                                    シーン選択式
                                </button>
                                <button
                                    type="button"
                                    class={`ba-tab ${isManualEv() ? "is-active" : ""}`}
                                    onClick={() => setIsManualEv(true)}
                                >
                                    手動EV・測光値入力
                                </button>
                            </div>
                            <Show when={isManualEv()}>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--sm"
                                    onClick={() => setIsManualEv(false)}
                                >
                                    シーン選択式に戻る
                                </button>
                            </Show>
                        </div>

                        {/* 手動 / プリセット切り替え（テスト互換用） */}
                        <label class="ba-sr-only">
                            <input
                                type="checkbox"
                                class="ba-toggle"
                                checked={isManualEv()}
                                onChange={(e) =>
                                    setIsManualEv(e.currentTarget.checked)
                                }
                                aria-label="EV値を数値で直接手動入力する"
                            />
                            EV値を手動で直接指定する
                        </label>

                        <Show
                            when={isManualEv()}
                            fallback={
                                <div class="ba-field" style={{ "max-width": "32rem" }}>
                                    <label class="ba-label" for="scene-select">
                                        <span>シーン・環境プリセット</span>
                                    </label>
                                    <select
                                        id="scene-select"
                                        class="ba-select"
                                        value={selectedScene()}
                                        onChange={(e) =>
                                            setSelectedScene(e.currentTarget.value)
                                        }
                                        aria-label="撮影シーンプリセット選択"
                                    >
                                        <For each={SCENE_PRESETS}>
                                            {(scene) => (
                                                <option value={scene.id}>
                                                    {scene.title} (EV{" "}
                                                    {scene.ev100})
                                                </option>
                                            )}
                                        </For>
                                    </select>
                                    <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                        {
                                            SCENE_PRESETS.find(
                                                (s) => s.id === selectedScene(),
                                            )?.description
                                        }
                                    </p>
                                </div>
                            }
                        >
                            <div class="ba-grid-2" style={{ "max-width": "32rem" }}>
                                <div class="ba-field">
                                    <label class="ba-label" for="manual-ev-input">
                                        <span>
                                            露出値 (EV100):{" "}
                                            {typeof manualEv() === "number"
                                                ? `${manualEv()} EV`
                                                : "未入力 (15.0 EV)"}
                                        </span>
                                    </label>
                                    <input
                                        id="manual-ev-input"
                                        type="range"
                                        min="-6"
                                        max="18"
                                        step="0.5"
                                        class="ba-range"
                                        value={
                                            typeof manualEv() === "number"
                                                ? manualEv()
                                                : 15
                                        }
                                        onInput={(e) => {
                                            const v = parseFloat(
                                                e.currentTarget.value,
                                            );
                                            setManualEv(
                                                Number.isFinite(v) ? v : 15,
                                            );
                                        }}
                                        aria-label="手動EVスライダー"
                                    />
                                </div>
                                <div class="ba-field">
                                    <label class="ba-label" for="manual-ev-num">
                                        <span>数値入力</span>
                                    </label>
                                    <input
                                        id="manual-ev-num"
                                        type="number"
                                        step="0.1"
                                        class="ba-input"
                                        placeholder="例: 15.0"
                                        value={manualEv()}
                                        onInput={(e) => {
                                            const raw =
                                                e.currentTarget.value;
                                            if (raw === "") {
                                                setManualEv("");
                                                return;
                                            }
                                            const v = parseFloat(raw);
                                            if (Number.isFinite(v)) {
                                                setManualEv(
                                                    Math.max(
                                                        -10,
                                                        Math.min(25, v),
                                                    ),
                                                );
                                            }
                                        }}
                                        aria-label="手動EV数値入力"
                                    />
                                </div>
                            </div>
                        </Show>

                        {/* 露出補正 (EV Compensation) */}
                        <div class="ba-field" style={{ "max-width": "32rem" }}>
                            <label class="ba-label" for="ev-comp-select">
                                <span>
                                    露出補正 (±EV):{" "}
                                    {evCompensation() > 0
                                        ? `+${evCompensation()}`
                                        : evCompensation()}{" "}
                                    EV
                                </span>
                            </label>
                            <select
                                id="ev-comp-select"
                                class="ba-select"
                                value={evCompensation()}
                                onChange={(e) => {
                                    const v = parseFloat(e.currentTarget.value);
                                    setEvCompensation(
                                        Number.isFinite(v) ? v : 0,
                                    );
                                }}
                                aria-label="露出補正選択"
                            >
                                <option value="-3">-3.0 EV (かなり暗め)</option>
                                <option value="-2">-2.0 EV</option>
                                <option value="-1">-1.0 EV (暗め・引き締め)</option>
                                <option value="-0.67">-0.67 EV (-2/3段)</option>
                                <option value="-0.33">-0.33 EV (-1/3段)</option>
                                <option value="0">±0.0 EV (標準適正)</option>
                                <option value="0.33">+0.33 EV (+1/3段)</option>
                                <option value="0.67">+0.67 EV (+2/3段)</option>
                                <option value="1">+1.0 EV (明るめ・ハイキー)</option>
                                <option value="2">+2.0 EV</option>
                                <option value="3">+3.0 EV (かなり明るめ)</option>
                            </select>
                        </div>

                        <h2
                            class="ba-section-title"
                            style={{
                                "border-bottom": "1px solid var(--ba-border)",
                                "padding-bottom": "0.5rem",
                                "padding-top": "0.5rem",
                            }}
                        >
                            2. 自動算出したいパラメータを選択
                        </h2>
                        <div class="ba-grid-3">
                            <label
                                class="ba-flex ba-items-center ba-gap-3"
                                style={{
                                    padding: "0.75rem",
                                    border: "1px solid var(--ba-border)",
                                    "border-radius": "var(--ba-radius)",
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="solveTarget"
                                    class="ba-radio"
                                    checked={solveTarget() === "shutter"}
                                    onChange={() =>
                                        setSolveTarget("shutter")
                                    }
                                    aria-label="シャッタースピードを自動計算する"
                                />
                                <div>
                                    <div class="ba-font-bold ba-text-sm">
                                        シャッタースピード
                                    </div>
                                    <div class="ba-text-xs ba-text-muted">
                                        F値とISOから適正秒数を計算
                                    </div>
                                </div>
                            </label>
                            <label
                                class="ba-flex ba-items-center ba-gap-3"
                                style={{
                                    padding: "0.75rem",
                                    border: "1px solid var(--ba-border)",
                                    "border-radius": "var(--ba-radius)",
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="solveTarget"
                                    class="ba-radio"
                                    checked={solveTarget() === "aperture"}
                                    onChange={() =>
                                        setSolveTarget("aperture")
                                    }
                                    aria-label="絞り値を自動計算する"
                                />
                                <div>
                                    <div class="ba-font-bold ba-text-sm">
                                        絞り (F値)
                                    </div>
                                    <div class="ba-text-xs ba-text-muted">
                                        秒数とISOから適正F値を計算
                                    </div>
                                </div>
                            </label>
                            <label
                                class="ba-flex ba-items-center ba-gap-3"
                                style={{
                                    padding: "0.75rem",
                                    border: "1px solid var(--ba-border)",
                                    "border-radius": "var(--ba-radius)",
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="radio"
                                    name="solveTarget"
                                    class="ba-radio"
                                    checked={solveTarget() === "iso"}
                                    onChange={() => setSolveTarget("iso")}
                                    aria-label="ISO感度を自動計算する"
                                />
                                <div>
                                    <div class="ba-font-bold ba-text-sm">
                                        ISO感度
                                    </div>
                                    <div class="ba-text-xs ba-text-muted">
                                        F値と秒数から適正ISOを計算
                                    </div>
                                </div>
                            </label>
                        </div>

                        <h2
                            class="ba-section-title"
                            style={{
                                "border-bottom": "1px solid var(--ba-border)",
                                "padding-bottom": "0.5rem",
                                "padding-top": "0.5rem",
                            }}
                        >
                            3. 固定パラメータの設定
                        </h2>
                        <div class="ba-grid-3">
                            {/* 絞り値 (F値) */}
                            <div
                                class="ba-field"
                                style={
                                    solveTarget() === "aperture"
                                        ? { opacity: 0.4, "pointer-events": "none" }
                                        : undefined
                                }
                            >
                                <label class="ba-label" for="sim-aperture-select">
                                    <span>絞り (F値)</span>
                                </label>
                                <select
                                    id="sim-aperture-select"
                                    class="ba-select"
                                    value={simAperture()}
                                    disabled={solveTarget() === "aperture"}
                                    onChange={(e) => {
                                        const v = parseFloat(
                                            e.currentTarget.value,
                                        );
                                        setSimAperture(
                                            Number.isFinite(v) ? v : 2.8,
                                        );
                                    }}
                                    aria-label="固定絞り値選択"
                                >
                                    <For each={STANDARD_APERTURES}>
                                        {(ap) => (
                                            <option value={ap}>f/{ap}</option>
                                        )}
                                    </For>
                                </select>
                            </div>

                            {/* シャッタースピード */}
                            <div
                                class="ba-field"
                                style={
                                    solveTarget() === "shutter"
                                        ? { opacity: 0.4, "pointer-events": "none" }
                                        : undefined
                                }
                            >
                                <label class="ba-label" for="sim-shutter-select">
                                    <span>シャッタースピード</span>
                                </label>
                                <select
                                    id="sim-shutter-select"
                                    class="ba-select"
                                    value={simShutter()}
                                    disabled={solveTarget() === "shutter"}
                                    onChange={(e) => {
                                        const v = parseFloat(
                                            e.currentTarget.value,
                                        );
                                        setSimShutter(
                                            Number.isFinite(v) ? v : 1 / 125,
                                        );
                                    }}
                                    aria-label="固定シャッタースピード選択"
                                >
                                    <For each={STANDARD_SHUTTER_SPEEDS}>
                                        {(s) => (
                                            <option value={s.value}>
                                                {s.label}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>

                            {/* ISO感度 */}
                            <div
                                class="ba-field"
                                style={
                                    solveTarget() === "iso"
                                        ? { opacity: 0.4, "pointer-events": "none" }
                                        : undefined
                                }
                            >
                                <label class="ba-label" for="sim-iso-select">
                                    <span>ISO感度</span>
                                </label>
                                <select
                                    id="sim-iso-select"
                                    class="ba-select"
                                    value={simIso()}
                                    disabled={solveTarget() === "iso"}
                                    onChange={(e) => {
                                        const v = parseInt(
                                            e.currentTarget.value,
                                            10,
                                        );
                                        setSimIso(
                                            Number.isFinite(v) ? v : 100,
                                        );
                                    }}
                                    aria-label="固定ISO感度選択"
                                >
                                    <For each={STANDARD_ISOS}>
                                        {(iso) => (
                                            <option value={iso}>
                                                ISO {iso}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                        </div>

                        {/* NDフィルター減光段数 */}
                        <div class="ba-field" style={{ "max-width": "28rem" }}>
                            <label class="ba-label" for="sim-nd-select">
                                <span>NDフィルター (減光段数)</span>
                            </label>
                            <select
                                id="sim-nd-select"
                                class="ba-select"
                                value={simNdStops()}
                                onChange={(e) => {
                                    const v = parseFloat(e.currentTarget.value);
                                    setSimNdStops(
                                        Number.isFinite(v) ? v : 0,
                                    );
                                }}
                                aria-label="シミュレーターNDフィルター選択"
                            >
                                <For each={ND_FILTER_PRESETS}>
                                    {(nd) => (
                                        <option value={nd.stops}>
                                            {nd.name}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </div>
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 2. ND長秒露光 & バルブタイマー */}
            {/* ======================================================== */}
            <Show when={activeTab() === "nd-bulb"}>
                <form
                    class="ba-stack-6"
                    {...({
                        toolname: "camera-nd-long-exposure",
                        tooldescription:
                            "NDフィルターなしの基準シャッタースピードとND減光段数から、必要な長秒露光時間を計算しタイマーを実行します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div class="ba-card ba-stack-4">
                        <h2
                            class="ba-section-title"
                            style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                        >
                            1. NDなしの基準シャッタースピード
                        </h2>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                            フィルター未装着の状態でカメラの露出計またはテスト撮影で得られた適正シャッタースピードを選択してください。
                        </p>
                        <div class="ba-field" style={{ "max-width": "28rem" }}>
                            <label class="ba-label" for="nd-base-shutter-select">
                                <span>基準シャッタースピード</span>
                            </label>
                            <select
                                id="nd-base-shutter-select"
                                class="ba-select"
                                value={ndBaseShutter()}
                                onChange={(e) => {
                                    const v = parseFloat(e.currentTarget.value);
                                    setNdBaseShutter(
                                        Number.isFinite(v) ? v : 1 / 125,
                                    );
                                }}
                                aria-label="ND基準シャッタースピード選択"
                            >
                                <For each={STANDARD_SHUTTER_SPEEDS}>
                                    {(s) => (
                                        <option value={s.value}>
                                            {s.label}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </div>

                        <h2
                            class="ba-section-title"
                            style={{
                                "border-bottom": "1px solid var(--ba-border)",
                                "padding-bottom": "0.5rem",
                                "padding-top": "0.5rem",
                            }}
                        >
                            2. 装着するNDフィルター
                        </h2>
                        <div class="ba-grid-2" style={{ "max-width": "32rem" }}>
                            <div class="ba-field">
                                <label class="ba-label" for="nd-filter-select">
                                    <span>NDフィルター選択</span>
                                </label>
                                <select
                                    id="nd-filter-select"
                                    class="ba-select"
                                    value={selectedNdFilter()}
                                    onChange={(e) =>
                                        setSelectedNdFilter(e.currentTarget.value)
                                    }
                                    aria-label="NDフィルター選択"
                                >
                                    <For each={ND_FILTER_PRESETS}>
                                        {(p) => (
                                            <option value={p.id}>
                                                {p.name}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                            <Show when={selectedNdFilter() === "custom"}>
                                <div class="ba-field">
                                    <label class="ba-label" for="custom-nd-input">
                                        <span>減光段数 (Stops)</span>
                                    </label>
                                    <input
                                        id="custom-nd-input"
                                        type="number"
                                        min="0"
                                        max="25"
                                        step="0.5"
                                        class="ba-input"
                                        placeholder="例: 10"
                                        value={customNdStops()}
                                        onInput={(e) => {
                                            const raw =
                                                e.currentTarget.value;
                                            if (raw === "") {
                                                setCustomNdStops("");
                                                return;
                                            }
                                            const v = parseFloat(raw);
                                            if (Number.isFinite(v)) {
                                                setCustomNdStops(
                                                    Math.max(0, v),
                                                );
                                            }
                                        }}
                                        aria-label="カスタムND減光段数入力"
                                    />
                                </div>
                            </Show>
                        </div>
                    </div>

                    {/* ND計算結果 & バルブタイマーカード */}
                    <div class="ba-card ba-stack-4">
                        <h2
                            class="ba-section-title"
                            style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                        >
                            長秒露光時間 & バルブ撮影タイマー
                        </h2>

                        <div
                            class="ba-panel ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-4"
                            style={{ padding: "1.5rem", "border-radius": "var(--ba-radius-lg)" }}
                        >
                            <div>
                                <div class="ba-text-xs ba-text-muted ba-font-bold">
                                    ND装着後の必要露光時間
                                </div>
                                <div
                                    class="ba-font-black ba-text-primary"
                                    style={{ "font-size": "2rem", "line-height": 1.15, "margin-top": "0.25rem" }}
                                >
                                    {formatShutterSpeed(
                                        ndCalculatedSeconds(),
                                    )}
                                </div>
                                <div class="ba-text-xs ba-text-muted" style={{ "margin-top": "0.25rem" }}>
                                    減光段数: {activeNdStops().toFixed(1)} stops
                                    (光量{" "}
                                    {(
                                        (1 / Math.pow(2, activeNdStops())) *
                                        100
                                    ).toFixed(4)}
                                    %)
                                </div>
                            </div>
                            <button
                                type="button"
                                class="ba-btn ba-btn--outline ba-text-primary"
                                onClick={() => setTimerFromNd()}
                            >
                                タイマーにセット
                            </button>
                        </div>

                        {/* カウントダウン表示エリア */}
                        <div
                            class="ba-panel ba-text-center ba-stack-2"
                            style={{ padding: "1.5rem", "border-radius": "var(--ba-radius-lg)" }}
                        >
                            <div class="ba-text-xs ba-text-muted ba-font-bold">
                                バルブ露光タイマー (残り時間)
                            </div>
                            <div
                                class={`ba-mono ba-font-black ${isTimerRunning() ? "ba-text-primary" : ""}`}
                                style={{ "font-size": "3.25rem", "line-height": 1.1, "margin-block": "0.25rem" }}
                            >
                                {Math.floor(timerRemainingSeconds() / 60)}:
                                {String(
                                    timerRemainingSeconds() % 60,
                                ).padStart(2, "0")}
                            </div>
                            <div class="ba-text-xs ba-text-muted">
                                合計設定時間:{" "}
                                {formatShutterSpeed(timerTotalSeconds())}
                            </div>

                            {/* コントロールボタン */}
                            <div class="ba-flex ba-justify-center ba-items-center ba-gap-3" style={{ "margin-top": "1rem" }}>
                                <button
                                    type="button"
                                    class={`ba-btn ${isTimerRunning() ? "ba-btn--warning" : "ba-btn--primary"}`}
                                    style={{ "padding-inline": "2rem" }}
                                    onClick={(e) =>
                                        toggleTimer(e.currentTarget)
                                    }
                                >
                                    {isTimerRunning() ? "一時停止" : "スタート"}
                                </button>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline"
                                    onClick={(e) =>
                                        resetTimer(e.currentTarget)
                                    }
                                >
                                    リセット
                                </button>
                            </div>

                            <div class="ba-flex ba-justify-center ba-items-center" style={{ "margin-top": "0.75rem" }}>
                                <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-text-muted" style={{ cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        class="ba-checkbox"
                                        checked={soundAlert()}
                                        onChange={(e) =>
                                            setSoundAlert(
                                                e.currentTarget.checked,
                                            )
                                        }
                                        aria-label="露光完了時にチャイム音で通知する"
                                    />
                                    <span>
                                        露光完了時にアラーム音で通知
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 3. 等価露出換算 */}
            {/* ======================================================== */}
            <Show when={activeTab() === "equivalent"}>
                <form
                    class="ba-stack-6"
                    {...({
                        toolname: "camera-equivalent-exposure",
                        tooldescription:
                            "露出を一定に保ったまま、絞り・シャッター速度・ISO・NDフィルターの組み合わせを相互に換算します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div class="ba-card ba-stack-4">
                        <h2
                            class="ba-section-title"
                            style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                        >
                            1. 現在の基準設定 (ベース露出)
                        </h2>
                        <div class="ba-grid-3">
                            <div class="ba-field">
                                <label class="ba-label" for="eq-base-aperture">
                                    <span>絞り (F値)</span>
                                </label>
                                <select
                                    id="eq-base-aperture"
                                    class="ba-select"
                                    value={eqBaseAperture()}
                                    onChange={(e) => {
                                        const v = parseFloat(
                                            e.currentTarget.value,
                                        );
                                        setEqBaseAperture(
                                            Number.isFinite(v) ? v : 8.0,
                                        );
                                    }}
                                    aria-label="ベース絞り値"
                                >
                                    <For each={STANDARD_APERTURES}>
                                        {(v) => (
                                            <option value={v}>f/{v}</option>
                                        )}
                                    </For>
                                </select>
                            </div>
                            <div class="ba-field">
                                <label class="ba-label" for="eq-base-shutter">
                                    <span>シャッタースピード</span>
                                </label>
                                <select
                                    id="eq-base-shutter"
                                    class="ba-select"
                                    value={eqBaseShutter()}
                                    onChange={(e) => {
                                        const v = parseFloat(
                                            e.currentTarget.value,
                                        );
                                        setEqBaseShutter(
                                            Number.isFinite(v) ? v : 1 / 250,
                                        );
                                    }}
                                    aria-label="ベースシャッタースピード"
                                >
                                    <For each={STANDARD_SHUTTER_SPEEDS}>
                                        {(s) => (
                                            <option value={s.value}>
                                                {s.label}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                            <div class="ba-field">
                                <label class="ba-label" for="eq-base-iso">
                                    <span>ISO感度</span>
                                </label>
                                <select
                                    id="eq-base-iso"
                                    class="ba-select"
                                    value={eqBaseIso()}
                                    onChange={(e) => {
                                        const v = parseInt(
                                            e.currentTarget.value,
                                            10,
                                        );
                                        setEqBaseIso(
                                            Number.isFinite(v) ? v : 100,
                                        );
                                    }}
                                    aria-label="ベースISO感度"
                                >
                                    <For each={STANDARD_ISOS}>
                                        {(v) => (
                                            <option value={v}>
                                                ISO {v}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                        </div>
                        <div class="ba-text-xs ba-text-muted">
                            基準露出値: EV {eqBaseEv().toFixed(1)} (at ISO 100)
                        </div>

                        <h2
                            class="ba-section-title"
                            style={{
                                "border-bottom": "1px solid var(--ba-border)",
                                "padding-bottom": "0.5rem",
                                "padding-top": "0.5rem",
                            }}
                        >
                            2. 変更後の設定 (等しい露出を保つための換算)
                        </h2>

                        <div class="ba-stack-2">
                            <span class="ba-label">
                                自動計算で求めたいパラメータ
                            </span>
                            <div class="ba-flex ba-flex-wrap ba-gap-4">
                                <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                                    <input
                                        type="radio"
                                        name="eqTargetParam"
                                        class="ba-radio"
                                        checked={
                                            eqTargetParam() === "shutter"
                                        }
                                        onChange={() =>
                                            setEqTargetParam("shutter")
                                        }
                                        aria-label="換算シャッタースピードを求める"
                                    />
                                    <span class="ba-text-sm">
                                        シャッタースピードを求める
                                    </span>
                                </label>
                                <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                                    <input
                                        type="radio"
                                        name="eqTargetParam"
                                        class="ba-radio"
                                        checked={
                                            eqTargetParam() === "aperture"
                                        }
                                        onChange={() =>
                                            setEqTargetParam("aperture")
                                        }
                                        aria-label="換算絞り値を求める"
                                    />
                                    <span class="ba-text-sm">
                                        絞り(F値)を求める
                                    </span>
                                </label>
                                <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                                    <input
                                        type="radio"
                                        name="eqTargetParam"
                                        class="ba-radio"
                                        checked={eqTargetParam() === "iso"}
                                        onChange={() =>
                                            setEqTargetParam("iso")
                                        }
                                        aria-label="換算ISO感度を求める"
                                    />
                                    <span class="ba-text-sm">
                                        ISO感度を求める
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div class="ba-grid-3" style={{ "padding-top": "0.25rem" }}>
                            <div
                                class="ba-field"
                                style={
                                    eqTargetParam() === "aperture"
                                        ? { opacity: 0.4, "pointer-events": "none" }
                                        : undefined
                                }
                            >
                                <label class="ba-label" for="eq-new-aperture">
                                    <span>変更後 絞り (F値)</span>
                                </label>
                                <select
                                    id="eq-new-aperture"
                                    class="ba-select"
                                    value={eqNewAperture()}
                                    disabled={eqTargetParam() === "aperture"}
                                    onChange={(e) => {
                                        const v = parseFloat(
                                            e.currentTarget.value,
                                        );
                                        setEqNewAperture(
                                            Number.isFinite(v) ? v : 2.8,
                                        );
                                    }}
                                    aria-label="変更後絞り値"
                                >
                                    <For each={STANDARD_APERTURES}>
                                        {(v) => (
                                            <option value={v}>f/{v}</option>
                                        )}
                                    </For>
                                </select>
                            </div>
                            <div
                                class="ba-field"
                                style={
                                    eqTargetParam() === "shutter"
                                        ? { opacity: 0.4, "pointer-events": "none" }
                                        : undefined
                                }
                            >
                                <label class="ba-label" for="eq-new-shutter">
                                    <span>変更後 シャッター</span>
                                </label>
                                <select
                                    id="eq-new-shutter"
                                    class="ba-select"
                                    value={eqNewShutter()}
                                    disabled={eqTargetParam() === "shutter"}
                                    onChange={(e) => {
                                        const v = parseFloat(
                                            e.currentTarget.value,
                                        );
                                        setEqNewShutter(
                                            Number.isFinite(v) ? v : 1 / 1000,
                                        );
                                    }}
                                    aria-label="変更後シャッター"
                                >
                                    <For each={STANDARD_SHUTTER_SPEEDS}>
                                        {(s) => (
                                            <option value={s.value}>
                                                {s.label}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                            <div
                                class="ba-field"
                                style={
                                    eqTargetParam() === "iso"
                                        ? { opacity: 0.4, "pointer-events": "none" }
                                        : undefined
                                }
                            >
                                <label class="ba-label" for="eq-new-iso">
                                    <span>変更後 ISO感度</span>
                                </label>
                                <select
                                    id="eq-new-iso"
                                    class="ba-select"
                                    value={eqNewIso()}
                                    disabled={eqTargetParam() === "iso"}
                                    onChange={(e) => {
                                        const v = parseInt(
                                            e.currentTarget.value,
                                            10,
                                        );
                                        setEqNewIso(
                                            Number.isFinite(v) ? v : 100,
                                        );
                                    }}
                                    aria-label="変更後ISO"
                                >
                                    <For each={STANDARD_ISOS}>
                                        {(v) => (
                                            <option value={v}>
                                                ISO {v}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 換算結果 */}
                    <div
                        class="ba-card ba-stack-1"
                        style={{
                            background: "var(--ba-primary)",
                            color: "var(--ba-primary-fg)",
                            "border-color": "var(--ba-primary)",
                        }}
                    >
                        <div class="ba-text-xs ba-font-bold" style={{ opacity: 0.85 }}>
                            {eqResult().label}
                        </div>
                        <h3
                            class="ba-font-black"
                            style={{
                                "font-size": "2rem",
                                "line-height": 1.15,
                                margin: "0.2rem 0 0",
                                color: "var(--ba-primary-fg)",
                            }}
                        >
                            {eqResult().standard}
                        </h3>
                        <div class="ba-text-sm" style={{ opacity: 0.9, "margin-top": "0.2rem" }}>
                            計算値: {eqResult().exact}
                        </div>
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 4. 星空シャッター速度限界 */}
            {/* ======================================================== */}
            <Show when={activeTab() === "astro"}>
                <form
                    class="ba-stack-6"
                    {...({
                        toolname: "camera-astro-shutter-limit",
                        tooldescription:
                            "星景写真において地球の自転による星の流れを防ぎ、点像として写す限界露光時間を500ルールとNPFルールで計算します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div class="ba-card ba-stack-4">
                        <h2
                            class="ba-section-title"
                            style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                        >
                            星景・天体写真 露光限界速度の計算
                        </h2>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                            星景写真では、露出時間が長すぎると地球の自転によって星が点ではなく線状に流れてしまいます。点像を維持できる限界シャッター速度を算出します。
                        </p>

                        <div class="ba-grid-2">
                            <div class="ba-field">
                                <label class="ba-label" for="astro-sensor-select">
                                    <span>センサーサイズ</span>
                                </label>
                                <select
                                    id="astro-sensor-select"
                                    class="ba-select"
                                    value={astroSensor()}
                                    onChange={(e) =>
                                        setAstroSensor(e.currentTarget.value)
                                    }
                                    aria-label="センサーサイズ選択"
                                >
                                    <For each={SENSOR_PRESETS}>
                                        {(s) => (
                                            <option value={s.id}>
                                                {s.name}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                            <div class="ba-field">
                                <label class="ba-label" for="astro-focal-input">
                                    <span>レンズの焦点距離 (mm)</span>
                                </label>
                                <input
                                    id="astro-focal-input"
                                    type="number"
                                    min="4"
                                    max="1200"
                                    class="ba-input"
                                    placeholder="例: 24"
                                    value={astroFocalLength()}
                                    onInput={(e) => {
                                        const raw = e.currentTarget.value;
                                        if (raw === "") {
                                            setAstroFocalLength("");
                                            return;
                                        }
                                        const v = parseFloat(raw);
                                        if (Number.isFinite(v)) {
                                            setAstroFocalLength(
                                                Math.max(1, v),
                                            );
                                        }
                                    }}
                                    aria-label="焦点距離mm入力"
                                />
                            </div>
                        </div>

                        <div class="ba-grid-2">
                            <div class="ba-field">
                                <label class="ba-label" for="astro-aperture-select">
                                    <span>レンズの開放F値</span>
                                </label>
                                <select
                                    id="astro-aperture-select"
                                    class="ba-select"
                                    value={astroAperture()}
                                    onChange={(e) => {
                                        const v = parseFloat(
                                            e.currentTarget.value,
                                        );
                                        setAstroAperture(
                                            Number.isFinite(v) ? v : 2.8,
                                        );
                                    }}
                                    aria-label="星空撮影絞りF値選択"
                                >
                                    <option value="1.4">f/1.4</option>
                                    <option value="1.8">f/1.8</option>
                                    <option value="2.0">f/2.0</option>
                                    <option value="2.8">f/2.8</option>
                                    <option value="3.5">f/3.5</option>
                                    <option value="4.0">f/4.0</option>
                                </select>
                            </div>
                            <div class="ba-field">
                                <label class="ba-label" for="astro-crop-input">
                                    <span>
                                        クロップ係数:{" "}
                                        {typeof astroCropFactor() === "number"
                                            ? `${astroCropFactor()}x`
                                            : "1.0x"}{" "}
                                        (35mm換算:{" "}
                                        {(
                                            (typeof astroFocalLength() ===
                                            "number"
                                                ? (astroFocalLength() as number)
                                                : 24) *
                                            (typeof astroCropFactor() ===
                                            "number"
                                                ? (astroCropFactor() as number)
                                                : 1.0)
                                        ).toFixed(1)}
                                        mm)
                                    </span>
                                </label>
                                <input
                                    id="astro-crop-input"
                                    type="number"
                                    step="0.01"
                                    min="0.5"
                                    max="5.0"
                                    class="ba-input"
                                    placeholder="例: 1.0"
                                    disabled={astroSensor() !== "custom"}
                                    value={astroCropFactor()}
                                    onInput={(e) => {
                                        const raw = e.currentTarget.value;
                                        if (raw === "") {
                                            setAstroCropFactor("");
                                            return;
                                        }
                                        const v = parseFloat(raw);
                                        if (Number.isFinite(v)) {
                                            setAstroCropFactor(
                                                Math.max(0.1, v),
                                            );
                                        }
                                    }}
                                    aria-label="クロップ係数入力"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 星空結果カード */}
                    <div class="ba-grid-2">
                        <div class="ba-card ba-stack-2">
                            <div>
                                <span class="ba-badge ba-badge--primary">
                                    500ルール（従来基準）
                                </span>
                            </div>
                            <div class="ba-text-2xl ba-font-black ba-text-primary">
                                約 {astroResult().rule500} 秒
                            </div>
                            <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                                広角レンズでSNS投稿や一般的な鑑賞用途に適した伝統的な目安（500
                                ÷ 換算焦点距離）です。
                            </p>
                        </div>

                        <div class="ba-card ba-stack-2" style={{ "border-color": "var(--ba-primary)" }}>
                            <div>
                                <span class="ba-badge ba-badge--developer">
                                    NPFルール（現代高画素機・厳密推奨）
                                </span>
                            </div>
                            <div class="ba-text-2xl ba-font-black ba-text-primary">
                                約 {astroResult().npfRule} 秒
                            </div>
                            <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                                等倍鑑賞や高画素センサー（2400万〜6000万画素超）で星を完全に点像として捉えたい場合の高精度な推奨値です。
                            </p>
                        </div>
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 露出の基礎知識 & 撮影ヒントガイド */}
            {/* ======================================================== */}
            <div class="ba-card ba-stack-4">
                <h2
                    class="ba-section-title"
                    style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                >
                    露出の基礎知識と撮影テクニック
                </h2>
                <div class="ba-grid-3">
                    <div class="ba-panel ba-stack-2">
                        <h3 class="ba-font-bold ba-text-sm" style={{ margin: 0 }}>
                            絞り (F値)
                        </h3>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                            光の入る窓の大きさ。値を小さくする（f/1.4やf/2.8）と背景が大きくボケて光が多く入ります。絞り込む（f/8やf/11）と全体にピントが合います（パンフォーカス）。
                        </p>
                    </div>
                    <div class="ba-panel ba-stack-2">
                        <h3 class="ba-font-bold ba-text-sm" style={{ margin: 0 }}>
                            シャッタースピード
                        </h3>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                            光を取り込む時間の長さ。1/1000秒などの高速は動体をピタッと静止させ、手ブレを防ぎます。数秒〜数十秒の長秒露光は水流を絹のように滑らかに表現できます。
                        </p>
                    </div>
                    <div class="ba-panel ba-stack-2">
                        <h3 class="ba-font-bold ba-text-sm" style={{ margin: 0 }}>
                            ISO感度
                        </h3>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                            センサーが光を増幅する度合い。暗い場所でシャッター速度を稼げますが、数値を高くしすぎると写真にノイズ（ざらつき）が発生します。基本はISO 100等の低感度を保ちます。
                        </p>
                    </div>
                </div>

                <details class="ba-accordion">
                    <summary>
                        快晴時の基準則「Sunny 16 ルール」とは？
                    </summary>
                    <div class="ba-accordion-body ba-stack-2">
                        <p style={{ margin: 0 }}>
                            「Sunny 16 (サニーシックスティーン)」とは、露出計が普及する前から写真家に愛用されている経験則です。快晴の日中において、絞りを <strong style={{ color: "var(--ba-text)" }}>f/16</strong> に設定したとき、適正シャッタースピードは <strong style={{ color: "var(--ba-text)" }}>1 / (ISO感度) 秒</strong> になります。
                        </p>
                        <p style={{ margin: 0 }}>
                            例えば、ISO 100 なら 1/100秒（カメラ標準で 1/125秒）、ISO 400 なら 1/400秒（標準で 1/500秒）が適正露出（EV 15）となります。
                        </p>
                    </div>
                </details>

                <details class="ba-accordion">
                    <summary>
                        NDフィルターを活用した長秒露光撮影のコツ
                    </summary>
                    <div class="ba-accordion-body">
                        <ul style={{ "padding-left": "1.25rem", margin: 0, display: "flex", "flex-direction": "column", gap: "0.35rem" }}>
                            <li>
                                <strong style={{ color: "var(--ba-text)" }}>三脚とレリーズ（リモコン）を使用する:</strong> 1秒以上の露光では手持ち撮影が不可能になります。頑丈な三脚にカメラを固定し、シャッターボタンを直接押すときのブレを防ぐためリモコンや2秒タイマーを活用しましょう。
                            </li>
                            <li>
                                <strong style={{ color: "var(--ba-text)" }}>手ブレ補正（IBIS/レンズ手ブレ補正）をOFFにする:</strong> 三脚使用時に手ブレ補正がONのままだと、カメラが微小な誤検知をしてかえって像がブレてしまう現象（揺り戻し）が起きることがあります。
                            </li>
                            <li>
                                <strong style={{ color: "var(--ba-text)" }}>ファインダーからの逆入射光を防ぐ（一眼レフの場合）:</strong> 一眼レフカメラではファインダーのアイピースから光が逆流して測光や露光に影響するため、アイピースシャッターを閉じるか遮光カバーをかけます。
                            </li>
                        </ul>
                    </div>
                </details>
            </div>

            {/* 広告エリア */}
            <AdSense />
        </div>
    );
}
