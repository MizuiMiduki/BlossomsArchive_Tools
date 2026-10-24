import {
    createSignal,
    Show,
    For,
    createEffect,
    onMount,
    onCleanup,
} from "solid-js";
import exifr from "exifr";
import piexif from "piexifjs";
import AdSense from "../components/AdSense";
import { delayedCall, playPageEntrance, animateFadeIn } from "../utils/gsapAnimations";
export default function ExifFrame() {
    const [fileName, setFileName] = createSignal("");
    const [customExportName, setCustomExportName] = createSignal("");
    const [frameColor, setFrameColor] = createSignal("white");
    const [framePosition, setFramePosition] = createSignal("bottom");
    const [textAlign, setTextAlign] = createSignal("left");
    const [saveFormat, setSaveFormat] = createSignal("image/jpeg");
    const [isChekiMode, setIsChekiMode] = createSignal(false);
    const [isMaximized, setIsMaximized] = createSignal(false);
    const [hasImage, setHasImage] = createSignal(false);
    const [keepOriginalExif, setKeepOriginalExif] = createSignal(false);

    const [showMobileSaveModal, setShowMobileSaveModal] = createSignal(false);
    const [downloadImageSrc, setDownloadImageSrc] = createSignal("");
    const [downloadFileName, setDownloadFileName] = createSignal("");
    const [uploadedImageSrc, setUploadedImageSrc] = createSignal("");

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

    type SettingTab = "text" | "layout" | "design" | "save";
    const settingTabs: { id: SettingTab; icon: string; label: string }[] = [
        { id: "text", icon: "📝", label: "文字" },
        { id: "layout", icon: "📍", label: "配置" },
        { id: "design", icon: "🎨", label: "デザイン" },
        { id: "save", icon: "💾", label: "保存" },
    ];
    const [activeTab, setActiveTab] = createSignal<SettingTab>("text");

    let rawFileBase64Str: string | null = null;
    let canvasRef: HTMLCanvasElement | undefined;
    let sourceImage: HTMLImageElement | null = null;
    let containerRef: HTMLDivElement | undefined;

    // SEO対策：メタデータの動的挿入
    onMount(() => {
        document.title =
            "Exif情報付きフレーム作成ツール | 写真編集ユーティリティ";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "アップロードした写真に、撮影時のExif情報（絞り、シャッタースピード、焦点距離など）をフレームとして合成・生成できるWebツールです。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "exif-frame-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Exifフレーム作成ツール",
            operatingSystem: "All",
            applicationCategory: "PhotographyApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "写真にExif情報を書き込み、スタイリッシュなフレーム付き画像を生成するツールです。",
        });
        document.head.appendChild(script);

        if (containerRef) playPageEntrance(containerRef);
    });

    onCleanup(() => {
        const script = document.getElementById("exif-frame-jsonld");
        if (script) {
            script.remove();
        }
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
            border: "border-base-300",
            style: "background: #fff;",
        },
        {
            id: "shadow",
            name: "立体浮き出し影",
            border: "border-base-300 shadow-md",
            style: "background: #eee;",
        },
        {
            id: "border",
            name: "インライン線画",
            border: "border-slate-800",
            style: "background: #fff; box-shadow: inset 0 0 0 2px #333;",
        },
        {
            id: "classic",
            name: "伝統的二重マット",
            border: "border-slate-400",
            style: "background: #fff; box-shadow: inset 0 0 0 1px #999, inset 0 0 0 3px #333;",
        },
        {
            id: "wood",
            name: "最高級オーク木目",
            border: "border-amber-800",
            style: "background: linear-gradient(135deg, #a05a2c 25%, #8b4513 25%, #8b4513 50%, #a05a2c 50%, #a05a2c 75%, #8b4513 75%); background-size: 8px 8px;",
        },
        {
            id: "gold",
            name: "宮殿アンティーク金縁",
            border: "border-yellow-600 shadow-[inset_0_0_4px_rgba(0,0,0,0.3)]",
            style: "background: linear-gradient(to bottom, #ffe57f, #ffc107, #b78103);",
        },
    ];

    const plateTemplates = [
        {
            id: "none",
            name: "標準テキスト（プレートなし）",
            bg: "bg-base-200 text-base-content border-base-300",
            innerHtml: "Text Only",
        },
        {
            id: "box",
            name: "モダン座布団ボックス",
            bg: "bg-base-300/60 text-base-content border-base-300 rounded-md",
            innerHtml:
                "<span class='bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded text-[11px]'>Label Box</span>",
        },
        {
            id: "line",
            name: "クラシック上下境界線",
            bg: "bg-base-100 text-base-content border-base-300",
            innerHtml:
                "<span class='border-y border-current px-1 py-0.5 text-[11px]'>Line Text</span>",
        },
        {
            id: "metal-gold",
            name: "真鍮ヘアラインゴールド",
            bg: "bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-600 text-amber-950 font-bold border-amber-700 shadow-[2px_2px_0px_#151515]",
            innerHtml:
                "<span class='text-[10px] relative px-2 py-0.5 border border-white/30 block text-center'>凹 GOLD</span>",
        },
        {
            id: "metal-silver",
            name: "アルミブラッシュドシルバー",
            bg: "bg-gradient-to-b from-white via-slate-300 to-slate-400 text-slate-900 font-bold border-slate-500 shadow-[2px_2px_0px_#151515]",
            innerHtml:
                "<span class='text-[10px] relative px-2 py-0.5 border border-white/40 block text-center'>凹 SILVER</span>",
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

    const drawFrame = () => {
        if (!canvasRef || !sourceImage) return;
        const ctx = canvasRef.getContext("2d");
        if (!ctx) return;

        const origW = sourceImage.width;
        const origH = sourceImage.height;
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

        let fColor = frameColor() === "white" ? "#ffffff" : "#121212";
        if (isAdvancedMode()) fColor = customFrameColor();

        ctx.fillStyle = fColor;
        ctx.fillRect(
            realFrameWidth,
            realFrameWidth,
            innerCanvasW,
            innerCanvasH,
        );

        if (framePosition() === "left-horizontal") {
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
        } else if (framePosition() === "right-horizontal") {
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
                currentScale = Math.max(
                    0.75,
                    availableWidth / targetMaxTextWidth,
                );
                measuredFontSize1 = Math.max(
                    12,
                    Math.floor(fontSize1 * currentScale),
                );
                measuredFontSize2 = Math.max(
                    10,
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
            drawCombinedTextAndPlate(
                prefix,
                textLine1Main,
                textLine2,
                x,
                y,
                "center",
                Math.max(100, clipWidth - 16),
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
    };

    // リアクティブに自動で再描画が走るように一元化するにゃん！
    createEffect(() => {
        if (hasImage()) {
            // 追跡したいすべてのStateをここに並べるにゃん
            frameColor();
            framePosition();
            textAlign();
            isChekiMode();
            selectedFont();
            fontSizeScale();
            imageRotation();
            useCustomTitle();
            customTitleLine1();
            customTitleLine2();
            prefixText();
            showPrefix();
            isAdvancedMode();
            customFrameColor();
            customTextColor();
            imageBorderRadius();
            frameStyle();
            textPlateStyle();
            cameraModel();
            lensModel();
            focalLength();
            fNumber();
            shutterSpeed();
            isoValue();
            showCamera();
            showLens();
            showFocal();
            showFNumber();
            showSpeed();
            showIso();
            separatorType();
            customSeparator();

            // 設定が切り替わったら自動で再描画にゃん！
            drawFrame();
        }
    });

    const handleGenerate = () => {
        if (!canvasRef) return;

        let baseName = customExportName().trim();
        if (!baseName) {
            baseName = `framed_${(fileName() || "image").split(".")[0]}`;
        }

        let finalDataUrl = canvasRef.toDataURL(saveFormat(), 0.95);

        if (
            keepOriginalExif() &&
            rawFileBase64Str &&
            saveFormat() === "image/jpeg"
        ) {
            try {
                const exifObj = piexif.load(rawFileBase64Str);
                if (exifObj["0th"]) {
                    // キャンバス上の描画はすでに適切な向きで回転補正されているため、
                    // 保存するExifのOrientationは「1（標準 / 0度回転）」に上書き固定する
                    exifObj["0th"][piexif.ImageIFD.Orientation] = 1;
                    exifObj["0th"][piexif.ImageIFD.ImageWidth] = canvasRef.width;
                    exifObj["0th"][piexif.ImageIFD.ImageLength] = canvasRef.height;
                }
                if (exifObj["Exif"]) {
                    exifObj["Exif"][piexif.ExifIFD.PixelXDimension] = canvasRef.width;
                    exifObj["Exif"][piexif.ExifIFD.PixelYDimension] = canvasRef.height;
                }
                const exifDump = piexif.dump(exifObj);
                finalDataUrl = piexif.insert(exifDump, finalDataUrl);
            } catch (exifErr) {
                console.error("Failed to insert EXIF metadata:", exifErr);
            }
        }

        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const downloadName = `${baseName}_${randomNum}.${saveFormat().split("/")[1]}`;
        setDownloadImageSrc(finalDataUrl);
        setDownloadFileName(downloadName);
        setShowMobileSaveModal(true);
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
            const blob = dataUrlToBlob(dataUrl);
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

        const base64Reader = new FileReader();
        base64Reader.onload = (event) => {
            if (file.type === "image/jpeg") {
                rawFileBase64Str = event.target?.result as string;
            }
        };
        base64Reader.readAsDataURL(file);

        try {
            const arrayBuffer = await file.arrayBuffer();
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

        const img = new Image();
        img.onload = () => {
            sourceImage = img;
            setHasImage(true);
            setImageRotation(0);
            setUploadedImageSrc(img.src);
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

    const handleFontChange = async (val: string) => {
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
            alignClass: "justify-start",
        },
        {
            pos: "bottom",
            align: "center",
            label: "下・中央",
            alignClass: "justify-center",
        },
        {
            pos: "bottom",
            align: "right",
            label: "下・右",
            alignClass: "justify-end",
        },
        {
            pos: "top",
            align: "left",
            label: "上・左",
            alignClass: "justify-start",
        },
        {
            pos: "top",
            align: "center",
            label: "上・中央",
            alignClass: "justify-center",
        },
        {
            pos: "top",
            align: "right",
            label: "上・右",
            alignClass: "justify-end",
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
            title: "🖼️ フレーム帯に配置",
            items: positionItems.filter((i) => !i.isOverlay),
        },
        {
            title: "✨ 画像の上に重ねる",
            items: positionItems.filter((i) => i.isOverlay),
        },
    ];

    // タブ切替時、スマホでは設定パネルの先頭が見えるようにスクロールする
    let settingsTopRef: HTMLDivElement | undefined;
    const selectTab = (id: SettingTab) => {
        setActiveTab(id);
        if (
            settingsTopRef &&
            typeof window !== "undefined" &&
            window.matchMedia?.("(max-width: 1023.98px)")?.matches
        ) {
            const rect = settingsTopRef.getBoundingClientRect();
            if (rect.top < 0 || rect.top > window.innerHeight * 0.6) {
                settingsTopRef.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            }
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
        <div ref={containerRef} class="exif-tool h-full w-full p-0 sm:p-4 pb-28 sm:pb-28 lg:pb-4 flex flex-col gap-4 bg-base-100">
            <For each={fontList}>
                {(f) => (
                    <link
                        rel="stylesheet"
                        href={`https://fonts.googleapis.com/css2?family=${f.link}&display=swap`}
                    />
                )}
            </For>

            <div class="card bg-base-100 shadow-xl p-3 sm:p-6 w-full border border-base-300">
                <div class="flex flex-col lg:flex-row gap-4 lg:gap-8 w-full items-stretch">
                    <div class="contents lg:flex lg:flex-col lg:w-[360px] lg:flex-shrink-0 lg:gap-4 lg:max-h-[85vh] lg:overflow-y-auto lg:pr-1">
                        <div class="order-1 lg:order-none grid grid-cols-2 gap-2 lg:flex lg:flex-col bg-base-200 p-2 sm:p-3 rounded-xl border border-base-300 shadow-xs">
                            <label class="btn btn-primary text-white h-12 px-3 lg:px-6 text-sm rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2 w-full"
                                classList={{ "col-span-2": !hasImage() }}>
                                <span>📁 写真を選択する</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    class="hidden"
                                />
                            </label>
                            <Show when={hasImage()}>
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    class="btn btn-success text-white h-12 px-6 text-sm rounded-xl shadow-xs hidden lg:flex items-center justify-center gap-2 w-full"
                                >
                                    ✨ 額縁付き画像を生成
                                </button>
                                <button
                                    type="button"
                                    onClick={rotateImage}
                                    class="btn btn-outline btn-primary btn-sm h-12 lg:h-10 px-2 lg:px-4 rounded-xl flex items-center justify-center gap-2 w-full border-base-300 text-xs"
                                >
                                    <span class="lg:hidden">🔄 右に90°回転</span>
                                    <span class="hidden lg:inline">
                                        🔄 画像を右に90度回転
                                    </span>
                                </button>
                            </Show>
                        </div>
                        <div
                            ref={settingsTopRef}
                            class="order-3 lg:order-none flex flex-col gap-4 scroll-mt-[40vh] lg:scroll-mt-0"
                        >
                            <div
                                role="tablist"
                                aria-label="設定カテゴリ"
                                class="fixed bottom-0 inset-x-0 z-10 bg-base-100/95 backdrop-blur-md border-t border-base-300 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:bottom-auto lg:inset-x-auto lg:border lg:rounded-xl lg:shadow-xs lg:pb-0"
                            >
                                <div class="flex items-stretch gap-1 p-1.5 max-w-xl mx-auto lg:max-w-none">
                                    <For each={settingTabs}>
                                        {(tab) => (
                                            <button
                                                type="button"
                                                role="tab"
                                                id={`exif-tab-${tab.id}`}
                                                aria-controls={`exif-panel-${tab.id}`}
                                                aria-selected={activeTab() === tab.id}
                                                onClick={() => selectTab(tab.id)}
                                                class={`flex-1 min-w-0 flex flex-col lg:flex-row items-center justify-center gap-0.5 lg:gap-1.5 h-14 lg:h-10 rounded-lg text-[11px] lg:text-xs font-bold transition-colors cursor-pointer select-none ${
                                                    activeTab() === tab.id
                                                        ? "bg-primary text-primary-content shadow-xs"
                                                        : "text-base-content/70 hover:bg-base-200 active:bg-base-200"
                                                }`}
                                            >
                                                <span
                                                    class="text-lg lg:text-sm leading-none"
                                                    aria-hidden="true"
                                                >
                                                    {tab.icon}
                                                </span>
                                                <span class="truncate">{tab.label}</span>
                                            </button>
                                        )}
                                    </For>
                                    <Show when={hasImage()}>
                                        <button
                                            type="button"
                                            onClick={handleGenerate}
                                            class="lg:hidden flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 h-14 rounded-lg text-[11px] font-bold bg-success text-success-content shadow-xs active:scale-95 transition-transform cursor-pointer select-none"
                                            aria-label="額縁付き画像を生成"
                                        >
                                            <span class="text-lg leading-none" aria-hidden="true">
                                                ✨
                                            </span>
                                            <span class="truncate">生成</span>
                                        </button>
                                    </Show>
                                </div>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-text"
                                aria-labelledby="exif-tab-text"
                                hidden={activeTab() !== "text"}
                                class="flex flex-col gap-4"
                            >
                                <div class="form-control border border-base-300 p-3 rounded-xl bg-base-200/50">
                                    <label class="flex items-center justify-between cursor-pointer text-base-content">
                                        <div class="flex flex-col">
                                            <span class="text-xs font-bold text-base-content">
                                                ✍️ 自由なタイトルモードにする
                                            </span>
                                            <span class="text-[10px] text-base-content/50 font-medium">
                                                カメラ情報の代わりに好きな文字を刻印
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={useCustomTitle()}
                                            onChange={(e) =>
                                                handleToggleChange(
                                                    setUseCustomTitle,
                                                    e.currentTarget.checked,
                                                )
                                            }
                                            class="toggle toggle-primary toggle-sm"
                                        />
                                    </label>
                                </div>
                                <div class="form-control border border-base-300 p-3.5 rounded-xl bg-base-200/30 flex flex-col gap-3">
                                    <span class="text-xs font-bold text-base-content uppercase tracking-wider block border-b border-base-300 pb-1.5">
                                        📝 文字編集
                                    </span>
                                    <div class="flex flex-col gap-2 bg-base-100 p-3 rounded-lg border border-base-300 text-xs mb-1">
                                        <div class="flex items-center justify-between">
                                            <div class="flex flex-col">
                                                <span class="font-bold text-base-content text-[11px]">
                                                    🏷️ 接頭辞の設定
                                                </span>
                                                <span class="text-[10px] text-base-content/50 font-medium">
                                                    テキストの先頭に文字を添えます
                                                </span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={showPrefix()}
                                                onChange={(e) =>
                                                    handleToggleChange(
                                                        setShowPrefix,
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="toggle toggle-primary toggle-sm"
                                            />
                                        </div>
                                        <Show when={showPrefix()}>
                                            <input
                                                type="text"
                                                value={prefixText()}
                                                onInput={(e) =>
                                                    handleTextChange(
                                                        setPrefixText,
                                                        e.currentTarget.value,
                                                    )
                                                }
                                                class="input input-bordered input-sm w-full mt-1.5 bg-base-100 text-base-content text-xs font-medium border-base-300"
                                                placeholder="例: Shot on "
                                            />
                                        </Show>
                                    </div>
                                    <Show when={useCustomTitle()}>
                                        <div class="flex flex-col gap-2 text-xs animate-fade-in">
                                            <div class="flex flex-col gap-1">
                                                <span class="text-[10px] font-bold text-base-content/60">
                                                    ✍️ 自由タイトル 1行目（メイン題名）
                                                </span>
                                                <input
                                                    type="text"
                                                    placeholder="1行目 (例: 作品のタイトル)"
                                                    value={customTitleLine1()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setCustomTitleLine1,
                                                            e.currentTarget.value,
                                                        )
                                                    }
                                                    class="input input-bordered input-sm w-full bg-base-100 text-base-content text-xs font-medium border-base-300"
                                                />
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <span class="text-[10px] font-bold text-base-content/60">
                                                    📅 自由タイトル 2行目（サブ情報）
                                                </span>
                                                <input
                                                    type="text"
                                                    placeholder="2行目 (例: 撮影日や場所)"
                                                    value={customTitleLine2()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setCustomTitleLine2,
                                                            e.currentTarget.value,
                                                        )
                                                    }
                                                    class="input input-bordered input-sm w-full bg-base-100 text-base-content text-xs font-medium border-base-300"
                                                />
                                            </div>
                                        </div>
                                    </Show>
                                    <Show when={!useCustomTitle()}>
                                        <div class="flex flex-col gap-1.5 bg-base-100 p-3 rounded-lg border border-base-300 text-xs">
                                            <div class="flex items-center justify-between">
                                                <span class="font-bold text-base-content text-[11px] flex items-center gap-1">
                                                    ⚡ 区切り文字
                                                </span>
                                                <span class="text-[10px] text-base-content/50 font-medium">
                                                    Exifパラメータ間の区切り記号
                                                </span>
                                            </div>
                                            <div class="grid grid-cols-4 sm:grid-cols-7 gap-1 mt-1">
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
                                                                class={`h-10 lg:h-8 px-1 rounded-lg border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                                                    isSelected()
                                                                        ? "border-primary bg-primary text-white shadow-xs scale-[0.98]"
                                                                        : "border-base-300 bg-base-100 hover:bg-base-200 text-base-content/80"
                                                                }`}
                                                                title={item.label}
                                                            >
                                                                {item.display}
                                                            </button>
                                                        );
                                                    }}
                                                </For>
                                            </div>
                                            <Show when={separatorType() === "custom"}>
                                                <div class="flex items-center gap-2 mt-1.5 animate-fade-in">
                                                    <span class="text-[10px] text-base-content/60 font-bold whitespace-nowrap">
                                                        任意の区切り文字:
                                                    </span>
                                                    <input
                                                        type="text"
                                                        value={customSeparator()}
                                                        onInput={(e) =>
                                                            handleTextChange(
                                                                setCustomSeparator,
                                                                e.currentTarget.value,
                                                            )
                                                        }
                                                        class="input input-bordered input-sm flex-1 bg-base-100 text-base-content text-xs font-medium border-base-300"
                                                        placeholder="例:  //  や  ,  など"
                                                    />
                                                </div>
                                            </Show>
                                        </div>
                                    </Show>
                                </div>
                                <Show when={!useCustomTitle()}>
                                    <div class="form-control border border-base-300 p-3.5 rounded-xl bg-base-200/30 flex flex-col gap-3 text-xs">
                                        <div class="flex items-center justify-between border-b border-base-300 pb-1.5">
                                            <span class="text-xs font-bold text-base-content uppercase tracking-wider">
                                                📷 表示するExif情報
                                            </span>
                                            <span class="text-[10px] text-base-content/50 font-medium">
                                                チェックで表示 / 値は直接修正可
                                            </span>
                                        </div>
                                        <div class="flex flex-col gap-1.5 text-[11px] text-base-content">
                                            <div class="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={showCamera()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowCamera,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="checkbox checkbox-sm"
                                                />
                                                <span class="w-12 text-base-content/60 font-bold text-[10px]">
                                                    カメラ:
                                                </span>
                                                <input
                                                    type="text"
                                                    value={cameraModel()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setCameraModel,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="input input-bordered input-sm flex-1 bg-base-100 font-medium border-base-300"
                                                />
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={showLens()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowLens,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="checkbox checkbox-sm"
                                                />
                                                <span class="w-12 text-base-content/60 font-bold text-[10px]">
                                                    レンズ:
                                                </span>
                                                <input
                                                    type="text"
                                                    value={lensModel()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setLensModel,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="input input-bordered input-sm flex-1 bg-base-100 font-medium border-base-300"
                                                />
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={showFocal()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowFocal,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="checkbox checkbox-sm"
                                                />
                                                <span class="w-12 text-base-content/60 font-bold text-[10px]">
                                                    焦点距離:
                                                </span>
                                                <input
                                                    type="text"
                                                    value={focalLength()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setFocalLength,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="input input-bordered input-sm flex-1 bg-base-100 font-medium border-base-300"
                                                    placeholder="例: 50"
                                                />
                                                <span class="text-[10px] text-base-content/60">
                                                    mm
                                                </span>
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={showFNumber()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowFNumber,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="checkbox checkbox-sm"
                                                />
                                                <span class="w-12 text-base-content/60 font-bold text-[10px]">
                                                    絞り値:
                                                </span>
                                                <span class="text-[10px] text-base-content/60">
                                                    f/
                                                </span>
                                                <input
                                                    type="text"
                                                    value={fNumber()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setFNumber,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="input input-bordered input-sm flex-1 bg-base-100 font-medium border-base-300"
                                                    placeholder="例: 2.8"
                                                />
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={showSpeed()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowSpeed,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="checkbox checkbox-sm"
                                                />
                                                <span class="w-12 text-base-content/60 font-bold text-[10px]">
                                                    SS速度:
                                                </span>
                                                <input
                                                    type="text"
                                                    value={shutterSpeed()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setShutterSpeed,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="input input-bordered input-sm flex-1 bg-base-100 font-medium border-base-300"
                                                    placeholder="例: 1/250s"
                                                />
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={showIso()}
                                                    onChange={(e) =>
                                                        handleToggleChange(
                                                            setShowIso,
                                                            e.currentTarget
                                                                .checked,
                                                        )
                                                    }
                                                    class="checkbox checkbox-sm"
                                                />
                                                <span class="w-12 text-base-content/60 font-bold text-[10px]">
                                                    ISO感度:
                                                </span>
                                                <span class="text-[10px] text-base-content/60">
                                                    ISO
                                                </span>
                                                <input
                                                    type="text"
                                                    value={isoValue()}
                                                    onInput={(e) =>
                                                        handleTextChange(
                                                            setIsoValue,
                                                            e.currentTarget
                                                                .value,
                                                        )
                                                    }
                                                    class="input input-bordered input-sm flex-1 bg-base-100 font-medium border-base-300"
                                                    placeholder="例: 100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-layout"
                                aria-labelledby="exif-tab-layout"
                                hidden={activeTab() !== "layout"}
                                class="flex flex-col gap-4"
                            >
                                <div class="form-control border border-base-300 p-3.5 rounded-xl bg-base-200/30 flex flex-col gap-3 text-xs">
                                    <div class="flex items-center justify-between border-b border-base-300 pb-2">
                                        <span class="font-bold text-base-content/80 text-[11px] flex items-center gap-1">
                                            📍 文字の配置設定
                                        </span>
                                        <span class="text-[10px] text-base-content/50 font-medium">
                                            選択して変更
                                        </span>
                                    </div>
                                    <For each={positionGroups}>
                                        {(group) => (
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-base-content/60">
                                                    {group.title}
                                                </span>
                                                <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">
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
                                                                    class={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                                                                        isSelected()
                                                                            ? "border-primary bg-primary/10 text-primary font-bold ring-2 ring-primary/30 shadow-xs"
                                                                            : "border-base-300 bg-base-100 hover:bg-base-200/80 text-base-content/70"
                                                                    }`}
                                                                    title={`${item.label}に配置`}
                                                                >
                                                                    {/* Mini Preview Box */}
                                                                    <div class="w-full aspect-[4/3] rounded-md border border-base-300 bg-slate-950 relative overflow-hidden flex flex-col mb-1.5 shadow-2xs select-none">
                                                                        <Show when={item.isCheki}>
                                                                            {/* Cheki style mini preview */}
                                                                            <div
                                                                                class="w-full h-full flex flex-col p-1 transition-colors"
                                                                                style={{
                                                                                    "background-color":
                                                                                        getMiniBgColor(),
                                                                                }}
                                                                            >
                                                                                <div class="flex-1 bg-slate-900 rounded-xs overflow-hidden relative flex items-center justify-center">
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span class="text-[8px] opacity-40">
                                                                                                📸
                                                                                            </span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            class="w-full h-full object-cover transition-transform"
                                                                                            style={{
                                                                                                transform: `rotate(${imageRotation()}deg)`,
                                                                                            }}
                                                                                        />
                                                                                    </Show>
                                                                                </div>
                                                                                <div
                                                                                    class="h-3 flex flex-col items-center justify-center pt-0.5 leading-none"
                                                                                    style={{
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div class="w-2/3 h-0.5 rounded-full bg-current opacity-80"></div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.isOverlay
                                                                            }
                                                                        >
                                                                            <div class="flex-1 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                                                                <Show
                                                                                    when={uploadedImageSrc()}
                                                                                    fallback={
                                                                                        <span class="text-[10px] opacity-30">
                                                                                            🖼️
                                                                                        </span>
                                                                                    }
                                                                                >
                                                                                    <img
                                                                                        src={uploadedImageSrc()}
                                                                                        class="w-full h-full object-cover transition-transform"
                                                                                        style={{
                                                                                            transform: `rotate(${imageRotation()}deg)`,
                                                                                        }}
                                                                                    />
                                                                                </Show>

                                                                                <div
                                                                                    class="absolute pointer-events-none"
                                                                                    style={
                                                                                        item.pos ===
                                                                                        "overlay-top-left"
                                                                                            ? {
                                                                                                  top: "6px",
                                                                                                  left: "6px",
                                                                                              }
                                                                                            : item.pos ===
                                                                                                "overlay-top-center"
                                                                                              ? {
                                                                                                    top: "6px",
                                                                                                    left: "50%",
                                                                                                    transform:
                                                                                                        "translateX(-50%)",
                                                                                                }
                                                                                              : item.pos ===
                                                                                                  "overlay-top-right"
                                                                                                ? {
                                                                                                      top: "6px",
                                                                                                      right: "6px",
                                                                                                  }
                                                                                                : item.pos ===
                                                                                                    "overlay-bottom-left"
                                                                                                  ? {
                                                                                                        bottom: "6px",
                                                                                                        left: "6px",
                                                                                                    }
                                                                                                  : item.pos ===
                                                                                                      "overlay-bottom-center"
                                                                                                    ? {
                                                                                                          bottom: "6px",
                                                                                                          left: "50%",
                                                                                                          transform:
                                                                                                              "translateX(-50%)",
                                                                                                      }
                                                                                                    : item.pos ===
                                                                                                        "overlay-bottom-right"
                                                                                                      ? {
                                                                                                            bottom: "6px",
                                                                                                            right: "6px",
                                                                                                        }
                                                                                                      : item.pos ===
                                                                                                          "overlay-right-vertical"
                                                                                                        ? {
                                                                                                              left: "calc(100% - 6px)",
                                                                                                              top: "50%",
                                                                                                              transform:
                                                                                                                  "translate(-100%, -50%)",
                                                                                                          }
                                                                                                        : item.pos ===
                                                                                                            "overlay-left-vertical"
                                                                                                          ? {
                                                                                                                left: "6px",
                                                                                                                top: "50%",
                                                                                                                transform:
                                                                                                                    "translateY(-50%)",
                                                                                                            }
                                                                                                          : {}
                                                                                    }
                                                                                >
                                                                                    <div
                                                                                        class={
                                                                                            item.pos ===
                                                                                                "overlay-left-vertical" ||
                                                                                            item.pos ===
                                                                                                "overlay-right-vertical"
                                                                                                ? "w-1 h-6 rounded-md bg-white/90 border border-black/20"
                                                                                                : "w-6 h-1 rounded-md bg-white/90 border border-black/20"
                                                                                        }
                                                                                    ></div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.pos ===
                                                                                    "bottom"
                                                                            }
                                                                        >
                                                                            <div class="flex-1 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                                                                <Show
                                                                                    when={uploadedImageSrc()}
                                                                                    fallback={
                                                                                        <span class="text-[10px] opacity-30">
                                                                                            🖼️
                                                                                        </span>
                                                                                    }
                                                                                >
                                                                                    <img
                                                                                        src={uploadedImageSrc()}
                                                                                        class="w-full h-full object-cover transition-transform"
                                                                                        style={{
                                                                                            transform: `rotate(${imageRotation()}deg)`,
                                                                                        }}
                                                                                    />
                                                                                </Show>
                                                                            </div>
                                                                            <div
                                                                                class="h-3.5 border-t flex flex-col justify-center px-1.5 py-0.5 leading-none transition-colors"
                                                                                style={{
                                                                                    "background-color":
                                                                                        getMiniBgColor(),
                                                                                    "border-color":
                                                                                        "rgba(0,0,0,0.1)",
                                                                                    color: getMiniTextColor(),
                                                                                }}
                                                                            >
                                                                                <div class="w-full flex flex-col gap-0.5">
                                                                                    <div
                                                                                        class={`w-full flex ${item.alignClass}`}
                                                                                    >
                                                                                        <div class="w-2/3 h-0.5 rounded-full bg-current opacity-85"></div>
                                                                                    </div>
                                                                                    <div
                                                                                        class={`w-full flex ${item.alignClass}`}
                                                                                    >
                                                                                        <div class="w-1/3 h-0.5 rounded-full bg-current opacity-55"></div>
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
                                                                                class="h-3.5 border-b flex flex-col justify-center px-1.5 py-0.5 leading-none transition-colors"
                                                                                style={{
                                                                                    "background-color":
                                                                                        getMiniBgColor(),
                                                                                    "border-color":
                                                                                        "rgba(0,0,0,0.1)",
                                                                                    color: getMiniTextColor(),
                                                                                }}
                                                                            >
                                                                                <div class="w-full flex flex-col gap-0.5">
                                                                                    <div
                                                                                        class={`w-full flex ${item.alignClass}`}
                                                                                    >
                                                                                        <div class="w-2/3 h-0.5 rounded-full bg-current opacity-85"></div>
                                                                                    </div>
                                                                                    <div
                                                                                        class={`w-full flex ${item.alignClass}`}
                                                                                    >
                                                                                        <div class="w-1/3 h-0.5 rounded-full bg-current opacity-55"></div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div class="flex-1 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                                                                <Show
                                                                                    when={uploadedImageSrc()}
                                                                                    fallback={
                                                                                        <span class="text-[10px] opacity-30">
                                                                                            🖼️
                                                                                        </span>
                                                                                    }
                                                                                >
                                                                                    <img
                                                                                        src={uploadedImageSrc()}
                                                                                        class="w-full h-full object-cover transition-transform"
                                                                                        style={{
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
                                                                            <div class="w-full h-full flex flex-row">
                                                                                <div
                                                                                    class="w-4 h-full border-r flex flex-row items-center justify-center py-1 gap-[2px] transition-colors"
                                                                                    style={{
                                                                                        "background-color":
                                                                                            getMiniBgColor(),
                                                                                        "border-color":
                                                                                            "rgba(0,0,0,0.1)",
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div class="w-0.5 h-3/5 rounded-full bg-current opacity-60"></div>
                                                                                    <div class="w-0.5 h-4/5 rounded-full bg-current opacity-90"></div>
                                                                                </div>
                                                                                <div class="flex-1 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span class="text-[10px] opacity-30">
                                                                                                🖼️
                                                                                            </span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            class="w-full h-full object-cover transition-transform"
                                                                                            style={{
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
                                                                                item.pos ===
                                                                                    "left-horizontal"
                                                                            }
                                                                        >
                                                                            <div class="w-full h-full flex flex-row">
                                                                                <div
                                                                                    class="w-8 h-full flex flex-col items-center justify-center gap-1 transition-colors"
                                                                                    style={{
                                                                                        "background-color":
                                                                                            getMiniBgColor(),
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div class="w-5 h-0.5 rounded-full bg-current opacity-90"></div>
                                                                                    <div class="w-5 h-0.5 rounded-full bg-current opacity-70"></div>
                                                                                </div>
                                                                                <div class="flex-1 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span class="text-[10px] opacity-30">
                                                                                                🖼️
                                                                                            </span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            class="w-full h-full object-cover transition-transform"
                                                                                            style={{
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
                                                                            <div class="w-full h-full flex flex-row">
                                                                                <div class="flex-1 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span class="text-[10px] opacity-30">
                                                                                                🖼️
                                                                                            </span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            class="w-full h-full object-cover transition-transform"
                                                                                            style={{
                                                                                                transform: `rotate(${imageRotation()}deg)`,
                                                                                            }}
                                                                                        />
                                                                                    </Show>
                                                                                </div>
                                                                                <div
                                                                                    class="w-4 h-full border-l flex flex-row items-center justify-center py-1 gap-[2px] transition-colors"
                                                                                    style={{
                                                                                        "background-color":
                                                                                            getMiniBgColor(),
                                                                                        "border-color":
                                                                                            "rgba(0,0,0,0.1)",
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div class="w-0.5 h-3/5 rounded-full bg-current opacity-60"></div>
                                                                                    <div class="w-0.5 h-4/5 rounded-full bg-current opacity-90"></div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>

                                                                        <Show
                                                                            when={
                                                                                !item.isCheki &&
                                                                                item.pos ===
                                                                                    "right-horizontal"
                                                                            }
                                                                        >
                                                                            <div class="w-full h-full flex flex-row">
                                                                                <div class="flex-1 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                                                                                    <Show
                                                                                        when={uploadedImageSrc()}
                                                                                        fallback={
                                                                                            <span class="text-[10px] opacity-30">
                                                                                                🖼️
                                                                                            </span>
                                                                                        }
                                                                                    >
                                                                                        <img
                                                                                            src={uploadedImageSrc()}
                                                                                            class="w-full h-full object-cover transition-transform"
                                                                                            style={{
                                                                                                transform: `rotate(${imageRotation()}deg)`,
                                                                                            }}
                                                                                        />
                                                                                    </Show>
                                                                                </div>
                                                                                <div
                                                                                    class="w-8 h-full flex flex-col items-center justify-center gap-1 transition-colors"
                                                                                    style={{
                                                                                        "background-color":
                                                                                            getMiniBgColor(),
                                                                                        color: getMiniTextColor(),
                                                                                    }}
                                                                                >
                                                                                    <div class="w-5 h-0.5 rounded-full bg-current opacity-90"></div>
                                                                                    <div class="w-5 h-0.5 rounded-full bg-current opacity-70"></div>
                                                                                </div>
                                                                            </div>
                                                                        </Show>
                                                                    </div>
                                                                    <span class="text-[10px] truncate max-w-full leading-tight font-semibold">
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
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-design"
                                aria-labelledby="exif-tab-design"
                                hidden={activeTab() !== "design"}
                                class="flex flex-col gap-4"
                            >
                                <Show when={!isAdvancedMode()}>
                                    <div class="flex flex-col gap-2 bg-base-200/50 p-3 rounded-xl border border-base-300/60 text-xs">
                                        <div class="flex items-center justify-between">
                                            <span class="font-bold text-base-content/80">
                                                🎨 背景マットの色
                                            </span>
                                            <div class="flex items-center gap-3 font-semibold text-base-content">
                                                <label class="flex gap-1 items-center cursor-pointer">
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
                                                        class="radio radio-primary radio-sm"
                                                    />
                                                    白
                                                </label>
                                                <label class="flex gap-1 items-center cursor-pointer">
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
                                                        class="radio radio-primary radio-sm"
                                                    />
                                                    黒
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </Show>
                                <div class="form-control border border-base-300 p-3.5 rounded-xl bg-base-200/30 flex flex-col gap-3 text-xs">
                                    <span class="text-xs font-bold text-base-content uppercase tracking-wider block border-b border-base-300 pb-1.5">
                                        🔤 フォント・文字サイズ
                                    </span>
                                    <div class="flex flex-col gap-1">
                                        <span class="font-bold text-base-content/60 text-[10px]">
                                            使用フォント
                                        </span>
                                        <select
                                            value={selectedFont()}
                                            onChange={(e) =>
                                                handleFontChange(
                                                    e.currentTarget.value,
                                                )
                                            }
                                            class="select select-bordered select-sm w-full bg-base-100 text-base-content border-base-300"
                                        >
                                            <For each={fontList}>
                                                {(f) => (
                                                    <option value={f.value}>
                                                        {f.name}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                        <p class="text-[10px] text-base-content/60 mt-1">
                                            利用可能なフォントは各フォントの利用規約に従ってください。
                                        </p>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <span class="font-bold text-base-content/60 text-[10px]">
                                            文字の大きさ ({fontSizeScale()}%)
                                        </span>
                                        <input
                                            type="range"
                                            min="50"
                                            max="180"
                                            value={fontSizeScale()}
                                            onInput={(e) =>
                                                handleSizeScaleChange(
                                                    Number(
                                                        e.currentTarget.value,
                                                    ),
                                                )
                                            }
                                            class="range range-primary range-sm mt-1"
                                        />
                                    </div>
                                </div>
                                <div class="form-control border-2 border-dashed border-secondary/40 p-3.5 rounded-xl bg-secondary/5 shadow-xs mt-1">
                                    <label class="flex items-center justify-between cursor-pointer mb-2">
                                        <div class="flex flex-col">
                                            <span class="label-text font-black text-secondary text-sm">
                                                🔥 上級者カスタマイズモード
                                            </span>
                                            <span class="text-[10px] text-base-content/60 font-medium">
                                                こだわりの額縁や銘板プレートを解放
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isAdvancedMode()}
                                            onChange={(e) =>
                                                handleToggleChange(
                                                    setIsAdvancedMode,
                                                    e.currentTarget.checked,
                                                )
                                            }
                                            class="toggle toggle-secondary toggle-sm"
                                        />
                                    </label>

                                    <Show when={isAdvancedMode()}>
                                        <div class="flex flex-col gap-3 pt-2 border-t border-secondary/20 animate-fade-in text-xs text-base-content">
                                            <div class="grid grid-cols-2 gap-2">
                                                <div class="flex flex-col gap-1">
                                                    <span class="text-[10px] font-bold text-base-content/70">
                                                        🎨 好きな枠色
                                                    </span>
                                                    <div class="flex items-center gap-1">
                                                        <input
                                                            type="color"
                                                            value={customFrameColor()}
                                                            onInput={(e) =>
                                                                handleTextChange(
                                                                    setCustomFrameColor,
                                                                    e.currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            class="w-9 h-9 rounded cursor-pointer border border-base-300 bg-transparent"
                                                        />
                                                        <span class="text-[10px] font-mono font-bold text-base-content/50">
                                                            {customFrameColor()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div class="flex flex-col gap-1">
                                                    <span class="text-[10px] font-bold text-base-content/70">
                                                        ✍️ 好きな文字色
                                                    </span>
                                                    <div class="flex items-center gap-1">
                                                        <input
                                                            type="color"
                                                            value={customTextColor()}
                                                            onInput={(e) =>
                                                                handleTextChange(
                                                                    setCustomTextColor,
                                                                    e.currentTarget
                                                                        .value,
                                                                )
                                                            }
                                                            class="w-9 h-9 rounded pointer border border-base-300 bg-transparent"
                                                        />
                                                        <span class="text-[10px] font-mono font-bold text-base-content/50">
                                                            {customTextColor()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="flex flex-col gap-1">
                                                <span class="text-[10px] font-bold text-base-content/70">
                                                    🪚 写真の角丸調整
                                                </span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="150"
                                                    value={imageBorderRadius()}
                                                    onInput={(e) => {
                                                        setImageBorderRadius(
                                                            Number(
                                                                e.currentTarget.value,
                                                            ),
                                                        );
                                                    }}
                                                    class="range range-secondary range-sm mt-1"
                                                />
                                            </div>

                                            <div class="flex flex-col gap-1">
                                                <span class="text-[10px] font-bold text-base-content/70 mb-1">
                                                    🖼️ 額縁の装飾スタイル
                                                </span>
                                                <div class="grid grid-cols-3 gap-1.5 p-0.5">
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
                                                                class={`flex flex-col items-center p-1.5 rounded-lg border-2 text-center transition-all duration-150 min-h-[58px] ${
                                                                    frameStyle() ===
                                                                    tmpl.id
                                                                        ? "border-secondary bg-secondary/10 scale-[0.96] ring-2 ring-secondary/20"
                                                                        : "border-base-300 bg-base-100 hover:bg-base-200 text-base-content shadow-xs"
                                                                }`}
                                                            >
                                                                <div
                                                                    class={`w-7 h-5 mb-1 border rounded-xs ${tmpl.border}`}
                                                                    style={tmpl.style}
                                                                />
                                                                <span class="text-[10px] font-bold text-base-content/80 leading-tight block">
                                                                    {tmpl.name}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>

                                            <div class="flex flex-col gap-1">
                                                <span class="text-[10px] font-bold text-base-content/70 mb-1">
                                                    🏷️ 文字のプレート装飾
                                                </span>
                                                <div class="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto p-0.5">
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
                                                                class={`flex flex-col items-center justify-between p-2 rounded-lg border-2 text-center transition-all duration-200 min-h-[64px] ${
                                                                    textPlateStyle() ===
                                                                    plate.id
                                                                        ? "border-secondary bg-secondary/10 scale-[0.98] ring-2 ring-secondary/30"
                                                                        : "border-base-300 bg-base-100 hover:bg-base-200 text-base-content shadow-sm"
                                                                }`}
                                                            >
                                                                <span class="text-[10px] font-bold text-base-content/70 mb-1 block">
                                                                    {plate.name}
                                                                </span>
                                                                <div
                                                                    class={`w-full py-1 px-1 flex items-center justify-center border text-[10px] select-none ${plate.bg}`}
                                                                    innerHTML={
                                                                        plate.innerHtml
                                                                    }
                                                                />
                                                            </button>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>

                                            <div class="form-control border-t border-secondary/20 pt-2">
                                                <label class="flex items-center justify-between cursor-pointer">
                                                    <span class="text-[10px] font-bold text-base-content/60">
                                                        チェキ風の帯比率を連動
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChekiMode()}
                                                        onChange={(e) =>
                                                            handleToggleChange(
                                                                setIsChekiMode,
                                                                e.currentTarget.checked,
                                                            )
                                                        }
                                                        class="toggle toggle-secondary toggle-sm"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                            <div
                                role="tabpanel"
                                id="exif-panel-save"
                                aria-labelledby="exif-tab-save"
                                hidden={activeTab() !== "save"}
                                class="flex flex-col gap-4"
                            >
                                <div class="form-control border border-base-300 p-3.5 rounded-xl bg-base-200/30 flex flex-col gap-2.5 text-xs">
                                    <span class="text-xs font-bold text-base-content uppercase tracking-wider block border-b border-base-300 pb-1.5">
                                        💾 ファイル保存設定
                                    </span>
                                    <div class="flex flex-col gap-1">
                                        <span class="text-[10px] font-bold text-base-content/60">
                                            出力ファイル名
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="空欄なら自動生成されます"
                                            value={customExportName()}
                                            onInput={(e) =>
                                                setCustomExportName(
                                                    e.currentTarget.value,
                                                )
                                            }
                                            class="input input-bordered input-sm w-full bg-base-100 font-mono text-base-content border-base-300"
                                        />
                                    </div>
                                    <div class="flex gap-2 pt-1 justify-between items-center text-base-content">
                                        <span class="text-[10px] font-bold text-base-content/60">
                                            保存形式:
                                        </span>
                                        <div class="flex gap-2">
                                            <For
                                                each={[
                                                    "image/jpeg",
                                                    "image/png",
                                                    "image/webp",
                                                ]}
                                            >
                                                {(fmt) => (
                                                    <label class="flex gap-1 text-[11px] items-center cursor-pointer font-semibold">
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
                                                            class="radio radio-primary radio-sm"
                                                        />
                                                        {fmt
                                                            .split("/")[1]
                                                            .toUpperCase()}
                                                    </label>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                    <div class="form-control border-t border-base-300 pt-2 text-base-content">
                                        <label class="flex items-center justify-between cursor-pointer">
                                            <div class="flex flex-col">
                                                <span class="text-[11px] font-bold text-base-content/80">
                                                    元のExifデータを引き継ぐ
                                                </span>
                                                <span class="text-[10px] text-base-content/50 font-medium">
                                                    ※JPEG保存時のみ有効
                                                </span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={keepOriginalExif()}
                                                onChange={(e) =>
                                                    setKeepOriginalExif(
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="toggle toggle-primary toggle-sm"
                                            />
                                        </label>
                                        <Show
                                            when={
                                                useCustomTitle() && keepOriginalExif()
                                            }
                                        >
                                            <span class="text-[10px] text-error font-bold mt-1.5 block leading-tight">
                                                ⚠️
                                                注意：タイトル入力をONにすると、自動取得したExif情報は画像データに書き込まれません。
                                            </span>
                                        </Show>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        class="order-2 lg:order-none flex-1 flex flex-col border border-base-300 bg-base-200 lg:bg-base-200/30 text-base-content rounded-2xl p-2 lg:p-4 justify-center items-center relative min-h-[140px] lg:min-h-0 overflow-hidden shadow-inner"
                        classList={{
                            "sticky top-0 z-[5] shadow-md lg:static lg:shadow-inner":
                                hasImage(),
                        }}
                    >
                        <Show
                            when={hasImage()}
                            fallback={
                                <div class="text-base-content/50 p-8 text-center font-medium">
                                    📸
                                    写真を読み込むと、比率を維持したプレビューが表示されます！
                                </div>
                            }
                        >
                            <button
                                type="button"
                                onClick={() => setIsMaximized(true)}
                                class="absolute top-2 right-2 lg:top-4 lg:right-4 btn btn-sm bg-slate-900/80 text-white border-none hover:bg-slate-900 shadow-md z-10 px-3 rounded-lg text-xs h-9"
                            >
                                🔍 大画面で拡大
                            </button>
                            <canvas
                                ref={(el) => (canvasRef = el)}
                                class="w-full h-full max-h-[36vh] lg:max-h-[calc(100vh-160px)] object-contain rounded-none shadow-lg bg-slate-200 transition-all duration-300"
                            />
                        </Show>
                    </div>
                </div>
            </div>

            <Show when={isMaximized()}>
                <div
                    class="fixed inset-0 bg-black/95 flex flex-col justify-center items-center z-[9999] p-4"
                    onClick={() => setIsMaximized(false)}
                >
                    <div
                        class="absolute top-4 right-4 flex gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setIsMaximized(false)}
                            class="btn btn-circle btn-outline border-white/40 text-white"
                        >
                            ✕
                        </button>
                    </div>
                    <canvas
                        ref={(el) => {
                            if (el && canvasRef) {
                                el.width = canvasRef.width;
                                el.height = canvasRef.height;
                                el.getContext("2d")?.drawImage(canvasRef, 0, 0);
                            }
                        }}
                        class="max-w-full max-h-[90vh] object-contain shadow-2xl bg-slate-200"
                    />
                </div>
            </Show>

            <Show when={showMobileSaveModal()}>
                <div
                    class="fixed inset-0 bg-black/80 flex flex-col justify-center items-center z-[10000] p-4 animate-fade-in"
                    onClick={() => setShowMobileSaveModal(false)}
                >
                    <div
                        class="bg-base-100 text-base-content max-w-md w-full p-5 rounded-2xl shadow-2xl flex flex-col gap-4 text-center border border-base-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div class="flex flex-col gap-1">
                            <h3 class="font-bold text-sm text-base-content flex items-center justify-center gap-1.5">
                                ✨ 画像が生成されました
                            </h3>
                        </div>
                        <div class="w-full max-h-[55vh] overflow-hidden bg-base-200 p-2 rounded-xl flex items-center justify-center">
                            <img
                                src={downloadImageSrc()}
                                alt="Generated masterpiece"
                                class="max-w-full max-h-[55vh] object-contain shadow-md rounded-xs"
                            />
                        </div>
                        <a
                            href={downloadImageSrc()}
                            download={downloadFileName()}
                            onClick={handleDownload}
                            class="btn btn-success text-white w-full h-11 text-xs rounded-xl shadow-xs flex items-center justify-center gap-1 font-bold text-sm"
                        >
                            📥 画像をダウンロードする
                        </a>

                        {/* SNS共有ボタン */}
                        <Show when={"share" in navigator && typeof (navigator as any).canShare === "function"}>
                            <button
                                type="button"
                                class="btn btn-info text-white w-full h-11 text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 font-bold text-sm"
                                onClick={async () => {
                                    try {
                                        const dataUrl = downloadImageSrc();
                                        const fileName = downloadFileName();
                                        const blob = dataUrlToBlob(dataUrl);
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
                                📤 画像をSNSにシェアする
                            </button>
                        </Show>

                        <button
                            type="button"
                            onClick={() => setShowMobileSaveModal(false)}
                            class="btn btn-primary text-white w-full h-11 text-xs rounded-xl shadow-xs mt-1"
                        >
                            とじる
                        </button>
                    </div>
                </div>
            </Show>
            <AdSense />
            <AdSense />
        </div>
    );
}
