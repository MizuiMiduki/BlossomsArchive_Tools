import {
    createSignal,
    createEffect,
    createMemo,
    onSettled,
    Show,
} from "solid-js";
import AdSense from "../components/AdSense";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";
import {
    type OverlayMode,
    type CameraFacing,
    type AlphaBounds,
    type EnvironmentLighting,
    type GyroOrientation,
    clampFinite,
    analyzeImageAlphaBounds,
    estimateEnvironmentLighting,
    calculateProjectedShadowTransform,
    calculateGyroParallaxOffset,
    smoothDeviceOrientation,
    createShadowSilhouettePixels,
    createSafeObjectUrl,
    isSupportedImageFile,
    generateDepthOcclusionMaskPixels,
    estimateCharacterGroundDepth,
    estimateDistanceFromArDepth,
    analyzeGroundAndWallPlanes,
    generateSurfaceOverlayPixels,
    calculateApertureMaxBlurPx,
    generateDofOutOfFocusMaskPixels,
    calculatePerspectivePitchParams,
    projectVerticalPerspectiveT,
    estimateCameraPitchFromGyro,
    type FrameOrientationMode,
    resolveExportDimensions,
    selectSupportedVideoMimeType,
    formatRecordingTime,
    calculateScaleForCharacterHeight,
    estimateGroundTiltFromDepthMap,
    generateGroundShadowMaskPixels,
    estimateBackgroundScaleAndShift,
    calculateCharacterColorAdaptation,
} from "../utils/arCameraOverlay";

interface OverlayImageAsset {
    name: string;
    previewUrl: string;
    width: number;
    height: number;
    imgElement: HTMLImageElement;
    alphaBounds: AlphaBounds;
    silhouetteCanvas: HTMLCanvasElement;
}

interface BackgroundImageAsset {
    name: string;
    previewUrl: string;
    width: number;
    height: number;
    imgElement: HTMLImageElement;
}

export default function ArCameraOverlay() {
    const { title: pageTitle, description } = usePageI18n("/ar-camera", {
        defaultTitle: "ARカメラ・立ち絵重ね撮影",
        defaultDescription:
            "カメラ映像に立ち絵などの透過画像を重ねて撮影できる無料Webツールです。リアルな接地・投影影を計算するARモードと、画面上の自由な位置に固定できるオーバーレイモードの両方に対応しています。",
    });

    let containerRef: HTMLDivElement | undefined;
    let cameraStageRef: HTMLDivElement | undefined;
    let videoRef: HTMLVideoElement | undefined;
    let previewCanvasRef: HTMLCanvasElement | undefined;
    let overlayInputRef: HTMLInputElement | undefined;
    let bgInputRef: HTMLInputElement | undefined;
    let lightSampleCanvas: HTMLCanvasElement | undefined;

    let mediaStream: MediaStream | null = null;
    let rafId: number | null = null;
    let lastLightSampleTime = 0;

    // モード & カメラ状態
    const [mode, setMode] = createSignal<OverlayMode>("ar");
    const [cameraFacing, setCameraFacing] = createSignal<CameraFacing>("environment");
    const [isCameraActive, setIsCameraActive] = createSignal<boolean>(false);
    const [mirrorSelfie, setMirrorSelfie] = createSignal<boolean>(true);
    const [cameraError, setCameraError] = createSignal<string | null>(null);

    // カメラアプリ風UI状態（全画面・設定ドロワー・撮影プレビューモーダル）
    const [isFullscreen, setIsFullscreen] = createSignal<boolean>(false);
    const [showSettingsDrawer, setShowSettingsDrawer] = createSignal<boolean>(false);
    const [showCaptureModal, setShowCaptureModal] = createSignal<boolean>(false);

    // 画像アセット
    const [overlayAsset, setOverlayAsset] = createSignal<OverlayImageAsset | null>(null);
    const [bgAsset, setBgAsset] = createSignal<BackgroundImageAsset | null>(null);

    // 共通配置パラメータ
    const [posXPercent, setPosXPercent] = createSignal<number>(50);
    const [posYPercent, setPosYPercent] = createSignal<number>(78);
    const [scale, setScale] = createSignal<number>(0.65);

    // 前後配置（物の奥に立つ表現・ローカルWebGPU AI専用）
    const [occlusionPaintMode, setOcclusionPaintMode] = createSignal<boolean>(false);
    const [hasOcclusion, setHasOcclusion] = createSignal<boolean>(false);
    const [aiDepthMap, setAiDepthMap] = createSignal<{
        data: Float32Array;
        width: number;
        height: number;
        guideRgba?: Uint8ClampedArray;
        guideWidth?: number;
        guideHeight?: number;
    } | null>(null);
    const [aiDepthThreshold, setAiDepthThreshold] = createSignal<number>(0.55);
    const [aiDepthBusy, setAiDepthBusy] = createSignal<boolean>(false);
    const [aiDepthStatus, setAiDepthStatus] = createSignal<string>("");
    const [characterHeightCm, setCharacterHeightCm] = createSignal<number>(160);
    const [cameraDistanceM, setCameraDistanceM] = createSignal<number>(2.5);
    const [autoDistanceFromAr, setAutoDistanceFromAr] = createSignal<boolean>(true);
    const [visualTrackingEnabled, setVisualTrackingEnabled] = createSignal<boolean>(true);
    const [hasShadowCatcher, setHasShadowCatcher] = createSignal<boolean>(false);
    const [surfaceInfo, setSurfaceInfo] = createSignal<{
        groundPct: number;
        wallPct: number;
        horizonYRatio: number;
    } | null>(null);
    let surfaceOverlayCanvas: HTMLCanvasElement | undefined;
    let shadowCatcherCanvas: HTMLCanvasElement | undefined;
    let shadowLayerCanvas: HTMLCanvasElement | undefined;
    let litCharCanvas: HTMLCanvasElement | undefined;
    let trackCanvas: HTMLCanvasElement | undefined;
    let prevGrayFrame: Uint8Array | null = null;
    let visualOffsetRatioX = 0;
    let visualOffsetRatioY = 0;
    let visualZoomScale = 1;
    let visualBaseGyro: GyroOrientation | null = null;
    let lastVisualTrackTime = 0;
    let maskBaseGyro: GyroOrientation | null = null;
    let maskBaseVisualX = 0;
    let maskBaseVisualY = 0;
    let maskBaseZoomScale = 1;
    const OCCLUSION_MASK_SIZE = 512;
    let occlusionCanvas: HTMLCanvasElement | undefined;
    let characterLayerCanvas: HTMLCanvasElement | undefined;
    let dofBlurCanvas: HTMLCanvasElement | undefined;
    let dofMaskCanvas: HTMLCanvasElement | undefined;

    // 被写界深度（DoF）・フォーカス操作
    const [dofEnabled, setDofEnabled] = createSignal<boolean>(false);
    const [dofApertureF, setDofApertureF] = createSignal<number>(2.4);
    const [dofFocusDepth, setDofFocusDepth] = createSignal<number>(0.55);
    const [autoFocusOnCharacter, setAutoFocusOnCharacter] = createSignal<boolean>(true);
    const [hasDofMask, setHasDofMask] = createSignal<boolean>(false);

    // バックグラウンド復帰時にカメラを自動再開するためのフラグ
    let shouldResumeCamera = false;
    const [rotationDeg, setRotationDeg] = createSignal<number>(0);
    const [cameraPitchDeg, setCameraPitchDeg] = createSignal<number>(0);
    const [autoPitchFromGyro, setAutoPitchFromGyro] = createSignal<boolean>(true);
    const [opacity, setOpacity] = createSignal<number>(1.0);
    const [flipHorizontal, setFlipHorizontal] = createSignal<boolean>(false);

    // ARモード専用パラメータ（リアル影・接地・環境光・ジャイロ）
    const [lightAzimuthDeg, setLightAzimuthDeg] = createSignal<number>(315);
    const [lightElevationDeg, setLightElevationDeg] = createSignal<number>(42);
    const [groundTiltDeg, setGroundTiltDeg] = createSignal<number>(34);
    const [shadowOpacity, setShadowOpacity] = createSignal<number>(0.52);
    const [shadowSoftness, setShadowSoftness] = createSignal<number>(0.42);
    const [autoAmbientMatch, setAutoAmbientMatch] = createSignal<boolean>(true);
    const [autoLightDirection, setAutoLightDirection] = createSignal<boolean>(true);
    const [showArGrid, setShowArGrid] = createSignal<boolean>(true);

    // 環境光推定結果
    const [envLighting, setEnvLighting] = createSignal<EnvironmentLighting>({
        luminance: 0.55,
        ambientColor: { r: 140, g: 145, b: 155 },
        suggestedAzimuthDeg: 315,
        suggestedShadowOpacity: 0.45,
        brightnessMultiplier: 1.0,
    });

    // ジャイロ（空間固定）状態
    const [gyroEnabled, setGyroEnabled] = createSignal<boolean>(false);
    const [gyroStatus, setGyroStatus] = createSignal<string>("");
    const [baseGyro, setBaseGyro] = createSignal<GyroOrientation | null>(null);
    const [currentGyro, setCurrentGyro] = createSignal<GyroOrientation | null>(null);

    // 撮影結果・動画録画・向き設定
    const [capturedUrl, setCapturedUrl] = createSignal<string | null>(null);
    const [captureFormat, setCaptureFormat] = createSignal<"image/png" | "image/jpeg" | "image/webp">("image/png");
    const [frameOrientation, setFrameOrientation] = createSignal<FrameOrientationMode>("auto");
    const [isFlashActive, setIsFlashActive] = createSignal<boolean>(false);
    const [isRecording, setIsRecording] = createSignal<boolean>(false);
    const [recordingSeconds, setRecordingSeconds] = createSignal<number>(0);
    const [capturedVideoUrl, setCapturedVideoUrl] = createSignal<string | null>(null);
    const [capturedVideoExt, setCapturedVideoExt] = createSignal<"mp4" | "webm">("webm");
    const [showVideoModal, setShowVideoModal] = createSignal<boolean>(false);
    let mediaRecorder: MediaRecorder | null = null;
    let recordedChunks: Blob[] = [];
    let recordCanvas: HTMLCanvasElement | undefined;
    let recordTimerId: number | null = null;

    // マルチタッチ・ドラッグ操作状態
    const activePointers = new Map<number, { x: number; y: number }>();
    let isDragging = false;
    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let dragStartPosX = 50;
    let dragStartPosY = 78;
    let pinchStartDistance = 0;
    let pinchStartScale = 0.65;

    const currentShadowPreview = createMemo(() =>
        calculateProjectedShadowTransform({
            azimuthDeg: lightAzimuthDeg(),
            elevationDeg: lightElevationDeg(),
            groundTiltDeg: groundTiltDeg(),
            shadowOpacity: shadowOpacity(),
            shadowSoftness: shadowSoftness(),
            characterHeightPx: 300 * scale(),
            characterWidthPx: 180 * scale(),
        }),
    );

    const stopCamera = (resetResume = true) => {
        if (resetResume) {
            shouldResumeCamera = false;
        }
        if (mediaStream) {
            for (const track of mediaStream.getTracks()) {
                track.stop();
            }
            mediaStream = null;
        }
        if (videoRef) {
            videoRef.srcObject = null;
        }
        prevGrayFrame = null;
        visualOffsetRatioX = 0;
        visualOffsetRatioY = 0;
        setIsCameraActive(false);
    };

    const toggleFullscreen = async () => {
        const next = !isFullscreen();
        setIsFullscreen(next);
        try {
            if (next && cameraStageRef?.requestFullscreen && !document.fullscreenElement) {
                await cameraStageRef.requestFullscreen();
            } else if (!next && document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch {
            // iOS Safari 等で Fullscreen API 非対応の場合は CSS フルスクリーン（position: fixed）で動作
        }
    };

    const handleFullscreenChange = () => {
        if (typeof document !== "undefined" && !document.fullscreenElement && isFullscreen()) {
            // OSフルスクリーンがEsc等で解除された場合もCSS状態と同期
            setIsFullscreen(false);
        }
    };

    const getScreenOrientationAngle = (): number => {
        if (typeof window === "undefined") return 0;
        const angle =
            window.screen?.orientation?.angle ??
            (typeof (window as unknown as { orientation?: number }).orientation === "number"
                ? (window as unknown as { orientation: number }).orientation
                : 0);
        return Number.isFinite(angle) ? angle : 0;
    };

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
        if (
            event.alpha === null ||
            event.beta === null ||
            event.gamma === null
        ) {
            return;
        }
        const raw: GyroOrientation = {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            screenAngleDeg: getScreenOrientationAngle(),
        };
        if (!baseGyro()) {
            const initialized = smoothDeviceOrientation(null, raw, 1.0);
            setBaseGyro(initialized);
            setCurrentGyro(initialized);
            return;
        }
        // クォータニオン空間で最短経路平滑化し、beta≈90°付近のオイラー角フリップ・ジンバルロックによる飛びを防止
        const smoothed = smoothDeviceOrientation(currentGyro(), raw, 0.35);
        setCurrentGyro(smoothed);
    };

    const disableGyro = () => {
        if (typeof window !== "undefined") {
            window.removeEventListener("deviceorientation", handleDeviceOrientation);
        }
        setGyroEnabled(false);
        setBaseGyro(null);
        setCurrentGyro(null);
        setGyroStatus("");
    };

    const enableGyro = async (fromUserGesture = false) => {
        if (gyroEnabled()) return;
        if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") {
            if (fromUserGesture) {
                setGyroStatus("この端末・ブラウザはジャイロセンサーに対応していません。");
            }
            return;
        }
        try {
            const devOrientAny = DeviceOrientationEvent as unknown as {
                requestPermission?: () => Promise<"granted" | "denied">;
            };
            if (typeof devOrientAny.requestPermission === "function") {
                if (!fromUserGesture) {
                    setGyroStatus("空間アンカーを利用するには「ジャイロON」または「カメラを起動」をタップしてください。");
                    return;
                }
                const permission = await devOrientAny.requestPermission();
                if (permission !== "granted") {
                    setGyroStatus("センサーの利用が許可されませんでした。");
                    return;
                }
            }
            setBaseGyro(null);
            setCurrentGyro(null);
            window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
            setGyroEnabled(true);
            setGyroStatus("空間アンカー有効（端末を動かすと空間に固定されます）");
        } catch {
            if (fromUserGesture) {
                setGyroStatus("ジャイロセンサーの起動に失敗しました。");
            }
        }
    };

    const toggleGyro = async () => {
        if (gyroEnabled()) {
            disableGyro();
            return;
        }
        await enableGyro(true);
    };

    const resetGyroAnchor = () => {
        const cur = currentGyro();
        if (cur) {
            setBaseGyro({ ...cur });
            visualBaseGyro = { ...cur };
        } else {
            visualBaseGyro = null;
        }
        visualOffsetRatioX = 0;
        visualOffsetRatioY = 0;
        visualZoomScale = 1;
        prevGrayFrame = null;
        setGyroStatus("空間アンカーの基準位置をリセットしました");
    };

    const handleModeChange = (nextMode: OverlayMode) => {
        setMode(nextMode);
        if (nextMode === "fixed" && gyroEnabled()) {
            disableGyro();
        } else if (nextMode === "ar" && !gyroEnabled()) {
            void enableGyro(true);
        }
    };

    const buildOverlayAsset = (
        name: string,
        previewUrl: string,
        img: HTMLImageElement,
    ): OverlayImageAsset => {
        const w = Math.max(1, img.naturalWidth || img.width || 300);
        const h = Math.max(1, img.naturalHeight || img.height || 400);

        const maxAnalysisDim = 512;
        const ratio = Math.min(1, maxAnalysisDim / Math.max(w, h));
        const aw = Math.max(1, Math.round(w * ratio));
        const ah = Math.max(1, Math.round(h * ratio));

        const analysisCanvas = document.createElement("canvas");
        analysisCanvas.width = aw;
        analysisCanvas.height = ah;
        const actx = analysisCanvas.getContext("2d", { willReadFrequently: true });

        let bounds: AlphaBounds = {
            minX: 0,
            minY: 0,
            maxX: aw - 1,
            maxY: ah - 1,
            width: aw,
            height: ah,
            footCenterXRatio: 0.5,
            footBottomYRatio: 1,
            opaqueHeightRatio: 1,
            hasOpaquePixels: true,
        };

        const silhouetteCanvas = document.createElement("canvas");
        silhouetteCanvas.width = aw;
        silhouetteCanvas.height = ah;
        const sctx = silhouetteCanvas.getContext("2d");

        if (actx) {
            actx.drawImage(img, 0, 0, aw, ah);
            try {
                const imgData = actx.getImageData(0, 0, aw, ah);
                bounds = analyzeImageAlphaBounds(imgData.data, aw, ah, 12);

                if (sctx) {
                    const shadowPixels = createShadowSilhouettePixels(imgData.data, {
                        r: 14,
                        g: 18,
                        b: 30,
                    });
                    const outData = new ImageData(
                        new Uint8ClampedArray(shadowPixels),
                        aw,
                        ah,
                    );
                    sctx.putImageData(outData, 0, 0);
                }
            } catch {
                // Canvas汚染時フォールバック
            }
        }

        return {
            name,
            previewUrl,
            width: w,
            height: h,
            imgElement: img,
            alphaBounds: bounds,
            silhouetteCanvas,
        };
    };

    const handleOverlayFile = (file: File) => {
        if (!isSupportedImageFile(file.name, file.type)) return;
        const prev = overlayAsset();
        if (prev?.previewUrl) {
            URL.revokeObjectURL(prev.previewUrl);
        }
        const previewUrl = createSafeObjectUrl(file);
        const img = new Image();
        img.onload = () => {
            setOverlayAsset(buildOverlayAsset(file.name, previewUrl, img));
            applyHeightScale(characterHeightCm(), cameraDistanceM());
        };
        img.src = previewUrl;
    };

    const handleBgFile = (file: File) => {
        if (!isSupportedImageFile(file.name, file.type)) return;
        const prev = bgAsset();
        if (prev?.previewUrl) {
            URL.revokeObjectURL(prev.previewUrl);
        }
        const previewUrl = createSafeObjectUrl(file);
        const img = new Image();
        img.onload = () => {
            setBgAsset({
                name: file.name,
                previewUrl,
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
                imgElement: img,
            });
            clearOcclusion();
            visualOffsetRatioX = 0;
            visualOffsetRatioY = 0;
            visualZoomScale = 1;
            prevGrayFrame = null;
        };
        img.src = previewUrl;
    };

    const startCamera = async (facingOverride?: CameraFacing) => {
        const targetFacing = facingOverride ?? cameraFacing();
        setCameraError(null);
        stopCamera(false);

        if (
            typeof navigator === "undefined" ||
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            shouldResumeCamera = false;
            setCameraError(
                "お使いのブラウザまたは端末はカメラアクセスAPI（getUserMedia）に対応していません。背景画像を選択してテストできます。",
            );
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: targetFacing },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            });
            mediaStream = stream;
            shouldResumeCamera = true;
            for (const track of stream.getVideoTracks()) {
                track.addEventListener?.("ended", () => {
                    if (mediaStream === stream) {
                        setIsCameraActive(false);
                    }
                });
            }
            if (videoRef) {
                videoRef.srcObject = stream;
                await videoRef.play().catch(() => {});
            }
            setIsCameraActive(true);
            if (mode() === "ar" && !gyroEnabled()) {
                void enableGyro(true);
            }
        } catch (err: unknown) {
            stopCamera(true);
            const errObj = err as { name?: string; message?: string };
            if (errObj?.name === "NotAllowedError" || errObj?.name === "PermissionDeniedError") {
                setCameraError("カメラへのアクセス権限が拒否されました。ブラウザの設定でカメラを許可してください。");
            } else {
                setCameraError(`カメラの起動に失敗しました: ${errObj?.message || "不明なエラー"}`);
            }
        }
    };

    const handleVisibilityOrPageShow = () => {
        if (typeof document === "undefined" || document.visibilityState !== "visible") return;
        if (!shouldResumeCamera) return;
        const hasLiveTrack =
            mediaStream !== null &&
            mediaStream.getVideoTracks().some((track) => track.readyState === "live");
        if (hasLiveTrack && videoRef) {
            if (videoRef.paused) {
                void videoRef.play().catch(() => {
                    void startCamera();
                });
            }
            setIsCameraActive(true);
        } else {
            void startCamera();
        }
    };

    const switchCameraFacing = () => {
        const next: CameraFacing = cameraFacing() === "environment" ? "user" : "environment";
        setCameraFacing(next);
        clearOcclusion();
        visualOffsetRatioX = 0;
        visualOffsetRatioY = 0;
        visualZoomScale = 1;
        prevGrayFrame = null;
        if (isCameraActive()) {
            void startCamera(next);
        }
    };

    const syncCanvasDisplaySize = () => {
        if (!previewCanvasRef || !cameraStageRef) return;
        const rect = cameraStageRef.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50) {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const targetW = Math.round(rect.width * dpr);
            const targetH = Math.round(rect.height * dpr);
            const wasPortrait = previewCanvasRef.height >= previewCanvasRef.width;
            const nextPortrait = targetH >= targetW;
            if (
                Math.abs(previewCanvasRef.width - targetW) > 4 ||
                Math.abs(previewCanvasRef.height - targetH) > 4
            ) {
                previewCanvasRef.width = targetW;
                previewCanvasRef.height = targetH;
                if (wasPortrait !== nextPortrait) {
                    prevGrayFrame = null;
                    visualOffsetRatioX = 0;
                    visualOffsetRatioY = 0;
                    visualZoomScale = 1;
                    if (overlayAsset()) {
                        applyHeightScale(characterHeightCm(), cameraDistanceM());
                    }
                }
            }
        }
    };

    const drawCompositeScene = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        isExport = false,
    ) => {
        ctx.clearRect(0, 0, width, height);

        const activeCam = isCameraActive() && videoRef && videoRef.readyState >= 2;
        const bg = bgAsset();

        if (activeCam && videoRef) {
            const vw = videoRef.videoWidth || width;
            const vh = videoRef.videoHeight || height;
            const coverRatio = Math.max(width / vw, height / vh);
            const drawW = vw * coverRatio;
            const drawH = vh * coverRatio;
            const drawX = (width - drawW) / 2;
            const drawY = (height - drawH) / 2;

            ctx.save();
            if (cameraFacing() === "user" && mirrorSelfie()) {
                ctx.translate(width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(videoRef, drawX, drawY, drawW, drawH);
            ctx.restore();

            // 回転補償付きビジュアルトラッキング（近づき・離れの拡大縮小 + 平行移動を基準フレームと照合）
            if (
                !isExport &&
                mode() === "ar" &&
                visualTrackingEnabled() &&
                !isDragging &&
                performance.now() - lastVisualTrackTime > 45
            ) {
                lastVisualTrackTime = performance.now();
                const trackW = 64;
                const trackH = Math.max(36, Math.min(96, Math.round(64 * (height / Math.max(1, width)))));
                if (!trackCanvas) {
                    trackCanvas = document.createElement("canvas");
                }
                if (trackCanvas.width !== trackW || trackCanvas.height !== trackH) {
                    trackCanvas.width = trackW;
                    trackCanvas.height = trackH;
                    prevGrayFrame = null;
                }
                const tctx = trackCanvas.getContext("2d", { willReadFrequently: true });
                if (tctx) {
                    tctx.clearRect(0, 0, trackW, trackH);
                    tctx.save();
                    const curG = currentGyro();
                    if (gyroEnabled() && curG && visualBaseGyro && prevGrayFrame) {
                        const rotShift = calculateGyroParallaxOffset(
                            curG,
                            visualBaseGyro,
                            trackW,
                            trackH,
                            1.0,
                        );
                        tctx.translate(trackW * 0.5 - rotShift.offsetX, trackH * 0.5 - rotShift.offsetY);
                        tctx.rotate((-rotShift.tiltSkewDeg * Math.PI) / 180);
                        tctx.translate(-trackW * 0.5, -trackH * 0.5);
                    }
                    tctx.drawImage(ctx.canvas, 0, 0, trackW, trackH);
                    tctx.restore();
                    try {
                        const frameData = tctx.getImageData(0, 0, trackW, trackH).data;
                        const currGray = new Uint8Array(trackW * trackH);
                        for (let i = 0; i < trackW * trackH; i++) {
                            const p = i * 4;
                            currGray[i] = Math.round(
                                0.299 * frameData[p] + 0.587 * frameData[p + 1] + 0.114 * frameData[p + 2],
                            );
                        }
                        if (!prevGrayFrame) {
                            prevGrayFrame = currGray;
                            const curG = currentGyro();
                            visualBaseGyro = curG ? { ...curG } : null;
                        } else {
                            const transform = estimateBackgroundScaleAndShift(
                                prevGrayFrame,
                                currGray,
                                trackW,
                                trackH,
                                18,
                                clampFinite(posXPercent() / 100, 0.05, 0.95, 0.5),
                                clampFinite(posYPercent() / 100, 0.05, 0.95, 0.78),
                            );
                            if (transform.confidence > 0.18) {
                                const smooth = 0.34;
                                const targetX = clampFinite(transform.dx / trackW, -0.65, 0.65, 0);
                                const targetY = clampFinite(transform.dy / trackH, -0.65, 0.65, 0);
                                const targetScale = clampFinite(transform.scale, 0.55, 1.85, 1);
                                visualOffsetRatioX = visualOffsetRatioX * (1 - smooth) + targetX * smooth;
                                visualOffsetRatioY = visualOffsetRatioY * (1 - smooth) + targetY * smooth;
                                visualZoomScale = visualZoomScale * (1 - smooth) + targetScale * smooth;
                            }
                        }
                    } catch {
                        // トラッキングスキップ
                    }
                }
            }
        } else if (bg) {
            const coverRatio = Math.max(width / bg.width, height / bg.height);
            const drawW = bg.width * coverRatio;
            const drawH = bg.height * coverRatio;
            ctx.drawImage(bg.imgElement, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        } else {
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, "#1e293b");
            grad.addColorStop(0.6, "#334155");
            grad.addColorStop(1, "#0f172a");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        const now = performance.now();
        if (!isExport && mode() === "ar" && (autoAmbientMatch() || autoLightDirection()) && now - lastLightSampleTime > 180) {
            lastLightSampleTime = now;
            if (!lightSampleCanvas) {
                lightSampleCanvas = document.createElement("canvas");
                lightSampleCanvas.width = 16;
                lightSampleCanvas.height = 16;
            }
            const lctx = lightSampleCanvas.getContext("2d", { willReadFrequently: true });
            if (lctx) {
                lctx.drawImage(ctx.canvas, 0, 0, 16, 16);
                try {
                    const sampleData = lctx.getImageData(0, 0, 16, 16);
                    const lighting = estimateEnvironmentLighting(sampleData.data, 16, 16);
                    setEnvLighting(lighting);
                    if (autoLightDirection()) {
                        setLightAzimuthDeg(lighting.suggestedAzimuthDeg);
                    }
                } catch {
                    // スキップ
                }
            }
        }

        // 被写界深度（DoF）背景ボケ合成（立ち絵にフォーカスを当て、F値に応じて背景・ピント外をボカす）
        if (dofEnabled() && width > 0 && height > 0) {
            const blurPx = calculateApertureMaxBlurPx(dofApertureF(), cameraDistanceM());
            if (blurPx >= 0.4) {
                const blurScale = isExport ? 1.0 : 0.5;
                const bw = Math.max(16, Math.round(width * blurScale));
                const bh = Math.max(16, Math.round(height * blurScale));
                if (!dofBlurCanvas) {
                    dofBlurCanvas = document.createElement("canvas");
                }
                if (dofBlurCanvas.width !== bw || dofBlurCanvas.height !== bh) {
                    dofBlurCanvas.width = bw;
                    dofBlurCanvas.height = bh;
                }
                const bCtx = dofBlurCanvas.getContext("2d");
                if (bCtx) {
                    bCtx.clearRect(0, 0, bw, bh);
                    bCtx.save();
                    if ("filter" in bCtx) {
                        bCtx.filter = `blur(${(blurPx * blurScale).toFixed(1)}px)`;
                    }
                    bCtx.drawImage(ctx.canvas, 0, 0, bw, bh);
                    bCtx.restore();

                    if (hasDofMask() && dofMaskCanvas) {
                        const { dx, dy } = getMaskShiftOffset(bw, bh);
                        const relZoom =
                            mode() === "ar" && visualTrackingEnabled()
                                ? clampFinite(visualZoomScale / Math.max(0.25, maskBaseZoomScale), 0.4, 2.5, 1)
                                : 1;
                        bCtx.save();
                        bCtx.globalCompositeOperation = "destination-in";
                        bCtx.translate(bw * 0.5 + dx, bh * 0.5 + dy);
                        bCtx.scale(relZoom, relZoom);
                        bCtx.drawImage(dofMaskCanvas, -bw * 0.5, -bh * 0.5, bw, bh);
                        bCtx.restore();
                    }

                    ctx.save();
                    ctx.drawImage(dofBlurCanvas, 0, 0, width, height);
                    ctx.restore();
                }
            }
        }

        if (!isExport && mode() === "ar" && showArGrid()) {
            const detectedSurface = surfaceInfo();
            if (detectedSurface && surfaceOverlayCanvas) {
                const { dx, dy } = getMaskShiftOffset(width, height);
                ctx.save();
                ctx.drawImage(surfaceOverlayCanvas, dx, dy, width, height);
                ctx.restore();
            }
            const defaultHorizon = clampFinite(0.55 - (groundTiltDeg() - 30) * 0.004, 0.25, 0.72, 0.55);
            const horizonY = height * (detectedSurface ? detectedSurface.horizonYRatio : defaultHorizon);
            ctx.save();
            ctx.strokeStyle = "rgba(129, 140, 248, 0.25)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, horizonY);
            ctx.lineTo(width, horizonY);
            for (let i = -4; i <= 4; i++) {
                ctx.moveTo(width / 2 + i * 35, horizonY);
                ctx.lineTo(width / 2 + i * 240, height);
            }
            for (let row = 1; row <= 4; row++) {
                const y = horizonY + ((height - horizonY) * (row * row)) / 16;
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();
            ctx.restore();
        }

        drawCharacterWithOcclusion(ctx, width, height);
    };

    const drawCharacter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const asset = overlayAsset();
        if (!asset) return;

        const activeVisualZoom = mode() === "ar" && visualTrackingEnabled() ? visualZoomScale : 1;
        const baseTargetHeight = height * 0.62 * clampFinite(scale(), 0.1, 4.0, 0.65) * activeVisualZoom;
        const aspect = asset.width / Math.max(1, asset.height);
        const drawH = baseTargetHeight;
        const drawW = drawH * aspect;

        const baseX = (clampFinite(posXPercent(), -100, 200, 50) / 100) * width;
        const baseY = (clampFinite(posYPercent(), -100, 200, 78) / 100) * height;

        if (mode() === "fixed") {
            ctx.save();
            ctx.globalAlpha = clampFinite(opacity(), 0, 1, 1);
            ctx.translate(baseX, baseY);
            ctx.rotate((clampFinite(rotationDeg(), -180, 180, 0) * Math.PI) / 180);
            ctx.scale(flipHorizontal() ? -1 : 1, 1);
            ctx.drawImage(asset.imgElement, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
            return;
        }

        let gyroX = 0;
        let gyroY = 0;
        let gyroTilt = 0;
        const curG = currentGyro();
        const baseG = baseGyro();
        if (gyroEnabled() && curG && baseG) {
            const parallax = calculateGyroParallaxOffset(
                curG,
                baseG,
                width,
                height,
                1.0,
                baseX / Math.max(1, width),
                baseY / Math.max(1, height),
            );
            gyroX = parallax.offsetX;
            gyroY = parallax.offsetY;
            gyroTilt = parallax.tiltSkewDeg;
        }
        const effectivePitchDeg = clampFinite(
            mode() === "ar" && gyroEnabled() && autoPitchFromGyro() && curG
                ? estimateCameraPitchFromGyro(curG) + cameraPitchDeg()
                : cameraPitchDeg(),
            -60,
            60,
            0,
        );
        const pitchParams = calculatePerspectivePitchParams(effectivePitchDeg);

        const anchoredX = baseX + gyroX;
        const anchoredY = baseY + gyroY;
        const footX =
            width * 0.5 +
            (anchoredX - width * 0.5) * activeVisualZoom +
            (mode() === "ar" && visualTrackingEnabled() ? visualOffsetRatioX * width : 0);
        const footY =
            height * 0.5 +
            (anchoredY - height * 0.5) * activeVisualZoom +
            (mode() === "ar" && visualTrackingEnabled() ? visualOffsetRatioY * height : 0);

        const footAnchorXRatio = flipHorizontal()
            ? 1 - asset.alphaBounds.footCenterXRatio
            : asset.alphaBounds.footCenterXRatio;
        const footAnchorYRatio = asset.alphaBounds.footBottomYRatio;

        const imgLeftOffset = -drawW * footAnchorXRatio;
        const imgTopOffset = -drawH * footAnchorYRatio;

        const shadow = calculateProjectedShadowTransform({
            azimuthDeg: lightAzimuthDeg(),
            elevationDeg: lightElevationDeg(),
            groundTiltDeg: clampFinite(groundTiltDeg() + effectivePitchDeg * 0.45, 10, 78, 34),
            shadowOpacity: shadowOpacity(),
            shadowSoftness: shadowSoftness(),
            characterHeightPx: drawH,
            characterWidthPx: drawW,
        });

        const charOpacity = clampFinite(opacity(), 0, 1, 1);

        // 接地コンタクトシャドウは常に足元へ描画し、キャラクターの接地感を維持
        ctx.save();
        ctx.translate(footX, footY);
        const contactGrad = ctx.createRadialGradient(
            0,
            0,
            shadow.contactWidthPx * 0.08,
            0,
            0,
            shadow.contactWidthPx * 0.52,
        );
        contactGrad.addColorStop(0, `rgba(10, 14, 24, ${Math.max(0.28, shadow.contactOpacity) * charOpacity})`);
        contactGrad.addColorStop(0.55, `rgba(10, 14, 24, ${Math.max(0.28, shadow.contactOpacity) * 0.45 * charOpacity})`);
        contactGrad.addColorStop(1, "rgba(10, 14, 24, 0)");
        ctx.scale(1, shadow.contactHeightPx / Math.max(1, shadow.contactWidthPx));
        ctx.fillStyle = contactGrad;
        ctx.beginPath();
        ctx.arc(0, 0, shadow.contactWidthPx * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const drawProjectedShadow = (sCtx: CanvasRenderingContext2D) => {
            sCtx.save();
            sCtx.translate(footX + shadow.offsetX, footY + shadow.offsetY);
            sCtx.transform(1, 0, shadow.skewXRatio, shadow.scaleYRatio, 0, 0);
            if (flipHorizontal()) {
                sCtx.scale(-1, 1);
            }
            sCtx.globalAlpha = shadow.opacity * charOpacity;
            if ("filter" in sCtx && shadow.blurPx > 0.4) {
                sCtx.filter = `blur(${shadow.blurPx.toFixed(1)}px)`;
            }
            const silLeft = -drawW * asset.alphaBounds.footCenterXRatio;
            const silTop = -drawH * footAnchorYRatio;
            sCtx.drawImage(asset.silhouetteCanvas, silLeft, silTop, drawW, drawH);
            sCtx.restore();
        };

        // 深度AIが解析済みの場合は床面・机面以外に投影影がはみ出さないようシャドウキャッチャーマスクを適用
        if (hasShadowCatcher() && shadowCatcherCanvas && width > 0 && height > 0) {
            if (!shadowLayerCanvas) {
                shadowLayerCanvas = document.createElement("canvas");
            }
            if (shadowLayerCanvas.width !== width || shadowLayerCanvas.height !== height) {
                shadowLayerCanvas.width = width;
                shadowLayerCanvas.height = height;
            }
            const slCtx = shadowLayerCanvas.getContext("2d");
            if (slCtx) {
                const { dx, dy } = getMaskShiftOffset(width, height);
                slCtx.clearRect(0, 0, width, height);
                drawProjectedShadow(slCtx);
                slCtx.save();
                slCtx.globalCompositeOperation = "destination-in";
                slCtx.drawImage(shadowCatcherCanvas, dx, dy, width, height);
                slCtx.restore();
                ctx.drawImage(shadowLayerCanvas, 0, 0, width, height);
            } else {
                drawProjectedShadow(ctx);
            }
        } else {
            drawProjectedShadow(ctx);
        }

        // キャラクター本体（環境光・背景色・光源方向に合わせた色馴染ませ）
        const drawWInt = Math.max(1, Math.min(2048, Math.round(drawW)));
        const drawHInt = Math.max(1, Math.min(2048, Math.round(drawH)));
        let charSource: CanvasImageSource = asset.imgElement;

        if (autoAmbientMatch()) {
            const adapt = calculateCharacterColorAdaptation(envLighting(), lightAzimuthDeg());
            if (!litCharCanvas) {
                litCharCanvas = document.createElement("canvas");
            }
            if (litCharCanvas.width !== drawWInt || litCharCanvas.height !== drawHInt) {
                litCharCanvas.width = drawWInt;
                litCharCanvas.height = drawHInt;
            }
            const lCtx = litCharCanvas.getContext("2d");
            if (lCtx) {
                lCtx.clearRect(0, 0, drawWInt, drawHInt);
                lCtx.save();
                if ("filter" in lCtx) {
                    lCtx.filter = `brightness(${adapt.brightness.toFixed(2)}) saturate(${adapt.saturate.toFixed(2)})`;
                }
                lCtx.drawImage(asset.imgElement, 0, 0, drawWInt, drawHInt);
                lCtx.restore();

                // 1. 背景の環境光色（色温度）を立ち絵のピクセルへ馴染ませる
                lCtx.save();
                lCtx.globalCompositeOperation = "source-atop";
                lCtx.fillStyle = `rgba(${adapt.tintRgb.r}, ${adapt.tintRgb.g}, ${adapt.tintRgb.b}, ${adapt.tintAlpha.toFixed(3)})`;
                lCtx.fillRect(0, 0, drawWInt, drawHInt);

                // 2. 光源方向に応じた片側ハイライト＆反対側の立体陰影を付与
                const dir = flipHorizontal() ? -adapt.rimDirX : adapt.rimDirX;
                const xStart = dir >= 0 ? drawWInt : 0;
                const xEnd = dir >= 0 ? 0 : drawWInt;
                const shadeGrad = lCtx.createLinearGradient(xStart, 0, xEnd, 0);
                shadeGrad.addColorStop(0, "rgba(255, 252, 242, 0.08)");
                shadeGrad.addColorStop(0.45, "rgba(0, 0, 0, 0)");
                shadeGrad.addColorStop(1, `rgba(10, 16, 30, ${adapt.shadeAlpha.toFixed(3)})`);
                lCtx.fillStyle = shadeGrad;
                lCtx.fillRect(0, 0, drawWInt, drawHInt);
                lCtx.restore();

                charSource = litCharCanvas;
            }
        }

        ctx.save();
        ctx.translate(footX, footY);
        const totalRotRad =
            ((clampFinite(rotationDeg(), -180, 180, 0) + gyroTilt) * Math.PI) / 180;
        ctx.rotate(totalRotRad);
        ctx.globalAlpha = charOpacity;

        const renderHeight = drawH * pitchParams.heightCompression;
        const renderTopOffset = -renderHeight * footAnchorYRatio;
        const srcW =
            charSource === litCharCanvas && litCharCanvas ? litCharCanvas.width : asset.width;
        const srcH =
            charSource === litCharCanvas && litCharCanvas ? litCharCanvas.height : asset.height;

        const drawCharacterProjected = () => {
            if (Math.abs(pitchParams.perspectiveK) < 0.015) {
                ctx.drawImage(charSource, -drawW * footAnchorXRatio, imgTopOffset, drawW, drawH);
                return;
            }
            const strips = 28;
            for (let i = 0; i < strips; i++) {
                // i=0 が頭頂(t=1)、i=strips が足元(t=0) になるように分割
                const tTop = 1 - i / strips;
                const tBot = 1 - (i + 1) / strips;
                const uTop = 1 - projectVerticalPerspectiveT(tTop, pitchParams.perspectiveK);
                const uBot = 1 - projectVerticalPerspectiveT(tBot, pitchParams.perspectiveK);
                const tMid = (tTop + tBot) * 0.5;
                const stripScaleW = clampFinite(1 + pitchParams.perspectiveK * tMid, 0.55, 1.5, 1);

                const sy = (i / strips) * srcH;
                const sh = srcH / strips;
                const dyTop = renderTopOffset + uTop * renderHeight;
                const dh = Math.max(0.5, (uBot - uTop) * renderHeight + 0.6);
                const dw = drawW * stripScaleW;
                const dx = -dw * footAnchorXRatio;

                ctx.drawImage(charSource, 0, sy, srcW, sh, dx, dyTop, dw, dh);
            }
        };

        if (flipHorizontal()) {
            ctx.scale(-1, 1);
            drawCharacterProjected();
        } else {
            drawCharacterProjected();
        }
        ctx.restore();
    };

    const captureMaskAnchor = () => {
        const curG = currentGyro();
        maskBaseGyro = curG ? { ...curG } : null;
        maskBaseVisualX = visualOffsetRatioX;
        maskBaseVisualY = visualOffsetRatioY;
        maskBaseZoomScale = visualZoomScale;
    };

    const getMaskShiftOffset = (width: number, height: number): { dx: number; dy: number } => {
        if (mode() !== "ar") return { dx: 0, dy: 0 };
        let dx = 0;
        let dy = 0;
        const curG = currentGyro();
        if (gyroEnabled() && curG && maskBaseGyro) {
            const p = calculateGyroParallaxOffset(curG, maskBaseGyro, width, height, 1.0);
            dx += p.offsetX;
            dy += p.offsetY;
        }
        if (visualTrackingEnabled()) {
            dx += (visualOffsetRatioX - maskBaseVisualX) * width;
            dy += (visualOffsetRatioY - maskBaseVisualY) * height;
        }
        return { dx, dy };
    };

    /** 遮蔽マスクを考慮して立ち絵（影含む）を描画する。マスクもAR画角に追従させる */
    const drawCharacterWithOcclusion = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ) => {
        if (!hasOcclusion() || !occlusionCanvas || width <= 0 || height <= 0) {
            drawCharacter(ctx, width, height);
            return;
        }
        if (!characterLayerCanvas) {
            characterLayerCanvas = document.createElement("canvas");
        }
        if (characterLayerCanvas.width !== width || characterLayerCanvas.height !== height) {
            characterLayerCanvas.width = width;
            characterLayerCanvas.height = height;
        }
        const layerCtx = characterLayerCanvas.getContext("2d");
        if (!layerCtx) {
            drawCharacter(ctx, width, height);
            return;
        }
        const { dx, dy } = getMaskShiftOffset(width, height);
        const relMaskZoom =
            mode() === "ar" && visualTrackingEnabled()
                ? clampFinite(visualZoomScale / Math.max(0.25, maskBaseZoomScale), 0.4, 2.5, 1)
                : 1;
        layerCtx.clearRect(0, 0, width, height);
        drawCharacter(layerCtx, width, height);
        layerCtx.save();
        layerCtx.globalCompositeOperation = "destination-out";
        layerCtx.translate(width * 0.5 + dx, height * 0.5 + dy);
        layerCtx.scale(relMaskZoom, relMaskZoom);
        layerCtx.drawImage(occlusionCanvas, -width * 0.5, -height * 0.5, width, height);
        layerCtx.restore();
        ctx.drawImage(characterLayerCanvas, 0, 0, width, height);
    };

    const ensureOcclusionCanvas = (): CanvasRenderingContext2D | null => {
        if (!occlusionCanvas) {
            occlusionCanvas = document.createElement("canvas");
            occlusionCanvas.width = OCCLUSION_MASK_SIZE;
            occlusionCanvas.height = OCCLUSION_MASK_SIZE;
        }
        return occlusionCanvas.getContext("2d");
    };

    const applyHeightScale = (heightCm: number, distanceM: number) => {
        const asset = overlayAsset();
        const opaqueRatio =
            asset && asset.alphaBounds.hasOpaquePixels
                ? clampFinite(asset.alphaBounds.opaqueHeightRatio, 0.1, 1.0, 1.0)
                : 1.0;
        const isPortraitView =
            !previewCanvasRef || previewCanvasRef.height >= previewCanvasRef.width;
        setScale(
            calculateScaleForCharacterHeight({
                characterHeightCm: heightCm,
                distanceMeters: distanceM,
                opaqueHeightRatio: opaqueRatio,
                verticalFovDeg: isPortraitView ? 74 : 52,
            }),
        );
    };

    const syncDistanceAndScaleFromDepth = (
        depthMap: { data: Float32Array; width: number; height: number },
        nx = clampFinite(posXPercent() / 100, 0.05, 0.95, 0.5),
        ny = clampFinite(posYPercent() / 100, 0.05, 0.95, 0.78),
    ): number => {
        const isPortraitView =
            !previewCanvasRef || previewCanvasRef.height >= previewCanvasRef.width;
        const estimatedDist = estimateDistanceFromArDepth({
            normalizedDepth: depthMap.data,
            width: depthMap.width,
            height: depthMap.height,
            footXRatio: nx,
            footYRatio: ny,
            verticalFovDeg: isPortraitView ? 74 : 52,
            pitchTiltDeg: groundTiltDeg(),
        });
        setCameraDistanceM(estimatedDist);
        applyHeightScale(characterHeightCm(), estimatedDist);
        return estimatedDist;
    };

    const clearOcclusion = () => {
        if (occlusionCanvas) {
            occlusionCanvas.getContext("2d")?.clearRect(0, 0, OCCLUSION_MASK_SIZE, OCCLUSION_MASK_SIZE);
        }
        if (surfaceOverlayCanvas) {
            surfaceOverlayCanvas.getContext("2d")?.clearRect(0, 0, surfaceOverlayCanvas.width, surfaceOverlayCanvas.height);
        }
        if (dofMaskCanvas) {
            dofMaskCanvas.getContext("2d")?.clearRect(0, 0, dofMaskCanvas.width, dofMaskCanvas.height);
        }
        maskBaseGyro = null;
        maskBaseVisualX = 0;
        maskBaseVisualY = 0;
        setHasOcclusion(false);
        setHasShadowCatcher(false);
        setHasDofMask(false);
        setSurfaceInfo(null);
        setAiDepthMap(null);
        setAiDepthStatus("");
    };

    const updateDofFocusMask = (
        depthMap: { data: Float32Array; width: number; height: number },
        focusDepth01: number,
        apertureF: number,
    ) => {
        if (!dofMaskCanvas) {
            dofMaskCanvas = document.createElement("canvas");
        }
        if (dofMaskCanvas.width !== depthMap.width || dofMaskCanvas.height !== depthMap.height) {
            dofMaskCanvas.width = depthMap.width;
            dofMaskCanvas.height = depthMap.height;
        }
        const dCtx = dofMaskCanvas.getContext("2d");
        if (!dCtx) return;
        const pixels = generateDofOutOfFocusMaskPixels(
            depthMap.data,
            depthMap.width,
            depthMap.height,
            focusDepth01,
            apertureF,
        );
        dCtx.putImageData(
            new ImageData(new Uint8ClampedArray(pixels), depthMap.width, depthMap.height),
            0,
            0,
        );
        setHasDofMask(true);
    };

    const focusOnCharacter = () => {
        setDofEnabled(true);
        setAutoFocusOnCharacter(true);
        const map = aiDepthMap();
        if (map) {
            const charDepth = estimateCharacterGroundDepth(
                map.data,
                map.width,
                map.height,
                clampFinite(posXPercent() / 100, 0.05, 0.95, 0.5),
                clampFinite(posYPercent() / 100, 0.05, 0.95, 0.78),
            );
            const rounded = Math.round(charDepth * 100) / 100;
            setDofFocusDepth(rounded);
            updateDofFocusMask(map, rounded, dofApertureF());
        } else {
            void runAiDepthOcclusion();
        }
    };

    const applyDepthMaskToOcclusion = (
        depthMap: {
            data: Float32Array;
            width: number;
            height: number;
            guideRgba?: Uint8ClampedArray;
            guideWidth?: number;
            guideHeight?: number;
        },
        threshold01: number,
    ) => {
        const mctx = ensureOcclusionCanvas();
        if (!mctx || !occlusionCanvas) return;
        const outW =
            depthMap.guideWidth && depthMap.guideWidth >= 8 ? depthMap.guideWidth : depthMap.width;
        const outH =
            depthMap.guideHeight && depthMap.guideHeight >= 8 ? depthMap.guideHeight : depthMap.height;
        const pixels = generateDepthOcclusionMaskPixels(
            depthMap.data,
            depthMap.width,
            depthMap.height,
            threshold01,
            0.008,
            {
                preserveThinStructures: true,
                guideRgba: depthMap.guideRgba,
                guideWidth: outW,
                guideHeight: outH,
            },
        );
        if (occlusionCanvas.width !== outW || occlusionCanvas.height !== outH) {
            occlusionCanvas.width = outW;
            occlusionCanvas.height = outH;
        }
        mctx.clearRect(0, 0, outW, outH);
        mctx.putImageData(
            new ImageData(new Uint8ClampedArray(pixels), outW, outH),
            0,
            0,
        );
        captureMaskAnchor();
        setHasOcclusion(true);
    };

    const updateGroundShadowCatcher = (
        depthMap: { data: Float32Array; width: number; height: number },
    ) => {
        if (!shadowCatcherCanvas) {
            shadowCatcherCanvas = document.createElement("canvas");
            shadowCatcherCanvas.width = OCCLUSION_MASK_SIZE;
            shadowCatcherCanvas.height = OCCLUSION_MASK_SIZE;
        }
        const sctx = shadowCatcherCanvas.getContext("2d");
        if (!sctx) return;

        const pixels = generateGroundShadowMaskPixels(
            depthMap.data,
            depthMap.width,
            depthMap.height,
            clampFinite(posXPercent() / 100, 0.05, 0.95, 0.5),
            clampFinite(posYPercent() / 100, 0.05, 0.95, 0.78),
        );
        const tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = depthMap.width;
        tmpCanvas.height = depthMap.height;
        const tctx = tmpCanvas.getContext("2d");
        if (!tctx) return;
        tctx.putImageData(
            new ImageData(new Uint8ClampedArray(pixels), depthMap.width, depthMap.height),
            0,
            0,
        );
        sctx.clearRect(0, 0, OCCLUSION_MASK_SIZE, OCCLUSION_MASK_SIZE);
        sctx.drawImage(tmpCanvas, 0, 0, OCCLUSION_MASK_SIZE, OCCLUSION_MASK_SIZE);
        setHasShadowCatcher(true);
    };

    const runAiDepthOcclusion = async () => {
        if (aiDepthBusy()) return;
        const activeCam = isCameraActive() && videoRef && videoRef.readyState >= 2;
        const bg = bgAsset();
        if (!activeCam && !bg) {
            setAiDepthStatus("カメラを起動するか背景画像を選択してから実行してください。");
            return;
        }

        // プレビュー画面と完全に同じアスペクト比・cover切り抜き範囲で解析用キャンバスを生成（位置ズレ防止・ガイド画像高精細化）
        const viewW = previewCanvasRef && previewCanvasRef.width > 0 ? previewCanvasRef.width : 720;
        const viewH = previewCanvasRef && previewCanvasRef.height > 0 ? previewCanvasRef.height : 1280;
        const fitRatio = Math.min(1, 720 / Math.max(viewW, viewH));
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = Math.max(32, Math.round(viewW * fitRatio));
        srcCanvas.height = Math.max(32, Math.round(viewH * fitRatio));
        const sctx = srcCanvas.getContext("2d", { willReadFrequently: true });
        if (!sctx) return;

        if (activeCam && videoRef) {
            const vw = videoRef.videoWidth || srcCanvas.width;
            const vh = videoRef.videoHeight || srcCanvas.height;
            const coverRatio = Math.max(srcCanvas.width / vw, srcCanvas.height / vh);
            const drawW = vw * coverRatio;
            const drawH = vh * coverRatio;
            const drawX = (srcCanvas.width - drawW) / 2;
            const drawY = (srcCanvas.height - drawH) / 2;
            sctx.save();
            if (cameraFacing() === "user" && mirrorSelfie()) {
                sctx.translate(srcCanvas.width, 0);
                sctx.scale(-1, 1);
            }
            sctx.drawImage(videoRef, drawX, drawY, drawW, drawH);
            sctx.restore();
        } else if (bg) {
            const coverRatio = Math.max(srcCanvas.width / bg.width, srcCanvas.height / bg.height);
            const drawW = bg.width * coverRatio;
            const drawH = bg.height * coverRatio;
            sctx.drawImage(
                bg.imgElement,
                (srcCanvas.width - drawW) / 2,
                (srcCanvas.height - drawH) / 2,
                drawW,
                drawH,
            );
        }

        setAiDepthBusy(true);
        try {
            const { estimateDepthMapFromCanvas } = await import("../utils/arDepthEstimator");
            const estimated = await estimateDepthMapFromCanvas(srcCanvas, (msg) =>
                setAiDepthStatus(msg),
            );
            let guideRgba: Uint8ClampedArray | undefined;
            try {
                guideRgba = new Uint8ClampedArray(
                    sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data,
                );
            } catch {
                guideRgba = undefined;
            }
            const mapData = {
                data: estimated.data,
                width: estimated.width,
                height: estimated.height,
                guideRgba,
                guideWidth: srcCanvas.width,
                guideHeight: srcCanvas.height,
            };
            setAiDepthMap(mapData);

            // 地面（水平面）と壁（垂直面）の境界・領域を認識
            const surface = analyzeGroundAndWallPlanes(
                estimated.data,
                estimated.width,
                estimated.height,
            );
            const groundPct = Math.round(surface.groundRatio * 100);
            const wallPct = Math.round(surface.wallRatio * 100);
            setSurfaceInfo({
                groundPct,
                wallPct,
                horizonYRatio: surface.horizonYRatio,
            });
            if (!surfaceOverlayCanvas) {
                surfaceOverlayCanvas = document.createElement("canvas");
            }
            surfaceOverlayCanvas.width = estimated.width;
            surfaceOverlayCanvas.height = estimated.height;
            const soCtx = surfaceOverlayCanvas.getContext("2d");
            if (soCtx) {
                const surfPixels = generateSurfaceOverlayPixels(
                    surface.labels,
                    estimated.width,
                    estimated.height,
                );
                soCtx.putImageData(
                    new ImageData(
                        new Uint8ClampedArray(surfPixels),
                        estimated.width,
                        estimated.height,
                    ),
                    0,
                    0,
                );
            }
            // 足元が壁エリア（境界線より上）に浮いていれば検出された地面上へスナップ
            if (surface.groundRatio >= 0.08 && posYPercent() < surface.horizonYRatio * 100) {
                setPosYPercent(Math.round(surface.recommendedFootYRatio * 1000) / 10);
            }

            // 足元に手前の柵がかぶっても引っ張られないよう、足元周辺の床面深度（下位30%点）を基準にする
            // +0.06 の安全マージンにより立ち位置の壁・床で立ち絵が半透明になるのを防止
            const groundDepth = estimateCharacterGroundDepth(
                estimated.data,
                estimated.width,
                estimated.height,
                clampFinite(posXPercent() / 100, 0.05, 0.95, 0.5),
                clampFinite(posYPercent() / 100, 0.05, 0.95, 0.78),
            );
            const autoThreshold = Math.round(clampFinite(groundDepth + 0.06, 0.14, 0.92, 0.55) * 100) / 100;
            setAiDepthThreshold(autoThreshold);
            applyDepthMaskToOcclusion(mapData, autoThreshold);
            const estimatedTilt = estimateGroundTiltFromDepthMap(
                estimated.data,
                estimated.width,
                estimated.height,
            );
            setGroundTiltDeg(estimatedTilt);
            updateGroundShadowCatcher(mapData);
            if (autoFocusOnCharacter()) {
                const roundedFocus = Math.round(groundDepth * 100) / 100;
                setDofFocusDepth(roundedFocus);
                updateDofFocusMask(mapData, roundedFocus, dofApertureF());
            } else {
                updateDofFocusMask(mapData, dofFocusDepth(), dofApertureF());
            }
            if (autoDistanceFromAr()) {
                const estimatedDist = syncDistanceAndScaleFromDepth(mapData);
                setAiDepthStatus(
                    `端末内(${estimated.backend === "webgpu" ? "WebGPU" : "WASM"})で地面${groundPct}%・壁${wallPct}%・推定距離(${estimatedDist}m)・遮蔽・接地影を最適化しました`,
                );
            } else {
                setAiDepthStatus(
                    `端末内(${estimated.backend === "webgpu" ? "WebGPU" : "WASM"})で地面${groundPct}%・壁${wallPct}%・床角(${estimatedTilt}°)・接地影を最適化しました`,
                );
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "解析に失敗しました";
            setAiDepthStatus(`AI解析エラー: ${message}`);
        } finally {
            setAiDepthBusy(false);
        }
    };

    const startRenderLoop = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        const render = () => {
            syncCanvasDisplaySize();
            if (previewCanvasRef) {
                const ctx = previewCanvasRef.getContext("2d");
                if (ctx) {
                    drawCompositeScene(
                        ctx,
                        previewCanvasRef.width,
                        previewCanvasRef.height,
                        false,
                    );
                }
            }
            if (isRecording() && recordCanvas) {
                const rCtx = recordCanvas.getContext("2d");
                if (rCtx) {
                    drawCompositeScene(rCtx, recordCanvas.width, recordCanvas.height, true);
                }
            }
            rafId = requestAnimationFrame(render);
        };
        rafId = requestAnimationFrame(render);
    };

    const capturePhoto = () => {
        setIsFlashActive(true);
        window.setTimeout(() => setIsFlashActive(false), 180);

        const exportCanvas = document.createElement("canvas");
        const srcW =
            isCameraActive() && videoRef && videoRef.videoWidth > 0
                ? videoRef.videoWidth
                : bgAsset()?.width ?? 0;
        const srcH =
            isCameraActive() && videoRef && videoRef.videoHeight > 0
                ? videoRef.videoHeight
                : bgAsset()?.height ?? 0;
        const dims = resolveExportDimensions(
            frameOrientation(),
            previewCanvasRef?.width ?? 1280,
            previewCanvasRef?.height ?? 720,
            srcW,
            srcH,
            2400,
        );
        exportCanvas.width = dims.width;
        exportCanvas.height = dims.height;

        const ctx = exportCanvas.getContext("2d");
        if (!ctx) return;
        drawCompositeScene(ctx, exportCanvas.width, exportCanvas.height, true);

        const mime = captureFormat();
        const quality = mime === "image/png" ? undefined : 0.92;
        exportCanvas.toBlob(
            (blob) => {
                if (!blob) return;
                const prev = capturedUrl();
                if (prev) {
                    URL.revokeObjectURL(prev);
                }
                setCapturedUrl(createSafeObjectUrl(blob));
                setShowCaptureModal(true);
            },
            mime,
            quality,
        );
    };

    const stopVideoRecording = () => {
        if (recordTimerId !== null) {
            window.clearInterval(recordTimerId);
            recordTimerId = null;
        }
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            try {
                mediaRecorder.stop();
            } catch {
                // 停止済み
            }
        }
        setIsRecording(false);
    };

    const startVideoRecording = () => {
        if (isRecording()) return;
        if (typeof MediaRecorder === "undefined") {
            setCameraError("お使いのブラウザは動画録画（MediaRecorder API）に対応していません。");
            return;
        }
        const dims = resolveExportDimensions(
            frameOrientation(),
            previewCanvasRef?.width ?? 1280,
            previewCanvasRef?.height ?? 720,
            0,
            0,
            1280,
        );
        if (!recordCanvas) {
            recordCanvas = document.createElement("canvas");
        }
        recordCanvas.width = dims.width;
        recordCanvas.height = dims.height;
        const rCtx = recordCanvas.getContext("2d");
        if (!rCtx || typeof recordCanvas.captureStream !== "function") {
            setCameraError("お使いのブラウザはキャンバス動画録画（captureStream）に対応していません。");
            return;
        }
        drawCompositeScene(rCtx, recordCanvas.width, recordCanvas.height, true);

        const { mimeType, ext } = selectSupportedVideoMimeType((m) =>
            MediaRecorder.isTypeSupported(m),
        );
        setCapturedVideoExt(ext);
        recordedChunks = [];
        try {
            const stream = recordCanvas.captureStream(30);
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_500_000 })
                : new MediaRecorder(stream);
            mediaRecorder = recorder;
            recorder.ondataavailable = (ev) => {
                if (ev.data && ev.data.size > 0) {
                    recordedChunks.push(ev.data);
                }
            };
            recorder.onstop = () => {
                const blobType = mimeType || `video/${ext}`;
                const blob = new Blob(recordedChunks, { type: blobType });
                recordedChunks = [];
                if (blob.size > 0) {
                    const prev = capturedVideoUrl();
                    if (prev) URL.revokeObjectURL(prev);
                    setCapturedVideoUrl(createSafeObjectUrl(blob));
                    setShowVideoModal(true);
                }
            };
            recorder.start(250);
            setRecordingSeconds(0);
            setIsRecording(true);
            recordTimerId = window.setInterval(() => {
                setRecordingSeconds((s) => s + 1);
            }, 1000);
        } catch {
            setIsRecording(false);
            setCameraError("動画録画の開始に失敗しました。端末の対応形式をご確認ください。");
        }
    };

    const toggleVideoRecording = () => {
        if (isRecording()) {
            stopVideoRecording();
        } else {
            startVideoRecording();
        }
    };

    const downloadCapturedVideo = () => {
        const url = capturedVideoUrl();
        if (!url || !url.startsWith("blob:")) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = `ar-overlay-${Date.now()}.${capturedVideoExt()}`;
        a.click();
    };

    const downloadCaptured = () => {
        const url = capturedUrl();
        if (!url || !url.startsWith("blob:")) return;
        const ext =
            captureFormat() === "image/jpeg"
                ? "jpg"
                : captureFormat() === "image/webp"
                  ? "webp"
                  : "png";
        const a = document.createElement("a");
        a.href = url;
        a.download = `ar-overlay-${Date.now()}.${ext}`;
        a.click();
    };

    const handlePointerDown = (e: PointerEvent) => {
        if (!previewCanvasRef) return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

        if (activePointers.size === 1) {
            isDragging = true;
            dragStartClientX = e.clientX;
            dragStartClientY = e.clientY;
            dragStartPosX = posXPercent();
            dragStartPosY = posYPercent();
        } else if (activePointers.size === 2) {
            isDragging = false;
            const pts = Array.from(activePointers.values());
            pinchStartDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            pinchStartScale = scale();
        }
    };

    const handlePointerMove = (e: PointerEvent) => {
        if (!previewCanvasRef) return;
        if (!activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 2 && pinchStartDistance > 10) {
            const pts = Array.from(activePointers.values());
            const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            const ratio = dist / pinchStartDistance;
            setScale(Math.round(clampFinite(pinchStartScale * ratio, 0.1, 4.0, 0.65) * 100) / 100);
            return;
        }

        if (!isDragging || activePointers.size !== 1) return;
        const rect = previewCanvasRef.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const dxPct = ((e.clientX - dragStartClientX) / rect.width) * 100;
        const dyPct = ((e.clientY - dragStartClientY) / rect.height) * 100;
        setPosXPercent(Math.round(clampFinite(dragStartPosX + dxPct, -100, 200, 50) * 10) / 10);
        setPosYPercent(Math.round(clampFinite(dragStartPosY + dyPct, -100, 200, 78) * 10) / 10);
    };

    const handlePointerUp = (e: PointerEvent) => {
        const wasSingleDragging = isDragging && activePointers.size === 1;
        activePointers.delete(e.pointerId);
        if (activePointers.size < 2) {
            pinchStartDistance = 0;
        }
        if (activePointers.size === 0) {
            isDragging = false;
        }
        if (wasSingleDragging && mode() === "ar") {
            const cur = currentGyro();
            if (cur) {
                setBaseGyro({ ...cur });
                visualBaseGyro = { ...cur };
            }
            visualOffsetRatioX = 0;
            visualOffsetRatioY = 0;
            visualZoomScale = 1;
            prevGrayFrame = null;
            if (autoDistanceFromAr()) {
                const map = aiDepthMap();
                if (map) {
                    syncDistanceAndScaleFromDepth(map);
                }
            }
            if (autoFocusOnCharacter()) {
                const map = aiDepthMap();
                if (map) {
                    const charDepth = estimateCharacterGroundDepth(
                        map.data,
                        map.width,
                        map.height,
                        clampFinite(posXPercent() / 100, 0.05, 0.95, 0.5),
                        clampFinite(posYPercent() / 100, 0.05, 0.95, 0.78),
                    );
                    const rounded = Math.round(charDepth * 100) / 100;
                    setDofFocusDepth(rounded);
                    updateDofFocusMask(map, rounded, dofApertureF());
                }
            }
        }
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    };

    const handleCanvasWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.04 : 0.04;
        setScale((prev) => Math.round(clampFinite(prev + delta, 0.1, 4.0, 0.65) * 100) / 100);
    };

    onSettled(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".ba-card");
        }
        if (typeof document !== "undefined") {
            document.addEventListener("fullscreenchange", handleFullscreenChange);
            document.addEventListener("visibilitychange", handleVisibilityOrPageShow);
        }
        if (typeof window !== "undefined") {
            window.addEventListener("pageshow", handleVisibilityOrPageShow);
        }
        if (mode() === "ar") {
            void enableGyro(false);
        }
        startRenderLoop();

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (typeof document !== "undefined") {
                document.removeEventListener("fullscreenchange", handleFullscreenChange);
                document.removeEventListener("visibilitychange", handleVisibilityOrPageShow);
            }
            if (typeof window !== "undefined") {
                window.removeEventListener("pageshow", handleVisibilityOrPageShow);
            }
            stopVideoRecording();
            stopCamera();
            disableGyro();
            const o = overlayAsset();
            if (o?.previewUrl) URL.revokeObjectURL(o.previewUrl);
            const b = bgAsset();
            if (b?.previewUrl) URL.revokeObjectURL(b.previewUrl);
            const c = capturedUrl();
            if (c) URL.revokeObjectURL(c);
            const cv = capturedVideoUrl();
            if (cv) URL.revokeObjectURL(cv);
        };
    });

    createEffect(
        () => mode(),
        (currentMode) => {
            if (currentMode === "fixed") {
                setPosYPercent((y) => (y === 78 ? 50 : y));
            } else {
                setPosYPercent((y) => (y === 50 ? 78 : y));
            }
        },
    );

    const downloadExtensionLabel = createMemo(() => {
        if (captureFormat() === "image/jpeg") return "JPEG";
        if (captureFormat() === "image/webp") return "WebP";
        return "PNG";
    });

    return (
        <div ref={containerRef} class="ba-stack-4" style={{ width: "100%" }}>
            {/* コンパクトヘッダー（H1・説明・A11y担保） */}
            <header class="ba-card ba-card--border" style={{ padding: "0.75rem 1rem" }}>
                <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                    <div class="ba-flex ba-items-center ba-gap-3">
                        <span class="ba-icon-box ba-icon-box--primary" aria-hidden="true">
                            <ToolIcon name="camera" class="ba-icon-sm" />
                        </span>
                        <div>
                            <h1 class="ba-title-h1" style={{ "font-size": "1.15rem", margin: 0 }}>
                                {pageTitle()}
                            </h1>
                            <p class="ba-text-xs ba-text-subtle" style={{ margin: 0 }}>
                                {description()}
                            </p>
                            <p class="ba-text-xs ba-text-success" style={{ margin: "0.2rem 0 0", "font-weight": 600 }}>
                                全処理（WebGPUローカルAI解析を含む）は端末内で完結し、映像や立ち絵が外部送信・AI学習に使われることはありません。
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* スマホカメラアプリ風・全画面ビューファインダー */}
            <form
                {...({
                    toolname: "ar_camera_overlay",
                    tooldescription:
                        "Overlay transparent character illustrations onto live camera feed with physically-based AR shadow calculation or fixed screen positioning.",
                } as Record<string, string>)}
                onSubmit={(e) => e.preventDefault()}
            >
                <div
                    ref={cameraStageRef}
                    style={{
                        position: isFullscreen() ? "fixed" : "relative",
                        inset: isFullscreen() ? "0" : "auto",
                        "z-index": isFullscreen() ? "60" : "1",
                        width: isFullscreen()
                            ? "100%"
                            : frameOrientation() === "portrait"
                              ? "min(100%, 440px)"
                              : "100%",
                        "aspect-ratio": isFullscreen()
                            ? "auto"
                            : frameOrientation() === "landscape"
                              ? "16 / 9"
                              : frameOrientation() === "portrait"
                                ? "9 / 16"
                                : "auto",
                        height: isFullscreen()
                            ? "100dvh"
                            : frameOrientation() === "auto"
                              ? "min(78dvh, 760px)"
                              : "auto",
                        "max-height": isFullscreen() ? "100dvh" : "min(80dvh, 780px)",
                        "min-height": isFullscreen() ? "0" : "clamp(240px, 52dvh, 460px)",
                        margin: "0 auto",
                        "background-color": "#0b0f19",
                        "border-radius": isFullscreen() ? "0" : "var(--ba-radius-lg, 16px)",
                        overflow: "hidden",
                        display: "flex",
                        "flex-direction": "column",
                        "justify-content": "space-between",
                        border: isFullscreen() ? "none" : "1px solid var(--ba-border)",
                    }}
                >
                    {/* ライブ合成キャンバス（背景全面） */}
                    <video
                        ref={videoRef}
                        playsinline
                        muted
                        class="ba-sr-only"
                        aria-hidden="true"
                    />
                    <canvas
                        ref={previewCanvasRef}
                        width={1280}
                        height={720}
                        style={{
                            position: "absolute",
                            inset: "0",
                            width: "100%",
                            height: "100%",
                            display: "block",
                            "touch-action": "none",
                            cursor: "grab",
                        }}
                        aria-label="カメラと透過画像の合成プレビューキャンバス"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onWheel={handleCanvasWheel}
                    />

                    {/* シャッターフラッシュ */}
                    <Show when={isFlashActive()}>
                        <div
                            style={{
                                position: "absolute",
                                inset: "0",
                                "background-color": "#ffffff",
                                opacity: "0.75",
                                "pointer-events": "none",
                                "z-index": "30",
                            }}
                            aria-hidden="true"
                        />
                    </Show>

                    {/* 上部フローティングHUD */}
                    <div
                        style={{
                            position: "relative",
                            "z-index": "10",
                            padding: "0.75rem",
                            background:
                                "linear-gradient(180deg, rgba(10,15,28,0.78) 0%, rgba(10,15,28,0.28) 75%, rgba(10,15,28,0) 100%)",
                            display: "flex",
                            "flex-wrap": "wrap",
                            "align-items": "center",
                            "justify-content": "space-between",
                            gap: "0.5rem",
                        }}
                    >
                        {/* 左：カメラ起動・切替 */}
                        <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                            <Show
                                when={isCameraActive()}
                                fallback={
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--primary ba-btn--sm"
                                        onClick={() => void startCamera()}
                                    >
                                        カメラを起動
                                    </button>
                                }
                            >
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--danger ba-btn--sm"
                                    onClick={() => stopCamera()}
                                >
                                    カメラを停止
                                </button>
                            </Show>

                            <button
                                type="button"
                                class="ba-btn ba-btn--secondary ba-btn--sm"
                                onClick={switchCameraFacing}
                            >
                                {cameraFacing() === "environment" ? "外カメラ (切替)" : "内カメラ (切替)"}
                            </button>

                            <Show when={cameraFacing() === "user"}>
                                <label
                                    class="ba-flex ba-items-center ba-gap-1 ba-text-xs ba-cursor-pointer"
                                    style={{ color: "#f8fafc" }}
                                >
                                    <input
                                        type="checkbox"
                                        class="ba-checkbox"
                                        checked={mirrorSelfie()}
                                        onChange={(e) => setMirrorSelfie(e.currentTarget.checked)}
                                    />
                                    <span>左右反転</span>
                                </label>
                            </Show>
                        </div>

                        {/* 右：モード切替 & 全画面トグル */}
                        <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2">
                            <div class="ba-flex ba-gap-1" role="group" aria-label="重ね合わせモード選択">
                                <button
                                    type="button"
                                    class={`ba-btn ba-btn--xs ${mode() === "ar" ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                    aria-pressed={mode() === "ar" ? "true" : "false"}
                                    onClick={() => handleModeChange("ar")}
                                >
                                    AR空間モード
                                </button>
                                <button
                                    type="button"
                                    class={`ba-btn ba-btn--xs ${mode() === "fixed" ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                    aria-pressed={mode() === "fixed" ? "true" : "false"}
                                    onClick={() => handleModeChange("fixed")}
                                >
                                    自由固定モード
                                </button>
                            </div>

                            <button
                                type="button"
                                class="ba-btn ba-btn--secondary ba-btn--xs"
                                onClick={() => {
                                    const order: FrameOrientationMode[] = ["auto", "landscape", "portrait"];
                                    const idx = order.indexOf(frameOrientation());
                                    const next = order[(idx + 1) % order.length];
                                    setFrameOrientation(next);
                                    prevGrayFrame = null;
                                }}
                            >
                                {frameOrientation() === "auto"
                                    ? "向き: 自動"
                                    : frameOrientation() === "landscape"
                                      ? "横撮り (16:9)"
                                      : "縦撮り (9:16)"}
                            </button>

                            <button
                                type="button"
                                class="ba-btn ba-btn--secondary ba-btn--xs"
                                aria-pressed={isFullscreen() ? "true" : "false"}
                                onClick={() => void toggleFullscreen()}
                            >
                                {isFullscreen() ? "全画面終了" : "全画面"}
                            </button>
                        </div>
                    </div>

                    {/* 中央：エラーまたは画像未選択ガイド */}
                    <div
                        style={{
                            position: "relative",
                            "z-index": "10",
                            padding: "0 1rem",
                            display: "flex",
                            "flex-direction": "column",
                            "align-items": "center",
                            gap: "0.5rem",
                            "pointer-events": "none",
                        }}
                    >
                        <Show when={cameraError()}>
                            <div
                                class="ba-alert ba-alert--warning ba-text-xs"
                                role="alert"
                                style={{ "pointer-events": "auto", "max-width": "420px" }}
                            >
                                {cameraError()}
                            </div>
                        </Show>

                        <Show when={!overlayAsset()}>
                            <div
                                style={{
                                    "pointer-events": "auto",
                                    background: "rgba(15, 23, 42, 0.82)",
                                    color: "#f8fafc",
                                    padding: "0.75rem 1rem",
                                    "border-radius": "12px",
                                    border: "1px solid rgba(255,255,255,0.16)",
                                    "text-align": "center",
                                    "max-width": "360px",
                                }}
                            >
                                <p class="ba-text-xs" style={{ margin: "0 0 0.5rem" }}>
                                    立ち絵などの透過画像を選んでください（ドラッグ移動・2本指ピンチで拡大縮小）
                                </p>
                                <div class="ba-flex ba-flex-wrap ba-justify-center ba-gap-2">
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--primary ba-btn--xs"
                                        onClick={() => overlayInputRef?.click()}
                                    >
                                        透過画像を選択
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>

                    {/* 下部：スマホカメラアプリ風シャッターバー */}
                    <div
                        style={{
                            position: "relative",
                            "z-index": "10",
                            padding: "0.75rem 0.75rem 0.9rem",
                            background:
                                "linear-gradient(0deg, rgba(10,15,28,0.9) 0%, rgba(10,15,28,0.52) 72%, rgba(10,15,28,0) 100%)",
                            display: "flex",
                            "flex-direction": "column",
                            "align-items": "stretch",
                            gap: "0.625rem",
                            width: "100%",
                            "box-sizing": "border-box",
                        }}
                    >
                        {/* ローカルAI奥に配置パネル */}
                        <Show when={occlusionPaintMode()}>
                            <div
                                role="region"
                                aria-label="ローカルAI奥に配置パネル"
                                style={{
                                    background: "rgba(15, 23, 42, 0.88)",
                                    color: "#f8fafc",
                                    padding: "0.45rem 0.65rem",
                                    "border-radius": "10px",
                                    display: "flex",
                                    "flex-wrap": "wrap",
                                    "align-items": "center",
                                    "justify-content": "center",
                                    gap: "0.4rem",
                                    "font-size": "0.75rem",
                                }}
                            >
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--primary ba-btn--xs"
                                    disabled={aiDepthBusy()}
                                    onClick={() => void runAiDepthOcclusion()}
                                >
                                    {aiDepthBusy() ? "AI解析中..." : "AI自動判定 (WebGPU)"}
                                </button>
                                <Show when={aiDepthMap()}>
                                    {(map) => (
                                        <label class="ba-flex ba-items-center ba-gap-1">
                                            <span>奥行き</span>
                                            <input
                                                type="range"
                                                min="0.05"
                                                max="0.95"
                                                step="0.01"
                                                aria-label="AI奥行き前後位置"
                                                value={aiDepthThreshold()}
                                                onInput={(e) => {
                                                    const v = clampFinite(Number(e.currentTarget.value), 0.05, 0.95, 0.55);
                                                    setAiDepthThreshold(v);
                                                    applyDepthMaskToOcclusion(map(), v);
                                                }}
                                                style={{ width: "80px" }}
                                            />
                                        </label>
                                    )}
                                </Show>
                                <Show when={hasOcclusion()}>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        style={{ color: "#f8fafc", "border-color": "rgba(255,255,255,0.4)" }}
                                        onClick={clearOcclusion}
                                    >
                                        解除
                                    </button>
                                </Show>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--success ba-btn--xs"
                                    onClick={() => setOcclusionPaintMode(false)}
                                >
                                    完了
                                </button>
                                <div style={{ width: "100%", "text-align": "center", "font-size": "0.6875rem", color: "#cbd5e1" }}>
                                    {aiDepthStatus() || "端末内（WebGPU）のみで解析・外部送信やAI学習には一切使用されません"}
                                </div>
                            </div>
                        </Show>

                        {/* 上段：画像選択・奥に配置・調整ボタン（狭い画面でも折り返して収まる） */}
                        <div
                            style={{
                                display: "flex",
                                "flex-wrap": "wrap",
                                "align-items": "center",
                                "justify-content": "center",
                                gap: "0.375rem",
                            }}
                        >
                            <button
                                type="button"
                                class="ba-btn ba-btn--secondary ba-btn--xs"
                                onClick={() => overlayInputRef?.click()}
                            >
                                画像を選択
                            </button>
                            <button
                                type="button"
                                class="ba-btn ba-btn--outline ba-btn--xs"
                                style={{ color: "#f8fafc", "border-color": "rgba(255,255,255,0.4)" }}
                                onClick={() => bgInputRef?.click()}
                            >
                                背景画像
                            </button>
                            <button
                                type="button"
                                class={`ba-btn ba-btn--xs ${occlusionPaintMode() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                aria-pressed={occlusionPaintMode() ? "true" : "false"}
                                onClick={() => setOcclusionPaintMode((v) => !v)}
                            >
                                {occlusionPaintMode() ? "奥に配置(開)" : "奥に配置"}
                            </button>
                            <button
                                type="button"
                                class={`ba-btn ba-btn--xs ${showSettingsDrawer() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                aria-expanded={showSettingsDrawer() ? "true" : "false"}
                                onClick={() => setShowSettingsDrawer((v) => !v)}
                            >
                                {showSettingsDrawer() ? "調整を閉じる" : "影・配置調整"}
                            </button>
                        </div>

                        {/* 下段：左サムネイル・中央シャッターボタン・右スペーサー */}
                        <div
                            style={{
                                display: "grid",
                                "grid-template-columns": "1fr auto 1fr",
                                "align-items": "center",
                                width: "100%",
                            }}
                        >
                            <div style={{ "justify-self": "start" }}>
                                <Show when={capturedUrl()}>
                                    {(url) => (
                                        <button
                                            type="button"
                                            aria-label="撮影した写真を確認"
                                            onClick={() => setShowCaptureModal(true)}
                                            style={{
                                                width: "44px",
                                                height: "44px",
                                                padding: 0,
                                                "border-radius": "8px",
                                                overflow: "hidden",
                                                border: "2px solid #ffffff",
                                                cursor: "pointer",
                                                background: "#0f172a",
                                            }}
                                        >
                                            <img
                                                src={url()}
                                                alt="直前の撮影写真"
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    "object-fit": "cover",
                                                }}
                                            />
                                        </button>
                                    )}
                                </Show>
                            </div>

                            {/* 中央：スマホカメラ風シャッターボタン */}
                            <button
                                type="button"
                                onClick={capturePhoto}
                                aria-label="撮影する (シャッター)"
                                style={{
                                    "justify-self": "center",
                                    width: "64px",
                                    height: "64px",
                                    "border-radius": "9999px",
                                    border: "4px solid #ffffff",
                                    background: "rgba(255, 255, 255, 0.22)",
                                    display: "flex",
                                    "align-items": "center",
                                    "justify-content": "center",
                                    cursor: "pointer",
                                    "flex-shrink": 0,
                                }}
                            >
                                <span
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        "border-radius": "9999px",
                                        "background-color": "#ffffff",
                                        display: "block",
                                    }}
                                    aria-hidden="true"
                                />
                            </button>

                            <div style={{ "justify-self": "end" }}>
                                <button
                                    type="button"
                                    class={`ba-btn ba-btn--sm ${isRecording() ? "ba-btn--danger" : "ba-btn--secondary"}`}
                                    aria-pressed={isRecording() ? "true" : "false"}
                                    onClick={toggleVideoRecording}
                                    style={{
                                        display: "inline-flex",
                                        "align-items": "center",
                                        gap: "0.35rem",
                                    }}
                                >
                                    <span
                                        style={{
                                            width: "10px",
                                            height: "10px",
                                            "border-radius": isRecording() ? "2px" : "9999px",
                                            "background-color": isRecording() ? "#ffffff" : "#ef4444",
                                            display: "inline-block",
                                        }}
                                        aria-hidden="true"
                                    />
                                    <span>
                                        {isRecording()
                                            ? `停止 (${formatRecordingTime(recordingSeconds())})`
                                            : "動画録画"}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 隠しファイル入力（写真ライブラリ・ドライブ両対応） */}
                    <input
                        ref={overlayInputRef}
                        type="file"
                        class="ba-sr-only"
                        aria-label="写真やドライブから透過画像を選択"
                        onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            if (file) handleOverlayFile(file);
                            e.currentTarget.value = "";
                        }}
                    />
                    <input
                        ref={bgInputRef}
                        type="file"
                        class="ba-sr-only"
                        aria-label="テスト用背景画像を選択"
                        onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            if (file) handleBgFile(file);
                            e.currentTarget.value = "";
                        }}
                    />

                    {/* スライドアップ設定ドロワー（カメラ画面上に重ねて表示） */}
                    <Show when={showSettingsDrawer()}>
                        <div
                            class="ba-card"
                            role="region"
                            aria-label="カメラ合成の配置とリアル影詳細設定"
                            style={{
                                position: "absolute",
                                right: "0.75rem",
                                bottom: "5.25rem",
                                "z-index": "20",
                                width: "min(360px, calc(100% - 1.5rem))",
                                "max-height": "calc(100% - 9.5rem)",
                                display: "flex",
                                "flex-direction": "column",
                                overflow: "hidden",
                                padding: "0",
                                "box-shadow": "0 16px 40px rgba(0,0,0,0.45)",
                            }}
                        >
                            {/* 固定ヘッダー（スクロールしても閉じるボタンが残る） */}
                            <div
                                class="ba-flex ba-items-center ba-justify-between"
                                style={{
                                    "flex-shrink": 0,
                                    padding: "0.75rem 1rem",
                                    "border-bottom": "1px solid var(--ba-border)",
                                }}
                            >
                                <h2 class="ba-card-title" style={{ "font-size": "0.95rem", margin: 0 }}>
                                    配置・影・保存設定
                                </h2>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--ghost ba-btn--xs"
                                    onClick={() => setShowSettingsDrawer(false)}
                                    aria-label="調整パネルを閉じる"
                                >
                                    閉じる ×
                                </button>
                            </div>

                            {/* スクロール可能な設定項目エリア */}
                            <div
                                class="ba-stack-3"
                                style={{
                                    flex: "1 1 0%",
                                    "overflow-y": "auto",
                                    padding: "0.85rem 1rem 1rem",
                                }}
                            >
                                {/* 立ち絵クイック操作 */}
                                <div class="ba-flex ba-flex-wrap ba-gap-2">
                                    <button
                                        type="button"
                                        class={`ba-btn ba-btn--xs ${flipHorizontal() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                        onClick={() => setFlipHorizontal((v) => !v)}
                                    >
                                        左右反転
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        onClick={() => {
                                            setPosXPercent(50);
                                            setPosYPercent(mode() === "ar" ? 78 : 50);
                                            setScale(0.65);
                                            setRotationDeg(0);
                                            setCameraPitchDeg(0);
                                            setOpacity(1);
                                            setFlipHorizontal(false);
                                        }}
                                    >
                                        配置リセット
                                    </button>
                                </div>

                                <div>
                                    <label for="pos-x-range" class="ba-label">
                                        <span>横位置 (X)</span>
                                        <span>{posXPercent().toFixed(1)}%</span>
                                    </label>
                                    <input
                                        id="pos-x-range"
                                        type="range"
                                        min="-100"
                                        max="200"
                                        step="0.5"
                                        class="ba-range"
                                        value={posXPercent()}
                                        onInput={(e) =>
                                            setPosXPercent(clampFinite(Number(e.currentTarget.value), -100, 200, 50))
                                        }
                                    />
                                </div>

                                <div>
                                    <label for="pos-y-range" class="ba-label">
                                        <span>{mode() === "ar" ? "足元接地位置 (Y)" : "縦位置 (Y)"}</span>
                                        <span>{posYPercent().toFixed(1)}%</span>
                                    </label>
                                    <input
                                        id="pos-y-range"
                                        type="range"
                                        min="-100"
                                        max="200"
                                        step="0.5"
                                        class="ba-range"
                                        value={posYPercent()}
                                        onInput={(e) =>
                                            setPosYPercent(clampFinite(Number(e.currentTarget.value), -100, 200, 78))
                                        }
                                    />
                                </div>

                                <div>
                                    <label for="scale-range" class="ba-label">
                                        <span>サイズ (拡大率)</span>
                                        <span>{Math.round(scale() * 100)}%</span>
                                    </label>
                                    <input
                                        id="scale-range"
                                        type="range"
                                        min="0.1"
                                        max="4"
                                        step="0.05"
                                        class="ba-range"
                                        value={scale()}
                                        onInput={(e) =>
                                            setScale(clampFinite(Number(e.currentTarget.value), 0.1, 4.0, 0.65))
                                        }
                                    />
                                </div>

                                {/* 身長・距離による実寸サイズ計算 */}
                                <div
                                    class="ba-stack-2"
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        "border-radius": "var(--ba-radius)",
                                        border: "1px solid var(--ba-border)",
                                    }}
                                >
                                    <div class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-flex-wrap">
                                        <span class="ba-text-xs ba-font-bold">身長・距離から実寸合わせ</span>
                                        <div class="ba-flex ba-items-center ba-gap-1">
                                            <button
                                                type="button"
                                                class="ba-btn ba-btn--secondary ba-btn--xs"
                                                disabled={aiDepthBusy()}
                                                onClick={() => {
                                                    const map = aiDepthMap();
                                                    if (map) {
                                                        syncDistanceAndScaleFromDepth(map);
                                                    } else {
                                                        void runAiDepthOcclusion();
                                                    }
                                                }}
                                            >
                                                {aiDepthBusy() ? "解析中..." : "ARから距離合わせ"}
                                            </button>
                                            <button
                                                type="button"
                                                class="ba-btn ba-btn--primary ba-btn--xs"
                                                onClick={() => applyHeightScale(characterHeightCm(), cameraDistanceM())}
                                            >
                                                サイズを合わせる
                                            </button>
                                        </div>
                                    </div>
                                    <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer">
                                        <input
                                            type="checkbox"
                                            class="ba-checkbox"
                                            checked={autoDistanceFromAr()}
                                            onChange={(e) => {
                                                const checked = e.currentTarget.checked;
                                                setAutoDistanceFromAr(checked);
                                                const map = aiDepthMap();
                                                if (checked && map) {
                                                    syncDistanceAndScaleFromDepth(map);
                                                }
                                            }}
                                        />
                                        <span>AR奥行き解析・位置移動に合わせて距離と身長を自動調整</span>
                                    </label>
                                    <div class="ba-grid ba-grid-cols-2 ba-gap-2">
                                        <div>
                                            <label for="character-height-input" class="ba-label">
                                                <span>身長 (cm)</span>
                                            </label>
                                            <input
                                                id="character-height-input"
                                                type="number"
                                                min="20"
                                                max="350"
                                                step="1"
                                                class="ba-input ba-input--sm"
                                                value={characterHeightCm()}
                                                onInput={(e) => {
                                                    const raw = Number(e.currentTarget.value);
                                                    if (!Number.isFinite(raw)) return;
                                                    const next = clampFinite(raw, 20, 350, 160);
                                                    setCharacterHeightCm(next);
                                                    applyHeightScale(next, cameraDistanceM());
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label for="camera-distance-input" class="ba-label">
                                                <span>距離 (m)</span>
                                            </label>
                                            <input
                                                id="camera-distance-input"
                                                type="number"
                                                min="0.3"
                                                max="30"
                                                step="0.1"
                                                class="ba-input ba-input--sm"
                                                value={cameraDistanceM()}
                                                onInput={(e) => {
                                                    const raw = Number(e.currentTarget.value);
                                                    if (!Number.isFinite(raw)) return;
                                                    const next = clampFinite(raw, 0.3, 30, 2.5);
                                                    setCameraDistanceM(next);
                                                    applyHeightScale(characterHeightCm(), next);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="ba-grid ba-grid-cols-2 ba-gap-2">
                                    <div>
                                        <label for="rotation-range" class="ba-label">
                                            <span>回転</span>
                                            <span>{rotationDeg()}°</span>
                                        </label>
                                        <input
                                            id="rotation-range"
                                            type="range"
                                            min="-180"
                                            max="180"
                                            step="1"
                                            class="ba-range"
                                            value={rotationDeg()}
                                            onInput={(e) =>
                                                setRotationDeg(clampFinite(Number(e.currentTarget.value), -180, 180, 0))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label for="opacity-range" class="ba-label">
                                            <span>不透明度</span>
                                            <span>{Math.round(opacity() * 100)}%</span>
                                        </label>
                                        <input
                                            id="opacity-range"
                                            type="range"
                                            min="0.1"
                                            max="1"
                                            step="0.05"
                                            class="ba-range"
                                            value={opacity()}
                                            onInput={(e) =>
                                                setOpacity(clampFinite(Number(e.currentTarget.value), 0.1, 1, 1))
                                            }
                                        />
                                    </div>
                                </div>

                                {/* ローアングル煽り・ハイアングル俯瞰パース */}
                                <div>
                                    <label for="camera-pitch-range" class="ba-label">
                                        <span>煽り・俯瞰アングル (ロー ↔ ハイ)</span>
                                        <span>
                                            {cameraPitchDeg() === 0
                                                ? "水平 0°"
                                                : cameraPitchDeg() < 0
                                                    ? `ローアングル ${Math.abs(cameraPitchDeg())}°`
                                                    : `ハイアングル ${cameraPitchDeg()}°`}
                                        </span>
                                    </label>
                                    <input
                                        id="camera-pitch-range"
                                        type="range"
                                        min="-60"
                                        max="60"
                                        step="1"
                                        class="ba-range"
                                        value={cameraPitchDeg()}
                                        onInput={(e) =>
                                            setCameraPitchDeg(clampFinite(Number(e.currentTarget.value), -60, 60, 0))
                                        }
                                    />
                                    <Show when={mode() === "ar"}>
                                        <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer" style={{ "margin-top": "0.35rem" }}>
                                            <input
                                                type="checkbox"
                                                class="ba-checkbox"
                                                checked={autoPitchFromGyro()}
                                                onChange={(e) => setAutoPitchFromGyro(e.currentTarget.checked)}
                                            />
                                            <span>スマホの上下傾きに煽り・俯瞰パースを自動連動</span>
                                        </label>
                                    </Show>
                                </div>

                                {/* 被写界深度（DoF）・フォーカス操作 */}
                                <div
                                    class="ba-stack-2"
                                    style={{
                                        padding: "0.6rem 0.75rem",
                                        "border-radius": "var(--ba-radius)",
                                        border: "1px solid var(--ba-border)",
                                    }}
                                >
                                    <div class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-flex-wrap">
                                        <span class="ba-text-xs ba-font-bold">被写界深度・フォーカス操作</span>
                                        <div class="ba-flex ba-items-center ba-gap-1">
                                            <button
                                                type="button"
                                                class="ba-btn ba-btn--secondary ba-btn--xs"
                                                disabled={aiDepthBusy()}
                                                onClick={focusOnCharacter}
                                            >
                                                {aiDepthBusy() ? "解析中..." : "立ち絵にピント合わせ"}
                                            </button>
                                            <button
                                                type="button"
                                                class={`ba-btn ba-btn--xs ${dofEnabled() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                                aria-pressed={dofEnabled() ? "true" : "false"}
                                                onClick={() => setDofEnabled((v) => !v)}
                                            >
                                                {dofEnabled() ? "ボケON" : "ボケOFF"}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label for="dof-aperture-range" class="ba-label">
                                            <span>絞り (F値 / ボケの強さ)</span>
                                            <span>f/{dofApertureF().toFixed(1)}</span>
                                        </label>
                                        <input
                                            id="dof-aperture-range"
                                            type="range"
                                            min="1.4"
                                            max="16"
                                            step="0.2"
                                            class="ba-range"
                                            value={dofApertureF()}
                                            onInput={(e) => {
                                                const nextF = clampFinite(Number(e.currentTarget.value), 1.4, 16, 2.4);
                                                setDofApertureF(nextF);
                                                if (!dofEnabled()) setDofEnabled(true);
                                                const map = aiDepthMap();
                                                if (map) {
                                                    updateDofFocusMask(map, dofFocusDepth(), nextF);
                                                }
                                            }}
                                        />
                                    </div>
                                    <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer">
                                        <input
                                            type="checkbox"
                                            class="ba-checkbox"
                                            checked={autoFocusOnCharacter()}
                                            onChange={(e) => {
                                                const checked = e.currentTarget.checked;
                                                setAutoFocusOnCharacter(checked);
                                                if (checked) {
                                                    const map = aiDepthMap();
                                                    if (map) {
                                                        const charDepth = estimateCharacterGroundDepth(
                                                            map.data,
                                                            map.width,
                                                            map.height,
                                                            clampFinite(posXPercent() / 100, 0.05, 0.95, 0.5),
                                                            clampFinite(posYPercent() / 100, 0.05, 0.95, 0.78),
                                                        );
                                                        const rounded = Math.round(charDepth * 100) / 100;
                                                        setDofFocusDepth(rounded);
                                                        updateDofFocusMask(map, rounded, dofApertureF());
                                                    }
                                                }
                                            }}
                                        />
                                        <span>立ち絵の位置にオートフォーカス追従</span>
                                    </label>
                                    <Show when={hasDofMask() || !autoFocusOnCharacter()}>
                                        <div>
                                            <label for="dof-focus-depth-range" class="ba-label">
                                                <span>ピント位置 (奥 ↔ 手前)</span>
                                                <span>{Math.round(dofFocusDepth() * 100)}%</span>
                                            </label>
                                            <input
                                                id="dof-focus-depth-range"
                                                type="range"
                                                min="0.05"
                                                max="0.95"
                                                step="0.01"
                                                class="ba-range"
                                                value={dofFocusDepth()}
                                                onInput={(e) => {
                                                    const nextFocus = clampFinite(
                                                        Number(e.currentTarget.value),
                                                        0.05,
                                                        0.95,
                                                        0.55,
                                                    );
                                                    setAutoFocusOnCharacter(false);
                                                    setDofFocusDepth(nextFocus);
                                                    if (!dofEnabled()) setDofEnabled(true);
                                                    const map = aiDepthMap();
                                                    if (map) {
                                                        updateDofFocusMask(map, nextFocus, dofApertureF());
                                                    }
                                                }}
                                            />
                                        </div>
                                    </Show>
                                </div>

                                {/* ARモード専用パラメータ */}
                                <Show when={mode() === "ar"}>
                                    <div class="ba-stack-2" style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "0.75rem" }}>
                                        <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                                            <span class="ba-text-xs ba-font-bold">ARリアル影・ジャイロ</span>
                                            <div class="ba-flex ba-gap-1">
                                                <button
                                                    type="button"
                                                    class={`ba-btn ba-btn--xs ${gyroEnabled() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                                    onClick={() => void toggleGyro()}
                                                >
                                                    {gyroEnabled() ? "ジャイロON" : "ジャイロOFF"}
                                                </button>
                                                <button
                                                    type="button"
                                                    class={`ba-btn ba-btn--xs ${visualTrackingEnabled() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                                    onClick={() => setVisualTrackingEnabled((v) => !v)}
                                                >
                                                    {visualTrackingEnabled() ? "映像追従ON" : "映像追従OFF"}
                                                </button>
                                                <Show when={gyroEnabled() || visualTrackingEnabled()}>
                                                    <button
                                                        type="button"
                                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                                        onClick={resetGyroAnchor}
                                                    >
                                                        基準リセット
                                                    </button>
                                                </Show>
                                            </div>
                                        </div>
                                        <Show when={gyroStatus()}>
                                            <p class="ba-text-xs ba-text-subtle">{gyroStatus()}</p>
                                        </Show>

                                        <div>
                                            <label for="light-azimuth-range" class="ba-label">
                                                <span>光源の向き (方位角)</span>
                                                <span>{lightAzimuthDeg()}°</span>
                                            </label>
                                            <input
                                                id="light-azimuth-range"
                                                type="range"
                                                min="0"
                                                max="360"
                                                step="1"
                                                class="ba-range"
                                                value={lightAzimuthDeg()}
                                                onInput={(e) => {
                                                    setAutoLightDirection(false);
                                                    setLightAzimuthDeg(clampFinite(Number(e.currentTarget.value), 0, 360, 315));
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label for="light-elevation-range" class="ba-label">
                                                <span>光源の高さ (照明高度)</span>
                                                <span>{lightElevationDeg()}°</span>
                                            </label>
                                            <input
                                                id="light-elevation-range"
                                                type="range"
                                                min="10"
                                                max="85"
                                                step="1"
                                                class="ba-range"
                                                value={lightElevationDeg()}
                                                onInput={(e) =>
                                                    setLightElevationDeg(clampFinite(Number(e.currentTarget.value), 10, 85, 42))
                                                }
                                            />
                                        </div>

                                        <div>
                                            <label for="ground-tilt-range" class="ba-label">
                                                <span>地面の見下ろし角</span>
                                                <span>{groundTiltDeg()}°</span>
                                            </label>
                                            <input
                                                id="ground-tilt-range"
                                                type="range"
                                                min="12"
                                                max="80"
                                                step="1"
                                                class="ba-range"
                                                value={groundTiltDeg()}
                                                onInput={(e) =>
                                                    setGroundTiltDeg(clampFinite(Number(e.currentTarget.value), 12, 80, 34))
                                                }
                                            />
                                        </div>

                                        <div class="ba-grid ba-grid-cols-2 ba-gap-2">
                                            <div>
                                                <label for="shadow-opacity-range" class="ba-label">
                                                    <span>影の濃さ</span>
                                                    <span>{Math.round(shadowOpacity() * 100)}%</span>
                                                </label>
                                                <input
                                                    id="shadow-opacity-range"
                                                    type="range"
                                                    min="0"
                                                    max="0.9"
                                                    step="0.05"
                                                    class="ba-range"
                                                    value={shadowOpacity()}
                                                    onInput={(e) =>
                                                        setShadowOpacity(clampFinite(Number(e.currentTarget.value), 0, 0.9, 0.52))
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label for="shadow-softness-range" class="ba-label">
                                                    <span>影のぼかし</span>
                                                    <span>{Math.round(shadowSoftness() * 100)}%</span>
                                                </label>
                                                <input
                                                    id="shadow-softness-range"
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    class="ba-range"
                                                    value={shadowSoftness()}
                                                    onInput={(e) =>
                                                        setShadowSoftness(clampFinite(Number(e.currentTarget.value), 0, 1, 0.42))
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer">
                                            <input
                                                type="checkbox"
                                                class="ba-checkbox"
                                                checked={autoAmbientMatch()}
                                                onChange={(e) => setAutoAmbientMatch(e.currentTarget.checked)}
                                            />
                                            <span>環境光・背景色・光源に合わせて立ち絵の色を自動馴染ませ</span>
                                        </label>
                                        <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer">
                                            <input
                                                type="checkbox"
                                                class="ba-checkbox"
                                                checked={autoLightDirection()}
                                                onChange={(e) => setAutoLightDirection(e.currentTarget.checked)}
                                            />
                                            <span>映像の明暗から光源方向を自動推定</span>
                                        </label>
                                        <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer">
                                            <input
                                                type="checkbox"
                                                class="ba-checkbox"
                                                checked={showArGrid()}
                                                onChange={(e) => setShowArGrid(e.currentTarget.checked)}
                                            />
                                            <span>地面パースガイドを表示</span>
                                        </label>
                                        <div class="ba-text-xs ba-text-subtle">
                                            推定輝度: {Math.round(envLighting().luminance * 100)}% / ぼかし:{" "}
                                            {currentShadowPreview().blurPx.toFixed(1)}px
                                        </div>
                                    </div>
                                </Show>

                                {/* 保存形式 */}
                                <div class="ba-flex ba-items-center ba-justify-between ba-gap-2" style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "0.5rem" }}>
                                    <label for="capture-format-select" class="ba-text-xs ba-font-bold">
                                        保存形式
                                    </label>
                                    <select
                                        id="capture-format-select"
                                        class="ba-select ba-select--sm"
                                        style={{ width: "auto" }}
                                        value={captureFormat()}
                                        onChange={(e) =>
                                            setCaptureFormat(
                                                e.currentTarget.value as "image/png" | "image/jpeg" | "image/webp",
                                            )
                                        }
                                    >
                                        <option value="image/png">PNG (高画質)</option>
                                        <option value="image/jpeg">JPEG (軽量)</option>
                                        <option value="image/webp">WebP (高効率)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* 撮影プレビューモーダル */}
                    <Show when={showCaptureModal() && capturedUrl()}>
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label="撮影結果プレビュー"
                            style={{
                                position: "absolute",
                                inset: "0",
                                "z-index": "40",
                                background: "rgba(10, 15, 28, 0.88)",
                                display: "flex",
                                "flex-direction": "column",
                                "align-items": "center",
                                "justify-content": "center",
                                padding: "1rem",
                                gap: "0.75rem",
                            }}
                        >
                            <img
                                src={capturedUrl()!}
                                alt="撮影された合成写真"
                                style={{
                                    "max-width": "100%",
                                    "max-height": "calc(100% - 4.5rem)",
                                    "border-radius": "10px",
                                    "object-fit": "contain",
                                    border: "1px solid rgba(255,255,255,0.2)",
                                }}
                            />
                            <div class="ba-flex ba-gap-2">
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--success ba-btn--sm"
                                    onClick={downloadCaptured}
                                >
                                    {downloadExtensionLabel()}で保存
                                </button>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--secondary ba-btn--sm"
                                    onClick={() => setShowCaptureModal(false)}
                                >
                                    カメラに戻る
                                </button>
                            </div>
                        </div>
                    </Show>

                    {/* 動画録画プレビューモーダル */}
                    <Show when={showVideoModal() && capturedVideoUrl()}>
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label="録画動画プレビュー"
                            style={{
                                position: "absolute",
                                inset: "0",
                                "z-index": "40",
                                background: "rgba(10, 15, 28, 0.9)",
                                display: "flex",
                                "flex-direction": "column",
                                "align-items": "center",
                                "justify-content": "center",
                                padding: "1rem",
                                gap: "0.75rem",
                            }}
                        >
                            <video
                                src={capturedVideoUrl()!}
                                controls
                                playsinline
                                autoplay
                                loop
                                style={{
                                    "max-width": "100%",
                                    "max-height": "calc(100% - 4.5rem)",
                                    "border-radius": "10px",
                                    border: "1px solid rgba(255,255,255,0.2)",
                                }}
                            />
                            <div class="ba-flex ba-gap-2">
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--success ba-btn--sm"
                                    onClick={downloadCapturedVideo}
                                >
                                    {capturedVideoExt().toUpperCase()}動画で保存
                                </button>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--secondary ba-btn--sm"
                                    onClick={() => setShowVideoModal(false)}
                                >
                                    カメラに戻る
                                </button>
                            </div>
                        </div>
                    </Show>
                </div>
            </form>

            <AdSense />
        </div>
    );
}
