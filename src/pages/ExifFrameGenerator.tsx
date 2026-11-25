import {
    createSignal,
    Show,
    For,
    createEffect,
    onSettled,
} from "solid-js";
import AdSense from "../components/AdSense";
import ToolIcon, { type ToolIconName } from "../components/ToolIcon";
import { delayedCall, playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";
const isTest = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

export default function ExifFrame() {
    const { title, description } = usePageI18n("/exif-frame", {
        defaultTitle: "EXIFフレーム生成",
        defaultDescription:
            "写真に撮影日時、カメラ機種、レンズ名、焦点距離、F値、シャッタースピード、ISO感度などのEXIF情報を美しくレイアウトしたフレーム画像をブラウザ完結で生成・保存できる無料ツールです。完全無料で登録不要、すべての処理はお使いのブラウザ上で安全かつ高速に実行されます。PCやスマートフォンの大画面・小画面どちらでも快適にご利用いただけます。",
    });
    const [fileName, setFileName] = createSignal("");
    const [customExportName, setCustomExportName] = createSignal("");
    const [frameColor, setFrameColor] = createSignal("white");
    const [framePosition, setFramePosition] = createSignal("bottom");
    const [textAlign, setTextAlign] = createSignal("left");
    const [saveFormat, setSaveFormat] = createSignal("image/jpeg");
    const [isChekiMode, setIsChekiMode] = createSignal(false);
    const [isMaximized, setIsMaximized] = createSignal(false);
    const [modalZoomScale, setModalZoomScale] = createSignal(1);
    const [modalTranslate, setModalTranslate] = createSignal({ x: 0, y: 0 });
    const [hasImage, setHasImage] = createSignal(false);
    const [keepOriginalExif, setKeepOriginalExif] = createSignal(false);
    const [visitedTabs, setVisitedTabs] = createSignal<Set<string>>(
        isTest
            ? new Set(["photo", "text", "layout", "design", "overlay", "save"])
            : new Set(["photo"]),
    );

    const [showMobileSaveModal, setShowMobileSaveModal] = createSignal(false);
    const [downloadImageSrc, setDownloadImageSrc] = createSignal("");
    const [downloadFileName, setDownloadFileName] = createSignal("");
    const [uploadedImageSrc, setUploadedImageSrc] = createSignal("");
    const [isProcessing, setIsProcessing] = createSignal(false);
    const [processingProgress, setProcessingProgress] = createSignal(0);
    const [processingStepText, setProcessingStepText] = createSignal("");
    const [exportMaxEdge, setExportMaxEdge] = createSignal<number>(0); // 0 = 元画像のまま(フル解像度), 4096 = 4K, 2048 = SNS推奨
    let preparedDownloadBlob: Blob | null = null;
    let currentModalBlobUrl: string | null = null;
    let rafDrawId = 0;

    const [useCustomTitle, setUseCustomTitle] = createSignal(false);
    const [customTitleLine1, setCustomTitleLine1] =
        createSignal("My Masterpiece");
    const [customTitleLine2, setCustomTitleLine2] =
        createSignal("Shot in 2026");

    const [prefixText, setPrefixText] = createSignal("Shot on ");
    const [showPrefix, setShowPrefix] = createSignal(true);

    const [isAdvancedMode, setIsAdvancedMode] = createSignal(false);
    const [customFrameColor, setCustomFrameColor] = createSignal("#ffffff");
    const [customTextColor, setCustomTextColor] = createSignal("#222222");
    const [imageBorderRadius, setImageBorderRadius] = createSignal(0);
    const [frameStyle, setFrameStyle] = createSignal("none");
    const [textPlateStyle, setTextPlateStyle] = createSignal("none");

    const [cameraModel, setCameraModel] = createSignal("");
    const [lensModel, setLensModel] = createSignal("");
    const [focalLength, setFocalLength] = createSignal("");
    const [fNumber, setFNumber] = createSignal("");
    const [shutterSpeed, setShutterSpeed] = createSignal("");
    const [isoValue, setIsoValue] = createSignal("");

    const [showCamera, setShowCamera] = createSignal(true);
    const [showLens, setShowLens] = createSignal(true);
    const [showFocal, setShowFocal] = createSignal(true);
    const [showFNumber, setShowFNumber] = createSignal(true);
    const [showSpeed, setShowSpeed] = createSignal(true);
    const [showIso, setShowIso] = createSignal(true);

    const [separatorType, setSeparatorType] = createSignal(" | ");
    const [customSeparator, setCustomSeparator] = createSignal(" | ");

    const separatorPresets = [
        { label: "パイプ ( | )", value: " | ", display: "|" },
        { label: "スラッシュ ( / )", value: " / ", display: "/" },
        { label: "ドット ( · )", value: " · ", display: "·" },
        { label: "丸点 ( • )", value: " • ", display: "•" },
        { label: "ハイフン ( - )", value: " - ", display: "-" },
        { label: "スペース (空白)", value: "   ", display: "␣" },
        { label: "自由入力", value: "custom", display: "自由" },
    ];

    const getSeparator = () => {
        if (separatorType() === "custom") {
            return customSeparator();
        }
        return separatorType();
    };

    const [selectedFont, setSelectedFont] = createSignal(
        "'Noto Sans JP', sans-serif",
    );
    const [fontSizeScale, setFontSizeScale] = createSignal(100);
    const [imageRotation, setImageRotation] = createSignal(0);

    type OverlayImageItem = {
        id: string;
        name: string;
        src: string;
        image: HTMLImageElement;
        x: number; // 0..100 (%)
        y: number; // 0..100 (%)
        scale: number; // 5..200 (% of longSide * 0.25)
        rotation: number; // -180..180 (deg)
        opacity: number; // 0..100 (%)
        flipX: boolean;
        overFrame: boolean; // true: フレームの上に重ねる / false: 写真領域内にクリップ
    };
    const [overlayImages, setOverlayImages] = createSignal<OverlayImageItem[]>([]);
    const [selectedOverlayId, setSelectedOverlayId] = createSignal<string | null>(null);
    const [draggingOverlayId, setDraggingOverlayId] = createSignal<string | null>(null);
    const [copyrightText, setCopyrightText] = createSignal("");
    const [copyrightPosition, setCopyrightPosition] = createSignal<
        "auto" | "frame-bottom-right" | "frame-bottom-left" | "frame-top-right" | "frame-top-left" | "image-bottom-right" | "image-bottom-left"
    >("auto");

    let lastImgLayout = {
        imgX: 0,
        imgY: 0,
        imgW: 1,
        imgH: 1,
        longSide: 1,
    };
    let overlayDragStart = {
        pointerId: -1,
        mode: "move" as "move" | "resize",
        startCanvasX: 0,
        startCanvasY: 0,
        initialItemX: 0,
        initialItemY: 0,
        initialScale: 40,
        initialDist: 1,
        centerX: 0,
        centerY: 0,
    };
    const activeOverlayPointers = new Map<number, { x: number; y: number }>();
    let overlayPinchStart = {
        active: false,
        initialDist: 1,
        initialScale: 40,
        targetId: null as string | null,
    };

    let sliderPointerDrag = {
        active: false,
        pointerId: -1,
        input: null as HTMLInputElement | null,
    };

    const updateRangeFromPointer = (input: HTMLInputElement, clientX: number) => {
        const rect = input.getBoundingClientRect();
        if (rect.width <= 0) return;
        const min = Number(input.min || 0);
        const max = Number(input.max || 100);
        const step = Number(input.step || 1);
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const raw = min + ratio * (max - min);
        const stepped = step > 0 ? Math.round(raw / step) * step : raw;
        const clamped = Math.max(min, Math.min(max, stepped));
        if (Number(input.value) !== clamped) {
            input.value = String(clamped);
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }
    };

    const handleSliderPointerDown = (e: PointerEvent) => {
        const input = e.currentTarget as HTMLInputElement;
        if (!input) return;
        e.stopPropagation();
        sliderPointerDrag = {
            active: true,
            pointerId: e.pointerId,
            input,
        };
        try {
            input.setPointerCapture?.(e.pointerId);
        } catch {
            // 無視
        }
        updateRangeFromPointer(input, e.clientX);
    };

    const handleSliderPointerMove = (e: PointerEvent) => {
        if (
            !sliderPointerDrag.active ||
            e.pointerId !== sliderPointerDrag.pointerId ||
            !sliderPointerDrag.input
        ) {
            return;
        }
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        updateRangeFromPointer(sliderPointerDrag.input, e.clientX);
    };

    const handleSliderPointerUp = (e: PointerEvent) => {
        if (
            !sliderPointerDrag.active ||
            e.pointerId !== sliderPointerDrag.pointerId
        ) {
            return;
        }
        e.stopPropagation();
        try {
            sliderPointerDrag.input?.releasePointerCapture?.(e.pointerId);
        } catch {
            // 無視
        }
        sliderPointerDrag = {
            active: false,
            pointerId: -1,
            input: null,
        };
    };

    const handleOverlayFilesChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) return;
        const files = Array.from(target.files);
        files.forEach((file) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                setOverlayImages((prev) => [
                    ...prev,
                    {
                        id: newId,
                        name: file.name,
                        src: url,
                        image: img,
                        x: 80,
                        y: 80,
                        scale: 40,
                        rotation: 0,
                        opacity: 100,
                        flipX: false,
                        overFrame: false,
                    },
                ]);
                setSelectedOverlayId(newId);
            };
            img.src = url;
        });
        target.value = "";
    };

    const updateOverlayItem = (
        id: string,
        patch: Partial<Omit<OverlayImageItem, "id" | "image" | "src">>,
    ) => {
        setOverlayImages((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );
    };

    const removeOverlayItem = (id: string) => {
        setOverlayImages((prev) => {
            const target = prev.find((item) => item.id === id);
            if (target) URL.revokeObjectURL(target.src);
            const next = prev.filter((item) => item.id !== id);
            if (selectedOverlayId() === id) {
                setSelectedOverlayId(next.length > 0 ? next[next.length - 1].id : null);
            }
            return next;
        });
    };

    const moveOverlayItemOrder = (id: string, dir: -1 | 1) => {
        setOverlayImages((prev) => {
            const idx = prev.findIndex((i) => i.id === id);
            if (idx < 0) return prev;
            const nextIdx = idx + dir;
            if (nextIdx < 0 || nextIdx >= prev.length) return prev;
            const copy = [...prev];
            const [moved] = copy.splice(idx, 1);
            copy.splice(nextIdx, 0, moved);
            return copy;
        });
    };

    type SettingTab = "photo" | "text" | "layout" | "design" | "overlay" | "save";
    const settingTabs: { id: SettingTab; icon: ToolIconName; label: string; isBeta?: boolean }[] = [
        { id: "photo", icon: "camera", label: "写真" },
        { id: "text", icon: "type", label: "文字" },
        { id: "layout", icon: "layout", label: "配置" },
        { id: "design", icon: "sliders", label: "デザイン" },
        { id: "overlay", icon: "layers", label: "重ね画像", isBeta: true },
        { id: "save", icon: "download", label: "保存" },
    ];
    const [activeTab, setActiveTab] = createSignal<SettingTab>("photo");

    let rawFileBase64Str: string | null = null;
    let canvasRef: HTMLCanvasElement | undefined;
    let sourceImage: HTMLImageElement | null = null;
    let containerRef: HTMLDivElement | undefined;

    const getCanvasCoordinates = (clientX: number, clientY: number) => {
        if (!canvasRef) return null;
        const rect = canvasRef.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const scaleX = canvasRef.width / rect.width;
        const scaleY = canvasRef.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    };

    const getOverlayItemMetrics = (item: OverlayImageItem) => {
        const { imgX, imgY, imgW, imgH, longSide } = lastImgLayout;
        const natW = item.image.naturalWidth || item.image.width || 1;
        const natH = item.image.naturalHeight || item.image.height || 1;
        const targetMaxDim = Math.max(8, longSide * (item.scale / 100) * 0.5);
        const ratio = targetMaxDim / Math.max(natW, natH);
        const drawW = natW * ratio;
        const drawH = natH * ratio;
        const cx = imgX + (item.x / 100) * imgW;
        const cy = imgY + (item.y / 100) * imgH;
        return { cx, cy, drawW, drawH, longSide };
    };

    const hitTestOverlayItem = (
        canvasX: number,
        canvasY: number,
    ): { id: string; mode: "move" | "resize" } | null => {
        const items = overlayImages();
        if (items.length === 0) return null;

        // 1. まず選択中のアイテムの四隅リサイズハンドルを優先判定
        const selId = selectedOverlayId();
        if (selId) {
            const selItem = items.find((i) => i.id === selId);
            if (selItem) {
                const { cx, cy, drawW, drawH, longSide } =
                    getOverlayItemMetrics(selItem);
                const dx = canvasX - cx;
                const dy = canvasY - cy;
                const rad = (-selItem.rotation * Math.PI) / 180;
                const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
                const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
                const handleRadius = Math.max(22, longSide * 0.022);
                const corners = [
                    { x: -drawW / 2, y: -drawH / 2 },
                    { x: drawW / 2, y: -drawH / 2 },
                    { x: -drawW / 2, y: drawH / 2 },
                    { x: drawW / 2, y: drawH / 2 },
                ];
                for (const c of corners) {
                    if (
                        Math.hypot(localX - c.x, localY - c.y) <= handleRadius
                    ) {
                        return { id: selItem.id, mode: "resize" };
                    }
                }
            }
        }

        // 2. 各アイテム本体の当たり判定（手前のレイヤーから）
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            const { cx, cy, drawW, drawH, longSide } =
                getOverlayItemMetrics(item);

            const dx = canvasX - cx;
            const dy = canvasY - cy;
            const rad = (-item.rotation * Math.PI) / 180;
            const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
            const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

            const handleRadius = Math.max(20, longSide * 0.02);
            const corners = [
                { x: -drawW / 2, y: -drawH / 2 },
                { x: drawW / 2, y: -drawH / 2 },
                { x: -drawW / 2, y: drawH / 2 },
                { x: drawW / 2, y: drawH / 2 },
            ];
            for (const c of corners) {
                if (Math.hypot(localX - c.x, localY - c.y) <= handleRadius) {
                    return { id: item.id, mode: "resize" };
                }
            }

            const hitPad = Math.max(12, longSide * 0.01);
            if (
                Math.abs(localX) <= drawW / 2 + hitPad &&
                Math.abs(localY) <= drawH / 2 + hitPad
            ) {
                return { id: item.id, mode: "move" };
            }
        }
        return null;
    };

    const handleCanvasPointerDown = (e: PointerEvent) => {
        if (overlayImages().length === 0) return;
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        if (!coords) return;

        activeOverlayPointers.set(e.pointerId, coords);
        try {
            (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
        } catch {
            // PointerCapture 非対応環境では無視
        }

        // 2本指タッチ時はピンチ拡大縮小モードへ移行
        if (activeOverlayPointers.size === 2) {
            const pts = Array.from(activeOverlayPointers.values());
            const dist = Math.max(
                1,
                Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
            );
            const targetId =
                selectedOverlayId() ||
                overlayImages()[overlayImages().length - 1]?.id ||
                null;
            const targetItem = overlayImages().find((i) => i.id === targetId);
            if (targetItem) {
                e.preventDefault();
                setSelectedOverlayId(targetItem.id);
                setDraggingOverlayId(targetItem.id);
                overlayPinchStart = {
                    active: true,
                    initialDist: dist,
                    initialScale: targetItem.scale,
                    targetId: targetItem.id,
                };
            }
            return;
        }

        const hit = hitTestOverlayItem(coords.x, coords.y);
        let targetId = hit?.id ?? null;
        let mode: "move" | "resize" = hit?.mode ?? "move";

        if (!targetId && activeTab() === "overlay") {
            targetId =
                selectedOverlayId() ||
                overlayImages()[overlayImages().length - 1]?.id ||
                null;
            mode = "move";
        }
        if (!targetId) {
            activeOverlayPointers.delete(e.pointerId);
            return;
        }

        const targetItem = overlayImages().find((item) => item.id === targetId);
        if (!targetItem) {
            activeOverlayPointers.delete(e.pointerId);
            return;
        }

        e.preventDefault();
        setSelectedOverlayId(targetId);
        setDraggingOverlayId(targetId);
        const { cx, cy } = getOverlayItemMetrics(targetItem);
        const initialDist = Math.max(1, Math.hypot(coords.x - cx, coords.y - cy));
        overlayDragStart = {
            pointerId: e.pointerId,
            mode,
            startCanvasX: coords.x,
            startCanvasY: coords.y,
            initialItemX: targetItem.x,
            initialItemY: targetItem.y,
            initialScale: targetItem.scale,
            initialDist,
            centerX: cx,
            centerY: cy,
        };
    };

    const handleCanvasPointerMove = (e: PointerEvent) => {
        if (activeOverlayPointers.has(e.pointerId)) {
            const coords = getCanvasCoordinates(e.clientX, e.clientY);
            if (coords) {
                activeOverlayPointers.set(e.pointerId, coords);
            }
        }

        // 2本指ピンチ拡大縮小中
        if (overlayPinchStart.active && activeOverlayPointers.size >= 2) {
            const targetId = overlayPinchStart.targetId;
            if (!targetId) return;
            e.preventDefault();
            const pts = Array.from(activeOverlayPointers.values());
            const dist = Math.max(
                1,
                Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
            );
            const nextScale = Math.max(
                5,
                Math.min(
                    250,
                    Math.round(
                        overlayPinchStart.initialScale *
                            (dist / overlayPinchStart.initialDist),
                    ),
                ),
            );
            updateOverlayItem(targetId, { scale: nextScale });
            return;
        }

        const currentId = draggingOverlayId();
        if (!currentId || e.pointerId !== overlayDragStart.pointerId) return;
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        if (!coords) return;

        e.preventDefault();

        if (overlayDragStart.mode === "resize") {
            const currentDist = Math.max(
                1,
                Math.hypot(
                    coords.x - overlayDragStart.centerX,
                    coords.y - overlayDragStart.centerY,
                ),
            );
            const nextScale = Math.max(
                5,
                Math.min(
                    250,
                    Math.round(
                        overlayDragStart.initialScale *
                            (currentDist / overlayDragStart.initialDist),
                    ),
                ),
            );
            updateOverlayItem(currentId, { scale: nextScale });
            return;
        }

        const { imgW, imgH } = lastImgLayout;
        if (imgW <= 0 || imgH <= 0) return;

        const deltaXPercent =
            ((coords.x - overlayDragStart.startCanvasX) / imgW) * 100;
        const deltaYPercent =
            ((coords.y - overlayDragStart.startCanvasY) / imgH) * 100;

        const nextX = Math.max(
            -30,
            Math.min(130, Math.round(overlayDragStart.initialItemX + deltaXPercent)),
        );
        const nextY = Math.max(
            -30,
            Math.min(130, Math.round(overlayDragStart.initialItemY + deltaYPercent)),
        );

        updateOverlayItem(currentId, { x: nextX, y: nextY });
    };

    const handleCanvasPointerUp = (e: PointerEvent) => {
        activeOverlayPointers.delete(e.pointerId);
        if (activeOverlayPointers.size < 2) {
            overlayPinchStart.active = false;
        }
        if (activeOverlayPointers.size === 0) {
            setDraggingOverlayId(null);
            overlayDragStart.pointerId = -1;
        }
        try {
            (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
        } catch {
            // 無視
        }
    };

    const handleCanvasWheel = (e: WheelEvent) => {
        if (overlayImages().length === 0) return;
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        if (!coords) return;

        const hit = hitTestOverlayItem(coords.x, coords.y);
        const targetId =
            hit?.id || (activeTab() === "overlay" ? selectedOverlayId() : null);
        if (!targetId) return;

        const targetItem = overlayImages().find((i) => i.id === targetId);
        if (!targetItem) return;

        e.preventDefault();
        setSelectedOverlayId(targetId);
        const delta = e.deltaY < 0 ? 4 : -4;
        const nextScale = Math.max(
            5,
            Math.min(250, Math.round(targetItem.scale + delta)),
        );
        updateOverlayItem(targetId, { scale: nextScale });
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef);

        return () => {
            if (rafDrawId && typeof window !== "undefined" && "cancelAnimationFrame" in window) {
                cancelAnimationFrame(rafDrawId);
                rafDrawId = 0;
            }
            if (currentModalBlobUrl) {
                URL.revokeObjectURL(currentModalBlobUrl);
                currentModalBlobUrl = null;
            }
            const upSrc = uploadedImageSrc();
            if (upSrc && upSrc.startsWith("blob:")) {
                URL.revokeObjectURL(upSrc);
            }
            for (const item of overlayImages()) {
                if (item.src && item.src.startsWith("blob:")) {
                    URL.revokeObjectURL(item.src);
                }
            }
        };
    });

    const fontList = [
        {
            id: "gothic",
            name: "Noto Sans JP",
            value: "'Noto Sans JP', sans-serif",
            link: "Noto+Sans+JP:wght@300;400;700",
        },
        {
            id: "serif",
            name: "Noto Serif JP",
            value: "'Noto Serif JP', serif",
            link: "Noto+Serif+JP:wght@300;400;700",
        },
        {
            id: "italic",
            name: "Playfair Display",
            value: "'Playfair Display', serif",
            link: "Playfair+Display:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700",
        },
        {
            id: "hand",
            name: "Caveat",
            value: "'Caveat', cursive",
            link: "Caveat:wght@400;700",
        },
        {
            id: "hand-jp",
            name: "Kiwi Maru",
            value: "'Kiwi Maru', serif",
            link: "Kiwi+Maru:wght@300;400;500",
        },
        {
            id: "display",
            name: "Inter",
            value: "'Inter', sans-serif",
            link: "Inter:wght@300;400;500;700",
        },
        {
            id: "mono",
            name: "JetBrains Mono",
            value: "'JetBrains Mono', monospace",
            link: "JetBrains+Mono:wght@300;400;500;700",
        },
        {
            id: "decorative",
            name: "Amatic SC",
            value: "'Amatic SC', cursive",
            link: "Amatic+SC:wght@400;700",
        },
    ];

    const frameTemplates = [
        {
            id: "none",
            name: "標準（装飾なし）",
            borderColor: "var(--ba-border)",
            style: "background: #fff;",
        },
        {
            id: "shadow",
            name: "立体浮き出し影",
            borderColor: "var(--ba-border)",
            style: "background: #eee; box-shadow: 0 2px 6px rgba(0,0,0,0.2);",
        },
        {
            id: "border",
            name: "インライン線画",
            borderColor: "#1e293b",
            style: "background: #fff; box-shadow: inset 0 0 0 2px #333;",
        },
        {
            id: "classic",
            name: "伝統的二重マット",
            borderColor: "#94a3b8",
            style: "background: #fff; box-shadow: inset 0 0 0 1px #999, inset 0 0 0 3px #333;",
        },
        {
            id: "wood",
            name: "最高級オーク木目",
            borderColor: "#92400e",
            style: "background: linear-gradient(135deg, #a05a2c 25%, #8b4513 25%, #8b4513 50%, #a05a2c 50%, #a05a2c 75%, #8b4513 75%); background-size: 8px 8px;",
        },
        {
            id: "gold",
            name: "宮殿アンティーク金縁",
            borderColor: "#ca8a04",
            style: "background: linear-gradient(to bottom, #ffe57f, #ffc107, #b78103); box-shadow: inset 0 0 4px rgba(0,0,0,0.3);",
        },
    ];

    const plateTemplates = [
        {
            id: "none",
            name: "標準テキスト（プレートなし）",
            boxStyle: { background: "var(--ba-surface-2)", color: "var(--ba-text)", "border-color": "var(--ba-border)" },
            render: () => <span>Text Only</span>,
        },
        {
            id: "box",
            name: "モダン座布団ボックス",
            boxStyle: { background: "var(--ba-surface-3)", color: "var(--ba-text)", "border-color": "var(--ba-border)", "border-radius": "0.375rem" },
            render: () => (
                <span style={{ background: "rgba(0,0,0,0.12)", padding: "0.1rem 0.5rem", "border-radius": "0.25rem", "font-size": "0.6875rem" }}>
                    Label Box
                </span>
            ),
        },
        {
            id: "line",
            name: "クラシック上下境界線",
            boxStyle: { background: "var(--ba-surface)", color: "var(--ba-text)", "border-color": "var(--ba-border)" },
            render: () => (
                <span style={{ "border-top": "1px solid currentColor", "border-bottom": "1px solid currentColor", padding: "0.1rem 0.25rem", "font-size": "0.6875rem" }}>
                    Line Text
                </span>
            ),
        },
        {
            id: "metal-gold",
            name: "真鍮ヘアラインゴールド",
            boxStyle: { background: "linear-gradient(to bottom, #fde68a, #facc15, #d97706)", color: "#451a03", "font-weight": 700, "border-color": "#b45309", "box-shadow": "2px 2px 0 #151515" },
            render: () => (
                <span style={{ "font-size": "0.625rem", padding: "0.1rem 0.5rem", border: "1px solid rgba(255,255,255,0.35)", display: "block", "text-align": "center" }}>
                    凹 GOLD
                </span>
            ),
        },
        {
            id: "metal-silver",
            name: "アルミブラッシュドシルバー",
            boxStyle: { background: "linear-gradient(to bottom, #ffffff, #cbd5e1, #94a3b8)", color: "#0f172a", "font-weight": 700, "border-color": "#64748b", "box-shadow": "2px 2px 0 #151515" },
            render: () => (
                <span style={{ "font-size": "0.625rem", padding: "0.1rem 0.5rem", border: "1px solid rgba(255,255,255,0.45)", display: "block", "text-align": "center" }}>
                    凹 SILVER
                </span>
            ),
        },
    ];

    const drawVerticalText = (
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        font: string,
    ) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 2);
        ctx.textAlign = "center";
        ctx.font = font;
        ctx.fillText(text, 0, 0);
        ctx.restore();
    };

    const pickContrast = (hex?: string) => {
        if (!hex || typeof hex !== "string")
            return frameColor() === "white" ? "#000000" : "#ffffff";
        const h = hex.replace("#", "");
        if (!/^[0-9a-fA-F]{6}$/.test(h))
            return frameColor() === "white" ? "#000000" : "#ffffff";
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        return luminance > 0.6 ? "#000000" : "#ffffff";
    };

    const drawFrame = (hideEditorGuides = false, targetMaxLongSide = 2048) => {
        if (!canvasRef || !sourceImage) return;
        const ctx = canvasRef.getContext("2d");
        if (!ctx) return;

        const rawOrigW = sourceImage.naturalWidth || sourceImage.width || 1;
        const rawOrigH = sourceImage.naturalHeight || sourceImage.height || 1;
        const rawLongSide = Math.max(rawOrigW, rawOrigH);
        const renderScale =
            targetMaxLongSide > 0 && rawLongSide > targetMaxLongSide
                ? targetMaxLongSide / rawLongSide
                : 1;

        const origW = Math.max(1, Math.round(rawOrigW * renderScale));
        const origH = Math.max(1, Math.round(rawOrigH * renderScale));
        const isRotated90 = imageRotation() % 180 === 90;
        const imgW = isRotated90 ? origH : origW;
        const imgH = isRotated90 ? origW : origH;

        const longSide = Math.max(imgW, imgH);
        const basePadding = Math.round(longSide * 0.02);
        const textSpace = Math.round(longSide * 0.08);
        const isPortrait = imgH > imgW;
        const isSideHorizontal =
            framePosition() === "left-horizontal" ||
            framePosition() === "right-horizontal";
        const sideAreaHorizontal = Math.max(
            Math.round(imgH * (2 / 3)),
            textSpace + Math.round(longSide * 0.04),
        );
        const sideAreaVertical = Math.max(
            Math.round(longSide * 0.16),
            textSpace + Math.round(longSide * 0.02),
        );
        const sideArea = isSideHorizontal
            ? sideAreaHorizontal
            : sideAreaVertical;
        const sidePadding = isSideHorizontal
            ? Math.max(24, Math.round(sideArea * 0.28))
            : Math.max(16, Math.round(sideArea * 0.22));

        const isRealFrame =
            isAdvancedMode() &&
            (frameStyle() === "wood" || frameStyle() === "gold");
        const realFrameWidth = isRealFrame ? Math.round(longSide * 0.035) : 0;

        let innerCanvasW = imgW;
        let innerCanvasH = imgH;
        let imgX = 0;
        let imgY = 0;

        if (isChekiMode()) {
            innerCanvasW += basePadding * 2;
            innerCanvasH += basePadding * 2 + textSpace;
            imgX = basePadding;
            imgY = basePadding;
        } else {
            if (framePosition() === "bottom") innerCanvasH += textSpace;
            else if (framePosition() === "top") {
                innerCanvasH += textSpace;
                imgY = textSpace;
            } else if (
                framePosition() === "left" ||
                framePosition() === "left-horizontal"
            ) {
                innerCanvasW += sideArea;
                imgX = sideArea;
            } else if (
                framePosition() === "right" ||
                framePosition() === "right-horizontal"
            ) {
                innerCanvasW += sideArea;
            }
        }

        const finalCanvasW = innerCanvasW + realFrameWidth * 2;
        const finalCanvasH = innerCanvasH + realFrameWidth * 2;

        canvasRef.width = finalCanvasW;
        canvasRef.height = finalCanvasH;

        imgX += realFrameWidth;
        imgY += realFrameWidth;
        lastImgLayout = {
            imgX,
            imgY,
            imgW,
            imgH,
            longSide,
        };

        let fColor = frameColor() === "white" ? "#ffffff" : "#121212";
        if (isAdvancedMode()) fColor = customFrameColor();

        ctx.fillStyle = fColor;
        ctx.fillRect(
            realFrameWidth,
            realFrameWidth,
            innerCanvasW,
            innerCanvasH,
        );

        // チェキ風モードでは framePosition に直前の配置（左右横書きなど）が残っているため、
        // サイドパネルの塗り・区切り線を描かないようにする（右下に謎の縦線が出る不具合の対策）
        if (!isChekiMode() && framePosition() === "left-horizontal") {
            ctx.fillStyle =
                frameColor() === "white"
                    ? "rgba(255,255,255,0.98)"
                    : "rgba(15,23,42,0.98)";
            ctx.fillRect(
                realFrameWidth,
                realFrameWidth,
                sideArea,
                innerCanvasH,
            );
            ctx.strokeStyle =
                frameColor() === "white"
                    ? "rgba(148,163,184,0.5)"
                    : "rgba(148,163,184,0.35)";
            ctx.lineWidth = Math.max(1, Math.round(longSide * 0.002));
            ctx.beginPath();
            ctx.moveTo(realFrameWidth + sideArea, realFrameWidth + 2);
            ctx.lineTo(
                realFrameWidth + sideArea,
                realFrameWidth + innerCanvasH - 2,
            );
            ctx.stroke();
        } else if (!isChekiMode() && framePosition() === "right-horizontal") {
            const sideX = realFrameWidth + imgW;
            ctx.fillStyle =
                frameColor() === "white"
                    ? "rgba(255,255,255,0.98)"
                    : "rgba(15,23,42,0.98)";
            ctx.fillRect(sideX, realFrameWidth, sideArea, innerCanvasH);
            ctx.strokeStyle =
                frameColor() === "white"
                    ? "rgba(148,163,184,0.5)"
                    : "rgba(148,163,184,0.35)";
            ctx.lineWidth = Math.max(1, Math.round(longSide * 0.002));
            ctx.beginPath();
            ctx.moveTo(sideX, realFrameWidth + 2);
            ctx.lineTo(sideX, realFrameWidth + innerCanvasH - 2);
            ctx.stroke();
        }

        const centerX = imgX + imgW / 2;
        const centerY = imgY + imgH / 2;
        const scaledRadius = isAdvancedMode()
            ? Math.round((imageBorderRadius() / 3000) * longSide)
            : 0;

        if (isAdvancedMode() && frameStyle() === "shadow") {
            ctx.save();
            ctx.shadowBlur = Math.round(longSide * 0.015);
            ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
            ctx.shadowOffsetX = Math.round(longSide * 0.005);
            ctx.shadowOffsetY = Math.round(longSide * 0.005);

            ctx.fillStyle = fColor;
            ctx.beginPath();
            if (scaledRadius > 0)
                ctx.roundRect(imgX, imgY, imgW, imgH, scaledRadius);
            else ctx.rect(imgX, imgY, imgW, imgH);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        if (scaledRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(imgX, imgY, imgW, imgH, scaledRadius);
            ctx.clip();
        }

        ctx.translate(centerX, centerY);
        ctx.rotate((imageRotation() * Math.PI) / 180);
        ctx.drawImage(sourceImage, -origW / 2, -origH / 2, origW, origH);
        ctx.restore();

        const drawOverlayItems = (overFrameFilter: boolean) => {
            const items = overlayImages().filter(
                (item) => item.overFrame === overFrameFilter,
            );
            if (items.length === 0) return;

            ctx.save();
            if (!overFrameFilter) {
                ctx.beginPath();
                if (scaledRadius > 0)
                    ctx.roundRect(imgX, imgY, imgW, imgH, scaledRadius);
                else ctx.rect(imgX, imgY, imgW, imgH);
                ctx.clip();
            }

            items.forEach((item) => {
                const natW = item.image.naturalWidth || item.image.width || 1;
                const natH = item.image.naturalHeight || item.image.height || 1;
                const targetMaxDim = Math.max(
                    8,
                    longSide * (item.scale / 100) * 0.5,
                );
                const ratio = targetMaxDim / Math.max(natW, natH);
                const drawW = natW * ratio;
                const drawH = natH * ratio;
                const cx = imgX + (item.x / 100) * imgW;
                const cy = imgY + (item.y / 100) * imgH;

                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, item.opacity / 100));
                ctx.translate(cx, cy);
                ctx.rotate((item.rotation * Math.PI) / 180);
                if (item.flipX) {
                    ctx.scale(-1, 1);
                }
                ctx.drawImage(item.image, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();
            });

            ctx.restore();
        };

        drawOverlayItems(false);

        if (isAdvancedMode() && !isRealFrame) {
            ctx.save();
            const lineWidthBorder = Math.max(1, Math.round(longSide * 0.002));
            const lineWidthClassicInner = Math.max(
                1,
                Math.round(longSide * 0.001),
            );
            const lineWidthClassicOuter = Math.max(
                1,
                Math.round(longSide * 0.003),
            );
            const classicOffset = Math.max(2, Math.round(longSide * 0.003));

            if (frameStyle() === "border") {
                ctx.strokeStyle = customTextColor();
                ctx.lineWidth = lineWidthBorder;
                ctx.beginPath();
                if (scaledRadius > 0)
                    ctx.roundRect(imgX, imgY, imgW, imgH, scaledRadius);
                else ctx.rect(imgX, imgY, imgW, imgH);
                ctx.stroke();
            } else if (frameStyle() === "classic") {
                ctx.strokeStyle = "rgba(128,128,128,0.3)";
                ctx.lineWidth = lineWidthClassicInner;
                ctx.beginPath();
                if (scaledRadius > 0)
                    ctx.roundRect(
                        imgX + classicOffset,
                        imgY + classicOffset,
                        imgW - classicOffset * 2,
                        imgH - classicOffset * 2,
                        Math.max(0, scaledRadius - classicOffset),
                    );
                else
                    ctx.rect(
                        imgX + classicOffset,
                        imgY + classicOffset,
                        imgW - classicOffset * 2,
                        imgH - classicOffset * 2,
                    );
                ctx.stroke();

                ctx.strokeStyle = customTextColor();
                ctx.lineWidth = lineWidthClassicOuter;
                ctx.beginPath();
                if (scaledRadius > 0)
                    ctx.roundRect(imgX, imgY, imgW, imgH, scaledRadius);
                else ctx.rect(imgX, imgY, imgW, imgH);
                ctx.stroke();
            }
            ctx.restore();
        }

        const prefix = showPrefix() ? prefixText() : "";
        let textLine1Main = "";
        let textLine2 = "";

        if (useCustomTitle()) {
            textLine1Main = customTitleLine1().trim();
            textLine2 = customTitleLine2().trim();
        } else {
            const sep = getSeparator();
            textLine1Main = [
                showCamera() ? cameraModel().trim() : "",
                showLens() ? lensModel().trim() : "",
            ]
                .filter(Boolean)
                .join(sep);

            textLine2 = [
                showFocal() && focalLength() ? `${focalLength()}mm` : "",
                showFNumber() && fNumber() ? `f/${fNumber()}` : "",
                showSpeed() && shutterSpeed() ? shutterSpeed() : "",
                showIso() && isoValue() ? `ISO ${isoValue()}` : "",
            ]
                .filter(Boolean)
                .join(sep);
        }

        let tColor = frameColor() === "white" ? "#222222" : "#e2e8f0";
        if (isAdvancedMode()) tColor = customTextColor();

        const scale = fontSizeScale() / 100;
        const fontSize1 = Math.round(longSide * 0.015 * scale);
        const fontSize2 = Math.round(longSide * 0.011 * scale);
        const font1Prefix = `300 ${fontSize1}px ${selectedFont()}`;
        const font1Main = `bold ${fontSize1}px ${selectedFont()}`;
        const font2 = `${fontSize2}px ${selectedFont()}`;

        const getHorizontalX = () => {
            if (isChekiMode()) return finalCanvasW / 2;
            return textAlign() === "left"
                ? imgX + basePadding
                : textAlign() === "right"
                  ? imgX + imgW - basePadding
                  : finalCanvasW / 2;
        };

        const getHorizontalAlign = () => {
            if (isChekiMode()) return "center";
            return textAlign() === "left"
                ? "start"
                : textAlign() === "right"
                  ? "end"
                  : "center";
        };

        const drawCombinedTextAndPlate = (
            prefixStr: string,
            mainStr: string,
            line2: string,
            tx: number,
            ty: number,
            overrideAlign?: CanvasTextAlign,
            maxTextWidthAllowed?: number,
            isOverlay?: boolean,
            overlayVerticalAlign: "top" | "center" | "bottom" = "center",
        ) => {
            if (!prefixStr && !mainStr && !line2) return;

            ctx.save();
            const hAlign = overrideAlign ?? getHorizontalAlign();
            ctx.textAlign = hAlign;

            let availableWidth = maxTextWidthAllowed ?? Infinity;
            let measuredFontSize1 = fontSize1;
            let measuredFontSize2 = fontSize2;
            let currentScale = 1;

            const measureWidths = () => {
                ctx.font = `300 ${measuredFontSize1}px ${selectedFont()}`;
                const prefixW = prefixStr
                    ? ctx.measureText(prefixStr).width
                    : 0;
                ctx.font = `bold ${measuredFontSize1}px ${selectedFont()}`;
                const mainW = mainStr ? ctx.measureText(mainStr).width : 0;
                const w1 = prefixW + mainW;

                ctx.font = `${measuredFontSize2}px ${selectedFont()}`;
                const w2 = line2 ? ctx.measureText(line2).width : 0;
                return { prefixW, mainW, w1, w2 };
            };

            let { prefixW, mainW, w1, w2 } = measureWidths();
            let targetMaxTextWidth = Math.max(w1, w2);
            if (targetMaxTextWidth > availableWidth) {
                // 枠幅(availableWidth)に必ず収まるよう動的にスケーリング（最小下限 0.25 まで縮小可能に）
                currentScale = Math.min(
                    1,
                    Math.max(0.25, availableWidth / targetMaxTextWidth),
                );
                measuredFontSize1 = Math.max(
                    8,
                    Math.floor(fontSize1 * currentScale),
                );
                measuredFontSize2 = Math.max(
                    6,
                    Math.floor(fontSize2 * currentScale),
                );
                ({ prefixW, mainW, w1, w2 } = measureWidths());
                targetMaxTextWidth = Math.max(w1, w2);
            }

            const lineGap = Math.round(measuredFontSize1 * 0.4);
            const hasLine1 = prefixStr || mainStr;
            const totalTextHeight =
                (hasLine1 ? measuredFontSize1 : 0) +
                (line2 ? measuredFontSize2 : 0) +
                (hasLine1 && line2 ? lineGap : 0);

            const paddingX = Math.round(measuredFontSize1 * 1.0);
            const paddingY = Math.round(measuredFontSize1 * 0.6);
            const pWidth = targetMaxTextWidth + paddingX * 2;
            const pHeight = totalTextHeight + paddingY * 2;

            let pX = tx;
            if (hAlign === "center") pX = tx - pWidth / 2;
            else if (hAlign === "end") pX = tx - pWidth;
            const pY = ty - pHeight / 2;

            const isMetal =
                isAdvancedMode() &&
                (textPlateStyle() === "metal-gold" ||
                    textPlateStyle() === "metal-silver");

            if (isMetal) {
                ctx.save();
                ctx.fillStyle = "#0a0a0a";
                const edgeOffset = Math.max(1, Math.round(fontSize1 * 0.1));
                ctx.fillRect(pX, pY, pWidth + edgeOffset, pHeight + edgeOffset);

                const grad = ctx.createLinearGradient(
                    pX,
                    pY,
                    pX + pWidth,
                    pY + pHeight,
                );
                if (textPlateStyle() === "metal-gold") {
                    grad.addColorStop(0, "#f9e49b");
                    grad.addColorStop(0.2, "#e5c158");
                    grad.addColorStop(0.4, "#fff9e6");
                    grad.addColorStop(0.6, "#cc9922");
                    grad.addColorStop(0.9, "#997311");
                    grad.addColorStop(1, "#664d0b");
                    ctx.fillStyle = grad;
                    tColor = "#1a1202";
                } else {
                    grad.addColorStop(0, "#ffffff");
                    grad.addColorStop(0.2, "#cfcfcf");
                    grad.addColorStop(0.4, "#f5f5f5");
                    grad.addColorStop(0.6, "#aaaaaa");
                    grad.addColorStop(0.9, "#777777");
                    grad.addColorStop(1, "#444444");
                    ctx.fillStyle = grad;
                    tColor = "#111111";
                }
                ctx.fillRect(pX, pY, pWidth, pHeight);

                ctx.strokeStyle =
                    textPlateStyle() === "metal-gold"
                        ? "rgba(255,255,255,0.5)"
                        : "rgba(255,255,255,0.7)";
                ctx.lineWidth = Math.max(1, Math.round(longSide * 0.0004));
                ctx.strokeRect(pX + 2, pY + 2, pWidth - 4, pHeight - 4);

                const screwRadius = Math.max(2, Math.round(fontSize1 * 0.14));
                const screwOffset = Math.round(paddingX * 0.4);
                const screwPositions = [
                    { x: pX + screwOffset, y: pY + screwOffset },
                    { x: pX + pWidth - screwOffset, y: pY + screwOffset },
                    { x: pX + screwOffset, y: pY + pHeight - screwOffset },
                    {
                        x: pX + pWidth - screwOffset,
                        y: pY + pHeight - screwOffset,
                    },
                ];

                screwPositions.forEach((pos) => {
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, screwRadius, 0, Math.PI * 2);
                    ctx.fillStyle =
                        textPlateStyle() === "metal-gold"
                            ? "#7c5a04"
                            : "#555555";
                    ctx.fill();
                    ctx.lineWidth = Math.max(
                        0.5,
                        Math.round(screwRadius * 0.25),
                    );
                    ctx.strokeStyle = "rgba(255,255,255,0.5)";
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(
                        pos.x - screwRadius * 0.5,
                        pos.y - screwRadius * 0.1,
                    );
                    ctx.lineTo(
                        pos.x + screwRadius * 0.5,
                        pos.y + screwRadius * 0.1,
                    );
                    ctx.strokeStyle = "rgba(0,0,0,0.6)";
                    ctx.lineWidth = Math.max(
                        0.5,
                        Math.round(screwRadius * 0.3),
                    );
                    ctx.stroke();
                });

                ctx.restore();
            } else if (isAdvancedMode() && textPlateStyle() === "box") {
                ctx.save();
                ctx.fillStyle =
                    frameColor() === "white"
                        ? "rgba(0,0,0,0.06)"
                        : "rgba(255,255,255,0.08)";
                ctx.beginPath();
                ctx.roundRect(
                    pX,
                    pY,
                    pWidth,
                    pHeight,
                    Math.max(4, Math.round(fontSize1 * 0.2)),
                );
                ctx.fill();
                ctx.restore();
            } else if (isAdvancedMode() && textPlateStyle() === "line") {
                ctx.save();
                ctx.strokeStyle = customTextColor();
                ctx.lineWidth = Math.max(1, Math.round(longSide * 0.0006));
                ctx.beginPath();
                ctx.moveTo(pX + paddingX * 0.3, pY);
                ctx.lineTo(pX + pWidth - paddingX * 0.3, pY);
                ctx.moveTo(pX + paddingX * 0.3, pY + pHeight);
                ctx.lineTo(pX + pWidth - paddingX * 0.3, pY + pHeight);
                ctx.stroke();
                ctx.restore();
            }

            let finalTextColor = isMetal
                ? tColor
                : isAdvancedMode()
                  ? customTextColor()
                  : frameColor() === "white"
                    ? "#222222"
                    : "#e2e8f0";

            if (isOverlay === true) {
                const pickContrast = (hex: string) => {
                    if (!hex || typeof hex !== "string")
                        return frameColor() === "white" ? "#000000" : "#ffffff";
                    const h = hex.replace("#", "");
                    if (!/^[0-9a-fA-F]{6}$/.test(h))
                        return frameColor() === "white" ? "#000000" : "#ffffff";
                    const r = parseInt(h.slice(0, 2), 16);
                    const g = parseInt(h.slice(2, 4), 16);
                    const b = parseInt(h.slice(4, 6), 16);
                    const luminance =
                        (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                    return luminance > 0.6 ? "#000000" : "#ffffff";
                };

                try {
                    finalTextColor = pickContrast(finalTextColor);
                } catch (e) {
                    finalTextColor =
                        frameColor() === "white" ? "#000000" : "#ffffff";
                }
            }

            ctx.fillStyle = finalTextColor;

            let currentTextY = pY + paddingY + measuredFontSize1 * 0.85;
            if (prefixStr || mainStr) {
                let startX = tx;
                if (hAlign === "center") {
                    startX = tx - w1 / 2;
                    ctx.textAlign = "left";
                } else if (hAlign === "end") {
                    startX = tx - w1;
                    ctx.textAlign = "left";
                }

                if (prefixStr) {
                    ctx.font = `300 ${measuredFontSize1}px ${selectedFont()}`;
                    ctx.fillText(prefixStr, startX, currentTextY);
                    startX += prefixW;
                }
                if (mainStr) {
                    ctx.font = `bold ${measuredFontSize1}px ${selectedFont()}`;
                    ctx.fillText(mainStr, startX, currentTextY);
                }

                ctx.textAlign = hAlign;
                currentTextY += measuredFontSize2 + lineGap;
            }
            if (line2) {
                ctx.font = `${measuredFontSize2}px ${selectedFont()}`;
                ctx.fillText(line2, tx, currentTextY - measuredFontSize2 * 0.1);
            }

            ctx.restore();
        };

        const isVerticalSide =
            framePosition() === "left" || framePosition() === "right";
        const isHorizontalSide =
            framePosition() === "left-horizontal" ||
            framePosition() === "right-horizontal";

        if (isChekiMode()) {
            const textCenterY = imgY + imgH + Math.round(textSpace / 2);
            drawCombinedTextAndPlate(
                prefix,
                textLine1Main,
                textLine2,
                finalCanvasW / 2,
                textCenterY,
                undefined,
                Math.max(100, innerCanvasW - basePadding * 2),
            );
        } else if (isVerticalSide) {
            const x =
                framePosition() === "left"
                    ? realFrameWidth + sideArea / 2
                    : realFrameWidth + imgW + sideArea / 2;
            const y = finalCanvasH / 2;
            const gap = Math.round(textSpace * 0.1);

            ctx.save();
            ctx.fillStyle = tColor;

            const hasLine1 = prefix || textLine1Main;

            const drawCombinedVertical = (vx: number, vy: number) => {
                ctx.save();
                ctx.translate(vx, vy);
                ctx.rotate(Math.PI / 2);

                ctx.font = font1Prefix;
                const pW = prefix ? ctx.measureText(prefix).width : 0;
                ctx.font = font1Main;
                const mW = textLine1Main
                    ? ctx.measureText(textLine1Main).width
                    : 0;

                let sX = -(pW + mW) / 2;
                ctx.textAlign = "left";

                if (prefix) {
                    ctx.font = font1Prefix;
                    ctx.fillText(prefix, sX, 0);
                    sX += pW;
                }
                if (textLine1Main) {
                    ctx.font = font1Main;
                    ctx.fillText(textLine1Main, sX, 0);
                }
                ctx.restore();
            };

            if (hasLine1 && textLine2) {
                drawCombinedVertical(x + (fontSize1 / 2 + gap / 2), y);
                drawVerticalText(
                    ctx,
                    textLine2,
                    x - (fontSize2 / 2 + gap / 2),
                    y,
                    font2,
                );
            } else if (hasLine1) {
                drawCombinedVertical(x, y);
            } else if (textLine2) {
                drawVerticalText(ctx, textLine2, x, y, font2);
            }

            ctx.restore();
        } else if (isHorizontalSide) {
            const clipX =
                framePosition() === "left-horizontal"
                    ? realFrameWidth
                    : realFrameWidth + imgW;
            const clipWidth = sideArea;
            const x = clipX + clipWidth / 2;
            const y = finalCanvasH / 2;

            ctx.save();
            ctx.beginPath();
            ctx.rect(clipX, realFrameWidth, clipWidth, innerCanvasH);
            ctx.clip();
            ctx.fillStyle = tColor;
            const horizontalSideAvailableWidth = Math.max(
                80,
                clipWidth - sidePadding * 2,
            );
            drawCombinedTextAndPlate(
                prefix,
                textLine1Main,
                textLine2,
                x,
                y,
                "center",
                horizontalSideAvailableWidth,
            );
            ctx.restore();
        } else {
            const pos = framePosition();
            // Handle overlay positions (画像内埋め込み)
            if (typeof pos === "string" && pos.startsWith("overlay")) {
                const maxW = Math.max(100, imgW - basePadding * 2);
                // inset from image edges for overlay text (use slightly larger than basePadding)
                const overlayInset = Math.max(
                    basePadding,
                    Math.round(longSide * 0.04),
                );
                let tx = imgX + imgW / 2;
                let ty = imgY + imgH / 2;
                let overrideAlign: CanvasTextAlign | undefined = "center";
                let overlayV: "top" | "center" | "bottom" = "center";

                if (pos === "overlay-top-left") {
                    tx = imgX + overlayInset;
                    ty = imgY + overlayInset;
                    overrideAlign = "start";
                    overlayV = "top";
                } else if (pos === "overlay-top-center") {
                    tx = imgX + imgW / 2;
                    ty = imgY + overlayInset;
                    overrideAlign = "center";
                    overlayV = "top";
                } else if (pos === "overlay-top-right") {
                    tx = imgX + imgW - overlayInset;
                    ty = imgY + overlayInset;
                    overrideAlign = "end";
                    overlayV = "top";
                } else if (pos === "overlay-bottom-left") {
                    tx = imgX + overlayInset;
                    ty = imgY + imgH - overlayInset;
                    overrideAlign = "start";
                    overlayV = "bottom";
                } else if (pos === "overlay-bottom-center") {
                    tx = imgX + imgW / 2;
                    ty = imgY + imgH - overlayInset;
                    overrideAlign = "center";
                    overlayV = "bottom";
                } else if (pos === "overlay-bottom-right") {
                    tx = imgX + imgW - overlayInset;
                    ty = imgY + imgH - overlayInset;
                    overrideAlign = "end";
                    overlayV = "bottom";
                } else if (pos === "overlay-right-vertical") {
                    const hasLine1 = prefix || textLine1Main;
                    const gap = Math.round(textSpace * 0.1);
                    const x = imgX + imgW - overlayInset;
                    const y = imgY + imgH / 2;
                    const isMetalLocal =
                        isAdvancedMode() &&
                        (textPlateStyle() === "metal-gold" ||
                            textPlateStyle() === "metal-silver");
                    let finalTextColorV = isMetalLocal
                        ? tColor
                        : isAdvancedMode()
                          ? customTextColor()
                          : frameColor() === "white"
                            ? "#222222"
                            : "#e2e8f0";
                    try {
                        finalTextColorV = pickContrast(finalTextColorV);
                    } catch (e) {
                        finalTextColorV =
                            frameColor() === "white" ? "#000000" : "#ffffff";
                    }

                    ctx.fillStyle = finalTextColorV;

                    const drawCombinedVerticalOverlay = (
                        vx: number,
                        vy: number,
                    ) => {
                        ctx.save();
                        ctx.translate(vx, vy);
                        ctx.rotate(Math.PI / 2);

                        ctx.font = font1Prefix;
                        const pW = prefix ? ctx.measureText(prefix).width : 0;
                        ctx.font = font1Main;
                        const mW = textLine1Main
                            ? ctx.measureText(textLine1Main).width
                            : 0;

                        let sX = -(pW + mW) / 2;
                        ctx.textAlign = "left";

                        if (prefix) {
                            ctx.font = font1Prefix;
                            ctx.fillText(prefix, sX, 0);
                            sX += pW;
                        }
                        if (textLine1Main) {
                            ctx.font = font1Main;
                            ctx.fillText(textLine1Main, sX, 0);
                        }
                        ctx.restore();
                    };

                    if (hasLine1 && textLine2) {
                        drawCombinedVerticalOverlay(
                            x + (fontSize1 / 2 + gap / 2),
                            y,
                        );
                        drawVerticalText(
                            ctx,
                            textLine2,
                            x - (fontSize2 / 2 + gap / 2),
                            y,
                            font2,
                        );
                    } else if (hasLine1) {
                        drawCombinedVerticalOverlay(x, y);
                    } else if (textLine2) {
                        drawVerticalText(ctx, textLine2, x, y, font2);
                    }
                } else if (pos === "overlay-left-vertical") {
                    const hasLine1 = prefix || textLine1Main;
                    const gap = Math.round(textSpace * 0.1);
                    const x = imgX + overlayInset;
                    const y = imgY + imgH / 2;
                    const isMetalLocal2 =
                        isAdvancedMode() &&
                        (textPlateStyle() === "metal-gold" ||
                            textPlateStyle() === "metal-silver");
                    let finalTextColorV2 = isMetalLocal2
                        ? tColor
                        : isAdvancedMode()
                          ? customTextColor()
                          : frameColor() === "white"
                            ? "#222222"
                            : "#e2e8f0";
                    try {
                        finalTextColorV2 = pickContrast(finalTextColorV2);
                    } catch (e) {
                        finalTextColorV2 =
                            frameColor() === "white" ? "#000000" : "#ffffff";
                    }

                    ctx.fillStyle = finalTextColorV2;

                    const drawCombinedVerticalOverlayLeft = (
                        vx: number,
                        vy: number,
                    ) => {
                        ctx.save();
                        ctx.translate(vx, vy);
                        ctx.rotate(Math.PI / 2);

                        ctx.font = font1Prefix;
                        const pW = prefix ? ctx.measureText(prefix).width : 0;
                        ctx.font = font1Main;
                        const mW = textLine1Main
                            ? ctx.measureText(textLine1Main).width
                            : 0;

                        let sX = -(pW + mW) / 2;
                        ctx.textAlign = "left";

                        if (prefix) {
                            ctx.font = font1Prefix;
                            ctx.fillText(prefix, sX, 0);
                            sX += pW;
                        }
                        if (textLine1Main) {
                            ctx.font = font1Main;
                            ctx.fillText(textLine1Main, sX, 0);
                        }
                        ctx.restore();
                    };

                    if (hasLine1 && textLine2) {
                        drawCombinedVerticalOverlayLeft(
                            x + (fontSize1 / 2 + gap / 2),
                            y,
                        );
                        drawVerticalText(
                            ctx,
                            textLine2,
                            x - (fontSize2 / 2 + gap / 2),
                            y,
                            font2,
                        );
                    } else if (hasLine1) {
                        drawCombinedVerticalOverlayLeft(x, y);
                    } else if (textLine2) {
                        drawVerticalText(ctx, textLine2, x, y, font2);
                    }
                }

                // For non-vertical overlays, draw using existing plate/text routine with overlay flag
                if (!pos.includes("vertical")) {
                    drawCombinedTextAndPlate(
                        prefix,
                        textLine1Main,
                        textLine2,
                        tx,
                        ty,
                        overrideAlign,
                        maxW,
                        true,
                        overlayV,
                    );
                }
            } else {
                const y =
                    framePosition() === "bottom"
                        ? imgH + textSpace / 2 + imgY
                        : textSpace / 2 + realFrameWidth;
                drawCombinedTextAndPlate(
                    prefix,
                    textLine1Main,
                    textLine2,
                    getHorizontalX(),
                    y,
                    undefined,
                    Math.max(100, imgW - basePadding * 2),
                );
            }
        }

        if (isRealFrame) {
            ctx.save();

            if (frameStyle() === "wood") {
                const woodGrad = ctx.createLinearGradient(
                    0,
                    0,
                    finalCanvasW,
                    finalCanvasH,
                );
                woodGrad.addColorStop(0, "#42220f");
                woodGrad.addColorStop(0.3, "#6a3b19");
                woodGrad.addColorStop(0.5, "#522a13");
                woodGrad.addColorStop(0.8, "#7a4522");
                woodGrad.addColorStop(1, "#30180a");
                ctx.fillStyle = woodGrad;

                ctx.fillRect(0, 0, finalCanvasW, realFrameWidth);
                ctx.fillRect(
                    0,
                    finalCanvasH - realFrameWidth,
                    finalCanvasW,
                    realFrameWidth,
                );
                ctx.fillRect(
                    0,
                    realFrameWidth,
                    realFrameWidth,
                    finalCanvasH - realFrameWidth * 2,
                );
                ctx.fillRect(
                    finalCanvasW - realFrameWidth,
                    realFrameWidth,
                    realFrameWidth,
                    finalCanvasH - realFrameWidth * 2,
                );

                ctx.strokeStyle = "rgba(24, 12, 4, 0.7)";
                ctx.lineWidth = Math.max(1, Math.round(longSide * 0.0015));
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(realFrameWidth, realFrameWidth);
                ctx.moveTo(finalCanvasW, 0);
                ctx.lineTo(finalCanvasW - realFrameWidth, realFrameWidth);
                ctx.moveTo(0, finalCanvasH);
                ctx.lineTo(realFrameWidth, finalCanvasH - realFrameWidth);
                ctx.moveTo(finalCanvasW, finalCanvasH);
                ctx.lineTo(
                    finalCanvasW - realFrameWidth,
                    finalCanvasH - realFrameWidth,
                );
                ctx.stroke();

                ctx.strokeStyle = "rgba(0,0,0,0.5)";
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    realFrameWidth,
                    realFrameWidth,
                    innerCanvasW,
                    innerCanvasH,
                );
            } else if (frameStyle() === "gold") {
                const goldGrad = ctx.createLinearGradient(
                    0,
                    0,
                    finalCanvasW,
                    finalCanvasH,
                );
                goldGrad.addColorStop(0, "#cf9e30");
                goldGrad.addColorStop(0.2, "#f9e79f");
                goldGrad.addColorStop(0.4, "#a47614");
                goldGrad.addColorStop(0.6, "#fff5cc");
                goldGrad.addColorStop(0.8, "#d9a736");
                goldGrad.addColorStop(1, "#4d3300");
                ctx.fillStyle = goldGrad;

                ctx.fillRect(0, 0, finalCanvasW, realFrameWidth);
                ctx.fillRect(
                    0,
                    finalCanvasH - realFrameWidth,
                    finalCanvasW,
                    realFrameWidth,
                );
                ctx.fillRect(
                    0,
                    realFrameWidth,
                    realFrameWidth,
                    finalCanvasH - realFrameWidth * 2,
                );
                ctx.fillRect(
                    finalCanvasW - realFrameWidth,
                    realFrameWidth,
                    realFrameWidth,
                    finalCanvasH - realFrameWidth * 2,
                );

                ctx.lineWidth = Math.max(1, Math.round(longSide * 0.001));
                const borderOffsets = [
                    0,
                    3,
                    6,
                    10,
                    realFrameWidth - 5,
                    realFrameWidth - 2,
                ];
                borderOffsets.forEach((offset, idx) => {
                    ctx.strokeStyle =
                        idx % 2 === 0
                            ? "rgba(255,255,255,0.4)"
                            : "rgba(70,45,2,0.6)";
                    ctx.strokeRect(
                        offset,
                        offset,
                        finalCanvasW - offset * 2,
                        finalCanvasH - offset * 2,
                    );
                });

                ctx.strokeStyle = "rgba(80, 50, 5, 0.6)";
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(realFrameWidth, realFrameWidth);
                ctx.moveTo(finalCanvasW, 0);
                ctx.lineTo(finalCanvasW - realFrameWidth, realFrameWidth);
                ctx.moveTo(0, finalCanvasH);
                ctx.lineTo(realFrameWidth, finalCanvasH - realFrameWidth);
                ctx.moveTo(finalCanvasW, finalCanvasH);
                ctx.lineTo(
                    finalCanvasW - realFrameWidth,
                    finalCanvasH - realFrameWidth,
                );
                ctx.stroke();
            }
            ctx.restore();
        }

        const cText = copyrightText().trim();
        if (cText) {
            ctx.save();
            const cFontSize = Math.max(
                9,
                Math.round(longSide * 0.0085 * scale),
            );
            ctx.font = `400 ${cFontSize}px ${selectedFont()}`;
            ctx.textBaseline = "middle";

            const posMode = copyrightPosition();
            const margin = Math.max(8, Math.round(basePadding * 0.45));
            let cx = finalCanvasW - realFrameWidth - margin;
            let cy = finalCanvasH - realFrameWidth - margin;
            let cAlign: CanvasTextAlign = "right";
            let maxCWidth = Math.max(80, innerCanvasW - margin * 2);
            let isInPhoto = false;

            if (posMode === "image-bottom-right") {
                cx = imgX + imgW - margin;
                cy = imgY + imgH - margin;
                cAlign = "right";
                maxCWidth = Math.max(80, imgW - margin * 2);
                isInPhoto = true;
            } else if (posMode === "image-bottom-left") {
                cx = imgX + margin;
                cy = imgY + imgH - margin;
                cAlign = "left";
                maxCWidth = Math.max(80, imgW - margin * 2);
                isInPhoto = true;
            } else if (posMode === "frame-bottom-right") {
                cx = finalCanvasW - realFrameWidth - margin;
                cy = finalCanvasH - realFrameWidth - margin;
                cAlign = "right";
            } else if (posMode === "frame-bottom-left") {
                cx = realFrameWidth + margin;
                cy = finalCanvasH - realFrameWidth - margin;
                cAlign = "left";
            } else if (posMode === "frame-top-right") {
                cx = finalCanvasW - realFrameWidth - margin;
                cy = realFrameWidth + margin;
                cAlign = "right";
            } else if (posMode === "frame-top-left") {
                cx = realFrameWidth + margin;
                cy = realFrameWidth + margin;
                cAlign = "left";
            } else {
                // auto: フレームの空きスペースを自動判定して配置
                if (isChekiMode()) {
                    cx = imgX + imgW;
                    cy = finalCanvasH - realFrameWidth - margin;
                    cAlign = "right";
                    maxCWidth = Math.max(80, imgW);
                } else if (framePosition() === "bottom") {
                    if (textAlign() === "right") {
                        cx = imgX + basePadding;
                        cAlign = "left";
                    } else {
                        cx = imgX + imgW - basePadding;
                        cAlign = "right";
                    }
                    cy = finalCanvasH - realFrameWidth - margin;
                    maxCWidth = Math.max(80, imgW - basePadding * 2);
                } else if (framePosition() === "top") {
                    if (textAlign() === "right") {
                        cx = imgX + basePadding;
                        cAlign = "left";
                    } else {
                        cx = imgX + imgW - basePadding;
                        cAlign = "right";
                    }
                    cy = realFrameWidth + margin;
                    maxCWidth = Math.max(80, imgW - basePadding * 2);
                } else if (
                    framePosition() === "left" ||
                    framePosition() === "left-horizontal"
                ) {
                    cx = realFrameWidth + sideArea / 2;
                    cy = finalCanvasH - realFrameWidth - margin;
                    cAlign = "center";
                    maxCWidth = Math.max(40, sideArea - margin * 1.5);
                } else if (
                    framePosition() === "right" ||
                    framePosition() === "right-horizontal"
                ) {
                    cx = realFrameWidth + imgW + sideArea / 2;
                    cy = finalCanvasH - realFrameWidth - margin;
                    cAlign = "center";
                    maxCWidth = Math.max(40, sideArea - margin * 1.5);
                } else {
                    // overlay-* モード時はExifと被らない側の下隅に配置
                    isInPhoto = true;
                    cy = imgY + imgH - margin;
                    maxCWidth = Math.max(80, imgW - margin * 2);
                    if (framePosition() === "overlay-br") {
                        cx = imgX + margin;
                        cAlign = "left";
                    } else {
                        cx = imgX + imgW - margin;
                        cAlign = "right";
                    }
                }
            }

            const baseTextColor = isAdvancedMode()
                ? customTextColor()
                : frameColor() === "white"
                  ? "#222222"
                  : "#e2e8f0";

            if (isInPhoto) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
                ctx.shadowBlur = Math.max(2, Math.round(cFontSize * 0.25));
            } else {
                ctx.fillStyle = baseTextColor;
                ctx.globalAlpha = 0.78;
            }

            let fittedFontSize = cFontSize;
            const measuredW = ctx.measureText(cText).width;
            if (measuredW > maxCWidth && measuredW > 0) {
                fittedFontSize = Math.max(
                    7,
                    Math.floor(cFontSize * (maxCWidth / measuredW)),
                );
                ctx.font = `400 ${fittedFontSize}px ${selectedFont()}`;
            }

            ctx.textAlign = cAlign;
            ctx.fillText(cText, cx, cy);
            ctx.restore();
        }

        drawOverlayItems(true);

        // 重ね画像タブを開いている、またはドラッグ操作中のときは選択枠と四隅のリサイズハンドルを描画（出力画像には含めない）
        if (
            !hideEditorGuides &&
            (activeTab() === "overlay" || draggingOverlayId() !== null)
        ) {
            const selId = selectedOverlayId();
            const selItem = overlayImages().find((i) => i.id === selId);
            if (selItem) {
                const { cx, cy, drawW, drawH } = getOverlayItemMetrics(selItem);
                const handleR = Math.max(6, Math.round(longSide * 0.008));
                const strokeW = Math.max(2, Math.round(longSide * 0.002));

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate((selItem.rotation * Math.PI) / 180);

                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = strokeW;
                ctx.setLineDash([strokeW * 3, strokeW * 2]);
                ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
                ctx.setLineDash([]);

                const corners = [
                    { x: -drawW / 2, y: -drawH / 2 },
                    { x: drawW / 2, y: -drawH / 2 },
                    { x: -drawW / 2, y: drawH / 2 },
                    { x: drawW / 2, y: drawH / 2 },
                ];
                corners.forEach((c) => {
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, handleR, 0, Math.PI * 2);
                    ctx.fillStyle = "#ffffff";
                    ctx.fill();
                    ctx.lineWidth = strokeW;
                    ctx.strokeStyle = "#2563eb";
                    ctx.stroke();
                });

                ctx.restore();
            }
        }
    };

    // リアクティブに自動で再描画が走るように一元化するにゃん！
    createEffect(
        () => {
            if (!hasImage()) return null;
            return {
                _fc: frameColor(),
                _fp: framePosition(),
                _ta: textAlign(),
                _cm: isChekiMode(),
                _sf: selectedFont(),
                _fs: fontSizeScale(),
                _ir: imageRotation(),
                _ut: useCustomTitle(),
                _t1: customTitleLine1(),
                _t2: customTitleLine2(),
                _pt: prefixText(),
                _sp: showPrefix(),
                _am: isAdvancedMode(),
                _cfc: customFrameColor(),
                _ctc: customTextColor(),
                _ibr: imageBorderRadius(),
                _fs2: frameStyle(),
                _tps: textPlateStyle(),
                _cm2: cameraModel(),
                _lm: lensModel(),
                _fl: focalLength(),
                _fn: fNumber(),
                _ss: shutterSpeed(),
                _iv: isoValue(),
                _sc: showCamera(),
                _sl: showLens(),
                _sf2: showFocal(),
                _sfn: showFNumber(),
                _ss2: showSpeed(),
                _si: showIso(),
                _st: separatorType(),
                _cs: customSeparator(),
                _oi: overlayImages(),
                _soi: selectedOverlayId(),
                _doi: draggingOverlayId(),
                _at: activeTab(),
                _cpt: copyrightText(),
                _cpp: copyrightPosition(),
                _proc: isProcessing(),
            };
        },
        (val) => {
            if (!val || val._proc) return;
            // 設定が切り替わったら自動で再描画にゃん！（高速化のため rAF でバッチ化＆プレビュー解像度 2048px 上限）
            if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
                if (rafDrawId) cancelAnimationFrame(rafDrawId);
                rafDrawId = requestAnimationFrame(() => {
                    rafDrawId = 0;
                    drawFrame(false, 2048);
                });
            } else {
                drawFrame(false, 2048);
            }
        }
    );

    const yieldToBrowser = () =>
        new Promise<void>((resolve) => setTimeout(resolve, 16));

    const canvasToBlobAsync = (
        canvas: HTMLCanvasElement,
        mime: string,
        quality: number,
    ): Promise<Blob> => {
        if (typeof canvas.toBlob === "function") {
            return new Promise<Blob>((resolve, reject) => {
                try {
                    canvas.toBlob(
                        (blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error("toBlob returned null"));
                        },
                        mime,
                        quality,
                    );
                } catch (err) {
                    reject(err);
                }
            });
        }
        return Promise.resolve(dataUrlToBlob(canvas.toDataURL(mime, quality)));
    };

    const handleGenerate = async () => {
        if (!canvasRef || isProcessing()) return;

        if (rafDrawId && typeof cancelAnimationFrame === "function") {
            cancelAnimationFrame(rafDrawId);
            rafDrawId = 0;
        }

        setIsProcessing(true);
        setProcessingProgress(15);
        setProcessingStepText("フレームと重ね画像を高解像度で描画中...");
        await yieldToBrowser();

        try {
            // 保存時は選択枠を非表示にし、選択された出力解像度（0 = オリジナル解像度）で描画
            drawFrame(true, exportMaxEdge());
            const exportWidth = canvasRef.width;
            const exportHeight = canvasRef.height;

            setProcessingProgress(45);
            setProcessingStepText("画像データをエンコード中...");
            await yieldToBrowser();

            let baseName = customExportName().trim();
            if (!baseName) {
                baseName = `framed_${(fileName() || "image").split(".")[0]}`;
            }

            const needsExifInsert =
                keepOriginalExif() &&
                Boolean(rawFileBase64Str) &&
                saveFormat() === "image/jpeg";

            let finalBlob: Blob | null = null;
            let finalModalSrc = "";

            if (needsExifInsert && rawFileBase64Str) {
                let finalDataUrl = canvasRef.toDataURL(saveFormat(), 0.95);
                // エンコード完了後すぐにプレビュー表示を軽量解像度に戻す
                drawFrame(false, 2048);

                setProcessingProgress(75);
                setProcessingStepText("Exifメタデータを書き込み中...");
                await yieldToBrowser();

                try {
                    const { default: piexif } = await import("piexifjs");
                    const exifObj = piexif.load(rawFileBase64Str);
                    if (exifObj["0th"]) {
                        // キャンバス上の描画はすでに適切な向きで回転補正されているため、
                        // 保存するExifのOrientationは「1（標準 / 0度回転）」に上書き固定する
                        exifObj["0th"][piexif.ImageIFD.Orientation] = 1;
                        exifObj["0th"][piexif.ImageIFD.ImageWidth] = exportWidth;
                        exifObj["0th"][piexif.ImageIFD.ImageLength] = exportHeight;
                    }
                    if (exifObj["Exif"]) {
                        exifObj["Exif"][piexif.ExifIFD.PixelXDimension] =
                            exportWidth;
                        exifObj["Exif"][piexif.ExifIFD.PixelYDimension] =
                            exportHeight;
                    }
                    const exifDump = piexif.dump(exifObj);
                    finalDataUrl = piexif.insert(exifDump, finalDataUrl);
                } catch (exifErr) {
                    console.error("Failed to insert EXIF metadata:", exifErr);
                }

                setProcessingProgress(92);
                setProcessingStepText("保存用ファイルデータを準備中...");
                await yieldToBrowser();

                try {
                    finalBlob = dataUrlToBlob(finalDataUrl);
                    if (currentModalBlobUrl) {
                        URL.revokeObjectURL(currentModalBlobUrl);
                    }
                    currentModalBlobUrl = URL.createObjectURL(finalBlob);
                    finalModalSrc = currentModalBlobUrl;
                } catch {
                    finalBlob = null;
                    finalModalSrc = finalDataUrl;
                }
            } else {
                // Exif引き継ぎ不要時（またはPNG/WebP保存時）は非同期 toBlob で高速エンコード（Base64文字列化を完全スキップ）
                try {
                    finalBlob = await canvasToBlobAsync(
                        canvasRef,
                        saveFormat(),
                        0.95,
                    );
                    drawFrame(false, 2048);
                    setProcessingProgress(90);
                    setProcessingStepText("保存用ファイルデータを準備中...");
                    if (currentModalBlobUrl) {
                        URL.revokeObjectURL(currentModalBlobUrl);
                    }
                    currentModalBlobUrl = URL.createObjectURL(finalBlob);
                    finalModalSrc = currentModalBlobUrl;
                } catch {
                    const fallbackDataUrl = canvasRef.toDataURL(
                        saveFormat(),
                        0.95,
                    );
                    drawFrame(false, 2048);
                    finalBlob = dataUrlToBlob(fallbackDataUrl);
                    finalModalSrc = fallbackDataUrl;
                }
            }

            preparedDownloadBlob = finalBlob;
            const randArr = new Uint32Array(1);
            window.crypto.getRandomValues(randArr);
            const randomNum = 1000 + (randArr[0] % 9000);
            const downloadName = `${baseName}_${randomNum}.${saveFormat().split("/")[1]}`;
            setDownloadImageSrc(finalModalSrc);
            setDownloadFileName(downloadName);
            setProcessingProgress(100);
            setProcessingStepText("完了しました！");
            setShowMobileSaveModal(true);
        } finally {
            setIsProcessing(false);
        }
    };

    const dataUrlToBlob = (dataUrl: string): Blob => {
        const parts = dataUrl.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };

    const handleDownload = (e: MouseEvent) => {
        const dataUrl = downloadImageSrc();
        const fileName = downloadFileName();
        if (!dataUrl) return;

        try {
            const blob = preparedDownloadBlob ?? dataUrlToBlob(dataUrl);
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            delayedCall(1, () => {
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            });

            e.preventDefault();
        } catch (err) {
            console.error("Failed to download via Blob:", err);
            // エラー時は通常のリンクナビゲーションにフォールバック
        }
    };


    const handleFileChange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) return;

        setHasImage(false);
        rawFileBase64Str = null;

        const file = target.files[0];
        setFileName(file.name);

        if (
            file.type === "image/png" ||
            file.type === "image/webp" ||
            file.type === "image/jpeg"
        ) {
            setSaveFormat(file.type);
        }

        if (file.type === "image/jpeg") {
            const base64Reader = new FileReader();
            base64Reader.onload = (event) => {
                rawFileBase64Str = event.target?.result as string;
            };
            base64Reader.readAsDataURL(file);
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const { default: exifr } = await import("exifr");
            const exif = await exifr.parse(arrayBuffer);

            setCameraModel(
                exif?.Model
                    ? `${exif.Make || ""} ${exif.Model}`.trim()
                    : "Unknown Camera",
            );
            setLensModel(exif?.LensModel || "Standard Lens");
            setFocalLength(exif?.FocalLength ? String(exif.FocalLength) : "");
            setFNumber(exif?.FNumber ? String(exif.FNumber) : "");
            setShutterSpeed(
                exif?.ExposureTime ? formatShutterSpeed(exif.ExposureTime) : "",
            );
            setIsoValue(
                exif?.ISO || exif?.ISOSpeedRatings
                    ? String(exif.ISO || exif.ISOSpeedRatings)
                    : "",
            );
        } catch (e) {
            console.error("Failed to parse EXIF:", e);
            setCameraModel("No EXIF data");
            setLensModel("");
        }

        const prevUpSrc = uploadedImageSrc();
        if (prevUpSrc && prevUpSrc.startsWith("blob:")) {
            URL.revokeObjectURL(prevUpSrc);
        }

        const img = new Image();
        img.onload = () => {
            sourceImage = img;
            setHasImage(true);
            setImageRotation(0);
            setUploadedImageSrc(img.src);
            ensureFontLoaded(selectedFont());
        };
        img.src = URL.createObjectURL(file);
    };

    const formatShutterSpeed = (exposure: any): string => {
        if (!exposure) return "";
        const expNum = Number(exposure);
        if (isNaN(expNum)) return String(exposure);
        if (expNum >= 1) return `${expNum}s`;
        return `1/${Math.round(1 / expNum)}s`;
    };

    // ハンドラはシンプルに値をセットするだけに綺麗にしたにゃん！
    const handleOptionChange = (setter: (val: any) => void, val: any) => {
        setter(val);
    };
    const handleToggleChange = (setter: (val: any) => void, val: any) => {
        setter(val);
    };
    const handleTextChange = (setter: (val: any) => void, val: any) => {
        setter(val);
    };

    const loadedFontValues = new Set<string>();
    const ensureFontLoaded = (fontVal: string) => {
        if (typeof document === "undefined" || loadedFontValues.has(fontVal)) return;
        const font = fontList.find((f) => f.value === fontVal || f.id === fontVal);
        if (!font) return;
        loadedFontValues.add(fontVal);
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${font.link}&display=swap`;
        document.head.appendChild(link);
    };

    const handleFontChange = async (val: string) => {
        ensureFontLoaded(val);
        setSelectedFont(val);
        try {
            await document.fonts.load(`16px ${val}`);
        } catch (err) {
            console.warn("Failed to load font:", err);
        }
        drawFrame();
    };

    const handleSizeScaleChange = (val: number) => {
        setSelectedFont(selectedFont());
        setFontSizeScale(val);
    };
    const rotateImage = () => {
        setImageRotation((prev) => (prev + 90) % 360);
    };

    const previewLine1 = () => {
        if (useCustomTitle()) return customTitleLine1() || "タイトル 1行目";
        const parts = [];
        if (showCamera() && cameraModel()) parts.push(cameraModel());
        if (showLens() && lensModel()) parts.push(lensModel());
        const mainStr = parts.join(getSeparator());
        return (showPrefix() ? prefixText() : "") + mainStr || "Camera Model";
    };

    const previewLine2 = () => {
        if (useCustomTitle()) return customTitleLine2() || "サブタイトル 2行目";
        const parts = [];
        if (showFocal() && focalLength()) parts.push(`${focalLength()}mm`);
        if (showFNumber() && fNumber()) parts.push(`f/${fNumber()}`);
        if (showSpeed() && shutterSpeed()) parts.push(shutterSpeed());
        if (showIso() && isoValue()) parts.push(`ISO${isoValue()}`);
        return parts.join(getSeparator()) || "50mm f/2.8";
    };

    const positionItems = [
        {
            pos: "bottom",
            align: "left",
            label: "下・左",
            alignClass: "ba-justify-start",
        },
        {
            pos: "bottom",
            align: "center",
            label: "下・中央",
            alignClass: "ba-justify-center",
        },
        {
            pos: "bottom",
            align: "right",
            label: "下・右",
            alignClass: "ba-justify-end",
        },
        {
            pos: "top",
            align: "left",
            label: "上・左",
            alignClass: "ba-justify-start",
        },
        {
            pos: "top",
            align: "center",
            label: "上・中央",
            alignClass: "ba-justify-center",
        },
        {
            pos: "top",
            align: "right",
            label: "上・右",
            alignClass: "ba-justify-end",
        },
        {
            pos: "left",
            align: "left",
            label: "左 (縦)",
            isVertical: true,
        },
        {
            pos: "left-horizontal",
            align: "left",
            label: "左 (横)",
            isHorizontal: true,
        },
        {
            pos: "right",
            align: "left",
            label: "右 (縦)",
            isVertical: true,
        },
        {
            pos: "right-horizontal",
            align: "right",
            label: "右 (横)",
            isHorizontal: true,
        },
        {
            pos: "overlay-top-left",
            align: "left",
            label: "画像内・左上",
            isOverlay: true,
        },
        {
            pos: "overlay-top-center",
            align: "center",
            label: "画像内・上中央",
            isOverlay: true,
        },
        {
            pos: "overlay-top-right",
            align: "right",
            label: "画像内・右上",
            isOverlay: true,
        },
        {
            pos: "overlay-bottom-left",
            align: "left",
            label: "画像内・左下",
            isOverlay: true,
        },
        {
            pos: "overlay-bottom-center",
            align: "center",
            label: "画像内・下中央",
            isOverlay: true,
        },
        {
            pos: "overlay-bottom-right",
            align: "right",
            label: "画像内・右下",
            isOverlay: true,
        },
        {
            pos: "overlay-right-vertical",
            align: "right",
            label: "画像内・右縦文字",
            isOverlay: true,
            isVertical: true,
        },
        {
            pos: "overlay-left-vertical",
            align: "left",
            label: "画像内・左縦文字",
            isOverlay: true,
            isVertical: true,
        },
        { label: "チェキ風", isCheki: true },
    ];

    const positionGroups = [
        {
            title: "フレーム帯に配置",
            items: positionItems.filter((i) => !i.isOverlay),
        },
        {
            title: "画像の上に重ねる",
            items: positionItems.filter((i) => i.isOverlay),
        },
    ];

    // タブ切替時、設定パネルの先頭へとページのスクロール位置を戻す
    let settingsTopRef: HTMLDivElement | undefined;
    let settingsDesktopScrollRef: HTMLDivElement | undefined;
    const selectTab = (id: SettingTab) => {
        setActiveTab(id);
        setVisitedTabs((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        if (typeof window === "undefined") return;

        // PC表示: 左カラムのスクロール領域を先頭に戻す
        if (settingsDesktopScrollRef) {
            settingsDesktopScrollRef.scrollTop = 0;
        }

        // スマホ表示: ページ最上部（または設定パネルの先頭）へスクロールを戻す
        if (window.matchMedia?.("(max-width: 1023.98px)")?.matches) {
            const mainEl = document.querySelector("main");
            if (mainEl) {
                mainEl.scrollTop = 0;
                mainEl.scrollTo?.({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
            }
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }
    };

    const getMiniBgColor = () => {
        if (isAdvancedMode()) return customFrameColor();
        return frameColor() === "white" ? "#ffffff" : "#1e293b";
    };

    const getMiniTextColor = () => {
        if (isAdvancedMode()) return customTextColor();
        return frameColor() === "white" ? "#1e293b" : "#f8fafc";
    };

    return (
        <div ref={containerRef} class="ba-page ba-page--wide">
            {/* ヘッダーセクション */}
            <div class="ba-card ba-stack-3">
                <h1 class="ba-title ba-flex ba-items-center ba-gap-2">
                    <span class="ba-icon-box" aria-hidden="true">
                        <ToolIcon name="frame" class="ba-icon-md" />
                    </span>
                    <span>{title()}</span>
                </h1>
                <p class="ba-text-sm ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                    {description()}
                </p>
            </div>

            <div class="ba-card ba-w-full">
                <div class="ba-exif-layout">
                    <div
                        ref={settingsDesktopScrollRef}
                        class="ba-exif-sidebar"
                    >
                        <div ref={settingsTopRef} class="ba-exif-settings">
                            <div
                                role="tablist"
                                aria-label="設定カテゴリ"
                                class="ba-exif-dock"
                            >
                                <div class="ba-exif-dock-inner">
                                    <For each={settingTabs}>
                                        {(tab) => (
                                            <button
                                                type="button"
                                                role="tab"
                                                id={`exif-tab-${tab.id}`}
                                                aria-controls={`exif-panel-${tab.id}`}
                                                aria-selected={activeTab() === tab.id ? "true" : "false"}
                                                onClick={() => selectTab(tab.id)}
                                                class={`ba-exif-dock-btn ${activeTab() === tab.id ? "is-active" : ""}`}
                                            >
                                                <Show when={tab.isBeta}>
                                                    <span
                                                        class="ba-badge ba-badge--warning"
                                                        style={{
                                                            position: "absolute",
                                                            top: "2px",
                                                            right: "2px",
                                                            padding: "0 0.25rem",
                                                            "font-size": "0.5rem",
                                                            "pointer-events": "none",
                                                        }}
                                                    >
                                                        BETA
                                                    </span>
                                                </Show>
                                                <ToolIcon name={tab.icon} class="ba-icon-sm ba-shrink-0" />
                                                <span class="ba-truncate">{tab.label}</span>
                                            </button>
                                        )}
                                    </For>
                                    <Show when={hasImage()}>
                                        <button
                                            type="button"
                                            disabled={isProcessing()}
                                            onClick={handleGenerate}
                                            class="ba-exif-dock-gen"
                                            aria-label="額縁付き画像を生成"
                                        >
                                            <ToolIcon name="download" class="ba-icon-sm ba-shrink-0" />
                                            <span class="ba-truncate">
                                                {isProcessing() ? "生成中" : "生成"}
                                            </span>
                                        </button>
                                    </Show>
                                </div>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-photo"
                                aria-labelledby="exif-tab-photo"
                                hidden={activeTab() !== "photo"}
                                class="ba-stack-4"
                            >
                                <div class="ba-panel ba-stack-3">
                                    <span
                                        class="ba-text-xs ba-font-bold"
                                        style={{
                                            display: "block",
                                            "border-bottom": "1px solid var(--ba-border)",
                                            "padding-bottom": "0.375rem",
                                        }}
                                    >
                                        写真の読み込み・回転
                                    </span>
                                    <label class="ba-btn ba-btn--primary ba-btn--lg ba-btn--block">
                                        <span>写真を選択する</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            aria-label="写真画像ファイルを選択"
                                            onChange={handleFileChange}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                    <Show when={fileName()}>
                                        <div
                                            class="ba-text-xs ba-text-muted ba-truncate"
                                            style={{
                                                background: "var(--ba-surface)",
                                                padding: "0.5rem 0.75rem",
                                                "border-radius": "var(--ba-radius-sm)",
                                                border: "1px solid var(--ba-border)",
                                            }}
                                        >
                                            選択中: <span class="ba-mono ba-font-bold" style={{ color: "var(--ba-text)" }}>{fileName()}</span>
                                        </div>
                                    </Show>
                                    <Show when={hasImage()}>
                                        <button
                                            type="button"
                                            onClick={rotateImage}
                                            class="ba-btn ba-btn--outline ba-btn--block ba-text-primary"
                                        >
                                            画像を右に90度回転
                                        </button>
                                    </Show>
                                </div>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-text"
                                aria-labelledby="exif-tab-text"
                                hidden={activeTab() !== "text"}
                                class="ba-stack-4"
                            >
                                <Show when={activeTab() === "text" || visitedTabs().has("text")}>
                                    <div class="ba-panel">
                                    <label class="ba-flex ba-items-center ba-justify-between ba-gap-2" style={{ cursor: "pointer" }}>
                                        <div class="ba-flex-col">
                                            <span class="ba-text-xs ba-font-bold">
                                                自由なタイトルモードにする
                                            </span>
                                            <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                カメラ情報の代わりに好きな文字を刻印
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            aria-label="自由タイトルの使用切り替え"
                                            checked={useCustomTitle()}
                                            onChange={(e) =>
                                                handleToggleChange(
                                                    setUseCustomTitle,
                                                    e.currentTarget.checked,
                                                )
                                            }
                                            class="ba-toggle ba-toggle--sm"
                                        />
                                    </label>
                                </div>
                                <div class="ba-panel ba-stack-3">
                                    <span
                                        class="ba-text-xs ba-font-bold"
                                        style={{
                                            display: "block",
                                            "border-bottom": "1px solid var(--ba-border)",
                                            "padding-bottom": "0.375rem",
                                        }}
                                    >
                                        文字編集
                                    </span>
                                    <div
                                        class="ba-stack-2 ba-text-xs"
                                        style={{
                                            background: "var(--ba-surface)",
                                            padding: "0.75rem",
                                            "border-radius": "var(--ba-radius-sm)",
                                            border: "1px solid var(--ba-border)",
                                        }}
                                    >
                                        <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                                            <div class="ba-flex-col">
                                                <span class="ba-font-bold" style={{ "font-size": "0.75rem" }}>
                                                    接頭辞の設定
                                                </span>
                                                <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    テキストの先頭に文字を添えます
                                                </span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                aria-label="接頭辞（Shot on 等）の表示切り替え"
                                                checked={showPrefix()}
                                                onChange={(e) =>
                                                    handleToggleChange(
                                                        setShowPrefix,
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="ba-toggle ba-toggle--sm"
                                            />
                                        </div>
                                        <Show when={showPrefix()}>
                                            <input
                                                type="text"
                                                aria-label="接頭辞テキスト"
                                                value={prefixText()}
                                                onInput={(e) =>
                                                    handleTextChange(
                                                        setPrefixText,
                                                        e.currentTarget.value,
                                                    )
                                                }
                                                class="ba-input ba-input--sm"
                                                placeholder="例: Shot on "
                                            />
                                        </Show>
                                    </div>
                                    <Show when={useCustomTitle()}>
                                        <div class="ba-stack-2 ba-text-xs">
                                            <div class="ba-field">
                                                <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    自由タイトル 1行目（メイン題名）
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label="自由タイトル 1行目"
                                                    placeholder="1行目 (例: 作品のタイトル)"
                                                    value={customTitleLine1()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setCustomTitleLine1,
                                                            e.currentTarget.value,
                                                        )
                                                    }
                                                    class="ba-input ba-input--sm"
                                                />
                                            </div>
                                            <div class="ba-field">
                                                <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    自由タイトル 2行目（サブ情報）
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label="自由タイトル 2行目"
                                                    placeholder="2行目 (例: 撮影日や場所)"
                                                    value={customTitleLine2()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setCustomTitleLine2,
                                                            e.currentTarget.value,
                                                        )
                                                    }
                                                    class="ba-input ba-input--sm"
                                                />
                                            </div>
                                        </div>
                                    </Show>
                                    <Show when={!useCustomTitle()}>
                                        <div
                                            class="ba-stack-2 ba-text-xs"
                                            style={{
                                                background: "var(--ba-surface)",
                                                padding: "0.75rem",
                                                "border-radius": "var(--ba-radius-sm)",
                                                border: "1px solid var(--ba-border)",
                                            }}
                                        >
                                            <div class="ba-flex ba-items-center ba-justify-between ba-gap-2">
                                                <span class="ba-font-bold" style={{ "font-size": "0.75rem" }}>
                                                    区切り文字
                                                </span>
                                                <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    Exifパラメータ間の区切り記号
                                                </span>
                                            </div>
                                            <div
                                                class="ba-grid"
                                                style={{
                                                    "grid-template-columns": "repeat(auto-fill, minmax(40px, 1fr))",
                                                    gap: "0.25rem",
                                                }}
                                            >
                                                <For each={separatorPresets}>
                                                    {(item) => {
                                                        const isSelected = () =>
                                                            separatorType() === item.value;
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleOptionChange(
                                                                        setSeparatorType,
                                                                        item.value,
                                                                    )
                                                                }
                                                                class={`ba-btn ba-btn--xs ${isSelected() ? "ba-btn--primary" : "ba-btn--outline"}`}
                                                                style={{ "min-height": "2rem", padding: "0.2rem" }}
                                                                title={item.label}
                                                            >
                                                                {item.display}
                                                            </button>
                                                        );
                                                    }}
                                                </For>
                                            </div>
                                            <Show when={separatorType() === "custom"}>
                                                <div class="ba-flex ba-items-center ba-gap-2">
                                                    <span class="ba-text-muted ba-font-bold ba-shrink-0" style={{ "font-size": "0.6875rem" }}>
                                                        任意の区切り文字:
                                                    </span>
                                                    <input
                                                        type="text"
                                                        aria-label="任意の区切り文字"
                                                        value={customSeparator()}
                                                        onInput={(e) =>
                                                            handleTextChange(
                                                                setCustomSeparator,
                                                                e.currentTarget.value,
                                                            )
                                                        }
                                                        class="ba-input ba-input--sm ba-flex-1"
                                                        placeholder="例:  //  や  ,  など"
                                                    />
                                                </div>
                                            </Show>
                                        </div>
                                    </Show>
                                </div>
                                <Show when={!useCustomTitle()}>
                                    <div class="ba-panel ba-stack-3 ba-text-xs">
                                        <div
                                            class="ba-flex ba-items-center ba-justify-between ba-gap-2"
                                            style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.375rem" }}
                                        >
                                            <span class="ba-text-xs ba-font-bold">
                                                表示するExif情報
                                            </span>
                                            <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                チェックで表示 / 値は直接修正可
                                            </span>
                                        </div>
                                        <div class="ba-stack-2">
                                            <div class="ba-flex ba-items-center ba-gap-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label="カメラ機種名の表示切り替え"
                                                    checked={showCamera()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowCamera,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="ba-checkbox"
                                                />
                                                <span class="ba-text-muted ba-font-bold ba-shrink-0" style={{ width: "3.2rem", "font-size": "0.6875rem" }}>
                                                    カメラ:
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label="カメラ機種名"
                                                    value={cameraModel()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setCameraModel,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="ba-input ba-input--sm ba-flex-1"
                                                />
                                            </div>
                                            <div class="ba-flex ba-items-center ba-gap-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label="レンズ名の表示切り替え"
                                                    checked={showLens()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowLens,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="ba-checkbox"
                                                />
                                                <span class="ba-text-muted ba-font-bold ba-shrink-0" style={{ width: "3.2rem", "font-size": "0.6875rem" }}>
                                                    レンズ:
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label="レンズ名"
                                                    value={lensModel()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setLensModel,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="ba-input ba-input--sm ba-flex-1"
                                                />
                                            </div>
                                            <div class="ba-flex ba-items-center ba-gap-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label="焦点距離の表示切り替え"
                                                    checked={showFocal()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowFocal,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="ba-checkbox"
                                                />
                                                <span class="ba-text-muted ba-font-bold ba-shrink-0" style={{ width: "3.2rem", "font-size": "0.6875rem" }}>
                                                    焦点距離:
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label="焦点距離"
                                                    value={focalLength()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setFocalLength,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="ba-input ba-input--sm ba-flex-1"
                                                    placeholder="例: 50"
                                                />
                                                <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    mm
                                                </span>
                                            </div>
                                            <div class="ba-flex ba-items-center ba-gap-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label="F値の表示切り替え"
                                                    checked={showFNumber()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowFNumber,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="ba-checkbox"
                                                />
                                                <span class="ba-text-muted ba-font-bold ba-shrink-0" style={{ width: "3.2rem", "font-size": "0.6875rem" }}>
                                                    絞り値:
                                                </span>
                                                <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    f/
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label="F値"
                                                    value={fNumber()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setFNumber,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="ba-input ba-input--sm ba-flex-1"
                                                    placeholder="例: 2.8"
                                                />
                                            </div>
                                            <div class="ba-flex ba-items-center ba-gap-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label="シャッター速度の表示切り替え"
                                                    checked={showSpeed()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowSpeed,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="ba-checkbox"
                                                />
                                                <span class="ba-text-muted ba-font-bold ba-shrink-0" style={{ width: "3.2rem", "font-size": "0.6875rem" }}>
                                                    SS速度:
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label="シャッター速度"
                                                    value={shutterSpeed()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setShutterSpeed,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="ba-input ba-input--sm ba-flex-1"
                                                    placeholder="例: 1/250s"
                                                />
                                            </div>
                                            <div class="ba-flex ba-items-center ba-gap-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label="ISO感度の表示切り替え"
                                                    checked={showIso()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowIso,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="ba-checkbox"
                                                />
                                                <span class="ba-text-muted ba-font-bold ba-shrink-0" style={{ width: "3.2rem", "font-size": "0.6875rem" }}>
                                                    ISO感度:
                                                </span>
                                                <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    ISO
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label="ISO感度"
                                                    value={isoValue()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setIsoValue,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="ba-input ba-input--sm ba-flex-1"
                                                    placeholder="例: 100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                                </Show>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-layout"
                                aria-labelledby="exif-tab-layout"
                                hidden={activeTab() !== "layout"}
                                class="ba-stack-4"
                            >
                                <Show when={activeTab() === "layout" || visitedTabs().has("layout")}>
                                    <div class="ba-panel ba-stack-3 ba-text-xs">
                                    <div
                                        class="ba-flex ba-items-center ba-justify-between"
                                        style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                                    >
                                        <span class="ba-font-bold">
                                            文字の配置設定
                                        </span>
                                        <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            選択して変更
                                        </span>
                                    </div>
                                    <For each={positionGroups}>
                                        {(group) => (
                                            <div class="ba-stack-1">
                                                <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    {group.title}
                                                </span>
                                                <div
                                                    class="ba-grid"
                                                    style={{
                                                        "grid-template-columns": "repeat(3, minmax(0, 1fr))",
                                                        gap: "0.5rem",
                                                    }}
                                                >
                                                    <For each={group.items}>
                                                        {(item) => {
                                                            const isSelected = () => {
                                                                if (item.isCheki) {
                                                                    return isChekiMode();
                                                                }
                                                                if (isChekiMode()) {
                                                                    return false;
                                                                }
                                                                if (item.isOverlay) {
                                                                    return (
                                                                        framePosition() === item.pos
                                                                    );
                                                                }
                                                                if (
                                                                    item.isVertical ||
                                                                    item.isHorizontal
                                                                ) {
                                                                    return (
                                                                        framePosition() === item.pos
                                                                    );
                                                                }
                                                                return (
                                                                    framePosition() === item.pos &&
                                                                    textAlign() === item.align
                                                                );
                                                            };

                                                            const justifyStyle =
                                                                item.align === "center"
                                                                    ? "center"
                                                                    : item.align === "right"
                                                                      ? "flex-end"
                                                                      : "flex-start";

                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (item.isCheki) {
                                                                            setIsChekiMode(true);
                                                                        } else {
                                                                            setIsChekiMode(false);
                                                                            handleOptionChange(
                                                                                setFramePosition,
                                                                                item.pos,
                                                                            );
                                                                            if (!item.isVertical) {
                                                                                handleOptionChange(
                                                                                    setTextAlign,
                                                                                    item.align,
                                                                                );
                                                                            }
                                                                        }
                                                                    }}
                                                                    class="ba-flex-col ba-items-center ba-justify-center"
                                                                    style={{
                                                                        padding: "0.5rem",
                                                                        "border-radius": "var(--ba-radius)",
                                                                        border: isSelected()
                                                                            ? "1.5px solid var(--ba-primary)"
                                                                            : "1px solid var(--ba-border)",
                                                                        background: isSelected()
                                                                            ? "var(--ba-primary-soft)"
                                                                            : "var(--ba-surface)",
                                                                        color: isSelected()
                                                                            ? "var(--ba-primary)"
                                                                            : "var(--ba-text-muted)",
                                                                        "font-weight": isSelected() ? 700 : 600,
                                                                        cursor: "pointer",
                                                                        transition: "all 0.15s ease",
                                                                    }}
                                                                    title={`${item.label}に配置`}
                                                                >
                                                                    {/* Mini Preview Box */}
                                                                    <div
                                                                        class="ba-w-full ba-flex-col"
                                                                        style={{
                                                                            "aspect-ratio": "4 / 3",
                                                                            "border-radius": "0.375rem",
                                                                            border: "1px solid var(--ba-border)",
                                                                            background: "#020617",
                                                                            position: "relative",
                                                                            overflow: "hidden",
                                                                            "margin-bottom": "0.375rem",
                                                                            "user-select": "none",
                                                                        }}
                                                                    >
                                                                        <Show when={item.isCheki}>
                                                                            {/* Cheki style mini preview */}
                                                                            <div
                                                                                class="ba-w-full ba-flex-col"
                                                                                style={{
                                                                                    height: "100%",
                                                                                    padding: "0.25rem",
                                                                                    "background-color": getMiniBgColor(),
                                                                                }}
                                                                            >
                                                                                <div
                                                                                    class="ba-flex-1 ba-flex ba-items-center ba-justify-center"
                                                                                    style={{
                                                                                        background: "#0f172a",
                                                                                        "border-radius": "0.15rem",
                                                                                        overflow: "hidden",
                                                                                        position: "relative",
                                                                                    }}
                                                                                >
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span style={{ color: "rgba(255,255,255,0.4)" }}><ToolIcon name="image" class="ba-icon-xs" /></span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            style={{
                                                                                                width: "100%",
                                                                                                height: "100%",
                                                                                                "object-fit": "cover",
                                                                                                transform: `rotate(${imageRotation()}deg)`,
                                                                                            }}
                                                                                        />
                                                                                    </Show>
                                                                                </div>
                                                                                <div
                                                                                    class="ba-flex-col ba-items-center ba-justify-center"
                                                                                    style={{
                                                                                        height: "0.75rem",
                                                                                        "padding-top": "0.125rem",
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div style={{ width: "66%", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.8 }}></div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.isOverlay
                                                                            }
                                                                        >
                                                                            <div
                                                                                class="ba-flex-1 ba-flex ba-items-center ba-justify-center"
                                                                                style={{ background: "#0f172a", overflow: "hidden", position: "relative" }}
                                                                            >
                                                                                <Show
                                                                                    when={uploadedImageSrc()}
                                                                                    fallback={
                                                                                        <span style={{ color: "rgba(255,255,255,0.35)" }}><ToolIcon name="image" class="ba-icon-xs" /></span>
                                                                                    }
                                                                                >
                                                                                    <img
                                                                                        src={uploadedImageSrc()}
                                                                                        style={{
                                                                                            width: "100%",
                                                                                            height: "100%",
                                                                                            "object-fit": "cover",
                                                                                            transform: `rotate(${imageRotation()}deg)`,
                                                                                        }}
                                                                                    />
                                                                                </Show>

                                                                                <div
                                                                                    style={{
                                                                                        position: "absolute",
                                                                                        "pointer-events": "none",
                                                                                        ...(item.pos === "overlay-top-left"
                                                                                            ? { top: "6px", left: "6px" }
                                                                                            : item.pos === "overlay-top-center"
                                                                                              ? { top: "6px", left: "50%", transform: "translateX(-50%)" }
                                                                                              : item.pos === "overlay-top-right"
                                                                                                ? { top: "6px", right: "6px" }
                                                                                                : item.pos === "overlay-bottom-left"
                                                                                                  ? { bottom: "6px", left: "6px" }
                                                                                                  : item.pos === "overlay-bottom-center"
                                                                                                    ? { bottom: "6px", left: "50%", transform: "translateX(-50%)" }
                                                                                                    : item.pos === "overlay-bottom-right"
                                                                                                      ? { bottom: "6px", right: "6px" }
                                                                                                      : item.pos === "overlay-right-vertical"
                                                                                                        ? { left: "calc(100% - 6px)", top: "50%", transform: "translate(-100%, -50%)" }
                                                                                                        : item.pos === "overlay-left-vertical"
                                                                                                          ? { left: "6px", top: "50%", transform: "translateY(-50%)" }
                                                                                                          : {}),
                                                                                    }}
                                                                                >
                                                                                    <div
                                                                                        style={
                                                                                            item.pos === "overlay-left-vertical" || item.pos === "overlay-right-vertical"
                                                                                                ? { width: "4px", height: "24px", "border-radius": "4px", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(0,0,0,0.2)" }
                                                                                                : { width: "24px", height: "4px", "border-radius": "4px", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(0,0,0,0.2)" }
                                                                                        }
                                                                                    ></div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.pos === "bottom"
                                                                            }
                                                                        >
                                                                            <div
                                                                                class="ba-flex-1 ba-flex ba-items-center ba-justify-center"
                                                                                style={{ background: "#0f172a", overflow: "hidden", position: "relative" }}
                                                                            >
                                                                                <Show
                                                                                    when={uploadedImageSrc()}
                                                                                    fallback={
                                                                                        <span style={{ color: "rgba(255,255,255,0.35)" }}><ToolIcon name="image" class="ba-icon-xs" /></span>
                                                                                    }
                                                                                >
                                                                                    <img
                                                                                        src={uploadedImageSrc()}
                                                                                        style={{
                                                                                            width: "100%",
                                                                                            height: "100%",
                                                                                            "object-fit": "cover",
                                                                                            transform: `rotate(${imageRotation()}deg)`,
                                                                                        }}
                                                                                    />
                                                                                </Show>
                                                                            </div>
                                                                            <div
                                                                                class="ba-flex-col ba-justify-center"
                                                                                style={{
                                                                                    height: "0.875rem",
                                                                                    "border-top": "1px solid rgba(0,0,0,0.1)",
                                                                                    padding: "0.125rem 0.375rem",
                                                                                    "background-color": getMiniBgColor(),
                                                                                    color: getMiniTextColor(),
                                                                                }}
                                                                            >
                                                                                <div class="ba-w-full ba-flex-col" style={{ gap: "2px" }}>
                                                                                    <div class="ba-w-full ba-flex" style={{ "justify-content": justifyStyle }}>
                                                                                        <div style={{ width: "66%", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.85 }}></div>
                                                                                    </div>
                                                                                    <div class="ba-w-full ba-flex" style={{ "justify-content": justifyStyle }}>
                                                                                        <div style={{ width: "33%", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.55 }}></div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.pos === "top"
                                                                            }
                                                                        >
                                                                            <div
                                                                                class="ba-flex-col ba-justify-center"
                                                                                style={{
                                                                                    height: "0.875rem",
                                                                                    "border-bottom": "1px solid rgba(0,0,0,0.1)",
                                                                                    padding: "0.125rem 0.375rem",
                                                                                    "background-color": getMiniBgColor(),
                                                                                    color: getMiniTextColor(),
                                                                                }}
                                                                            >
                                                                                <div class="ba-w-full ba-flex-col" style={{ gap: "2px" }}>
                                                                                    <div class="ba-w-full ba-flex" style={{ "justify-content": justifyStyle }}>
                                                                                        <div style={{ width: "66%", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.85 }}></div>
                                                                                    </div>
                                                                                    <div class="ba-w-full ba-flex" style={{ "justify-content": justifyStyle }}>
                                                                                        <div style={{ width: "33%", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.55 }}></div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div
                                                                                class="ba-flex-1 ba-flex ba-items-center ba-justify-center"
                                                                                style={{ background: "#0f172a", overflow: "hidden", position: "relative" }}
                                                                            >
                                                                                <Show
                                                                                    when={uploadedImageSrc()}
                                                                                    fallback={
                                                                                        <span style={{ color: "rgba(255,255,255,0.35)" }}><ToolIcon name="image" class="ba-icon-xs" /></span>
                                                                                    }
                                                                                >
                                                                                    <img
                                                                                        src={uploadedImageSrc()}
                                                                                        style={{
                                                                                            width: "100%",
                                                                                            height: "100%",
                                                                                            "object-fit": "cover",
                                                                                            transform: `rotate(${imageRotation()}deg)`,
                                                                                        }}
                                                                                    />
                                                                                </Show>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.pos === "left"
                                                                            }
                                                                        >
                                                                            <div class="ba-w-full ba-flex" style={{ height: "100%" }}>
                                                                                <div
                                                                                    class="ba-flex ba-items-center ba-justify-center"
                                                                                    style={{
                                                                                        width: "1rem",
                                                                                        height: "100%",
                                                                                        "border-right": "1px solid rgba(0,0,0,0.1)",
                                                                                        "padding-block": "0.25rem",
                                                                                        gap: "2px",
                                                                                        "background-color": getMiniBgColor(),
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div style={{ width: "2px", height: "60%", "border-radius": "9999px", background: "currentColor", opacity: 0.6 }}></div>
                                                                                    <div style={{ width: "2px", height: "80%", "border-radius": "9999px", background: "currentColor", opacity: 0.9 }}></div>
                                                                                </div>
                                                                                <div
                                                                                    class="ba-flex-1 ba-flex ba-items-center ba-justify-center"
                                                                                    style={{ background: "#0f172a", overflow: "hidden", position: "relative" }}
                                                                                >
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span style={{ color: "rgba(255,255,255,0.35)" }}><ToolIcon name="image" class="ba-icon-xs" /></span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            style={{
                                                                                                width: "100%",
                                                                                                height: "100%",
                                                                                                "object-fit": "cover",
                                                                                                transform: `rotate(${imageRotation()}deg)`,
                                                                                            }}
                                                                                        />
                                                                                    </Show>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.pos === "left-horizontal"
                                                                            }
                                                                        >
                                                                            <div class="ba-w-full ba-flex" style={{ height: "100%" }}>
                                                                                <div
                                                                                    class="ba-flex-col ba-items-center ba-justify-center"
                                                                                    style={{
                                                                                        width: "2rem",
                                                                                        height: "100%",
                                                                                        gap: "3px",
                                                                                        "background-color": getMiniBgColor(),
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div style={{ width: "1.25rem", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.9 }}></div>
                                                                                    <div style={{ width: "1.25rem", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.7 }}></div>
                                                                                </div>
                                                                                <div
                                                                                    class="ba-flex-1 ba-flex ba-items-center ba-justify-center"
                                                                                    style={{ background: "#0f172a", overflow: "hidden", position: "relative" }}
                                                                                >
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span style={{ color: "rgba(255,255,255,0.35)" }}><ToolIcon name="image" class="ba-icon-xs" /></span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            style={{
                                                                                                width: "100%",
                                                                                                height: "100%",
                                                                                                "object-fit": "cover",
                                                                                                transform: `rotate(${imageRotation()}deg)`,
                                                                                            }}
                                                                                        />
                                                                                    </Show>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.pos === "right"
                                                                            }
                                                                        >
                                                                            <div class="ba-w-full ba-flex" style={{ height: "100%" }}>
                                                                                <div
                                                                                    class="ba-flex-1 ba-flex ba-items-center ba-justify-center"
                                                                                    style={{ background: "#0f172a", overflow: "hidden", position: "relative" }}
                                                                                >
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span style={{ color: "rgba(255,255,255,0.35)" }}><ToolIcon name="image" class="ba-icon-xs" /></span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            style={{
                                                                                                width: "100%",
                                                                                                height: "100%",
                                                                                                "object-fit": "cover",
                                                                                                transform: `rotate(${imageRotation()}deg)`,
                                                                                            }}
                                                                                        />
                                                                                    </Show>
                                                                                </div>
                                                                                <div
                                                                                    class="ba-flex ba-items-center ba-justify-center"
                                                                                    style={{
                                                                                        width: "1rem",
                                                                                        height: "100%",
                                                                                        "border-left": "1px solid rgba(0,0,0,0.1)",
                                                                                        "padding-block": "0.25rem",
                                                                                        gap: "2px",
                                                                                        "background-color": getMiniBgColor(),
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div style={{ width: "2px", height: "60%", "border-radius": "9999px", background: "currentColor", opacity: 0.6 }}></div>
                                                                                    <div style={{ width: "2px", height: "80%", "border-radius": "9999px", background: "currentColor", opacity: 0.9 }}></div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.pos === "right-horizontal"
                                                                            }
                                                                        >
                                                                            <div class="ba-w-full ba-flex" style={{ height: "100%" }}>
                                                                                <div
                                                                                    class="ba-flex-1 ba-flex ba-items-center ba-justify-center"
                                                                                    style={{ background: "#0f172a", overflow: "hidden", position: "relative" }}
                                                                                >
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span style={{ color: "rgba(255,255,255,0.35)" }}><ToolIcon name="image" class="ba-icon-xs" /></span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            style={{
                                                                                                width: "100%",
                                                                                                height: "100%",
                                                                                                "object-fit": "cover",
                                                                                                transform: `rotate(${imageRotation()}deg)`,
                                                                                            }}
                                                                                        />
                                                                                    </Show>
                                                                                </div>
                                                                                <div
                                                                                    class="ba-flex-col ba-items-center ba-justify-center"
                                                                                    style={{
                                                                                        width: "2rem",
                                                                                        height: "100%",
                                                                                        gap: "3px",
                                                                                        "background-color": getMiniBgColor(),
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div style={{ width: "1.25rem", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.9 }}></div>
                                                                                    <div style={{ width: "1.25rem", height: "2px", "border-radius": "9999px", background: "currentColor", opacity: 0.7 }}></div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>
                                                                    </div>
                                                                    <span class="ba-truncate" style={{ "font-size": "0.6875rem", "max-width": "100%" }}>
                                                                        {item.label}
                                                                    </span>
                                                                </button>
                                                            );
                                                        }}
                                                    </For>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                                </Show>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-design"
                                aria-labelledby="exif-tab-design"
                                hidden={activeTab() !== "design"}
                                class="ba-stack-4"
                            >
                                <Show when={activeTab() === "design" || visitedTabs().has("design")}>
                                    <Show when={!isAdvancedMode()}>
                                    <div class="ba-panel ba-text-xs">
                                        <div class="ba-flex ba-items-center ba-justify-between">
                                            <span class="ba-font-bold ba-text-muted">
                                                背景マットの色
                                            </span>
                                            <div class="ba-flex ba-items-center ba-gap-3 ba-font-bold">
                                                <label class="ba-flex ba-gap-1 ba-items-center" style={{ cursor: "pointer" }}>
                                                    <input
                                                        type="radio"
                                                        name="color"
                                                        checked={
                                                            frameColor() === "white"
                                                        }
                                                        onChange={() =>
                                                            handleOptionChange(
                                                                setFrameColor,
                                                                "white",
                                                            )
                                                        }
                                                        class="ba-radio"
                                                    />
                                                    白
                                                </label>
                                                <label class="ba-flex ba-gap-1 ba-items-center" style={{ cursor: "pointer" }}>
                                                    <input
                                                        type="radio"
                                                        name="color"
                                                        checked={
                                                            frameColor() === "black"
                                                        }
                                                        onChange={() =>
                                                            handleOptionChange(
                                                                setFrameColor,
                                                                "black",
                                                            )
                                                        }
                                                        class="ba-radio"
                                                    />
                                                    黒
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                                <div class="ba-panel ba-stack-3 ba-text-xs">
                                    <span
                                        class="ba-text-xs ba-font-bold"
                                        style={{
                                            display: "block",
                                            "border-bottom": "1px solid var(--ba-border)",
                                            "padding-bottom": "0.375rem",
                                        }}
                                    >
                                        フォント・文字サイズ
                                    </span>
                                    <div class="ba-field">
                                        <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            使用フォント
                                        </span>
                                        <select
                                            aria-label="使用フォント"
                                            value={selectedFont()}
                                            onChange={(e) =>
                                                handleFontChange(
                                                    e.currentTarget.value,
                                                )
                                            }
                                            class="ba-select ba-select--sm"
                                        >
                                            <For each={fontList}>
                                                {(f) => (
                                                    <option value={f.value}>
                                                        {f.name}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                        <p class="ba-text-muted" style={{ "font-size": "0.6875rem", margin: 0 }}>
                                            利用可能なフォントは各フォントの利用規約に従ってください。
                                        </p>
                                    </div>
                                    <div class="ba-field">
                                        <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            文字の大きさ ({fontSizeScale()}%)
                                        </span>
                                        <input
                                            type="range"
                                            aria-label="文字の大きさスライダー"
                                            min="50"
                                            max="180"
                                            value={fontSizeScale()}
                                            onPointerDown={handleSliderPointerDown}
                                            onPointerMove={handleSliderPointerMove}
                                            onPointerUp={handleSliderPointerUp}
                                            onPointerCancel={handleSliderPointerUp}
                                            onInput={(e) =>
                                                handleSizeScaleChange(
                                                    Number(
                                                        e.currentTarget.value,
                                                    ),
                                                )
                                            }
                                            class="ba-range"
                                            style={{ "touch-action": "none" }}
                                        />
                                    </div>
                                </div>
                                <div
                                    class="ba-panel ba-stack-3"
                                    style={{
                                        border: "2px dashed var(--ba-primary)",
                                        background: "var(--ba-primary-soft)",
                                    }}
                                >
                                    <label class="ba-flex ba-items-center ba-justify-between ba-gap-2" style={{ cursor: "pointer" }}>
                                        <div class="ba-flex-col">
                                            <span class="ba-font-black ba-text-primary ba-text-sm">
                                                上級者カスタマイズモード
                                            </span>
                                            <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                こだわりの額縁や銘板プレートを解放
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            aria-label="自由カラー調整モードの切り替え"
                                            checked={isAdvancedMode()}
                                            onChange={(e) =>
                                                handleToggleChange(
                                                    setIsAdvancedMode,
                                                    e.currentTarget.checked,
                                                )
                                            }
                                            class="ba-toggle ba-toggle--sm"
                                        />
                                    </label>

                                    <Show when={isAdvancedMode()}>
                                        <div
                                            class="ba-stack-3 ba-text-xs"
                                            style={{ "padding-top": "0.5rem", "border-top": "1px solid var(--ba-border)" }}
                                        >
                                            <div
                                                class="ba-grid"
                                                style={{ "grid-template-columns": "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}
                                            >
                                                <div class="ba-field">
                                                    <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                        好きな枠色
                                                    </span>
                                                    <div class="ba-flex ba-items-center ba-gap-2">
                                                        <input
                                                            type="color"
                                                            aria-label="外枠フレームの色"
                                                            value={customFrameColor()}
                                                            onInput={(e) =>
                                                                handleTextChange(
                                                                    setCustomFrameColor,
                                                                    e.currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            style={{
                                                                width: "2.25rem",
                                                                height: "2.25rem",
                                                                "border-radius": "0.25rem",
                                                                cursor: "pointer",
                                                                border: "1px solid var(--ba-border)",
                                                                background: "transparent",
                                                            }}
                                                        />
                                                        <span class="ba-mono ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                            {customFrameColor()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div class="ba-field">
                                                    <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                        好きな文字色
                                                    </span>
                                                    <div class="ba-flex ba-items-center ba-gap-2">
                                                        <input
                                                            type="color"
                                                            aria-label="文字の色"
                                                            value={customTextColor()}
                                                            onInput={(e) =>
                                                                handleTextChange(
                                                                    setCustomTextColor,
                                                                    e.currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            style={{
                                                                width: "2.25rem",
                                                                height: "2.25rem",
                                                                "border-radius": "0.25rem",
                                                                cursor: "pointer",
                                                                border: "1px solid var(--ba-border)",
                                                                background: "transparent",
                                                            }}
                                                        />
                                                        <span class="ba-mono ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                            {customTextColor()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="ba-field">
                                                <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    写真の角丸調整
                                                </span>
                                                <input
                                                    type="range"
                                                    aria-label="写真の角丸調整スライダー"
                                                    min="0"
                                                    max="150"
                                                    value={imageBorderRadius()}
                                                    onPointerDown={handleSliderPointerDown}
                                                    onPointerMove={handleSliderPointerMove}
                                                    onPointerUp={handleSliderPointerUp}
                                                    onPointerCancel={handleSliderPointerUp}
                                                    onInput={(e) => {
                                                        setImageBorderRadius(
                                                            Number(
                                                                e.currentTarget.value,
                                                            ),
                                                        );
                                                    }}
                                                    class="ba-range"
                                                    style={{ "touch-action": "none" }}
                                                />
                                            </div>

                                            <div class="ba-stack-1">
                                                <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    額縁の装飾スタイル
                                                </span>
                                                <div
                                                    class="ba-grid"
                                                    style={{ "grid-template-columns": "repeat(3, minmax(0, 1fr))", gap: "0.375rem" }}
                                                >
                                                    <For each={frameTemplates}>
                                                        {(tmpl) => (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleOptionChange(
                                                                        setFrameStyle,
                                                                        tmpl.id,
                                                                    )
                                                                }
                                                                class="ba-flex-col ba-items-center ba-text-center ba-min-w-0"
                                                                style={{
                                                                    padding: "0.375rem",
                                                                    "border-radius": "var(--ba-radius-sm)",
                                                                    border: frameStyle() === tmpl.id
                                                                        ? "2px solid var(--ba-primary)"
                                                                        : "1px solid var(--ba-border)",
                                                                    background: frameStyle() === tmpl.id
                                                                        ? "var(--ba-primary-soft)"
                                                                        : "var(--ba-surface)",
                                                                    "min-height": "58px",
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                <div
                                                                    style={`${tmpl.style} width: 1.75rem; height: 1.25rem; margin-bottom: 0.25rem; border: 1px solid ${tmpl.borderColor}; border-radius: 0.15rem;`}
                                                                />
                                                                <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.625rem", "line-height": 1.2 }}>
                                                                    {tmpl.name}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>

                                            <div class="ba-stack-1">
                                                <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    文字のプレート装飾
                                                </span>
                                                <div
                                                    class="ba-grid ba-scroll-y"
                                                    style={{
                                                        "grid-template-columns": "repeat(2, minmax(0, 1fr))",
                                                        gap: "0.5rem",
                                                        "max-height": "180px",
                                                    }}
                                                >
                                                    <For each={plateTemplates}>
                                                        {(plate) => (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleOptionChange(
                                                                        setTextPlateStyle,
                                                                        plate.id,
                                                                    )
                                                                }
                                                                class="ba-flex-col ba-items-center ba-justify-between ba-text-center"
                                                                style={{
                                                                    padding: "0.5rem",
                                                                    "border-radius": "var(--ba-radius-sm)",
                                                                    border: textPlateStyle() === plate.id
                                                                        ? "2px solid var(--ba-primary)"
                                                                        : "1px solid var(--ba-border)",
                                                                    background: textPlateStyle() === plate.id
                                                                        ? "var(--ba-primary-soft)"
                                                                        : "var(--ba-surface)",
                                                                    "min-height": "64px",
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.625rem", "margin-bottom": "0.25rem" }}>
                                                                    {plate.name}
                                                                </span>
                                                                <div
                                                                    class="ba-w-full ba-flex ba-items-center ba-justify-center"
                                                                    style={{
                                                                        padding: "0.25rem",
                                                                        border: "1px solid var(--ba-border)",
                                                                        "font-size": "0.625rem",
                                                                        "user-select": "none",
                                                                        ...plate.boxStyle,
                                                                    }}
                                                                >
                                                                    {plate.render()}
                                                                </div>
                                                            </button>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>

                                            <div style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "0.5rem" }}>
                                                <label class="ba-flex ba-items-center ba-justify-between" style={{ cursor: "pointer" }}>
                                                    <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                        チェキ風の帯比率を連動
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        aria-label="チェキ風の帯比率を連動"
                                                        checked={isChekiMode()}
                                                        onChange={(e) =>
                                                            handleToggleChange(
                                                                setIsChekiMode,
                                                                e.currentTarget.checked,
                                                            )
                                                        }
                                                        class="ba-toggle ba-toggle--sm"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                                </Show>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-overlay"
                                aria-labelledby="exif-tab-overlay"
                                hidden={activeTab() !== "overlay"}
                                class="ba-stack-4"
                            >
                                <Show when={activeTab() === "overlay" || visitedTabs().has("overlay")}>
                                    <div class="ba-alert ba-alert--warning ba-items-start ba-text-xs">
                                    <span class="ba-badge ba-badge--warning ba-shrink-0">
                                        BETA
                                    </span>
                                    <div class="ba-stack-1">
                                        <span class="ba-font-bold">
                                            重ね画像（透過PNG）＆著作権表記（ベータ版）
                                        </span>
                                        <span style={{ "font-size": "0.6875rem", "font-weight": 500 }}>
                                            透過PNGやロゴ・キャラクター素材を複数読み込んで自由な位置に配置できます。フレームの空きスペースに著作権表記（©）を入れることも可能です。
                                        </span>
                                    </div>
                                </div>

                                <div class="ba-panel ba-stack-3 ba-text-xs">
                                    <div
                                        class="ba-flex ba-items-center ba-justify-between"
                                        style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.375rem" }}
                                    >
                                        <span class="ba-text-xs ba-font-bold">
                                            重ねる画像の追加・管理
                                        </span>
                                        <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            複数選択可（PNG / WebP 等）
                                        </span>
                                    </div>

                                    <label class="ba-btn ba-btn--primary ba-btn--block">
                                        <span>+ 透過PNG・重ねる画像を追加（複数可）</span>
                                        <input
                                            type="file"
                                            accept="image/png,image/webp,image/gif,image/svg+xml,image/*"
                                            aria-label="透過PNGや重ねる画像ファイルを選択"
                                            multiple
                                            onChange={handleOverlayFilesChange}
                                            style={{ display: "none" }}
                                        />
                                    </label>

                                    <Show
                                        when={overlayImages().length > 0}
                                        fallback={
                                            <div
                                                class="ba-text-muted ba-text-center"
                                                style={{
                                                    "font-size": "0.75rem",
                                                    background: "var(--ba-surface)",
                                                    border: "1px dashed var(--ba-border-strong)",
                                                    "border-radius": "var(--ba-radius-sm)",
                                                    padding: "0.75rem",
                                                }}
                                            >
                                                まだ重ねる画像が追加されていません。上のボタンから透過PNGなどを選択してください。
                                            </div>
                                        }
                                    >
                                        <div class="ba-alert ba-alert--info ba-text-xs">
                                            <span>
                                                プレビュー上で直接ドラッグして移動、四隅の丸（またはピンチ・マウスホイール）で拡大縮小できます。
                                            </span>
                                        </div>
                                        <div class="ba-stack-3">
                                            <For each={overlayImages()}>
                                                {(item, index) => (
                                                    <div
                                                        onClick={() => setSelectedOverlayId(item.id)}
                                                        class="ba-stack-3"
                                                        style={{
                                                            background: "var(--ba-surface)",
                                                            border: selectedOverlayId() === item.id
                                                                ? "2px solid var(--ba-primary)"
                                                                : "1px solid var(--ba-border)",
                                                            "border-radius": "var(--ba-radius)",
                                                            padding: "0.75rem",
                                                        }}
                                                    >
                                                        <div
                                                            class="ba-flex ba-items-center ba-gap-2"
                                                            style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.5rem" }}
                                                        >
                                                            <div
                                                                class="ba-flex ba-items-center ba-justify-center ba-shrink-0"
                                                                style={{
                                                                    width: "2.75rem",
                                                                    height: "2.75rem",
                                                                    "border-radius": "var(--ba-radius-sm)",
                                                                    border: "1px solid var(--ba-border)",
                                                                    background: "var(--ba-surface-2)",
                                                                    overflow: "hidden",
                                                                }}
                                                            >
                                                                <img
                                                                    src={item.src}
                                                                    alt={item.name}
                                                                    style={{ "max-width": "100%", "max-height": "100%", "object-fit": "contain" }}
                                                                />
                                                            </div>
                                                            <div class="ba-flex-1 ba-min-w-0">
                                                                <div class="ba-font-bold ba-text-xs ba-truncate ba-flex ba-items-center ba-gap-1">
                                                                    <span>#{index() + 1} {item.name}</span>
                                                                    <Show when={selectedOverlayId() === item.id}>
                                                                        <span class="ba-badge ba-badge--primary">
                                                                            操作中
                                                                        </span>
                                                                    </Show>
                                                                </div>
                                                                <div class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                                    X:{item.x}% / Y:{item.y}% / サイズ:{item.scale}%
                                                                </div>
                                                            </div>
                                                            <div class="ba-flex ba-items-center ba-gap-1 ba-shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveOverlayItemOrder(item.id, -1)}
                                                                    disabled={index() === 0}
                                                                    class="ba-btn ba-btn--xs ba-btn--outline"
                                                                    title="奥のレイヤーへ移動"
                                                                >
                                                                    ↑
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveOverlayItemOrder(item.id, 1)}
                                                                    disabled={index() === overlayImages().length - 1}
                                                                    class="ba-btn ba-btn--xs ba-btn--outline"
                                                                    title="手前のレイヤーへ移動"
                                                                >
                                                                    ↓
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeOverlayItem(item.id)}
                                                                    class="ba-btn ba-btn--xs ba-btn--outline ba-text-danger"
                                                                    title="この重ね画像を削除"
                                                                >
                                                                    削除
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div class="ba-flex ba-items-center ba-gap-2">
                                                            <label
                                                                class="ba-flex-1 ba-flex ba-items-center ba-justify-between"
                                                                style={{
                                                                    cursor: "pointer",
                                                                    background: "var(--ba-surface-2)",
                                                                    padding: "0.5rem 0.625rem",
                                                                    "border-radius": "var(--ba-radius-sm)",
                                                                    border: "1px solid var(--ba-border)",
                                                                }}
                                                            >
                                                                <div class="ba-flex-col">
                                                                    <span class="ba-font-bold" style={{ "font-size": "0.75rem" }}>
                                                                        フレームの上に被せる
                                                                    </span>
                                                                    <span class="ba-text-muted" style={{ "font-size": "0.625rem" }}>
                                                                        OFFの時は写真の内側のみで切り抜かれます
                                                                    </span>
                                                                </div>
                                                                <input
                                                                    type="checkbox"
                                                                    aria-label="枠外にはみ出して配置する"
                                                                    checked={item.overFrame}
                                                                    onChange={(e) =>
                                                                        updateOverlayItem(item.id, {
                                                                            overFrame: e.currentTarget.checked,
                                                                        })
                                                                    }
                                                                    class="ba-toggle ba-toggle--sm"
                                                                />
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    updateOverlayItem(item.id, {
                                                                        flipX: !item.flipX,
                                                                    })
                                                                }
                                                                class={`ba-btn ba-btn--sm ba-shrink-0 ${item.flipX ? "ba-btn--primary" : "ba-btn--outline"}`}
                                                            >
                                                                ↔ 左右反転
                                                            </button>
                                                        </div>

                                                        <div class="ba-stack-3">
                                                            <div class="ba-field">
                                                                <div class="ba-flex ba-justify-between ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                                    <span>サイズ (拡大率)</span>
                                                                    <span class="ba-mono">{item.scale}%</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    aria-label="画像サイズスライダー"
                                                                    min="5"
                                                                    max="250"
                                                                    value={item.scale}
                                                                    onPointerDown={handleSliderPointerDown}
                                                                    onPointerMove={handleSliderPointerMove}
                                                                    onPointerUp={handleSliderPointerUp}
                                                                    onPointerCancel={handleSliderPointerUp}
                                                                    onInput={(e) =>
                                                                        updateOverlayItem(item.id, {
                                                                            scale: Number(e.currentTarget.value),
                                                                        })
                                                                    }
                                                                    class="ba-range"
                                                                    style={{ "touch-action": "none" }}
                                                                />
                                                            </div>
                                                            <div class="ba-field">
                                                                <div class="ba-flex ba-justify-between ba-items-center ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                                    <span>回転率 (角度)</span>
                                                                    <div class="ba-flex ba-items-center ba-gap-2">
                                                                        <span class="ba-mono">{item.rotation}°</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                updateOverlayItem(item.id, {
                                                                                    rotation: 0,
                                                                                })
                                                                            }
                                                                            class="ba-underline ba-text-primary"
                                                                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, "font-size": "0.6875rem" }}
                                                                        >
                                                                            0°に戻す
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    aria-label="回転角度スライダー"
                                                                    min="-180"
                                                                    max="180"
                                                                    value={item.rotation}
                                                                    onPointerDown={handleSliderPointerDown}
                                                                    onPointerMove={handleSliderPointerMove}
                                                                    onPointerUp={handleSliderPointerUp}
                                                                    onPointerCancel={handleSliderPointerUp}
                                                                    onInput={(e) =>
                                                                        updateOverlayItem(item.id, {
                                                                            rotation: Number(e.currentTarget.value),
                                                                        })
                                                                    }
                                                                    class="ba-range"
                                                                    style={{ "touch-action": "none" }}
                                                                />
                                                            </div>
                                                            <div class="ba-field">
                                                                <div class="ba-flex ba-justify-between ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                                    <span>不透明度</span>
                                                                    <span class="ba-mono">{item.opacity}%</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    aria-label="不透明度スライダー"
                                                                    min="10"
                                                                    max="100"
                                                                    value={item.opacity}
                                                                    onPointerDown={handleSliderPointerDown}
                                                                    onPointerMove={handleSliderPointerMove}
                                                                    onPointerUp={handleSliderPointerUp}
                                                                    onPointerCancel={handleSliderPointerUp}
                                                                    onInput={(e) =>
                                                                        updateOverlayItem(item.id, {
                                                                            opacity: Number(e.currentTarget.value),
                                                                        })
                                                                    }
                                                                    class="ba-range"
                                                                    style={{ "touch-action": "none" }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </div>

                                <div class="ba-panel ba-stack-3 ba-text-xs">
                                    <div
                                        class="ba-flex ba-items-center ba-justify-between"
                                        style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.375rem" }}
                                    >
                                        <span class="ba-text-xs ba-font-bold">
                                            © 著作権・クレジット表記
                                        </span>
                                        <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            版権画像利用時の権利表記など
                                        </span>
                                    </div>

                                    <div class="ba-field">
                                        <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            著作権・権利表記テキスト
                                        </span>
                                        <div class="ba-flex ba-gap-2">
                                            <input
                                                type="text"
                                                aria-label="著作権クレジット表記テキスト"
                                                placeholder="例: © 2026 Project / Character Name"
                                                value={copyrightText()}
                                                onInput={(e) =>
                                                    handleTextChange(
                                                        setCopyrightText,
                                                        e.currentTarget.value,
                                                    )
                                                }
                                                class="ba-input ba-input--sm ba-flex-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setCopyrightText((prev) =>
                                                        prev.startsWith("©")
                                                            ? prev
                                                            : `© ${prev}`,
                                                    )
                                                }
                                                class="ba-btn ba-btn--sm ba-btn--outline ba-shrink-0"
                                                title="先頭に © を挿入"
                                            >
                                                ©
                                            </button>
                                        </div>
                                        <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            ※入力するとフレームの空きスペース（または指定位置）に自動で小さく刻印されます。
                                        </span>
                                    </div>

                                    <div class="ba-field">
                                        <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            表記の位置
                                        </span>
                                        <select
                                            aria-label="クレジット表記の位置"
                                            value={copyrightPosition()}
                                            onChange={(e) =>
                                                setCopyrightPosition(
                                                    e.currentTarget.value as
                                                        | "auto"
                                                        | "frame-bottom-right"
                                                        | "frame-bottom-left"
                                                        | "frame-top-right"
                                                        | "frame-top-left"
                                                        | "image-bottom-right"
                                                        | "image-bottom-left",
                                                )
                                            }
                                            class="ba-select ba-select--sm"
                                        >
                                            <option value="auto">
                                                自動（フレームの空きスペースに配置）
                                            </option>
                                            <option value="frame-bottom-right">
                                                フレームの右下
                                            </option>
                                            <option value="frame-bottom-left">
                                                フレームの左下
                                            </option>
                                            <option value="frame-top-right">
                                                フレームの右上
                                            </option>
                                            <option value="frame-top-left">
                                                フレームの左上
                                            </option>
                                            <option value="image-bottom-right">
                                                写真内の右下
                                            </option>
                                            <option value="image-bottom-left">
                                                写真内の左下
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                </Show>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-save"
                                aria-labelledby="exif-tab-save"
                                hidden={activeTab() !== "save"}
                                class="ba-stack-4"
                            >
                                <Show when={activeTab() === "save" || visitedTabs().has("save")}>
                                    <div class="ba-panel ba-stack-3 ba-text-xs">
                                    <span
                                        class="ba-text-xs ba-font-bold"
                                        style={{
                                            display: "block",
                                            "border-bottom": "1px solid var(--ba-border)",
                                            "padding-bottom": "0.375rem",
                                        }}
                                    >
                                        ファイル保存設定
                                    </span>
                                    <div class="ba-field">
                                        <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            出力ファイル名
                                        </span>
                                        <input
                                            type="text"
                                            aria-label="出力ファイル名"
                                            placeholder="空欄なら自動生成されます"
                                            value={customExportName()}
                                            onInput={(e) =>
                                                setCustomExportName(
                                                    e.currentTarget.value,
                                                )
                                            }
                                            class="ba-input ba-input--sm ba-mono"
                                        />
                                    </div>
                                    <div class="ba-flex ba-gap-2 ba-justify-between ba-items-center">
                                        <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            保存形式:
                                        </span>
                                        <div class="ba-flex ba-gap-2">
                                            <For
                                                each={[
                                                    "image/jpeg",
                                                    "image/png",
                                                    "image/webp",
                                                ]}
                                            >
                                                {(fmt) => (
                                                    <label class="ba-flex ba-gap-1 ba-items-center ba-font-bold" style={{ "font-size": "0.75rem", cursor: "pointer" }}>
                                                        <input
                                                            type="radio"
                                                            name="fmt"
                                                            checked={
                                                                saveFormat() === fmt
                                                            }
                                                            onChange={() =>
                                                                handleOptionChange(
                                                                    setSaveFormat,
                                                                    fmt,
                                                                )
                                                            }
                                                            class="ba-radio"
                                                        />
                                                        {fmt
                                                            .split("/")[1]
                                                            .toUpperCase()}
                                                    </label>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                    <div class="ba-field" style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "0.5rem" }}>
                                        <span class="ba-font-bold ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                            出力サイズ（解像度）:
                                        </span>
                                        <select
                                            aria-label="出力サイズ（解像度）"
                                            value={String(exportMaxEdge())}
                                            onChange={(e) =>
                                                setExportMaxEdge(
                                                    Number(e.currentTarget.value),
                                                )
                                            }
                                            class="ba-select ba-select--sm"
                                        >
                                            <option value="0">
                                                オリジナル解像度（最高画質）
                                            </option>
                                            <option value="4096">
                                                高画質・高速（長辺 最大4096px / 4K相当）
                                            </option>
                                            <option value="2048">
                                                SNS投稿向け・超高速（長辺 最大2048px）
                                            </option>
                                        </select>
                                    </div>
                                    <div style={{ "border-top": "1px solid var(--ba-border)", "padding-top": "0.5rem" }}>
                                        <label class="ba-flex ba-items-center ba-justify-between" style={{ cursor: "pointer" }}>
                                            <div class="ba-flex-col">
                                                <span class="ba-font-bold" style={{ "font-size": "0.75rem" }}>
                                                    元のExifデータを引き継ぐ
                                                </span>
                                                <span class="ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                                                    ※JPEG保存時のみ有効
                                                </span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                aria-label="元写真のEXIFメタデータを保持して書き出す"
                                                checked={keepOriginalExif()}
                                                onChange={(e) =>
                                                    setKeepOriginalExif(
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="ba-toggle ba-toggle--sm"
                                            />
                                        </label>
                                        <Show
                                            when={
                                                useCustomTitle() && keepOriginalExif()
                                            }
                                        >
                                            <span class="ba-text-danger ba-font-bold ba-inline-flex ba-items-center ba-gap-1" style={{ "font-size": "0.6875rem", "margin-top": "0.375rem" }}>
                                                <ToolIcon name="alert" class="ba-icon-xs ba-shrink-0" />
                                                注意：タイトル入力をONにすると、自動取得したExif情報は画像データに書き込まれません。
                                            </span>
                                        </Show>
                                    </div>
                                    <Show when={hasImage()}>
                                        <button
                                            type="button"
                                            disabled={isProcessing()}
                                            onClick={handleGenerate}
                                            class="ba-btn ba-btn--success ba-btn--lg ba-btn--block"
                                            style={{ "margin-top": "0.25rem" }}
                                        >
                                            <Show
                                                when={!isProcessing()}
                                                fallback={
                                                    <>
                                                        <span class="ba-spinner" />
                                                        <span>生成中... ({processingProgress()}%)</span>
                                                    </>
                                                }
                                            >
                                                額縁付き画像を生成
                                            </Show>
                                        </button>
                                    </Show>
                                </div>
                                </Show>
                            </div>
                        </div>
                    </div>

                    <div class="ba-exif-preview">
                        <Show
                            when={hasImage()}
                            fallback={
                                <div class="ba-text-muted ba-text-center ba-text-sm ba-flex-col ba-items-center ba-gap-2" style={{ padding: "1rem" }}>
                                    <ToolIcon name="camera" class="ba-icon-xl" />
                                    <span>写真を読み込むと、比率を維持したプレビューが表示されます。</span>
                                </div>
                            }
                        >
                            <Show when={overlayImages().length > 0}>
                                <div
                                    class="ba-text-xs ba-font-bold ba-flex ba-items-center ba-gap-1"
                                    style={{
                                        position: "absolute",
                                        top: "0.75rem",
                                        left: "0.75rem",
                                        background: "rgba(15, 23, 42, 0.78)",
                                        color: "#ffffff",
                                        padding: "0.25rem 0.625rem",
                                        "border-radius": "var(--ba-radius-sm)",
                                        "z-index": 10,
                                        "pointer-events": "none",
                                    }}
                                >
                                    <span>ドラッグで移動・四隅/ピンチで拡縮</span>
                                </div>
                            </Show>
                            <button
                                type="button"
                                onClick={() => setIsMaximized(true)}
                                class="ba-btn ba-btn--sm"
                                style={{
                                    position: "absolute",
                                    top: "0.75rem",
                                    right: "0.75rem",
                                    background: "rgba(15, 23, 42, 0.82)",
                                    color: "#ffffff",
                                    border: "none",
                                    "z-index": 10,
                                }}
                            >
                                大画面で拡大
                            </button>
                            <canvas
                                ref={(el) => (canvasRef = el)}
                                onPointerDown={handleCanvasPointerDown}
                                onPointerMove={handleCanvasPointerMove}
                                onPointerUp={handleCanvasPointerUp}
                                onPointerCancel={handleCanvasPointerUp}
                                onWheel={handleCanvasWheel}
                                style={{
                                    "max-width": "100%",
                                    "max-height": "100%",
                                    width: "auto",
                                    height: "auto",
                                    "object-fit": "contain",
                                    background: "#e2e8f0",
                                    "box-shadow": "var(--ba-shadow-md)",
                                    ...(overlayImages().length > 0
                                        ? {
                                              cursor: draggingOverlayId() ? "grabbing" : "grab",
                                              "touch-action": "none",
                                              "user-select": "none",
                                          }
                                        : {}),
                                }}
                            />
                        </Show>
                    </div>
                </div>
            </div>

            <Show when={isMaximized()}>
                {(() => {
                    let initialDistance = 0;
                    let initialScale = 1;
                    let lastTouchCenter = { x: 0, y: 0 };
                    let isDragging = false;
                    let dragStart = { x: 0, y: 0 };
                    let initialTranslate = { x: 0, y: 0 };

                    const handleTouchStart = (e: TouchEvent) => {
                        if (e.touches.length === 2) {
                            e.preventDefault();
                            const dx = e.touches[0].clientX - e.touches[1].clientX;
                            const dy = e.touches[0].clientY - e.touches[1].clientY;
                            initialDistance = Math.hypot(dx, dy);
                            initialScale = modalZoomScale();
                            lastTouchCenter = {
                                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                            };
                            initialTranslate = { ...modalTranslate() };
                        } else if (e.touches.length === 1 && modalZoomScale() > 1) {
                            isDragging = true;
                            dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                            initialTranslate = { ...modalTranslate() };
                        }
                    };

                    const handleTouchMove = (e: TouchEvent) => {
                        if (e.touches.length === 2) {
                            e.preventDefault();
                            const dx = e.touches[0].clientX - e.touches[1].clientX;
                            const dy = e.touches[0].clientY - e.touches[1].clientY;
                            const dist = Math.hypot(dx, dy);
                            if (initialDistance > 0) {
                                const newScale = Math.min(
                                    5,
                                    Math.max(1, initialScale * (dist / initialDistance)),
                                );
                                setModalZoomScale(newScale);

                                const currentCenter = {
                                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                                };
                                const deltaX = currentCenter.x - lastTouchCenter.x;
                                const deltaY = currentCenter.y - lastTouchCenter.y;
                                setModalTranslate({
                                    x: initialTranslate.x + deltaX,
                                    y: initialTranslate.y + deltaY,
                                });
                            }
                        } else if (e.touches.length === 1 && isDragging && modalZoomScale() > 1) {
                            e.preventDefault();
                            const deltaX = e.touches[0].clientX - dragStart.x;
                            const deltaY = e.touches[0].clientY - dragStart.y;
                            setModalTranslate({
                                x: initialTranslate.x + deltaX,
                                y: initialTranslate.y + deltaY,
                            });
                        }
                    };

                    const handleTouchEnd = (e: TouchEvent) => {
                        if (e.touches.length < 2) {
                            initialDistance = 0;
                        }
                        if (e.touches.length === 0) {
                            isDragging = false;
                            if (modalZoomScale() <= 1.05) {
                                setModalZoomScale(1);
                                setModalTranslate({ x: 0, y: 0 });
                            }
                        }
                    };

                    const handleWheel = (e: WheelEvent) => {
                        e.preventDefault();
                        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
                        const newScale = Math.min(
                            5,
                            Math.max(1, modalZoomScale() * zoomFactor),
                        );
                        setModalZoomScale(newScale);
                        if (newScale === 1) {
                            setModalTranslate({ x: 0, y: 0 });
                        }
                    };

                    return (
                        <div
                            class="ba-flex-col ba-justify-center ba-items-center"
                            style={{
                                position: "fixed",
                                inset: 0,
                                background: "rgba(0, 0, 0, 0.95)",
                                "z-index": 9999,
                                padding: "1rem",
                                "user-select": "none",
                                "touch-action": "none",
                                overflow: "hidden",
                            }}
                            onClick={() => {
                                setIsMaximized(false);
                                setModalZoomScale(1);
                                setModalTranslate({ x: 0, y: 0 });
                            }}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onWheel={handleWheel}
                        >
                            <div
                                class="ba-flex ba-items-center ba-gap-2"
                                style={{ position: "absolute", top: "1rem", right: "1rem", "z-index": 20 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Show when={modalZoomScale() > 1}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalZoomScale(1);
                                            setModalTranslate({ x: 0, y: 0 });
                                        }}
                                        class="ba-btn ba-btn--sm"
                                        style={{ background: "rgba(30, 41, 59, 0.85)", color: "#ffffff", border: "none" }}
                                    >
                                        リセット
                                    </button>
                                </Show>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMaximized(false);
                                        setModalZoomScale(1);
                                        setModalTranslate({ x: 0, y: 0 });
                                    }}
                                    class="ba-btn ba-btn--circle ba-btn--outline"
                                    style={{ "border-color": "rgba(255,255,255,0.4)", color: "#ffffff" }}
                                >
                                    ✕
                                </button>
                            </div>
                            <div
                                class="ba-w-full ba-flex ba-items-center ba-justify-center"
                                style={{
                                    height: "100%",
                                    transform: `translate(${modalTranslate().x}px, ${modalTranslate().y}px) scale(${modalZoomScale()})`,
                                    "transform-origin": "center center",
                                    transition: "transform 75ms ease-out",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <canvas
                                    ref={(el) => {
                                        if (el && canvasRef) {
                                            el.width = canvasRef.width;
                                            el.height = canvasRef.height;
                                            el.getContext("2d")?.drawImage(canvasRef, 0, 0);
                                        }
                                    }}
                                    style={{
                                        "max-width": "100%",
                                        "max-height": "90vh",
                                        "object-fit": "contain",
                                        background: "#e2e8f0",
                                        "pointer-events": "auto",
                                    }}
                                />
                            </div>
                        </div>
                    );
                })()}
            </Show>

            <Show when={isProcessing()}>
                <div
                    role="status"
                    aria-live="polite"
                    class="ba-modal is-open"
                    style={{ "z-index": 10001 }}
                >
                    <div
                        class="ba-modal-box ba-stack-3 ba-text-center"
                        style={{ "max-width": "24rem" }}
                    >
                        <div class="ba-flex ba-items-center ba-justify-center ba-gap-2 ba-font-bold ba-text-sm">
                            <span class="ba-spinner ba-text-primary" />
                            <span>画像を生成しています...</span>
                        </div>
                        <progress
                            class="ba-progress"
                            style={{ height: "0.75rem" }}
                            value={processingProgress()}
                            max="100"
                        />
                        <div class="ba-flex ba-items-center ba-justify-between ba-text-muted" style={{ "font-size": "0.6875rem" }}>
                            <span class="ba-truncate">{processingStepText()}</span>
                            <span class="ba-mono ba-font-bold ba-text-primary ba-shrink-0">
                                {processingProgress()}%
                            </span>
                        </div>
                    </div>
                </div>
            </Show>

            <Show when={showMobileSaveModal()}>
                <div
                    class="ba-modal is-open"
                    style={{ "z-index": 10000 }}
                    onClick={() => setShowMobileSaveModal(false)}
                >
                    <div
                        class="ba-modal-box ba-stack-4 ba-text-center"
                        style={{ "max-width": "28rem" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 class="ba-font-bold ba-text-sm" style={{ margin: 0 }}>
                            画像が生成されました
                        </h3>
                        <div
                            class="ba-panel ba-w-full ba-flex ba-items-center ba-justify-center"
                            style={{ "max-height": "55vh", overflow: "hidden", padding: "0.5rem" }}
                        >
                            <img
                                src={downloadImageSrc()}
                                alt="Generated masterpiece"
                                style={{ "max-width": "100%", "max-height": "55vh", "object-fit": "contain" }}
                            />
                        </div>
                        <a
                            href={downloadImageSrc()}
                            download={downloadFileName()}
                            onClick={handleDownload}
                            class="ba-btn ba-btn--success ba-btn--block"
                        >
                            画像をダウンロードする
                        </a>

                        {/* SNS共有ボタン */}
                        <Show when={"share" in navigator && typeof (navigator as any).canShare === "function"}>
                            <button
                                type="button"
                                class="ba-btn ba-btn--secondary ba-btn--block"
                                onClick={async () => {
                                    try {
                                        const dataUrl = downloadImageSrc();
                                        const fileName = downloadFileName();
                                        const blob =
                                            preparedDownloadBlob ??
                                            dataUrlToBlob(dataUrl);
                                        const file = new File([blob], fileName, { type: blob.type });
                                        if ((navigator as any).canShare({ files: [file] })) {
                                            await navigator.share({
                                                files: [file],
                                                title: "EXIFフレーム生成 | BlossomsArchive Tools",
                                            });
                                        }
                                    } catch (e) {
                                        // キャンセル or 非対応は無視
                                    }
                                }}
                            >
                                画像をSNSにシェアする
                            </button>
                        </Show>

                        <button
                            type="button"
                            onClick={() => setShowMobileSaveModal(false)}
                            class="ba-btn ba-btn--primary ba-btn--block"
                        >
                            とじる
                        </button>
                    </div>
                </div>
            </Show>
            <AdSense />
            <AdSense />
            {/* スマホ固定操作メニュー分の末尾スペーサー */}
            <div class="ba-exif-dock-spacer" aria-hidden="true" />
        </div>
    );
}
