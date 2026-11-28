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
    createShadowSilhouettePixels,
    createSafeObjectUrl,
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

    // 画像アセット
    const [overlayAsset, setOverlayAsset] = createSignal<OverlayImageAsset | null>(null);
    const [bgAsset, setBgAsset] = createSignal<BackgroundImageAsset | null>(null);

    // 共通配置パラメータ
    const [posXPercent, setPosXPercent] = createSignal<number>(50);
    const [posYPercent, setPosYPercent] = createSignal<number>(78);
    const [scale, setScale] = createSignal<number>(0.65);
    const [rotationDeg, setRotationDeg] = createSignal<number>(0);
    const [opacity, setOpacity] = createSignal<number>(1.0);
    const [flipHorizontal, setFlipHorizontal] = createSignal<boolean>(false);
    const [isPositionLocked, setIsPositionLocked] = createSignal<boolean>(false);

    // ARモード専用パラメータ（リアル影・接地・環境光・ジャイロ）
    const [lightAzimuthDeg, setLightAzimuthDeg] = createSignal<number>(315);
    const [lightElevationDeg, setLightElevationDeg] = createSignal<number>(42);
    const [groundTiltDeg, setGroundTiltDeg] = createSignal<number>(34);
    const [shadowOpacity, setShadowOpacity] = createSignal<number>(0.52);
    const [shadowSoftness, setShadowSoftness] = createSignal<number>(0.42);
    const [autoAmbientMatch, setAutoAmbientMatch] = createSignal<boolean>(true);
    const [autoLightDirection, setAutoLightDirection] = createSignal<boolean>(false);
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

    // 撮影結果
    const [capturedUrl, setCapturedUrl] = createSignal<string | null>(null);
    const [captureFormat, setCaptureFormat] = createSignal<"image/png" | "image/jpeg" | "image/webp">("image/png");
    const [isFlashActive, setIsFlashActive] = createSignal<boolean>(false);

    // ドラッグ操作状態
    let isDragging = false;
    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let dragStartPosX = 50;
    let dragStartPosY = 78;

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

    const stopCamera = () => {
        if (mediaStream) {
            for (const track of mediaStream.getTracks()) {
                track.stop();
            }
            mediaStream = null;
        }
        if (videoRef) {
            videoRef.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
        if (
            event.alpha === null ||
            event.beta === null ||
            event.gamma === null
        ) {
            return;
        }
        const sample: GyroOrientation = {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
        };
        if (!baseGyro()) {
            setBaseGyro(sample);
        }
        setCurrentGyro(sample);
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

    const toggleGyro = async () => {
        if (gyroEnabled()) {
            disableGyro();
            return;
        }
        if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") {
            setGyroStatus("この端末・ブラウザはジャイロセンサーに対応していません。");
            return;
        }
        try {
            const devOrientAny = DeviceOrientationEvent as unknown as {
                requestPermission?: () => Promise<"granted" | "denied">;
            };
            if (typeof devOrientAny.requestPermission === "function") {
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
            setGyroStatus("空間アンカー有効（端末を動かすと追従します）");
        } catch {
            setGyroStatus("ジャイロセンサーの起動に失敗しました。");
        }
    };

    const resetGyroAnchor = () => {
        const cur = currentGyro();
        if (cur) {
            setBaseGyro({ ...cur });
            setGyroStatus("空間アンカーの基準位置をリセットしました");
        }
    };

    const handleModeChange = (nextMode: OverlayMode) => {
        setMode(nextMode);
        if (nextMode === "fixed" && gyroEnabled()) {
            disableGyro();
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
        if (!file.type.startsWith("image/")) return;
        const prev = overlayAsset();
        if (prev?.previewUrl) {
            URL.revokeObjectURL(prev.previewUrl);
        }
        const previewUrl = createSafeObjectUrl(file);
        const img = new Image();
        img.onload = () => {
            setOverlayAsset(buildOverlayAsset(file.name, previewUrl, img));
        };
        img.src = previewUrl;
    };

    const handleBgFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
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
        };
        img.src = previewUrl;
    };

    const loadSampleCharacter = () => {
        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = 420;
        sampleCanvas.height = 680;
        const ctx = sampleCanvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, 420, 680);

        ctx.fillStyle = "#312e81";
        ctx.beginPath();
        ctx.ellipse(210, 170, 72, 92, 0, 0, Math.PI * 2);
        ctx.fill();

        const coatGrad = ctx.createLinearGradient(120, 220, 300, 560);
        coatGrad.addColorStop(0, "#4f46e5");
        coatGrad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = coatGrad;
        ctx.beginPath();
        ctx.moveTo(165, 225);
        ctx.lineTo(255, 225);
        ctx.lineTo(315, 515);
        ctx.lineTo(105, 515);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#1e293b";
        ctx.fillRect(168, 505, 28, 130);
        ctx.fillRect(224, 505, 28, 130);
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.roundRect(156, 615, 44, 30, 8);
        ctx.roundRect(220, 615, 44, 30, 8);
        ctx.fill();

        ctx.fillStyle = "#fde6d8";
        ctx.beginPath();
        ctx.ellipse(210, 160, 44, 52, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#4338ca";
        ctx.beginPath();
        ctx.arc(210, 140, 48, Math.PI, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 22;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(165, 245);
        ctx.lineTo(118, 375);
        ctx.moveTo(255, 245);
        ctx.lineTo(302, 365);
        ctx.stroke();

        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(210, 275, 10, 0, Math.PI * 2);
        ctx.fill();

        sampleCanvas.toBlob((blob) => {
            if (!blob) return;
            const prev = overlayAsset();
            if (prev?.previewUrl) {
                URL.revokeObjectURL(prev.previewUrl);
            }
            const url = createSafeObjectUrl(blob);
            const img = new Image();
            img.onload = () => {
                setOverlayAsset(buildOverlayAsset("sample-character.png", url, img));
            };
            img.src = url;
        }, "image/png");
    };

    const startCamera = async (facingOverride?: CameraFacing) => {
        const targetFacing = facingOverride ?? cameraFacing();
        setCameraError(null);
        stopCamera();

        if (
            typeof navigator === "undefined" ||
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            setCameraError(
                "お使いのブラウザまたは端末はカメラアクセスAPI（getUserMedia）に対応していません。背景画像をアップロードしてテストできます。",
            );
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: targetFacing },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });
            mediaStream = stream;
            if (videoRef) {
                videoRef.srcObject = stream;
                await videoRef.play().catch(() => {});
            }
            setIsCameraActive(true);
        } catch (err: unknown) {
            stopCamera();
            const errObj = err as { name?: string; message?: string };
            if (errObj?.name === "NotAllowedError" || errObj?.name === "PermissionDeniedError") {
                setCameraError("カメラへのアクセス権限が拒否されました。ブラウザの設定でカメラを許可してください。");
            } else {
                setCameraError(`カメラの起動に失敗しました: ${errObj?.message || "不明なエラー"}`);
            }
        }
    };

    const switchCameraFacing = () => {
        const next: CameraFacing = cameraFacing() === "environment" ? "user" : "environment";
        setCameraFacing(next);
        if (isCameraActive()) {
            void startCamera(next);
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
        } else if (bg) {
            const coverRatio = Math.max(width / bg.width, height / bg.height);
            const drawW = bg.width * coverRatio;
            const drawH = bg.height * coverRatio;
            ctx.drawImage(bg.imgElement, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        } else {
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, "#e2e8f0");
            grad.addColorStop(0.62, "#cbd5e1");
            grad.addColorStop(1, "#94a3b8");
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

        if (!isExport && mode() === "ar" && showArGrid()) {
            const horizonY = height * clampFinite(0.55 - (groundTiltDeg() - 30) * 0.004, 0.25, 0.72, 0.55);
            ctx.save();
            ctx.strokeStyle = "rgba(99, 102, 241, 0.28)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, horizonY);
            ctx.lineTo(width, horizonY);
            for (let i = -4; i <= 4; i++) {
                ctx.moveTo(width / 2 + i * 35, horizonY);
                ctx.lineTo(width / 2 + i * 190, height);
            }
            for (let row = 1; row <= 4; row++) {
                const y = horizonY + ((height - horizonY) * (row * row)) / 16;
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();
            ctx.restore();
        }

        const asset = overlayAsset();
        if (!asset) return;

        const baseTargetHeight = height * 0.65 * clampFinite(scale(), 0.1, 3.0, 0.65);
        const aspect = asset.width / Math.max(1, asset.height);
        const drawH = baseTargetHeight;
        const drawW = drawH * aspect;

        const baseX = (clampFinite(posXPercent(), 0, 100, 50) / 100) * width;
        const baseY = (clampFinite(posYPercent(), 0, 100, 78) / 100) * height;

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
            const parallax = calculateGyroParallaxOffset(curG, baseG, width, height, 1.0);
            gyroX = parallax.offsetX;
            gyroY = parallax.offsetY;
            gyroTilt = parallax.tiltSkewDeg;
        }

        const footX = baseX + gyroX;
        const footY = baseY + gyroY;

        const footAnchorXRatio = flipHorizontal()
            ? 1 - asset.alphaBounds.footCenterXRatio
            : asset.alphaBounds.footCenterXRatio;
        const footAnchorYRatio = asset.alphaBounds.footBottomYRatio;

        const imgLeftOffset = -drawW * footAnchorXRatio;
        const imgTopOffset = -drawH * footAnchorYRatio;

        const shadow = calculateProjectedShadowTransform({
            azimuthDeg: lightAzimuthDeg(),
            elevationDeg: lightElevationDeg(),
            groundTiltDeg: groundTiltDeg(),
            shadowOpacity: shadowOpacity(),
            shadowSoftness: shadowSoftness(),
            characterHeightPx: drawH,
            characterWidthPx: drawW,
        });

        const charOpacity = clampFinite(opacity(), 0, 1, 1);

        // 接地コンタクトシャドウ
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
        contactGrad.addColorStop(0, `rgba(10, 14, 24, ${shadow.contactOpacity * charOpacity})`);
        contactGrad.addColorStop(0.55, `rgba(10, 14, 24, ${shadow.contactOpacity * 0.45 * charOpacity})`);
        contactGrad.addColorStop(1, "rgba(10, 14, 24, 0)");
        ctx.scale(1, shadow.contactHeightPx / Math.max(1, shadow.contactWidthPx));
        ctx.fillStyle = contactGrad;
        ctx.beginPath();
        ctx.arc(0, 0, shadow.contactWidthPx * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 投影シルエット影
        ctx.save();
        ctx.translate(footX + shadow.offsetX, footY + shadow.offsetY);
        ctx.transform(1, 0, shadow.skewXRatio, shadow.scaleYRatio, 0, 0);
        if (flipHorizontal()) {
            ctx.scale(-1, 1);
        }
        ctx.globalAlpha = shadow.opacity * charOpacity;
        if ("filter" in ctx && shadow.blurPx > 0.4) {
            ctx.filter = `blur(${shadow.blurPx.toFixed(1)}px)`;
        }
        const silLeft = -drawW * asset.alphaBounds.footCenterXRatio;
        const silTop = -drawH * footAnchorYRatio;
        ctx.drawImage(asset.silhouetteCanvas, silLeft, silTop, drawW, drawH);
        ctx.restore();

        // キャラクター本体
        ctx.save();
        ctx.translate(footX, footY);
        const totalRotRad =
            ((clampFinite(rotationDeg(), -180, 180, 0) + gyroTilt) * Math.PI) / 180;
        ctx.rotate(totalRotRad);
        ctx.globalAlpha = charOpacity;

        if (autoAmbientMatch() && "filter" in ctx) {
            const lighting = envLighting();
            ctx.filter = `brightness(${lighting.brightnessMultiplier.toFixed(2)})`;
        }

        if (flipHorizontal()) {
            ctx.scale(-1, 1);
            ctx.drawImage(
                asset.imgElement,
                -drawW * asset.alphaBounds.footCenterXRatio,
                imgTopOffset,
                drawW,
                drawH,
            );
        } else {
            ctx.drawImage(asset.imgElement, imgLeftOffset, imgTopOffset, drawW, drawH);
        }
        ctx.restore();
    };

    const startRenderLoop = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        const render = () => {
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
            rafId = requestAnimationFrame(render);
        };
        rafId = requestAnimationFrame(render);
    };

    const capturePhoto = () => {
        setIsFlashActive(true);
        window.setTimeout(() => setIsFlashActive(false), 180);

        const exportCanvas = document.createElement("canvas");
        if (isCameraActive() && videoRef && videoRef.videoWidth > 0) {
            exportCanvas.width = videoRef.videoWidth;
            exportCanvas.height = videoRef.videoHeight;
        } else if (bgAsset()) {
            const bg = bgAsset()!;
            exportCanvas.width = Math.min(2400, bg.width);
            exportCanvas.height = Math.round(
                (exportCanvas.width / Math.max(1, bg.width)) * bg.height,
            );
        } else {
            exportCanvas.width = 1280;
            exportCanvas.height = 720;
        }

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
            },
            mime,
            quality,
        );
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
        if (isPositionLocked()) return;
        if (!previewCanvasRef) return;
        isDragging = true;
        dragStartClientX = e.clientX;
        dragStartClientY = e.clientY;
        dragStartPosX = posXPercent();
        dragStartPosY = posYPercent();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
        if (!isDragging || isPositionLocked() || !previewCanvasRef) return;
        const rect = previewCanvasRef.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const dxPct = ((e.clientX - dragStartClientX) / rect.width) * 100;
        const dyPct = ((e.clientY - dragStartClientY) / rect.height) * 100;
        setPosXPercent(Math.round(clampFinite(dragStartPosX + dxPct, 0, 100, 50) * 10) / 10);
        setPosYPercent(Math.round(clampFinite(dragStartPosY + dyPct, 0, 100, 78) * 10) / 10);
    };

    const handlePointerUp = (e: PointerEvent) => {
        isDragging = false;
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    };

    const handleCanvasWheel = (e: WheelEvent) => {
        if (isPositionLocked()) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.04 : 0.04;
        setScale((prev) => Math.round(clampFinite(prev + delta, 0.15, 2.5, 0.65) * 100) / 100);
    };

    onSettled(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".ba-card");
        }
        startRenderLoop();

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            stopCamera();
            disableGyro();
            const o = overlayAsset();
            if (o?.previewUrl) URL.revokeObjectURL(o.previewUrl);
            const b = bgAsset();
            if (b?.previewUrl) URL.revokeObjectURL(b.previewUrl);
            const c = capturedUrl();
            if (c) URL.revokeObjectURL(c);
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
        <div ref={containerRef} class="ba-page-container">
            <header class="ba-page-header">
                <div class="ba-page-title-row">
                    <span class="ba-page-icon-box" aria-hidden="true">
                        <ToolIcon name="camera" class="ba-icon-md" />
                    </span>
                    <div>
                        <h1 class="ba-page-title">{pageTitle()}</h1>
                        <p class="ba-page-desc">{description()}</p>
                    </div>
                </div>
            </header>

            <form
                {...({
                    toolname: "ar_camera_overlay",
                    tooldescription:
                        "Overlay transparent character illustrations onto live camera feed with physically-based AR shadow calculation or fixed screen positioning.",
                } as Record<string, string>)}
                onSubmit={(e) => e.preventDefault()}
                class="ba-grid ba-grid-cols-1 lg:ba-grid-cols-12 ba-gap-6"
            >
                <div class="lg:ba-col-span-7 ba-flex ba-flex-col ba-gap-4">
                    <section class="ba-card ba-p-4" aria-labelledby="preview-heading">
                        <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2 ba-mb-3">
                            <h2 id="preview-heading" class="ba-card-title">
                                ライブプレビュー
                            </h2>

                            <div class="ba-flex ba-gap-2" role="group" aria-label="重ね合わせモード選択">
                                <button
                                    type="button"
                                    class={`ba-btn ba-btn--sm ${mode() === "ar" ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                    aria-pressed={mode() === "ar" ? "true" : "false"}
                                    onClick={() => handleModeChange("ar")}
                                >
                                    AR空間モード（リアル影）
                                </button>
                                <button
                                    type="button"
                                    class={`ba-btn ba-btn--sm ${mode() === "fixed" ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                    aria-pressed={mode() === "fixed" ? "true" : "false"}
                                    onClick={() => handleModeChange("fixed")}
                                >
                                    自由固定モード
                                </button>
                            </div>
                        </div>

                        <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-2 ba-mb-3">
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
                                    onClick={stopCamera}
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
                                <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer">
                                    <input
                                        type="checkbox"
                                        class="ba-checkbox"
                                        checked={mirrorSelfie()}
                                        onChange={(e) => setMirrorSelfie(e.currentTarget.checked)}
                                    />
                                    <span>左右反転プレビュー</span>
                                </label>
                            </Show>

                            <button
                                type="button"
                                class="ba-btn ba-btn--outline ba-btn--sm"
                                onClick={() => bgInputRef?.click()}
                            >
                                背景画像を選択
                            </button>
                            <input
                                ref={bgInputRef}
                                type="file"
                                accept="image/*"
                                class="ba-sr-only"
                                aria-label="テスト用背景画像を選択"
                                onChange={(e) => {
                                    const file = e.currentTarget.files?.[0];
                                    if (file) handleBgFile(file);
                                }}
                            />
                        </div>

                        <Show when={cameraError()}>
                            <div class="ba-alert ba-alert--warning ba-mb-3" role="alert">
                                {cameraError()}
                            </div>
                        </Show>

                        <div class="ba-relative ba-rounded-lg ba-overflow-hidden ba-border ba-border-base-300 ba-bg-base-200">
                            <video
                                ref={videoRef}
                                playsinline
                                muted
                                class="ba-sr-only"
                                aria-hidden="true"
                            />
                            <canvas
                                ref={previewCanvasRef}
                                width={960}
                                height={540}
                                class="ba-w-full ba-h-auto ba-block ba-touch-none"
                                style={{
                                    cursor: isPositionLocked() ? "default" : "grab",
                                }}
                                aria-label="カメラと透過画像の合成プレビューキャンバス"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onWheel={handleCanvasWheel}
                            />

                            <Show when={isFlashActive()}>
                                <div
                                    class="ba-absolute ba-inset-0 ba-bg-white ba-pointer-events-none"
                                    style={{ opacity: "0.75" }}
                                    aria-hidden="true"
                                />
                            </Show>

                            <Show when={!overlayAsset()}>
                                <div class="ba-p-3 ba-text-center ba-text-sm ba-border-t ba-border-base-300">
                                    立ち絵などの透過画像を選択するか、「サンプル立ち絵」ボタンでお試しください。キャンバス上でドラッグ移動・ホイール拡大縮小ができます。
                                </div>
                            </Show>
                        </div>

                        <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3 ba-mt-4">
                            <div class="ba-flex ba-items-center ba-gap-2">
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

                            <button
                                type="button"
                                class="ba-btn ba-btn--primary"
                                onClick={capturePhoto}
                            >
                                撮影する (シャッター)
                            </button>
                        </div>
                    </section>

                    <Show when={capturedUrl()}>
                        {(url) => (
                            <section class="ba-card ba-p-4" aria-labelledby="captured-heading">
                                <div class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-mb-3">
                                    <h2 id="captured-heading" class="ba-card-title">
                                        撮影結果
                                    </h2>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--success ba-btn--sm"
                                        onClick={downloadCaptured}
                                    >
                                        {downloadExtensionLabel()}で保存
                                    </button>
                                </div>
                                <img
                                    src={url()}
                                    alt="撮影された合成写真"
                                    class="ba-w-full ba-h-auto ba-rounded-lg ba-border ba-border-base-300"
                                />
                            </section>
                        )}
                    </Show>
                </div>

                <div class="lg:ba-col-span-5 ba-flex ba-flex-col ba-gap-4">
                    <section class="ba-card ba-p-4" aria-labelledby="overlay-asset-heading">
                        <h2 id="overlay-asset-heading" class="ba-card-title ba-mb-3">
                            1. 重ねる透過画像（立ち絵）
                        </h2>
                        <div class="ba-flex ba-flex-wrap ba-gap-2">
                            <button
                                type="button"
                                class="ba-btn ba-btn--primary ba-btn--sm"
                                onClick={() => overlayInputRef?.click()}
                            >
                                画像を選択 (PNG/WebP等)
                            </button>
                            <button
                                type="button"
                                class="ba-btn ba-btn--secondary ba-btn--sm"
                                onClick={loadSampleCharacter}
                            >
                                サンプル立ち絵
                            </button>
                            <input
                                ref={overlayInputRef}
                                type="file"
                                accept="image/*"
                                class="ba-sr-only"
                                aria-label="重ねる透過画像を選択"
                                onChange={(e) => {
                                    const file = e.currentTarget.files?.[0];
                                    if (file) handleOverlayFile(file);
                                }}
                            />
                        </div>

                        <Show when={overlayAsset()}>
                            {(asset) => (
                                <div class="ba-mt-3 ba-p-2 ba-rounded ba-bg-base-200 ba-text-xs ba-flex ba-items-center ba-justify-between ba-gap-2">
                                    <span class="ba-truncate">{asset().name} ({asset().width}×{asset().height})</span>
                                    <span class="ba-badge ba-badge--neutral">
                                        足元検出済
                                    </span>
                                </div>
                            )}
                        </Show>
                    </section>

                    <section class="ba-card ba-p-4" aria-labelledby="transform-heading">
                        <div class="ba-flex ba-items-center ba-justify-between ba-gap-2 ba-mb-3">
                            <h2 id="transform-heading" class="ba-card-title">
                                2. 位置・サイズ・固定設定
                            </h2>
                            <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer">
                                <input
                                    type="checkbox"
                                    class="ba-toggle"
                                    checked={isPositionLocked()}
                                    onChange={(e) => setIsPositionLocked(e.currentTarget.checked)}
                                />
                                <span>位置ロック</span>
                            </label>
                        </div>

                        <div class="ba-flex ba-flex-col ba-gap-3">
                            <div>
                                <label for="pos-x-range" class="ba-label">
                                    <span>横位置 (X)</span>
                                    <span>{posXPercent().toFixed(1)}%</span>
                                </label>
                                <input
                                    id="pos-x-range"
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    class="ba-range"
                                    disabled={isPositionLocked()}
                                    value={posXPercent()}
                                    onInput={(e) =>
                                        setPosXPercent(clampFinite(Number(e.currentTarget.value), 0, 100, 50))
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
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    class="ba-range"
                                    disabled={isPositionLocked()}
                                    value={posYPercent()}
                                    onInput={(e) =>
                                        setPosYPercent(clampFinite(Number(e.currentTarget.value), 0, 100, 78))
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
                                    min="0.15"
                                    max="2.5"
                                    step="0.05"
                                    class="ba-range"
                                    value={scale()}
                                    onInput={(e) =>
                                        setScale(clampFinite(Number(e.currentTarget.value), 0.15, 2.5, 0.65))
                                    }
                                />
                            </div>

                            <div class="ba-grid ba-grid-cols-2 ba-gap-3">
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

                            <div class="ba-flex ba-flex-wrap ba-gap-2">
                                <button
                                    type="button"
                                    class={`ba-btn ba-btn--sm ${flipHorizontal() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                    onClick={() => setFlipHorizontal((v) => !v)}
                                >
                                    左右反転
                                </button>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--sm"
                                    onClick={() => {
                                        setPosXPercent(50);
                                        setPosYPercent(mode() === "ar" ? 78 : 50);
                                        setScale(0.65);
                                        setRotationDeg(0);
                                        setOpacity(1);
                                        setFlipHorizontal(false);
                                    }}
                                >
                                    配置をリセット
                                </button>
                            </div>
                        </div>
                    </section>

                    <Show when={mode() === "ar"}>
                        <section class="ba-card ba-p-4" aria-labelledby="ar-shadow-heading">
                            <h2 id="ar-shadow-heading" class="ba-card-title ba-mb-3">
                                3. ARリアル影・空間リアリティ設定
                            </h2>

                            <div class="ba-flex ba-flex-col ba-gap-3">
                                <div class="ba-p-3 ba-rounded ba-bg-base-200 ba-flex ba-flex-col ba-gap-2">
                                    <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                        <span class="ba-text-xs ba-font-bold">ジャイロ空間アンカー</span>
                                        <div class="ba-flex ba-gap-2">
                                            <button
                                                type="button"
                                                class={`ba-btn ba-btn--xs ${gyroEnabled() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                                onClick={() => void toggleGyro()}
                                            >
                                                {gyroEnabled() ? "ジャイロON" : "ジャイロOFF"}
                                            </button>
                                            <Show when={gyroEnabled()}>
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
                                        <p class="ba-text-xs">{gyroStatus()}</p>
                                    </Show>
                                </div>

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
                                        onInput={(e) =>
                                            setLightAzimuthDeg(clampFinite(Number(e.currentTarget.value), 0, 360, 315))
                                        }
                                    />
                                </div>

                                <div>
                                    <label for="light-elevation-range" class="ba-label">
                                        <span>光源の高さ (太陽・照明高度)</span>
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
                                        <span>地面の見下ろし角 (パース)</span>
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

                                <div class="ba-grid ba-grid-cols-2 ba-gap-3">
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
                                            <span>影のぼかし (半影)</span>
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

                                <div class="ba-flex ba-flex-col ba-gap-2 ba-pt-1">
                                    <label class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-cursor-pointer">
                                        <input
                                            type="checkbox"
                                            class="ba-checkbox"
                                            checked={autoAmbientMatch()}
                                            onChange={(e) => setAutoAmbientMatch(e.currentTarget.checked)}
                                        />
                                        <span>環境光に合わせて明るさを自動馴染ませ</span>
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
                                        <span>地面パースガイドを表示（撮影時は非表示）</span>
                                    </label>
                                </div>

                                <div class="ba-text-xs ba-p-2 ba-rounded ba-bg-base-200">
                                    推定環境輝度: {Math.round(envLighting().luminance * 100)}% / 投影ぼかし:{" "}
                                    {currentShadowPreview().blurPx.toFixed(1)}px
                                </div>
                            </div>
                        </section>
                    </Show>
                </div>
            </form>

            <AdSense />
        </div>
    );
}
