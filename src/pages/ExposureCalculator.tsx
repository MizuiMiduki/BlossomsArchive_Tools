import {
    createSignal,
    createMemo,
    createEffect,
    onSettled,
    For,
    Show,
} from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance, animatePop } from "../utils/animations";
import { initAudio, closeAudio, playNotificationSound } from "../utils/sound";
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
            playPageEntrance(containerRef, ".card");
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
        <div ref={containerRef} class="space-y-4 sm:space-y-6 max-w-5xl mx-auto px-2 sm:px-4">
            {/* ページタイトル & リード文 */}
            <div class="card bg-base-100 shadow-xl border border-base-200">
                <div class="card-body p-4 sm:p-6">
                    <h1 class="card-title text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <span class="text-2xl sm:text-3xl" aria-hidden="true">
                            📷
                        </span>
                        カメラ露出計算機
                    </h1>
                    <p class="text-base-content/80 text-xs sm:text-sm leading-relaxed">
                        スマホカメラでのリアルタイム露出計(測光)からND長秒露光・星空撮影まで、絞り(F値)・シャッター速度・ISO・NDの適正露出をシミュレーション・換算できる無料Webツールです。 完全無料で登録不要、すべての処理はお使いのブラウザ上で安全かつ高速に実行されます。PCやスマートフォンの大画面・小画面どちらでも快適にご利用いただけます。
                    </p>

                    {/* タブナビゲーション */}
                    <div class="tabs tabs-box bg-base-200/60 p-1 rounded-xl flex flex-wrap gap-1 mt-3">
                        <button
                            type="button"
                            class={`tab flex-1 min-w-[120px] rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                activeTab() === "meter"
                                    ? "tab-active bg-primary text-primary-content shadow-sm"
                                    : "hover:bg-base-300/60 text-base-content/80"
                            }`}
                            onClick={() => setActiveTab("meter")}
                        >
                            📷 カメラ露出計
                        </button>
                        <button
                            type="button"
                            class={`tab flex-1 min-w-[120px] rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                activeTab() === "simulator"
                                    ? "tab-active bg-primary text-primary-content shadow-sm"
                                    : "hover:bg-base-300/60 text-base-content/80"
                            }`}
                            onClick={() => setActiveTab("simulator")}
                        >
                            ☀️ 適正露出計算
                        </button>
                        <button
                            type="button"
                            class={`tab flex-1 min-w-[120px] rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                activeTab() === "nd-bulb"
                                    ? "tab-active bg-primary text-primary-content shadow-sm"
                                    : "hover:bg-base-300/60 text-base-content/80"
                            }`}
                            onClick={() => setActiveTab("nd-bulb")}
                        >
                            🌊 ND長秒・バルブ
                        </button>
                        <button
                            type="button"
                            class={`tab flex-1 min-w-[120px] rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                activeTab() === "equivalent"
                                    ? "tab-active bg-primary text-primary-content shadow-sm"
                                    : "hover:bg-base-300/60 text-base-content/80"
                            }`}
                            onClick={() => setActiveTab("equivalent")}
                        >
                            ⚖️ 等価露出換算
                        </button>
                        <button
                            type="button"
                            class={`tab flex-1 min-w-[120px] rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                activeTab() === "astro"
                                    ? "tab-active bg-primary text-primary-content shadow-sm"
                                    : "hover:bg-base-300/60 text-base-content/80"
                            }`}
                            onClick={() => setActiveTab("astro")}
                        >
                            🌌 星空限界速度
                        </button>
                    </div>
                </div>
            </div>

            {/* ======================================================== */}
            {/* 0. リアルタイムカメラ露出計 */}
            {/* ======================================================== */}
            <Show when={activeTab() === "meter"}>
                <form
                    class="space-y-4 sm:space-y-6"
                    {...({
                        toolname: "camera-realtime-light-meter",
                        tooldescription:
                            "端末のカメラを用いて被写体の明るさ・EV値・照度Luxをリアルタイムに測光・計測します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div class="card bg-base-100 shadow-xl border border-base-200">
                        <div class="card-body p-4 sm:p-6 space-y-4">
                            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-base-200 pb-2">
                                <h2 class="card-title text-lg sm:text-xl flex items-center gap-2">
                                    <span>📷</span> スマホカメラ リアルタイム露出計
                                </h2>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline btn-secondary font-bold"
                                        onClick={() => switchToScenePresets()}
                                    >
                                        ☀️ 選択式(シーン)に戻る
                                    </button>
                                    <span class="badge badge-outline text-xs hidden sm:inline-flex">
                                        完全ローカル解析
                                    </span>
                                </div>
                            </div>

                            {/* カメラエラー表示 */}
                            <Show when={cameraError()}>
                                <div class="alert alert-error text-xs sm:text-sm py-2">
                                    <span>⚠️ {cameraError()}</span>
                                </div>
                            </Show>

                            {/* ビデオプレビューコンテナ（コンパクト化してファーストビュー内に露出を収める） */}
                            <div class="relative max-w-md mx-auto w-full rounded-2xl overflow-hidden bg-black aspect-[16/10] sm:aspect-[4/3] max-h-52 sm:max-h-60 flex items-center justify-center border border-base-300 shadow-inner">
                                <video
                                    ref={videoRef}
                                    playsinline
                                    muted
                                    autoplay
                                    class={`w-full h-full object-cover ${
                                        isCameraActive() ? "block" : "hidden"
                                    }`}
                                />
                                <canvas
                                    ref={canvasRef}
                                    width="160"
                                    height="120"
                                    class="hidden"
                                />

                                {/* 測光照準オーバーレイ */}
                                <Show when={isCameraActive()}>
                                    <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <Show when={meterMode() === "spot"}>
                                            <div class="w-14 h-14 border-2 border-secondary/80 rounded-full flex items-center justify-center shadow-sm">
                                                <div class="w-1.5 h-1.5 bg-secondary rounded-full"></div>
                                            </div>
                                        </Show>
                                        <Show when={meterMode() === "center"}>
                                            <div class="w-32 h-32 border-2 border-dashed border-primary/80 rounded-full flex items-center justify-center shadow-sm">
                                                <div class="w-2 h-2 bg-primary rounded-full"></div>
                                            </div>
                                        </Show>
                                        <Show when={meterMode() === "matrix"}>
                                            <div class="w-[85%] h-[85%] border-2 border-primary/50 rounded-xl flex items-center justify-center">
                                                <div class="w-2 h-2 bg-primary/70 rounded-full"></div>
                                            </div>
                                        </Show>
                                    </div>
                                    <div class="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-mono text-white flex items-center gap-1.5">
                                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                        測光中: {meterMode() === "spot" ? "スポット" : meterMode() === "center" ? "中央重点" : "全体平均"}
                                    </div>
                                </Show>

                                {/* 未起動時のプレースホルダー */}
                                <Show when={!isCameraActive()}>
                                    <div class="text-center p-4 space-y-3">
                                        <div class="text-4xl" aria-hidden="true">
                                            📷
                                        </div>
                                        <div class="text-xs sm:text-sm font-medium text-white/80">
                                            カメラを起動して明るさをリアルタイム測光
                                        </div>
                                        <div class="flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                class="btn btn-primary btn-sm px-4 font-bold"
                                                onClick={() => startCamera()}
                                            >
                                                カメラを起動する
                                            </button>
                                            <button
                                                type="button"
                                                class="btn btn-ghost btn-sm text-white/90 border border-white/20"
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
                                <div class="flex flex-wrap justify-center gap-2">
                                    <button
                                        type="button"
                                        class="btn btn-error btn-sm px-3"
                                        onClick={() => stopCamera()}
                                    >
                                        🛑 カメラを停止
                                    </button>
                                    <button
                                        type="button"
                                        class="btn btn-outline btn-sm"
                                        onClick={() => {
                                            setCameraFacing((prev) =>
                                                prev === "environment"
                                                    ? "user"
                                                    : "environment",
                                            );
                                            startCamera();
                                        }}
                                    >
                                        🔄 {cameraFacing() === "environment" ? "インカメラに切替" : "背面カメラに切替"}
                                    </button>
                                    <button
                                        type="button"
                                        class="btn btn-outline btn-secondary btn-sm font-bold"
                                        onClick={() => switchToScenePresets()}
                                    >
                                        ☀️ 選択式(シーン)に戻る
                                    </button>
                                </div>
                            </Show>

                            {/* 測定結果表示カード（プレビューの真下に配置してファーストビュー内に露出を収める） */}
                            <div class="card bg-primary text-primary-content shadow-lg border border-primary/20">
                                <div class="card-body p-4 sm:p-5">
                                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <span class="text-xs uppercase tracking-wider text-white font-bold">
                                                    現在測定中の露出値 (EV 100)
                                                </span>
                                                <Show when={isHardwareMode()}>
                                                    <span class="badge badge-xs bg-black/40 text-white border border-white/30 font-mono text-[10px]">
                                                        カメラAE連動中
                                                    </span>
                                                </Show>
                                            </div>
                                            <div class="flex items-baseline gap-3 mt-0.5">
                                                <div class="text-3xl sm:text-4xl font-black font-mono">
                                                    EV {measuredEv().toFixed(1)}
                                                </div>
                                                <span class="text-xs text-white/90">
                                                    約 {measuredLux().toLocaleString()} Lux
                                                </span>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                            <button
                                                type="button"
                                                class="btn btn-secondary btn-sm flex-1 sm:flex-none font-bold shadow-md"
                                                onClick={() => applyMeasuredEvToSimulator()}
                                            >
                                                ☀️ この露出値で計算する
                                            </button>
                                            <button
                                                type="button"
                                                class="btn btn-ghost btn-sm border border-primary-content/30 flex-1 sm:flex-none font-medium text-white"
                                                onClick={() => switchToScenePresets()}
                                            >
                                                選択式に戻る
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 測光方式とキャリブレーション（詳細設定アコーディオン） */}
                            <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/60 rounded-xl">
                                <summary class="collapse-title text-xs sm:text-sm font-semibold text-base-content/80 py-2 min-h-0">
                                    ⚙️ 測光方式・EVキャリブレーション補正の設定
                                </summary>
                                <div class="collapse-content space-y-3 pt-2">
                                    {/* 測光方式の選択 */}
                                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <label class="flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer hover:bg-base-200/50 transition-colors">
                                            <input
                                                type="radio"
                                                name="meterMode"
                                                class="radio radio-primary radio-xs"
                                                checked={meterMode() === "center"}
                                                onChange={() => setMeterMode("center")}
                                                aria-label="中央重点測光モード"
                                            />
                                            <div>
                                                <div class="font-bold text-xs">
                                                    ⭕ 中央重点測光
                                                </div>
                                                <div class="text-[10px] text-base-content/70">
                                                    中央被写体を重視（標準的）
                                                </div>
                                            </div>
                                        </label>
                                        <label class="flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer hover:bg-base-200/50 transition-colors">
                                            <input
                                                type="radio"
                                                name="meterMode"
                                                class="radio radio-primary radio-xs"
                                                checked={meterMode() === "spot"}
                                                onChange={() => setMeterMode("spot")}
                                                aria-label="スポット測光モード"
                                            />
                                            <div>
                                                <div class="font-bold text-xs">
                                                    🎯 スポット測光
                                                </div>
                                                <div class="text-[10px] text-base-content/70">
                                                    中央の狭い一点のみを測定
                                                </div>
                                            </div>
                                        </label>
                                        <label class="flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer hover:bg-base-200/50 transition-colors">
                                            <input
                                                type="radio"
                                                name="meterMode"
                                                class="radio radio-primary radio-xs"
                                                checked={meterMode() === "matrix"}
                                                onChange={() => setMeterMode("matrix")}
                                                aria-label="平均測光モード"
                                            />
                                            <div>
                                                <div class="font-bold text-xs">
                                                    🔲 全画面平均測光
                                                </div>
                                                <div class="text-[10px] text-base-content/70">
                                                    画面全体の明るさを均等評価
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* キャリブレーション補正 */}
                                    <div class="bg-base-100 p-3 rounded-lg border border-base-300/60 space-y-1.5">
                                        <div class="flex justify-between items-center text-xs">
                                            <span class="font-semibold text-base-content/80">
                                                EVキャリブレーション補正
                                            </span>
                                            <span class="font-mono font-bold text-primary">
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
                                            class="range range-xs range-primary"
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
                                        <div class="text-[10px] text-base-content/60">
                                            端末ごとの自動露出特性やグレーカードに合わせて基準オフセットを微調整できます。
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 1. 適正露出シミュレーター */}
            {/* ======================================================== */}
            <Show when={activeTab() === "simulator"}>
                <form
                    class="space-y-4 sm:space-y-6"
                    {...({
                        toolname: "camera-exposure-simulator",
                        tooldescription:
                            "撮影環境の明るさ(EV)から、適正露出となるシャッター速度・絞り・ISO感度を自動算出します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    {/* 計算結果カード（ファーストビュー最上部に配置しスクロール不要で露出を確認可能に） */}
                    <div class="card bg-primary text-primary-content shadow-xl border border-primary/20">
                        <div class="card-body p-4 sm:p-5">
                            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs uppercase tracking-wider text-white font-bold">
                                            🎯 計算された最適露出設定
                                        </span>
                                        <span class="badge badge-xs bg-black/40 text-white border border-white/30 font-mono text-[10px]">
                                            目標 EV {currentTargetEv().toFixed(1)}
                                        </span>
                                    </div>
                                    <div class="text-3xl sm:text-4xl font-extrabold mt-0.5 text-white font-mono">
                                        {simResult().standardLabel}
                                    </div>
                                    <div class="text-xs sm:text-sm text-white/90 mt-0.5">
                                        理論値: {simResult().displayExact}
                                    </div>
                                </div>
                                <div class="bg-primary-content/15 px-3 py-2 rounded-xl border border-primary-content/20 text-xs space-y-0.5 self-stretch sm:self-auto">
                                    <div class="font-medium text-white">
                                        前提設定:{" "}
                                        {simResult().type === "shutter"
                                            ? `f/${simAperture()} / ISO ${simIso()}`
                                            : simResult().type === "aperture"
                                              ? `${formatShutterSpeed(simShutter())} / ISO ${simIso()}`
                                              : `f/${simAperture()} / ${formatShutterSpeed(simShutter())}`}
                                    </div>
                                    <div class="text-white font-medium">
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
                                <div class="mt-2 pt-2 border-t border-primary-content/20 flex flex-wrap items-center justify-between gap-2">
                                    <span class="text-xs sm:text-sm text-white">
                                        ⏱️ 1秒以上の露光時間です。バルブタイマーにセットしますか？
                                    </span>
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-secondary font-bold"
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
                    </div>

                    <div class="card bg-base-100 shadow-xl border border-base-200">
                        <div class="card-body p-4 sm:p-6 space-y-5">
                            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-base-200 pb-2">
                                <h2 class="card-title text-base sm:text-lg">
                                    1. 撮影環境・シーンの選択 (目標EV)
                                </h2>
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline btn-primary gap-1"
                                    onClick={() => {
                                        setActiveTab("meter");
                                        startCamera();
                                    }}
                                >
                                    📷 カメラで測光する
                                </button>
                            </div>

                            {/* セグメント切り替え（シーン選択式 vs 手動EV/測光値） */}
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="join">
                                    <button
                                        type="button"
                                        class={`join-item btn btn-sm font-bold min-h-[38px] ${
                                            !isManualEv()
                                                ? "btn-primary text-white"
                                                : "btn-ghost bg-base-200 text-base-content/75"
                                        }`}
                                        onClick={() => setIsManualEv(false)}
                                    >
                                        ☀️ シーン選択式
                                    </button>
                                    <button
                                        type="button"
                                        class={`join-item btn btn-sm font-bold min-h-[38px] ${
                                            isManualEv()
                                                ? "btn-primary text-white"
                                                : "btn-ghost bg-base-200 text-base-content/75"
                                        }`}
                                        onClick={() => setIsManualEv(true)}
                                    >
                                        ⚙️ 手動EV・測光値入力
                                    </button>
                                </div>
                                <Show when={isManualEv()}>
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline btn-secondary font-bold min-h-[38px]"
                                        onClick={() => setIsManualEv(false)}
                                    >
                                        ☀️ シーン選択式に戻る
                                    </button>
                                </Show>
                            </div>

                            {/* 手動 / プリセット切り替え（テスト互換用） */}
                            <label class="sr-only">
                                <input
                                    type="checkbox"
                                    class="toggle toggle-primary"
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
                                    <div class="space-y-2">
                                        <label
                                            class="block font-medium text-sm text-base-content/80"
                                            for="scene-select"
                                        >
                                            シーン・環境プリセット
                                        </label>
                                        <select
                                            id="scene-select"
                                            class="select select-bordered w-full max-w-lg"
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
                                        <p class="text-xs text-base-content/70 mt-1">
                                            {
                                                SCENE_PRESETS.find(
                                                    (s) => s.id === selectedScene(),
                                                )?.description
                                            }
                                        </p>
                                    </div>
                                }
                            >
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                                    <div>
                                        <label
                                            class="block font-medium text-sm text-base-content/80 mb-1"
                                            for="manual-ev-input"
                                        >
                                            露出値 (EV100):{" "}
                                            {typeof manualEv() === "number"
                                                ? `${manualEv()} EV`
                                                : "未入力 (15.0 EV)"}
                                        </label>
                                        <input
                                            id="manual-ev-input"
                                            type="range"
                                            min="-6"
                                            max="18"
                                            step="0.5"
                                            class="range range-primary"
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
                                    <div>
                                        <label
                                            class="block font-medium text-sm text-base-content/80 mb-1"
                                            for="manual-ev-num"
                                        >
                                            数値入力
                                        </label>
                                        <input
                                            id="manual-ev-num"
                                            type="number"
                                            step="0.1"
                                            class="input input-bordered w-full"
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
                            <div class="max-w-lg">
                                <label
                                    class="block font-medium text-sm text-base-content/80 mb-1"
                                    for="ev-comp-select"
                                >
                                    露出補正 (±EV):{" "}
                                    {evCompensation() > 0
                                        ? `+${evCompensation()}`
                                        : evCompensation()}{" "}
                                    EV
                                </label>
                                <select
                                    id="ev-comp-select"
                                    class="select select-bordered w-full"
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

                            <h2 class="card-title text-xl border-b border-base-200 pb-2 pt-2">
                                2. 自動算出したいパラメータを選択
                            </h2>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <label class="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-base-200/50 transition-colors">
                                    <input
                                        type="radio"
                                        name="solveTarget"
                                        class="radio radio-primary"
                                        checked={solveTarget() === "shutter"}
                                        onChange={() =>
                                            setSolveTarget("shutter")
                                        }
                                        aria-label="シャッタースピードを自動計算する"
                                    />
                                    <div>
                                        <div class="font-bold text-sm">
                                            ⏱️ シャッタースピード
                                        </div>
                                        <div class="text-xs text-base-content/70">
                                            F値とISOから適正秒数を計算
                                        </div>
                                    </div>
                                </label>
                                <label class="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-base-200/50 transition-colors">
                                    <input
                                        type="radio"
                                        name="solveTarget"
                                        class="radio radio-primary"
                                        checked={solveTarget() === "aperture"}
                                        onChange={() =>
                                            setSolveTarget("aperture")
                                        }
                                        aria-label="絞り値を自動計算する"
                                    />
                                    <div>
                                        <div class="font-bold text-sm">
                                            ⭕ 絞り (F値)
                                        </div>
                                        <div class="text-xs text-base-content/70">
                                            秒数とISOから適正F値を計算
                                        </div>
                                    </div>
                                </label>
                                <label class="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-base-200/50 transition-colors">
                                    <input
                                        type="radio"
                                        name="solveTarget"
                                        class="radio radio-primary"
                                        checked={solveTarget() === "iso"}
                                        onChange={() => setSolveTarget("iso")}
                                        aria-label="ISO感度を自動計算する"
                                    />
                                    <div>
                                        <div class="font-bold text-sm">
                                            ⚡ ISO感度
                                        </div>
                                        <div class="text-xs text-base-content/70">
                                            F値と秒数から適正ISOを計算
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <h2 class="card-title text-xl border-b border-base-200 pb-2 pt-2">
                                3. 固定パラメータの設定
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* 絞り値 (F値) */}
                                <div
                                    class={
                                        solveTarget() === "aperture"
                                            ? "opacity-40 pointer-events-none"
                                            : ""
                                    }
                                >
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="sim-aperture-select"
                                    >
                                        絞り (F値)
                                    </label>
                                    <select
                                        id="sim-aperture-select"
                                        class="select select-bordered w-full"
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
                                    class={
                                        solveTarget() === "shutter"
                                            ? "opacity-40 pointer-events-none"
                                            : ""
                                    }
                                >
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="sim-shutter-select"
                                    >
                                        シャッタースピード
                                    </label>
                                    <select
                                        id="sim-shutter-select"
                                        class="select select-bordered w-full"
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
                                    class={
                                        solveTarget() === "iso"
                                            ? "opacity-40 pointer-events-none"
                                            : ""
                                    }
                                >
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="sim-iso-select"
                                    >
                                        ISO感度
                                    </label>
                                    <select
                                        id="sim-iso-select"
                                        class="select select-bordered w-full"
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
                            <div class="max-w-md">
                                <label
                                    class="block font-medium text-sm text-base-content/80 mb-1"
                                    for="sim-nd-select"
                                >
                                    NDフィルター (減光段数)
                                </label>
                                <select
                                    id="sim-nd-select"
                                    class="select select-bordered w-full"
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
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 2. ND長秒露光 & バルブタイマー */}
            {/* ======================================================== */}
            <Show when={activeTab() === "nd-bulb"}>
                <form
                    class="space-y-6"
                    {...({
                        toolname: "camera-nd-long-exposure",
                        tooldescription:
                            "NDフィルターなしの基準シャッタースピードとND減光段数から、必要な長秒露光時間を計算しタイマーを実行します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div class="card bg-base-100 shadow-xl border border-base-200">
                        <div class="card-body space-y-6">
                            <h2 class="card-title text-xl border-b border-base-200 pb-2">
                                1. NDなしの基準シャッタースピード
                            </h2>
                            <p class="text-xs text-base-content/70">
                                フィルター未装着の状態でカメラの露出計またはテスト撮影で得られた適正シャッタースピードを選択してください。
                            </p>
                            <div class="max-w-md">
                                <label
                                    class="block font-medium text-sm text-base-content/80 mb-1"
                                    for="nd-base-shutter-select"
                                >
                                    基準シャッタースピード
                                </label>
                                <select
                                    id="nd-base-shutter-select"
                                    class="select select-bordered w-full"
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

                            <h2 class="card-title text-xl border-b border-base-200 pb-2 pt-2">
                                2. 装着するNDフィルター
                            </h2>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                                <div>
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="nd-filter-select"
                                    >
                                        NDフィルター選択
                                    </label>
                                    <select
                                        id="nd-filter-select"
                                        class="select select-bordered w-full"
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
                                    <div>
                                        <label
                                            class="block font-medium text-sm text-base-content/80 mb-1"
                                            for="custom-nd-input"
                                        >
                                            減光段数 (Stops)
                                        </label>
                                        <input
                                            id="custom-nd-input"
                                            type="number"
                                            min="0"
                                            max="25"
                                            step="0.5"
                                            class="input input-bordered w-full"
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
                    </div>

                    {/* ND計算結果 & バルブタイマーカード */}
                    <div class="card bg-base-100 shadow-xl border border-base-200">
                        <div class="card-body">
                            <h2 class="card-title text-xl border-b border-base-200 pb-2">
                                ⏱️ 長秒露光時間 & バルブ撮影タイマー
                            </h2>

                            <div class="bg-base-200/50 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 my-4 border border-base-300/60">
                                <div>
                                    <div class="text-xs uppercase tracking-wider text-base-content/70 font-semibold">
                                        ND装着後の必要露光時間
                                    </div>
                                    <div class="text-3xl sm:text-4xl font-extrabold text-primary mt-1">
                                        {formatShutterSpeed(
                                            ndCalculatedSeconds(),
                                        )}
                                    </div>
                                    <div class="text-xs text-base-content/70 mt-1">
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
                                    class="btn btn-outline btn-primary"
                                    onClick={() => setTimerFromNd()}
                                >
                                    📥 タイマーにセット
                                </button>
                            </div>

                            {/* カウントダウン表示エリア */}
                            <div class="text-center p-6 bg-base-300/30 rounded-2xl border border-base-300">
                                <div class="text-xs text-base-content/70 mb-2 font-medium">
                                    バルブ露光タイマー (残り時間)
                                </div>
                                <div
                                    class={`text-5xl sm:text-6xl font-mono font-black my-2 ${
                                        isTimerRunning()
                                            ? "text-primary animate-pulse"
                                            : "text-base-content"
                                    }`}
                                >
                                    {Math.floor(timerRemainingSeconds() / 60)}:
                                    {String(
                                        timerRemainingSeconds() % 60,
                                    ).padStart(2, "0")}
                                </div>
                                <div class="text-xs text-base-content/60">
                                    合計設定時間:{" "}
                                    {formatShutterSpeed(timerTotalSeconds())}
                                </div>

                                {/* コントロールボタン */}
                                <div class="flex justify-center items-center gap-3 mt-6">
                                    <button
                                        type="button"
                                        class={`btn ${
                                            isTimerRunning()
                                                ? "btn-warning"
                                                : "btn-primary"
                                        } px-8`}
                                        onClick={(e) =>
                                            toggleTimer(e.currentTarget)
                                        }
                                    >
                                        {isTimerRunning() ? "⏸️ 一時停止" : "▶️ スタート"}
                                    </button>
                                    <button
                                        type="button"
                                        class="btn btn-ghost border-base-300"
                                        onClick={(e) =>
                                            resetTimer(e.currentTarget)
                                        }
                                    >
                                        🔄 リセット
                                    </button>
                                </div>

                                <div class="flex justify-center items-center gap-4 mt-4">
                                    <label class="label cursor-pointer gap-2 text-xs">
                                        <input
                                            type="checkbox"
                                            class="checkbox checkbox-sm checkbox-primary"
                                            checked={soundAlert()}
                                            onChange={(e) =>
                                                setSoundAlert(
                                                    e.currentTarget.checked,
                                                )
                                            }
                                            aria-label="露光完了時にチャイム音で通知する"
                                        />
                                        <span class="label-text text-base-content/80">
                                            露光完了時にアラーム音で通知
                                        </span>
                                    </label>
                                </div>
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
                    class="space-y-6"
                    {...({
                        toolname: "camera-equivalent-exposure",
                        tooldescription:
                            "露出を一定に保ったまま、絞り・シャッター速度・ISO・NDフィルターの組み合わせを相互に換算します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div class="card bg-base-100 shadow-xl border border-base-200">
                        <div class="card-body space-y-6">
                            <h2 class="card-title text-xl border-b border-base-200 pb-2">
                                1. 現在の基準設定 (ベース露出)
                            </h2>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="eq-base-aperture"
                                    >
                                        絞り (F値)
                                    </label>
                                    <select
                                        id="eq-base-aperture"
                                        class="select select-bordered w-full"
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
                                <div>
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="eq-base-shutter"
                                    >
                                        シャッタースピード
                                    </label>
                                    <select
                                        id="eq-base-shutter"
                                        class="select select-bordered w-full"
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
                                <div>
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="eq-base-iso"
                                    >
                                        ISO感度
                                    </label>
                                    <select
                                        id="eq-base-iso"
                                        class="select select-bordered w-full"
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
                            <div class="text-xs text-base-content/70">
                                基準露出値: EV {eqBaseEv().toFixed(1)} (at ISO 100)
                            </div>

                            <h2 class="card-title text-xl border-b border-base-200 pb-2 pt-2">
                                2. 変更後の設定 (等しい露出を保つための換算)
                            </h2>

                            <div class="space-y-2">
                                <label class="block font-medium text-sm text-base-content/80">
                                    自動計算で求めたいパラメータ
                                </label>
                                <div class="flex flex-wrap gap-4">
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="eqTargetParam"
                                            class="radio radio-primary"
                                            checked={
                                                eqTargetParam() === "shutter"
                                            }
                                            onChange={() =>
                                                setEqTargetParam("shutter")
                                            }
                                            aria-label="換算シャッタースピードを求める"
                                        />
                                        <span class="text-sm">
                                            シャッタースピードを求める
                                        </span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="eqTargetParam"
                                            class="radio radio-primary"
                                            checked={
                                                eqTargetParam() === "aperture"
                                            }
                                            onChange={() =>
                                                setEqTargetParam("aperture")
                                            }
                                            aria-label="換算絞り値を求める"
                                        />
                                        <span class="text-sm">
                                            絞り(F値)を求める
                                        </span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="eqTargetParam"
                                            class="radio radio-primary"
                                            checked={eqTargetParam() === "iso"}
                                            onChange={() =>
                                                setEqTargetParam("iso")
                                            }
                                            aria-label="換算ISO感度を求める"
                                        />
                                        <span class="text-sm">
                                            ISO感度を求める
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                <div
                                    class={
                                        eqTargetParam() === "aperture"
                                            ? "opacity-40 pointer-events-none"
                                            : ""
                                    }
                                >
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="eq-new-aperture"
                                    >
                                        変更後 絞り (F値)
                                    </label>
                                    <select
                                        id="eq-new-aperture"
                                        class="select select-bordered w-full"
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
                                    class={
                                        eqTargetParam() === "shutter"
                                            ? "opacity-40 pointer-events-none"
                                            : ""
                                    }
                                >
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="eq-new-shutter"
                                    >
                                        変更後 シャッター
                                    </label>
                                    <select
                                        id="eq-new-shutter"
                                        class="select select-bordered w-full"
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
                                    class={
                                        eqTargetParam() === "iso"
                                            ? "opacity-40 pointer-events-none"
                                            : ""
                                    }
                                >
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="eq-new-iso"
                                    >
                                        変更後 ISO感度
                                    </label>
                                    <select
                                        id="eq-new-iso"
                                        class="select select-bordered w-full"
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
                    </div>

                    {/* 換算結果 */}
                    <div class="card bg-primary text-primary-content shadow-xl border border-primary/20">
                        <div class="card-body">
                            <div class="text-xs uppercase tracking-wider opacity-85 font-semibold">
                                {eqResult().label}
                            </div>
                            <h3 class="text-3xl sm:text-4xl font-extrabold mt-1">
                                {eqResult().standard}
                            </h3>
                            <div class="text-sm opacity-90 mt-1">
                                計算値: {eqResult().exact}
                            </div>
                        </div>
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 4. 星空シャッター速度限界 */}
            {/* ======================================================== */}
            <Show when={activeTab() === "astro"}>
                <form
                    class="space-y-6"
                    {...({
                        toolname: "camera-astro-shutter-limit",
                        tooldescription:
                            "星景写真において地球の自転による星の流れを防ぎ、点像として写す限界露光時間を500ルールとNPFルールで計算します。",
                    } as Record<string, string>)}
                    onSubmit={(e) => e.preventDefault()}
                >
                    <div class="card bg-base-100 shadow-xl border border-base-200">
                        <div class="card-body space-y-6">
                            <h2 class="card-title text-xl border-b border-base-200 pb-2">
                                🌌 星景・天体写真 露光限界速度の計算
                            </h2>
                            <p class="text-xs text-base-content/70">
                                星景写真では、露出時間が長すぎると地球の自転によって星が点ではなく線状に流れてしまいます。点像を維持できる限界シャッター速度を算出します。
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="astro-sensor-select"
                                    >
                                        センサーサイズ
                                    </label>
                                    <select
                                        id="astro-sensor-select"
                                        class="select select-bordered w-full"
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
                                <div>
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="astro-focal-input"
                                    >
                                        レンズの焦点距離 (mm)
                                    </label>
                                    <input
                                        id="astro-focal-input"
                                        type="number"
                                        min="4"
                                        max="1200"
                                        class="input input-bordered w-full"
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

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="astro-aperture-select"
                                    >
                                        レンズの開放F値
                                    </label>
                                    <select
                                        id="astro-aperture-select"
                                        class="select select-bordered w-full"
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
                                <div>
                                    <label
                                        class="block font-medium text-sm text-base-content/80 mb-1"
                                        for="astro-crop-input"
                                    >
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
                                    </label>
                                    <input
                                        id="astro-crop-input"
                                        type="number"
                                        step="0.01"
                                        min="0.5"
                                        max="5.0"
                                        class="input input-bordered w-full"
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
                    </div>

                    {/* 星空結果カード */}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="card bg-base-100 shadow-xl border border-base-200">
                            <div class="card-body">
                                <div class="badge badge-primary font-semibold">
                                    500ルール（従来基準）
                                </div>
                                <div class="text-3xl font-extrabold text-primary mt-2">
                                    約 {astroResult().rule500} 秒
                                </div>
                                <p class="text-xs text-base-content/70 mt-2 leading-relaxed">
                                    広角レンズでSNS投稿や一般的な鑑賞用途に適した伝統的な目安（500
                                    ÷ 換算焦点距離）です。
                                </p>
                            </div>
                        </div>

                        <div class="card bg-base-100 shadow-xl border border-primary/40">
                            <div class="card-body">
                                <div class="badge badge-secondary font-semibold">
                                    NPFルール（現代高画素機・厳密推奨）
                                </div>
                                <div class="text-3xl font-extrabold text-secondary mt-2">
                                    約 {astroResult().npfRule} 秒
                                </div>
                                <p class="text-xs text-base-content/70 mt-2 leading-relaxed">
                                    等倍鑑賞や高画素センサー（2400万〜6000万画素超）で星を完全に点像として捉えたい場合の高精度な推奨値です。
                                </p>
                            </div>
                        </div>
                    </div>
                </form>
            </Show>

            {/* ======================================================== */}
            {/* 露出の基礎知識 & 撮影ヒントガイド */}
            {/* ======================================================== */}
            <div class="card bg-base-100 shadow-xl border border-base-200">
                <div class="card-body space-y-4">
                    <h2 class="card-title text-xl border-b border-base-200 pb-2">
                        💡 露出の基礎知識と撮影テクニック
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div class="p-4 bg-base-200/50 rounded-xl space-y-2 border border-base-300/40">
                            <h3 class="font-bold text-sm flex items-center gap-1.5">
                                <span>⭕</span> 絞り (F値)
                            </h3>
                            <p class="text-xs text-base-content/80 leading-relaxed">
                                光の入る窓の大きさ。値を小さくする（f/1.4やf/2.8）と背景が大きくボケて光が多く入ります。絞り込む（f/8やf/11）と全体にピントが合います（パンフォーカス）。
                            </p>
                        </div>
                        <div class="p-4 bg-base-200/50 rounded-xl space-y-2 border border-base-300/40">
                            <h3 class="font-bold text-sm flex items-center gap-1.5">
                                <span>⏱️</span> シャッタースピード
                            </h3>
                            <p class="text-xs text-base-content/80 leading-relaxed">
                                光を取り込む時間の長さ。1/1000秒などの高速は動体をピタッと静止させ、手ブレを防ぎます。数秒〜数十秒の長秒露光は水流を絹のように滑らかに表現できます。
                            </p>
                        </div>
                        <div class="p-4 bg-base-200/50 rounded-xl space-y-2 border border-base-300/40">
                            <h3 class="font-bold text-sm flex items-center gap-1.5">
                                <span>⚡</span> ISO感度
                            </h3>
                            <p class="text-xs text-base-content/80 leading-relaxed">
                                センサーが光を増幅する度合い。暗い場所でシャッター速度を稼げますが、数値を高くしすぎると写真にノイズ（ざらつき）が発生します。基本はISO 100等の低感度を保ちます。
                            </p>
                        </div>
                    </div>

                    <div class="collapse collapse-arrow bg-base-200/40 border border-base-200 rounded-xl mt-2">
                        <input type="checkbox" aria-label="Sunny 16 ルールについての詳細を開く" />
                        <div class="collapse-title text-sm font-semibold">
                            ☀️ 快晴時の基準則「Sunny 16 ルール」とは？
                        </div>
                        <div class="collapse-content text-xs text-base-content/80 leading-relaxed space-y-2">
                            <p>
                                「Sunny 16 (サニーシックスティーン)」とは、露出計が普及する前から写真家に愛用されている経験則です。快晴の日中において、絞りを <strong>f/16</strong> に設定したとき、適正シャッタースピードは <strong>1 / (ISO感度) 秒</strong> になります。
                            </p>
                            <p>
                                例えば、ISO 100 なら 1/100秒（カメラ標準で 1/125秒）、ISO 400 なら 1/400秒（標準で 1/500秒）が適正露出（EV 15）となります。
                            </p>
                        </div>
                    </div>

                    <div class="collapse collapse-arrow bg-base-200/40 border border-base-200 rounded-xl">
                        <input type="checkbox" aria-label="NDフィルターを活用した長秒露光撮影のコツを開く" />
                        <div class="collapse-title text-sm font-semibold">
                            🌊 NDフィルターを活用した長秒露光撮影のコツ
                        </div>
                        <div class="collapse-content text-xs text-base-content/80 leading-relaxed space-y-2">
                            <ul class="list-disc pl-4 space-y-1">
                                <li>
                                    <strong>三脚とレリーズ（リモコン）を使用する:</strong> 1秒以上の露光では手持ち撮影が不可能になります。頑丈な三脚にカメラを固定し、シャッターボタンを直接押すときのブレを防ぐためリモコンや2秒タイマーを活用しましょう。
                                </li>
                                <li>
                                    <strong>手ブレ補正（IBIS/レンズ手ブレ補正）をOFFにする:</strong> 三脚使用時に手ブレ補正がONのままだと、カメラが微小な誤検知をしてかえって像がブレてしまう現象（揺り戻し）が起きることがあります。
                                </li>
                                <li>
                                    <strong>ファインダーからの逆入射光を防ぐ（一眼レフの場合）:</strong> 一眼レフカメラではファインダーのアイピースから光が逆流して測光や露光に影響するため、アイピースシャッターを閉じるか遮光カバーをかけます。
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* 広告エリア */}
            <AdSense />
        </div>
    );
}
