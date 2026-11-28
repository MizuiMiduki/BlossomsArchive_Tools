import {
    createSignal,
    createMemo,
    onSettled,
    For,
    Show,
} from "solid-js";
import AdSense from "../components/AdSense";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";
import {
    type AlphaBounds,
    type EnvironmentLighting,
    clampFinite,
    analyzeImageAlphaBounds,
    estimateEnvironmentLighting,
    calculateProjectedShadowTransform,
    createShadowSilhouettePixels,
    createSafeObjectUrl,
    isSupportedImageFile,
    generateDepthOcclusionMaskPixels,
    estimateCharacterGroundDepth,
    estimateDistanceFromArDepth,
    calculateScaleForCharacterHeight,
    estimateGroundTiltFromDepthMap,
    generateGroundShadowMaskPixels,
    calculateCharacterColorAdaptation,
    analyzeGroundAndWallPlanes,
    generateSurfaceOverlayPixels,
    calculateApertureMaxBlurPx,
    generateDofOutOfFocusMaskPixels,
    calculatePerspectivePitchParams,
    projectVerticalPerspectiveT,
} from "../utils/arCameraOverlay";
import {
    sortCharacterLayersByDepth,
    hitTestCharacterLayer,
    estimateLocalEnvironmentLighting,
} from "../utils/photoComposite";

interface CharacterAsset {
    name: string;
    previewUrl: string;
    width: number;
    height: number;
    imgElement: HTMLImageElement;
    alphaBounds: AlphaBounds;
    silhouetteCanvas: HTMLCanvasElement;
}

interface CharacterLayer {
    id: string;
    asset: CharacterAsset;
    posXPercent: number;
    posYPercent: number;
    scale: number;
    characterHeightCm: number;
    cameraDistanceM: number;
    rotationDeg: number;
    cameraPitchDeg: number;
    opacity: number;
    flipHorizontal: boolean;
    ambientStrength: number;
    edgeSoftnessPx: number;
    useOcclusion: boolean;
    occlusionThreshold: number;
}

interface BackgroundPhotoAsset {
    name: string;
    previewUrl: string;
    width: number;
    height: number;
    imgElement: HTMLImageElement;
}

export default function PhotoComposite() {
    const { title: pageTitle, description } = usePageI18n("/photo-composite", {
        defaultTitle: "写真・立ち絵合成スタジオ",
        defaultDescription:
            "背景写真に複数体の立ち絵を後から自然に合成できる無料Webツールです。AI奥行きによる遮蔽・被写界深度ボケ・接地影・環境光馴染ませ・実寸身長調整に対応しています。",
    });

    let containerRef: HTMLDivElement | undefined;
    let previewCanvasRef: HTMLCanvasElement | undefined;
    let bgInputRef: HTMLInputElement | undefined;
    let charInputRef: HTMLInputElement | undefined;

    const [bgAsset, setBgAsset] = createSignal<BackgroundPhotoAsset | null>(null);
    const [characters, setCharacters] = createSignal<CharacterLayer[]>([]);
    const [selectedId, setSelectedId] = createSignal<string | null>(null);
    const [sortByDepth, setSortByDepth] = createSignal<boolean>(true);
    const [showSurfaceGuides, setShowSurfaceGuides] = createSignal<boolean>(true);

    // 共通シーン設定（光源・影・被写界深度・書き出し）
    const [lightAzimuthDeg, setLightAzimuthDeg] = createSignal<number>(315);
    const [lightElevationDeg, setLightElevationDeg] = createSignal<number>(42);
    const [groundTiltDeg, setGroundTiltDeg] = createSignal<number>(34);
    const [shadowOpacity, setShadowOpacity] = createSignal<number>(0.52);
    const [shadowSoftness, setShadowSoftness] = createSignal<number>(0.42);
    const [autoAmbientMatch, setAutoAmbientMatch] = createSignal<boolean>(true);
    const [autoLightDirection, setAutoLightDirection] = createSignal<boolean>(true);

    // 被写界深度 (DoF)
    const [dofEnabled, setDofEnabled] = createSignal<boolean>(false);
    const [dofApertureF, setDofApertureF] = createSignal<number>(2.4);
    const [dofFocusDepth, setDofFocusDepth] = createSignal<number>(0.55);
    const [autoFocusSelected, setAutoFocusSelected] = createSignal<boolean>(true);

    // AI 深度マップ & 環境光サンプル
    const [aiDepthMap, setAiDepthMap] = createSignal<{
        data: Float32Array;
        width: number;
        height: number;
        guideRgba?: Uint8ClampedArray;
        guideWidth?: number;
        guideHeight?: number;
    } | null>(null);
    const [aiDepthBusy, setAiDepthBusy] = createSignal<boolean>(false);
    const [aiDepthStatus, setAiDepthStatus] = createSignal<string>("");
    const [surfaceInfo, setSurfaceInfo] = createSignal<{
        groundPct: number;
        wallPct: number;
        horizonYRatio: number;
    } | null>(null);

    const [bgSampleData, setBgSampleData] = createSignal<{
        rgba: Uint8ClampedArray;
        width: number;
        height: number;
        globalLighting: EnvironmentLighting;
    } | null>(null);

    const [exportFormat, setExportFormat] = createSignal<"image/png" | "image/jpeg" | "image/webp">("image/png");
    const [exportedUrl, setExportedUrl] = createSignal<string | null>(null);
    const [showExportModal, setShowExportModal] = createSignal<boolean>(false);

    // キャッシュ用オフスクリーンキャンバス
    let surfaceOverlayCanvas: HTMLCanvasElement | undefined;
    let dofBlurCanvas: HTMLCanvasElement | undefined;
    let dofMaskCanvas: HTMLCanvasElement | undefined;
    let litCharCanvas: HTMLCanvasElement | undefined;
    let occlusionMaskCanvas: HTMLCanvasElement | undefined;
    let characterLayerCanvas: HTMLCanvasElement | undefined;
    let shadowCatcherCanvas: HTMLCanvasElement | undefined;
    let shadowLayerCanvas: HTMLCanvasElement | undefined;
    let cachedMaskKey = "";
    let cachedDofKey = "";

    // ドラッグ操作
    const activePointers = new Map<number, { x: number; y: number }>();
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragInitPosX = 50;
    let dragInitPosY = 78;
    let pinchStartDist = 0;
    let pinchStartScale = 0.65;
    let idSeq = 1;

    const selectedCharacter = createMemo(() => {
        const list = characters();
        const sid = selectedId();
        return list.find((c) => c.id === sid) ?? list[0] ?? null;
    });

    const orderedCharacters = createMemo(() => {
        const list = characters();
        return sortByDepth() ? sortCharacterLayersByDepth(list) : list;
    });

    const updateSelectedCharacter = (updater: (prev: CharacterLayer) => CharacterLayer) => {
        const current = selectedCharacter();
        if (!current) return;
        setCharacters((list) => list.map((c) => (c.id === current.id ? updater(c) : c)));
    };

    const buildCharacterAsset = (
        name: string,
        previewUrl: string,
        img: HTMLImageElement,
    ): CharacterAsset => {
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
                    sctx.putImageData(
                        new ImageData(new Uint8ClampedArray(shadowPixels), aw, ah),
                        0,
                        0,
                    );
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

    const getCanvasViewAspect = () => {
        const bg = bgAsset();
        if (bg) return bg.width / Math.max(1, bg.height);
        return 16 / 9;
    };

    const computeScaleForLayer = (
        asset: CharacterAsset,
        heightCm: number,
        distanceM: number,
    ): number => {
        const aspect = getCanvasViewAspect();
        const verticalFovDeg = aspect < 1 ? 74 : 52;
        const opaqueRatio = asset.alphaBounds.hasOpaquePixels
            ? clampFinite(asset.alphaBounds.opaqueHeightRatio, 0.1, 1.0, 1.0)
            : 1.0;
        return calculateScaleForCharacterHeight({
            characterHeightCm: heightCm,
            distanceMeters: distanceM,
            opaqueHeightRatio: opaqueRatio,
            verticalFovDeg,
        });
    };

    const handleBackgroundFile = (file: File) => {
        if (!isSupportedImageFile(file.name, file.type)) {
            setAiDepthStatus("背景写真は PNG / JPEG / WebP などの画像ファイルを選択してください。");
            return;
        }
        const prev = bgAsset();
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        const previewUrl = createSafeObjectUrl(file);
        const img = new Image();
        img.onload = () => {
            const w = Math.max(1, img.naturalWidth || img.width || 1280);
            const h = Math.max(1, img.naturalHeight || img.height || 720);
            setBgAsset({ name: file.name, previewUrl, width: w, height: h, imgElement: img });

            // 背景の環境光サンプルを取得
            const sc = document.createElement("canvas");
            sc.width = 48;
            sc.height = Math.max(24, Math.round(48 * (h / w)));
            const sctx = sc.getContext("2d", { willReadFrequently: true });
            if (sctx) {
                sctx.drawImage(img, 0, 0, sc.width, sc.height);
                try {
                    const data = new Uint8ClampedArray(sctx.getImageData(0, 0, sc.width, sc.height).data);
                    const globalLighting = estimateEnvironmentLighting(data, sc.width, sc.height);
                    setBgSampleData({ rgba: data, width: sc.width, height: sc.height, globalLighting });
                    if (autoLightDirection()) {
                        setLightAzimuthDeg(globalLighting.suggestedAzimuthDeg);
                    }
                } catch {
                    setBgSampleData(null);
                }
            }

            // 古いAI深度キャッシュをリセット
            setAiDepthMap(null);
            setSurfaceInfo(null);
            setAiDepthStatus("");
            cachedMaskKey = "";
            cachedDofKey = "";

            // 既に配置済みキャラの実寸スケールも新背景のアスペクト比に再整合
            setCharacters((list) =>
                list.map((c) => ({
                    ...c,
                    scale: computeScaleForLayer(c.asset, c.characterHeightCm, c.cameraDistanceM),
                })),
            );
            renderPreview();
        };
        img.src = previewUrl;
    };

    const addCharacterFiles = (files: FileList | File[]) => {
        const arr = Array.from(files).filter((f) => isSupportedImageFile(f.name, f.type));
        if (arr.length === 0 && files.length > 0) {
            setAiDepthStatus("立ち絵は PNG / WebP などの画像ファイルを選択してください。");
            return;
        }
        arr.forEach((file, idx) => {
            const previewUrl = createSafeObjectUrl(file);
            const img = new Image();
            img.onload = () => {
                const asset = buildCharacterAsset(file.name, previewUrl, img);
                const existingCount = characters().length;
                const offsetStep = ((existingCount + idx) % 5) - 2;
                const defaultX = clampFinite(50 + offsetStep * 14, 15, 85, 50);
                const defaultY = 78;
                let initDist = 2.5;
                let initThresh = 0.55;
                let useOcc = false;

                const map = aiDepthMap();
                if (map) {
                    const aspect = getCanvasViewAspect();
                    initDist = estimateDistanceFromArDepth({
                        normalizedDepth: map.data,
                        width: map.width,
                        height: map.height,
                        footXRatio: defaultX / 100,
                        footYRatio: defaultY / 100,
                        verticalFovDeg: aspect < 1 ? 74 : 52,
                        pitchTiltDeg: groundTiltDeg(),
                    });
                    const gDepth = estimateCharacterGroundDepth(
                        map.data,
                        map.width,
                        map.height,
                        defaultX / 100,
                        defaultY / 100,
                    );
                    initThresh = Math.round(clampFinite(gDepth + 0.06, 0.14, 0.92, 0.55) * 100) / 100;
                    useOcc = true;
                }

                const newChar: CharacterLayer = {
                    id: `char-${idSeq++}`,
                    asset,
                    posXPercent: defaultX,
                    posYPercent: defaultY,
                    scale: computeScaleForLayer(asset, 160, initDist),
                    characterHeightCm: 160,
                    cameraDistanceM: initDist,
                    rotationDeg: 0,
                    cameraPitchDeg: 0,
                    opacity: 1.0,
                    flipHorizontal: false,
                    ambientStrength: 1.0,
                    edgeSoftnessPx: 0.4,
                    useOcclusion: useOcc,
                    occlusionThreshold: initThresh,
                };
                setCharacters((prev) => [...prev, newChar]);
                setSelectedId(newChar.id);
                renderPreview();
            };
            img.src = previewUrl;
        });
    };

    const duplicateSelectedCharacter = () => {
        const cur = selectedCharacter();
        if (!cur) return;
        const copy: CharacterLayer = {
            ...cur,
            id: `char-${idSeq++}`,
            asset: { ...cur.asset },
            posXPercent: clampFinite(cur.posXPercent + 12, -50, 150, 62),
        };
        setCharacters((prev) => [...prev, copy]);
        setSelectedId(copy.id);
        renderPreview();
    };

    const removeCharacter = (id: string) => {
        const target = characters().find((c) => c.id === id);
        setCharacters((prev) => {
            const next = prev.filter((c) => c.id !== id);
            if (target && !next.some((c) => c.asset.previewUrl === target.asset.previewUrl)) {
                URL.revokeObjectURL(target.asset.previewUrl);
            }
            if (selectedId() === id) {
                setSelectedId(next[0]?.id ?? null);
            }
            return next;
        });
        renderPreview();
    };

    const syncCharacterWithDepth = (charId: string) => {
        const map = aiDepthMap();
        if (!map) return;
        const aspect = getCanvasViewAspect();
        setCharacters((list) =>
            list.map((c) => {
                if (c.id !== charId) return c;
                const nx = clampFinite(c.posXPercent / 100, 0.05, 0.95, 0.5);
                const ny = clampFinite(c.posYPercent / 100, 0.05, 0.95, 0.78);
                const estDist = estimateDistanceFromArDepth({
                    normalizedDepth: map.data,
                    width: map.width,
                    height: map.height,
                    footXRatio: nx,
                    footYRatio: ny,
                    verticalFovDeg: aspect < 1 ? 74 : 52,
                    pitchTiltDeg: groundTiltDeg(),
                });
                const gDepth = estimateCharacterGroundDepth(map.data, map.width, map.height, nx, ny);
                const thresh = Math.round(clampFinite(gDepth + 0.06, 0.14, 0.92, 0.55) * 100) / 100;
                return {
                    ...c,
                    cameraDistanceM: estDist,
                    scale: computeScaleForLayer(c.asset, c.characterHeightCm, estDist),
                    occlusionThreshold: thresh,
                    useOcclusion: true,
                };
            }),
        );
        renderPreview();
    };

    const runAiDepthAnalysis = async () => {
        if (aiDepthBusy()) return;
        const bg = bgAsset();
        if (!bg) {
            setAiDepthStatus("先に背景写真を選択してください。");
            return;
        }

        const fitRatio = Math.min(1, 720 / Math.max(bg.width, bg.height));
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = Math.max(32, Math.round(bg.width * fitRatio));
        srcCanvas.height = Math.max(32, Math.round(bg.height * fitRatio));
        const sctx = srcCanvas.getContext("2d", { willReadFrequently: true });
        if (!sctx) return;
        sctx.drawImage(bg.imgElement, 0, 0, srcCanvas.width, srcCanvas.height);

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
            cachedMaskKey = "";
            cachedDofKey = "";

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
                    new ImageData(new Uint8ClampedArray(surfPixels), estimated.width, estimated.height),
                    0,
                    0,
                );
            }

            const tilt = estimateGroundTiltFromDepthMap(
                estimated.data,
                estimated.width,
                estimated.height,
            );
            setGroundTiltDeg(tilt);

            const aspect = getCanvasViewAspect();
            setCharacters((list) =>
                list.map((c) => {
                    const nyPct =
                        surface.groundRatio >= 0.08 && c.posYPercent < surface.horizonYRatio * 100
                            ? Math.round(surface.recommendedFootYRatio * 1000) / 10
                            : c.posYPercent;
                    const nx = clampFinite(c.posXPercent / 100, 0.05, 0.95, 0.5);
                    const ny = clampFinite(nyPct / 100, 0.05, 0.95, 0.78);
                    const estDist = estimateDistanceFromArDepth({
                        normalizedDepth: estimated.data,
                        width: estimated.width,
                        height: estimated.height,
                        footXRatio: nx,
                        footYRatio: ny,
                        verticalFovDeg: aspect < 1 ? 74 : 52,
                        pitchTiltDeg: tilt,
                    });
                    const gDepth = estimateCharacterGroundDepth(
                        estimated.data,
                        estimated.width,
                        estimated.height,
                        nx,
                        ny,
                    );
                    const thresh = Math.round(clampFinite(gDepth + 0.06, 0.14, 0.92, 0.55) * 100) / 100;
                    return {
                        ...c,
                        posYPercent: nyPct,
                        cameraDistanceM: estDist,
                        scale: computeScaleForLayer(c.asset, c.characterHeightCm, estDist),
                        occlusionThreshold: thresh,
                        useOcclusion: true,
                    };
                }),
            );

            const sel = selectedCharacter();
            if (sel && autoFocusSelected()) {
                const fd = estimateCharacterGroundDepth(
                    estimated.data,
                    estimated.width,
                    estimated.height,
                    clampFinite(sel.posXPercent / 100, 0.05, 0.95, 0.5),
                    clampFinite(sel.posYPercent / 100, 0.05, 0.95, 0.78),
                );
                setDofFocusDepth(Math.round(fd * 100) / 100);
            }

            setAiDepthStatus(
                `端末内(${estimated.backend === "webgpu" ? "WebGPU" : "WASM"})で解析完了: 地面${groundPct}%・壁${wallPct}%・各立ち絵の距離と遮蔽を自動最適化しました`,
            );
            renderPreview();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "解析に失敗しました";
            setAiDepthStatus(`AI解析エラー: ${msg}`);
        } finally {
            setAiDepthBusy(false);
        }
    };

    const drawScene = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        isExport: boolean,
    ) => {
        ctx.clearRect(0, 0, width, height);
        const bg = bgAsset();

        // 1. 背景写真
        if (bg) {
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

        // 2. 被写界深度 (DoF) ボケ合成
        const map = aiDepthMap();
        const sel = selectedCharacter();
        if (dofEnabled() && width > 0 && height > 0) {
            const blurPx = calculateApertureMaxBlurPx(
                dofApertureF(),
                sel?.cameraDistanceM ?? 2.5,
            );
            if (blurPx >= 0.4) {
                const blurScale = isExport ? 1.0 : 0.5;
                const bw = Math.max(16, Math.round(width * blurScale));
                const bh = Math.max(16, Math.round(height * blurScale));
                if (!dofBlurCanvas) dofBlurCanvas = document.createElement("canvas");
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

                    if (map) {
                        const dofKey = `${map.width}x${map.height}:${dofFocusDepth()}:${dofApertureF()}`;
                        if (!dofMaskCanvas) dofMaskCanvas = document.createElement("canvas");
                        if (cachedDofKey !== dofKey) {
                            cachedDofKey = dofKey;
                            dofMaskCanvas.width = map.width;
                            dofMaskCanvas.height = map.height;
                            const dCtx = dofMaskCanvas.getContext("2d");
                            if (dCtx) {
                                const px = generateDofOutOfFocusMaskPixels(
                                    map.data,
                                    map.width,
                                    map.height,
                                    dofFocusDepth(),
                                    dofApertureF(),
                                );
                                dCtx.putImageData(
                                    new ImageData(new Uint8ClampedArray(px), map.width, map.height),
                                    0,
                                    0,
                                );
                            }
                        }
                        bCtx.save();
                        bCtx.globalCompositeOperation = "destination-in";
                        bCtx.drawImage(dofMaskCanvas, 0, 0, bw, bh);
                        bCtx.restore();
                    }
                    ctx.drawImage(dofBlurCanvas, 0, 0, width, height);
                }
            }
        }

        // 3. 地面・壁認識ガイド (プレビューのみ)
        if (!isExport && showSurfaceGuides()) {
            const surf = surfaceInfo();
            if (surf && surfaceOverlayCanvas) {
                ctx.save();
                ctx.drawImage(surfaceOverlayCanvas, 0, 0, width, height);
                ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(0, height * surf.horizonYRatio);
                ctx.lineTo(width, height * surf.horizonYRatio);
                ctx.stroke();
                ctx.restore();
            }
        }

        // 4. 複数体の立ち絵を奥行き順に描画
        const sample = bgSampleData();
        const layers = orderedCharacters();

        for (const layer of layers) {
            const drawH = height * 0.62 * clampFinite(layer.scale, 0.1, 4.0, 0.65);
            const aspect = layer.asset.width / Math.max(1, layer.asset.height);
            const drawW = drawH * aspect;
            const footX = (clampFinite(layer.posXPercent, -100, 200, 50) / 100) * width;
            const footY = (clampFinite(layer.posYPercent, -100, 200, 78) / 100) * height;
            const footAnchorXRatio = layer.flipHorizontal
                ? 1 - layer.asset.alphaBounds.footCenterXRatio
                : layer.asset.alphaBounds.footCenterXRatio;
            const footAnchorYRatio = layer.asset.alphaBounds.footBottomYRatio;

            const renderSingleCharacter = (targetCtx: CanvasRenderingContext2D) => {
                const pitchParams = calculatePerspectivePitchParams(layer.cameraPitchDeg);
                const shadow = calculateProjectedShadowTransform({
                    azimuthDeg: lightAzimuthDeg(),
                    elevationDeg: lightElevationDeg(),
                    groundTiltDeg: clampFinite(groundTiltDeg() + layer.cameraPitchDeg * 0.45, 10, 78, 34),
                    shadowOpacity: shadowOpacity(),
                    shadowSoftness: shadowSoftness(),
                    characterHeightPx: drawH,
                    characterWidthPx: drawW,
                });
                const charOpacity = clampFinite(layer.opacity, 0, 1, 1);

                // コンタクトシャドウ
                targetCtx.save();
                targetCtx.translate(footX, footY);
                const contactGrad = targetCtx.createRadialGradient(
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
                targetCtx.scale(1, shadow.contactHeightPx / Math.max(1, shadow.contactWidthPx));
                targetCtx.fillStyle = contactGrad;
                targetCtx.beginPath();
                targetCtx.arc(0, 0, shadow.contactWidthPx * 0.52, 0, Math.PI * 2);
                targetCtx.fill();
                targetCtx.restore();

                // 投影影（深度マップがある場合は接地床面のみに制限）
                const drawProjShadow = (sCtx: CanvasRenderingContext2D) => {
                    sCtx.save();
                    sCtx.translate(footX + shadow.offsetX, footY + shadow.offsetY);
                    sCtx.transform(1, 0, shadow.skewXRatio, shadow.scaleYRatio, 0, 0);
                    if (layer.flipHorizontal) sCtx.scale(-1, 1);
                    sCtx.globalAlpha = shadow.opacity * charOpacity;
                    if ("filter" in sCtx && shadow.blurPx > 0.4) {
                        sCtx.filter = `blur(${shadow.blurPx.toFixed(1)}px)`;
                    }
                    const silLeft = -drawW * layer.asset.alphaBounds.footCenterXRatio;
                    const silTop = -drawH * footAnchorYRatio;
                    sCtx.drawImage(layer.asset.silhouetteCanvas, silLeft, silTop, drawW, drawH);
                    sCtx.restore();
                };

                if (map) {
                    if (!shadowCatcherCanvas) shadowCatcherCanvas = document.createElement("canvas");
                    if (!shadowLayerCanvas) shadowLayerCanvas = document.createElement("canvas");
                    if (shadowLayerCanvas.width !== width || shadowLayerCanvas.height !== height) {
                        shadowLayerCanvas.width = width;
                        shadowLayerCanvas.height = height;
                    }
                    shadowCatcherCanvas.width = map.width;
                    shadowCatcherCanvas.height = map.height;
                    const scCtx = shadowCatcherCanvas.getContext("2d");
                    const slCtx = shadowLayerCanvas.getContext("2d");
                    if (scCtx && slCtx) {
                        const scPixels = generateGroundShadowMaskPixels(
                            map.data,
                            map.width,
                            map.height,
                            clampFinite(layer.posXPercent / 100, 0.05, 0.95, 0.5),
                            clampFinite(layer.posYPercent / 100, 0.05, 0.95, 0.78),
                        );
                        scCtx.putImageData(
                            new ImageData(new Uint8ClampedArray(scPixels), map.width, map.height),
                            0,
                            0,
                        );
                        slCtx.clearRect(0, 0, width, height);
                        drawProjShadow(slCtx);
                        slCtx.save();
                        slCtx.globalCompositeOperation = "destination-in";
                        slCtx.drawImage(shadowCatcherCanvas, 0, 0, width, height);
                        slCtx.restore();
                        targetCtx.drawImage(shadowLayerCanvas, 0, 0, width, height);
                    } else {
                        drawProjShadow(targetCtx);
                    }
                } else {
                    drawProjShadow(targetCtx);
                }

                // キャラクター本体（局所環境光馴染ませ + エッジ馴染ませ + 2.5D透視パース）
                const drawWInt = Math.max(1, Math.min(2048, Math.round(drawW)));
                const drawHInt = Math.max(1, Math.min(2048, Math.round(drawH)));
                let charSource: CanvasImageSource = layer.asset.imgElement;

                if (autoAmbientMatch() && layer.ambientStrength > 0.02) {
                    const localLight = sample
                        ? estimateLocalEnvironmentLighting(
                              sample.rgba,
                              sample.width,
                              sample.height,
                              layer.posXPercent / 100,
                              layer.posYPercent / 100,
                          )
                        : {
                              luminance: 0.55,
                              ambientColor: { r: 140, g: 145, b: 155 },
                              suggestedAzimuthDeg: lightAzimuthDeg(),
                              suggestedShadowOpacity: 0.45,
                              brightnessMultiplier: 1.0,
                          };
                    const adapt = calculateCharacterColorAdaptation(localLight, lightAzimuthDeg());
                    const strength = clampFinite(layer.ambientStrength, 0, 1.5, 1);

                    if (!litCharCanvas) litCharCanvas = document.createElement("canvas");
                    if (litCharCanvas.width !== drawWInt || litCharCanvas.height !== drawHInt) {
                        litCharCanvas.width = drawWInt;
                        litCharCanvas.height = drawHInt;
                    }
                    const lCtx = litCharCanvas.getContext("2d");
                    if (lCtx) {
                        lCtx.clearRect(0, 0, drawWInt, drawHInt);
                        lCtx.save();
                        const bVal = 1 + (adapt.brightness - 1) * strength;
                        const sVal = 1 + (adapt.saturate - 1) * strength;
                        const edgeBlur = clampFinite(layer.edgeSoftnessPx, 0, 1.5, 0.4);
                        if ("filter" in lCtx) {
                            lCtx.filter = `brightness(${bVal.toFixed(2)}) saturate(${sVal.toFixed(2)})${edgeBlur > 0.05 ? ` blur(${edgeBlur.toFixed(2)}px)` : ""}`;
                        }
                        lCtx.drawImage(layer.asset.imgElement, 0, 0, drawWInt, drawHInt);
                        lCtx.restore();

                        lCtx.save();
                        lCtx.globalCompositeOperation = "source-atop";
                        lCtx.fillStyle = `rgba(${adapt.tintRgb.r}, ${adapt.tintRgb.g}, ${adapt.tintRgb.b}, ${clampFinite(adapt.tintAlpha * strength, 0, 0.45, 0.15).toFixed(3)})`;
                        lCtx.fillRect(0, 0, drawWInt, drawHInt);

                        const dir = layer.flipHorizontal ? -adapt.rimDirX : adapt.rimDirX;
                        const xStart = dir >= 0 ? drawWInt : 0;
                        const xEnd = dir >= 0 ? 0 : drawWInt;
                        const shadeGrad = lCtx.createLinearGradient(xStart, 0, xEnd, 0);
                        shadeGrad.addColorStop(0, "rgba(255, 252, 242, 0.08)");
                        shadeGrad.addColorStop(0.45, "rgba(0, 0, 0, 0)");
                        shadeGrad.addColorStop(1, `rgba(10, 16, 30, ${clampFinite(adapt.shadeAlpha * strength, 0, 0.3, 0.12).toFixed(3)})`);
                        lCtx.fillStyle = shadeGrad;
                        lCtx.fillRect(0, 0, drawWInt, drawHInt);
                        lCtx.restore();

                        charSource = litCharCanvas;
                    }
                }

                targetCtx.save();
                targetCtx.translate(footX, footY);
                targetCtx.rotate((clampFinite(layer.rotationDeg, -180, 180, 0) * Math.PI) / 180);
                targetCtx.globalAlpha = charOpacity;
                if (layer.flipHorizontal) targetCtx.scale(-1, 1);

                const renderH = drawH * pitchParams.heightCompression;
                const renderTop = -renderH * footAnchorYRatio;
                const srcW = charSource === litCharCanvas && litCharCanvas ? litCharCanvas.width : layer.asset.width;
                const srcH = charSource === litCharCanvas && litCharCanvas ? litCharCanvas.height : layer.asset.height;

                if (Math.abs(pitchParams.perspectiveK) < 0.015) {
                    targetCtx.drawImage(charSource, -drawW * footAnchorXRatio, -drawH * footAnchorYRatio, drawW, drawH);
                } else {
                    const strips = 28;
                    for (let i = 0; i < strips; i++) {
                        const tTop = 1 - i / strips;
                        const tBot = 1 - (i + 1) / strips;
                        const uTop = 1 - projectVerticalPerspectiveT(tTop, pitchParams.perspectiveK);
                        const uBot = 1 - projectVerticalPerspectiveT(tBot, pitchParams.perspectiveK);
                        const tMid = (tTop + tBot) * 0.5;
                        const stripW = drawW * clampFinite(1 + pitchParams.perspectiveK * tMid, 0.55, 1.5, 1);
                        const sy = (i / strips) * srcH;
                        const sh = srcH / strips;
                        const dy = renderTop + uTop * renderH;
                        const dh = Math.max(0.5, (uBot - uTop) * renderH + 0.6);
                        targetCtx.drawImage(charSource, 0, sy, srcW, sh, -stripW * footAnchorXRatio, dy, stripW, dh);
                    }
                }
                targetCtx.restore();
            };

            if (map && layer.useOcclusion) {
                if (!characterLayerCanvas) characterLayerCanvas = document.createElement("canvas");
                if (characterLayerCanvas.width !== width || characterLayerCanvas.height !== height) {
                    characterLayerCanvas.width = width;
                    characterLayerCanvas.height = height;
                }
                if (!occlusionMaskCanvas) occlusionMaskCanvas = document.createElement("canvas");

                const maskKey = `${map.width}x${map.height}:${layer.occlusionThreshold}:${map.guideWidth ?? 0}`;
                if (cachedMaskKey !== maskKey) {
                    cachedMaskKey = maskKey;
                    const outW = map.guideWidth && map.guideWidth >= 8 ? map.guideWidth : map.width;
                    const outH = map.guideHeight && map.guideHeight >= 8 ? map.guideHeight : map.height;
                    occlusionMaskCanvas.width = outW;
                    occlusionMaskCanvas.height = outH;
                    const omCtx = occlusionMaskCanvas.getContext("2d");
                    if (omCtx) {
                        const pixels = generateDepthOcclusionMaskPixels(
                            map.data,
                            map.width,
                            map.height,
                            layer.occlusionThreshold,
                            0.008,
                            {
                                preserveThinStructures: true,
                                guideRgba: map.guideRgba,
                                guideWidth: outW,
                                guideHeight: outH,
                            },
                        );
                        omCtx.putImageData(new ImageData(new Uint8ClampedArray(pixels), outW, outH), 0, 0);
                    }
                }

                const lcCtx = characterLayerCanvas.getContext("2d");
                if (lcCtx) {
                    lcCtx.clearRect(0, 0, width, height);
                    renderSingleCharacter(lcCtx);
                    lcCtx.save();
                    lcCtx.globalCompositeOperation = "destination-out";
                    lcCtx.drawImage(occlusionMaskCanvas, 0, 0, width, height);
                    lcCtx.restore();
                    ctx.drawImage(characterLayerCanvas, 0, 0, width, height);
                } else {
                    renderSingleCharacter(ctx);
                }
            } else {
                renderSingleCharacter(ctx);
            }

            // 選択中キャラ枠（プレビューのみ）
            if (!isExport && sel && sel.id === layer.id) {
                ctx.save();
                ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
                ctx.lineWidth = Math.max(1.5, width * 0.002);
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(
                    footX - drawW * footAnchorXRatio,
                    footY - drawH * footAnchorYRatio,
                    drawW,
                    drawH,
                );
                ctx.fillStyle = "rgba(56, 189, 248, 0.95)";
                ctx.beginPath();
                ctx.arc(footX, footY, Math.max(4, width * 0.006), 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    };

    const renderPreview = () => {
        if (!previewCanvasRef) return;
        const bg = bgAsset();
        const targetW = bg ? Math.min(1280, bg.width) : 1280;
        const targetH = bg ? Math.max(200, Math.round((targetW / Math.max(1, bg.width)) * bg.height)) : 720;
        if (previewCanvasRef.width !== targetW || previewCanvasRef.height !== targetH) {
            previewCanvasRef.width = targetW;
            previewCanvasRef.height = targetH;
        }
        const ctx = previewCanvasRef.getContext("2d");
        if (ctx) {
            drawScene(ctx, targetW, targetH, false);
        }
    };

    const handlePointerDown = (e: PointerEvent) => {
        if (!previewCanvasRef) return;
        const rect = previewCanvasRef.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
        const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

        if (activePointers.size === 1) {
            const hitId = hitTestCharacterLayer(
                orderedCharacters().map((c) => ({
                    id: c.id,
                    posXPercent: c.posXPercent,
                    posYPercent: c.posYPercent,
                    scale: c.scale,
                    cameraDistanceM: c.cameraDistanceM,
                    aspectRatio: c.asset.width / Math.max(1, c.asset.height),
                    footCenterXRatio: c.flipHorizontal
                        ? 1 - c.asset.alphaBounds.footCenterXRatio
                        : c.asset.alphaBounds.footCenterXRatio,
                    footBottomYRatio: c.asset.alphaBounds.footBottomYRatio,
                })),
                nx,
                ny,
            );
            if (hitId) {
                setSelectedId(hitId);
            }
            const cur = hitId
                ? characters().find((c) => c.id === hitId) ?? selectedCharacter()
                : selectedCharacter();
            if (cur) {
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                dragInitPosX = cur.posXPercent;
                dragInitPosY = cur.posYPercent;
            }
            renderPreview();
        } else if (activePointers.size === 2) {
            isDragging = false;
            const pts = Array.from(activePointers.values());
            pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            pinchStartScale = selectedCharacter()?.scale ?? 0.65;
        }
    };

    const handlePointerMove = (e: PointerEvent) => {
        if (!previewCanvasRef || !activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 2 && pinchStartDist > 10) {
            const pts = Array.from(activePointers.values());
            const curDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            const nextScale = clampFinite(pinchStartScale * (curDist / pinchStartDist), 0.1, 4.0, 0.65);
            updateSelectedCharacter((c) => ({ ...c, scale: Math.round(nextScale * 100) / 100 }));
            renderPreview();
            return;
        }

        if (!isDragging || activePointers.size !== 1) return;
        const rect = previewCanvasRef.getBoundingClientRect();
        const dxPct = ((e.clientX - dragStartX) / Math.max(1, rect.width)) * 100;
        const dyPct = ((e.clientY - dragStartY) / Math.max(1, rect.height)) * 100;
        updateSelectedCharacter((c) => ({
            ...c,
            posXPercent: Math.round(clampFinite(dragInitPosX + dxPct, -100, 200, 50) * 10) / 10,
            posYPercent: Math.round(clampFinite(dragInitPosY + dyPct, -100, 200, 78) * 10) / 10,
        }));
        renderPreview();
    };

    const handlePointerUp = (e: PointerEvent) => {
        const wasSingle = isDragging && activePointers.size === 1;
        activePointers.delete(e.pointerId);
        if (activePointers.size < 2) pinchStartDist = 0;
        if (activePointers.size === 0) isDragging = false;
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

        if (wasSingle && aiDepthMap()) {
            const sel = selectedCharacter();
            if (sel && autoFocusSelected()) {
                const map = aiDepthMap()!;
                const fd = estimateCharacterGroundDepth(
                    map.data,
                    map.width,
                    map.height,
                    clampFinite(sel.posXPercent / 100, 0.05, 0.95, 0.5),
                    clampFinite(sel.posYPercent / 100, 0.05, 0.95, 0.78),
                );
                setDofFocusDepth(Math.round(fd * 100) / 100);
                cachedDofKey = "";
            }
            renderPreview();
        }
    };

    const exportCompositeImage = () => {
        const bg = bgAsset();
        const exportW = bg ? Math.min(3200, bg.width) : 1280;
        const exportH = bg ? Math.max(200, Math.round((exportW / Math.max(1, bg.width)) * bg.height)) : 720;
        const canvas = document.createElement("canvas");
        canvas.width = exportW;
        canvas.height = exportH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        drawScene(ctx, exportW, exportH, true);
        const mime = exportFormat();
        const quality = mime === "image/png" ? undefined : 0.94;
        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                const prev = exportedUrl();
                if (prev) URL.revokeObjectURL(prev);
                setExportedUrl(createSafeObjectUrl(blob));
                setShowExportModal(true);
            },
            mime,
            quality,
        );
    };

    const downloadExported = () => {
        const url = exportedUrl();
        if (!url || !url.startsWith("blob:")) return;
        const ext = exportFormat() === "image/jpeg" ? "jpg" : exportFormat() === "image/webp" ? "webp" : "png";
        const a = document.createElement("a");
        a.href = url;
        a.download = `photo-composite-${Date.now()}.${ext}`;
        a.click();
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
        renderPreview();
        return () => {
            const b = bgAsset();
            if (b?.previewUrl) URL.revokeObjectURL(b.previewUrl);
            const seen = new Set<string>();
            for (const c of characters()) {
                if (!seen.has(c.asset.previewUrl)) {
                    seen.add(c.asset.previewUrl);
                    URL.revokeObjectURL(c.asset.previewUrl);
                }
            }
            const ex = exportedUrl();
            if (ex) URL.revokeObjectURL(ex);
        };
    });

    return (
        <div ref={containerRef} class="ba-stack-4" style={{ "max-width": "1240px", margin: "0 auto" }}>
            <header class="ba-stack-2">
                <div class="ba-flex ba-items-center ba-gap-2">
                    <ToolIcon name="image" />
                    <h1 class="ba-h1">{pageTitle()}</h1>
                </div>
                <p class="ba-text-sm ba-text-subtle">{description()}</p>
            </header>

            <form
                {...({
                    toolname: "photo_composite_studio",
                    tooldescription:
                        "Composite multiple transparent character illustrations onto a background photograph with AI depth occlusion, local ambient lighting, shadows, and Depth of Field.",
                } as Record<string, string>)}
                onSubmit={(e) => e.preventDefault()}
                class="ba-grid ba-grid-cols-1 lg:ba-grid-cols-[1.4fr_1fr] ba-gap-4"
            >
                {/* 左：合成プレビューキャンバス */}
                <section class="ba-card ba-stack-3">
                    <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                        <div class="ba-flex ba-flex-wrap ba-gap-2">
                            <input
                                ref={bgInputRef}
                                type="file"
                                class="ba-sr-only"
                                aria-label="写真ライブラリやドライブから背景写真を選択"
                                onChange={(e) => {
                                    const file = e.currentTarget.files?.[0];
                                    if (file) handleBackgroundFile(file);
                                    e.currentTarget.value = "";
                                }}
                            />
                            <button
                                type="button"
                                class="ba-btn ba-btn--primary ba-btn--sm"
                                onClick={() => bgInputRef?.click()}
                            >
                                背景写真を選択（ドライブ対応）
                            </button>

                            <input
                                ref={charInputRef}
                                type="file"
                                multiple
                                class="ba-sr-only"
                                aria-label="写真ライブラリやドライブから立ち絵を追加（複数選択可）"
                                onChange={(e) => {
                                    if (e.currentTarget.files?.length) {
                                        addCharacterFiles(e.currentTarget.files);
                                    }
                                    e.currentTarget.value = "";
                                }}
                            />
                            <button
                                type="button"
                                class="ba-btn ba-btn--secondary ba-btn--sm"
                                onClick={() => charInputRef?.click()}
                            >
                                立ち絵を追加（複数・ドライブ対応）
                            </button>
                        </div>

                        <button
                            type="button"
                            class="ba-btn ba-btn--accent ba-btn--sm"
                            disabled={aiDepthBusy() || !bgAsset()}
                            onClick={() => void runAiDepthAnalysis()}
                        >
                            {aiDepthBusy() ? "AI奥行き解析中..." : "AI自動馴染ませ（奥行き・地面壁・距離）"}
                        </button>
                    </div>

                    <Show when={aiDepthStatus()}>
                        <p class="ba-text-xs ba-text-subtle">{aiDepthStatus()}</p>
                    </Show>

                    <div
                        style={{
                            position: "relative",
                            width: "100%",
                            "background-color": "#0b0f19",
                            "border-radius": "var(--ba-radius)",
                            overflow: "hidden",
                            border: "1px solid var(--ba-border)",
                        }}
                    >
                        <canvas
                            ref={previewCanvasRef}
                            width={1280}
                            height={720}
                            style={{
                                width: "100%",
                                height: "auto",
                                "max-height": "72dvh",
                                display: "block",
                                "object-fit": "contain",
                                "touch-action": "none",
                                cursor: "grab",
                            }}
                            aria-label="写真と複数立ち絵の合成プレビュー"
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                        />
                    </div>

                    <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                        <p class="ba-text-xs ba-text-subtle">
                            ※ 処理はすべて端末内（WebGPU/ブラウザ）で完結し、画像が外部送信・AI学習に使われることはありません。
                        </p>
                        <div class="ba-flex ba-items-center ba-gap-2">
                            <select
                                aria-label="書き出し画像形式"
                                class="ba-select ba-select--sm"
                                value={exportFormat()}
                                onChange={(e) =>
                                    setExportFormat(
                                        e.currentTarget.value as "image/png" | "image/jpeg" | "image/webp",
                                    )
                                }
                            >
                                <option value="image/png">PNG</option>
                                <option value="image/jpeg">JPEG</option>
                                <option value="image/webp">WebP</option>
                            </select>
                            <button
                                type="button"
                                class="ba-btn ba-btn--success ba-btn--sm"
                                onClick={exportCompositeImage}
                            >
                                合成画像を保存
                            </button>
                        </div>
                    </div>
                </section>

                {/* 右：レイヤー管理 & 個別・空間調整 */}
                <aside class="ba-stack-3">
                    {/* 立ち絵レイヤー一覧 */}
                    <section class="ba-card ba-stack-2" aria-label="立ち絵レイヤー管理">
                        <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                            <h2 class="ba-h3">立ち絵レイヤー ({characters().length}体)</h2>
                            <label class="ba-flex ba-items-center ba-gap-1 ba-text-xs ba-cursor-pointer">
                                <input
                                    type="checkbox"
                                    class="ba-checkbox"
                                    checked={sortByDepth()}
                                    onChange={(e) => {
                                        setSortByDepth(e.currentTarget.checked);
                                        renderPreview();
                                    }}
                                />
                                <span>奥行き順に自動整列</span>
                            </label>
                        </div>

                        <Show
                            when={characters().length > 0}
                            fallback={
                                <p class="ba-text-xs ba-text-subtle">
                                    「立ち絵を追加（複数・ドライブ対応）」から透過PNG画像を追加してください。
                                </p>
                            }
                        >
                            <div class="ba-stack-1">
                                <For each={characters()}>
                                    {(c) => (
                                        <div
                                            class="ba-flex ba-items-center ba-justify-between ba-gap-2"
                                            style={{
                                                padding: "0.4rem 0.6rem",
                                                "border-radius": "var(--ba-radius)",
                                                border:
                                                    selectedCharacter()?.id === c.id
                                                        ? "1.5px solid var(--ba-primary, #38bdf8)"
                                                        : "1px solid var(--ba-border)",
                                            }}
                                        >
                                            <button
                                                type="button"
                                                class="ba-btn ba-btn--ghost ba-btn--xs"
                                                style={{ "text-align": "left", flex: "1", "justify-content": "flex-start" }}
                                                onClick={() => {
                                                    setSelectedId(c.id);
                                                    renderPreview();
                                                }}
                                            >
                                                <span class="ba-text-xs ba-font-bold">
                                                    {c.asset.name} ({c.cameraDistanceM}m / {c.characterHeightCm}cm)
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                class="ba-btn ba-btn--secondary ba-btn--xs"
                                                onClick={() => {
                                                    setSelectedId(c.id);
                                                    duplicateSelectedCharacter();
                                                }}
                                            >
                                                複製
                                            </button>
                                            <button
                                                type="button"
                                                class="ba-btn ba-btn--danger ba-btn--xs"
                                                aria-label={`${c.asset.name}を削除`}
                                                onClick={() => removeCharacter(c.id)}
                                            >
                                                削除
                                            </button>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </section>

                    {/* 選択中キャラ個別設定 */}
                    <Show when={selectedCharacter()}>
                        {(sel) => (
                            <section class="ba-card ba-stack-2" aria-label="選択中の立ち絵調整">
                                <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                                    <h2 class="ba-h3">選択中: {sel().asset.name}</h2>
                                    <div class="ba-flex ba-gap-1">
                                        <button
                                            type="button"
                                            class={`ba-btn ba-btn--xs ${sel().flipHorizontal ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                            onClick={() => {
                                                updateSelectedCharacter((c) => ({
                                                    ...c,
                                                    flipHorizontal: !c.flipHorizontal,
                                                }));
                                                renderPreview();
                                            }}
                                        >
                                            左右反転
                                        </button>
                                        <Show when={aiDepthMap()}>
                                            <button
                                                type="button"
                                                class="ba-btn ba-btn--secondary ba-btn--xs"
                                                onClick={() => syncCharacterWithDepth(sel().id)}
                                            >
                                                AI位置合わせ
                                            </button>
                                        </Show>
                                    </div>
                                </div>

                                <div class="ba-grid ba-grid-cols-2 ba-gap-2">
                                    <div>
                                        <label for="pc-height-input" class="ba-label">
                                            <span>身長 (cm)</span>
                                        </label>
                                        <input
                                            id="pc-height-input"
                                            type="number"
                                            min="20"
                                            max="350"
                                            class="ba-input ba-input--sm"
                                            value={sel().characterHeightCm}
                                            onInput={(e) => {
                                                const v = clampFinite(Number(e.currentTarget.value), 20, 350, 160);
                                                updateSelectedCharacter((c) => ({
                                                    ...c,
                                                    characterHeightCm: v,
                                                    scale: computeScaleForLayer(c.asset, v, c.cameraDistanceM),
                                                }));
                                                renderPreview();
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label for="pc-distance-input" class="ba-label">
                                            <span>距離 (m)</span>
                                        </label>
                                        <input
                                            id="pc-distance-input"
                                            type="number"
                                            min="0.3"
                                            max="30"
                                            step="0.1"
                                            class="ba-input ba-input--sm"
                                            value={sel().cameraDistanceM}
                                            onInput={(e) => {
                                                const v = clampFinite(Number(e.currentTarget.value), 0.3, 30, 2.5);
                                                updateSelectedCharacter((c) => ({
                                                    ...c,
                                                    cameraDistanceM: v,
                                                    scale: computeScaleForLayer(c.asset, c.characterHeightCm, v),
                                                }));
                                                renderPreview();
                                            }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label for="pc-scale-range" class="ba-label">
                                        <span>サイズ</span>
                                        <span>{Math.round(sel().scale * 100)}%</span>
                                    </label>
                                    <input
                                        id="pc-scale-range"
                                        type="range"
                                        min="0.1"
                                        max="4"
                                        step="0.05"
                                        class="ba-range"
                                        value={sel().scale}
                                        onInput={(e) => {
                                            const v = clampFinite(Number(e.currentTarget.value), 0.1, 4, 0.65);
                                            updateSelectedCharacter((c) => ({ ...c, scale: v }));
                                            renderPreview();
                                        }}
                                    />
                                </div>

                                <div class="ba-grid ba-grid-cols-2 ba-gap-2">
                                    <div>
                                        <label for="pc-pitch-range" class="ba-label">
                                            <span>煽り・俯瞰</span>
                                            <span>{sel().cameraPitchDeg}°</span>
                                        </label>
                                        <input
                                            id="pc-pitch-range"
                                            type="range"
                                            min="-60"
                                            max="60"
                                            step="1"
                                            class="ba-range"
                                            value={sel().cameraPitchDeg}
                                            onInput={(e) => {
                                                const v = clampFinite(Number(e.currentTarget.value), -60, 60, 0);
                                                updateSelectedCharacter((c) => ({ ...c, cameraPitchDeg: v }));
                                                renderPreview();
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label for="pc-rot-range" class="ba-label">
                                            <span>回転</span>
                                            <span>{sel().rotationDeg}°</span>
                                        </label>
                                        <input
                                            id="pc-rot-range"
                                            type="range"
                                            min="-180"
                                            max="180"
                                            step="1"
                                            class="ba-range"
                                            value={sel().rotationDeg}
                                            onInput={(e) => {
                                                const v = clampFinite(Number(e.currentTarget.value), -180, 180, 0);
                                                updateSelectedCharacter((c) => ({ ...c, rotationDeg: v }));
                                                renderPreview();
                                            }}
                                        />
                                    </div>
                                </div>

                                <div class="ba-grid ba-grid-cols-2 ba-gap-2">
                                    <div>
                                        <label for="pc-ambient-range" class="ba-label">
                                            <span>環境光馴染み</span>
                                            <span>{Math.round(sel().ambientStrength * 100)}%</span>
                                        </label>
                                        <input
                                            id="pc-ambient-range"
                                            type="range"
                                            min="0"
                                            max="1.5"
                                            step="0.05"
                                            class="ba-range"
                                            value={sel().ambientStrength}
                                            onInput={(e) => {
                                                const v = clampFinite(Number(e.currentTarget.value), 0, 1.5, 1);
                                                updateSelectedCharacter((c) => ({ ...c, ambientStrength: v }));
                                                renderPreview();
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label for="pc-edge-range" class="ba-label">
                                            <span>輪郭馴染ませ</span>
                                            <span>{sel().edgeSoftnessPx.toFixed(1)}px</span>
                                        </label>
                                        <input
                                            id="pc-edge-range"
                                            type="range"
                                            min="0"
                                            max="1.5"
                                            step="0.1"
                                            class="ba-range"
                                            value={sel().edgeSoftnessPx}
                                            onInput={(e) => {
                                                const v = clampFinite(Number(e.currentTarget.value), 0, 1.5, 0.4);
                                                updateSelectedCharacter((c) => ({ ...c, edgeSoftnessPx: v }));
                                                renderPreview();
                                            }}
                                        />
                                    </div>
                                </div>

                                <Show when={aiDepthMap()}>
                                    <div>
                                        <label for="pc-occ-range" class="ba-label">
                                            <span>手前遮蔽しきい値</span>
                                            <span>{Math.round(sel().occlusionThreshold * 100)}%</span>
                                        </label>
                                        <input
                                            id="pc-occ-range"
                                            type="range"
                                            min="0.05"
                                            max="0.95"
                                            step="0.01"
                                            class="ba-range"
                                            value={sel().occlusionThreshold}
                                            onInput={(e) => {
                                                const v = clampFinite(Number(e.currentTarget.value), 0.05, 0.95, 0.55);
                                                updateSelectedCharacter((c) => ({
                                                    ...c,
                                                    occlusionThreshold: v,
                                                    useOcclusion: true,
                                                }));
                                                cachedMaskKey = "";
                                                renderPreview();
                                            }}
                                        />
                                    </div>
                                </Show>
                            </section>
                        )}
                    </Show>

                    {/* 全体ライティング & 被写界深度 */}
                    <section class="ba-card ba-stack-2" aria-label="光源・影・被写界深度設定">
                        <h2 class="ba-h3">光源・影・被写界深度</h2>
                        <div class="ba-flex ba-flex-wrap ba-gap-3">
                            <label class="ba-flex ba-items-center ba-gap-1 ba-text-xs ba-cursor-pointer">
                                <input
                                    type="checkbox"
                                    class="ba-checkbox"
                                    checked={autoAmbientMatch()}
                                    onChange={(e) => {
                                        setAutoAmbientMatch(e.currentTarget.checked);
                                        renderPreview();
                                    }}
                                />
                                <span>環境光・背景色馴染ませ</span>
                            </label>
                            <label class="ba-flex ba-items-center ba-gap-1 ba-text-xs ba-cursor-pointer">
                                <input
                                    type="checkbox"
                                    class="ba-checkbox"
                                    checked={showSurfaceGuides()}
                                    onChange={(e) => {
                                        setShowSurfaceGuides(e.currentTarget.checked);
                                        renderPreview();
                                    }}
                                />
                                <span>地面・壁ガイド表示</span>
                            </label>
                        </div>

                        <div class="ba-grid ba-grid-cols-2 ba-gap-2">
                            <div>
                                <label for="pc-light-az-range" class="ba-label">
                                    <span>光源方位</span>
                                    <span>{Math.round(lightAzimuthDeg())}°</span>
                                </label>
                                <input
                                    id="pc-light-az-range"
                                    type="range"
                                    min="0"
                                    max="360"
                                    step="5"
                                    class="ba-range"
                                    value={lightAzimuthDeg()}
                                    onInput={(e) => {
                                        setAutoLightDirection(false);
                                        setLightAzimuthDeg(clampFinite(Number(e.currentTarget.value), 0, 360, 315));
                                        renderPreview();
                                    }}
                                />
                            </div>
                            <div>
                                <label for="pc-shadow-op-range" class="ba-label">
                                    <span>影の濃さ</span>
                                    <span>{Math.round(shadowOpacity() * 100)}%</span>
                                </label>
                                <input
                                    id="pc-shadow-op-range"
                                    type="range"
                                    min="0"
                                    max="0.95"
                                    step="0.05"
                                    class="ba-range"
                                    value={shadowOpacity()}
                                    onInput={(e) => {
                                        setShadowOpacity(clampFinite(Number(e.currentTarget.value), 0, 0.95, 0.52));
                                        renderPreview();
                                    }}
                                />
                            </div>
                        </div>

                        <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                            <span class="ba-text-xs ba-font-bold">被写界深度 (背景ボケ)</span>
                            <button
                                type="button"
                                class={`ba-btn ba-btn--xs ${dofEnabled() ? "ba-btn--primary" : "ba-btn--secondary"}`}
                                aria-pressed={dofEnabled() ? "true" : "false"}
                                onClick={() => {
                                    setDofEnabled((v) => !v);
                                    renderPreview();
                                }}
                            >
                                {dofEnabled() ? "ボケON" : "ボケOFF"}
                            </button>
                        </div>
                        <div>
                            <label for="pc-dof-f-range" class="ba-label">
                                <span>絞り (F値)</span>
                                <span>f/{dofApertureF().toFixed(1)}</span>
                            </label>
                            <input
                                id="pc-dof-f-range"
                                type="range"
                                min="1.4"
                                max="16"
                                step="0.2"
                                class="ba-range"
                                value={dofApertureF()}
                                onInput={(e) => {
                                    setDofApertureF(clampFinite(Number(e.currentTarget.value), 1.4, 16, 2.4));
                                    if (!dofEnabled()) setDofEnabled(true);
                                    cachedDofKey = "";
                                    renderPreview();
                                }}
                            />
                        </div>
                    </section>
                </aside>
            </form>

            {/* 書き出しプレビューモーダル */}
            <Show when={showExportModal() && exportedUrl()}>
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="合成画像保存プレビュー"
                    style={{
                        position: "fixed",
                        inset: "0",
                        "z-index": "70",
                        background: "rgba(10, 15, 28, 0.9)",
                        display: "flex",
                        "flex-direction": "column",
                        "align-items": "center",
                        "justify-content": "center",
                        padding: "1rem",
                        gap: "0.75rem",
                    }}
                >
                    <img
                        src={exportedUrl()!}
                        alt="合成された画像"
                        style={{
                            "max-width": "100%",
                            "max-height": "calc(100dvh - 6rem)",
                            "border-radius": "10px",
                            "object-fit": "contain",
                        }}
                    />
                    <div class="ba-flex ba-gap-2">
                        <button
                            type="button"
                            class="ba-btn ba-btn--success ba-btn--sm"
                            onClick={downloadExported}
                        >
                            画像をダウンロード
                        </button>
                        <button
                            type="button"
                            class="ba-btn ba-btn--secondary ba-btn--sm"
                            onClick={() => setShowExportModal(false)}
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </Show>

            <AdSense />
        </div>
    );
}
