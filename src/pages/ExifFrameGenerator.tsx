import { createSignal, Show, For } from "solid-js";
import exifr from "exifr";
import piexif from "piexifjs";

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

    const [selectedFont, setSelectedFont] = createSignal(
        "'Noto Sans JP', sans-serif",
    );
    const [fontSizeScale, setFontSizeScale] = createSignal(100);
    const [imageRotation, setImageRotation] = createSignal(0);

    let rawFileBase64Str: string | null = null;
    let canvasRef: HTMLCanvasElement | undefined;
    let sourceImage: HTMLImageElement | null = null;

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
            } else if (framePosition() === "left") {
                innerCanvasW += textSpace;
                imgX = textSpace;
            } else if (framePosition() === "right") innerCanvasW += textSpace;
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
            textLine1Main = [
                showCamera() ? cameraModel().trim() : "",
                showLens() ? lensModel().trim() : "",
            ]
                .filter(Boolean)
                .join(" | ");

            textLine2 = [
                showFocal() && focalLength() ? `${focalLength()}mm` : "",
                showFNumber() && fNumber() ? `f/${fNumber()}` : "",
                showSpeed() && shutterSpeed() ? shutterSpeed() : "",
                showIso() && isoValue() ? `ISO ${isoValue()}` : "",
            ]
                .filter(Boolean)
                .join(" | ");
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
        ) => {
            if (!prefixStr && !mainStr && !line2) return;

            ctx.save();
            const hAlign = getHorizontalAlign();
            ctx.textAlign = hAlign;

            ctx.font = font1Prefix;
            const prefixW = prefixStr ? ctx.measureText(prefixStr).width : 0;
            ctx.font = font1Main;
            const mainW = mainStr ? ctx.measureText(mainStr).width : 0;
            const w1 = prefixW + mainW;

            ctx.font = font2;
            const w2 = line2 ? ctx.measureText(line2).width : 0;
            const maxTextWidth = Math.max(w1, w2);

            const lineGap = Math.round(fontSize1 * 0.4);
            const hasLine1 = prefixStr || mainStr;
            const totalTextHeight =
                (hasLine1 ? fontSize1 : 0) +
                (line2 ? fontSize2 : 0) +
                (hasLine1 && line2 ? lineGap : 0);

            const paddingX = Math.round(fontSize1 * 1.0);
            const paddingY = Math.round(fontSize1 * 0.6);
            const pWidth = maxTextWidth + paddingX * 2;
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

            ctx.fillStyle = isMetal
                ? tColor
                : isAdvancedMode()
                  ? customTextColor()
                  : frameColor() === "white"
                    ? "#222222"
                    : "#e2e8f0";

            let currentTextY = pY + paddingY + fontSize1 * 0.85;
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
                    ctx.font = font1Prefix;
                    ctx.fillText(prefixStr, startX, currentTextY);
                    startX += prefixW;
                }
                if (mainStr) {
                    ctx.font = font1Main;
                    ctx.fillText(mainStr, startX, currentTextY);
                }

                ctx.textAlign = hAlign;
                currentTextY += fontSize2 + lineGap;
            }
            if (line2) {
                ctx.font = font2;
                ctx.fillText(line2, tx, currentTextY - fontSize2 * 0.1);
            }

            ctx.restore();
        };

        if (isChekiMode()) {
            const textCenterY = imgY + imgH + Math.round(textSpace / 2);
            drawCombinedTextAndPlate(
                prefix,
                textLine1Main,
                textLine2,
                finalCanvasW / 2,
                textCenterY,
            );
        } else if (framePosition() === "left" || framePosition() === "right") {
            const x =
                framePosition() === "left"
                    ? Math.round(textSpace * 0.5) + realFrameWidth
                    : imgW + Math.round(textSpace * 0.5) + realFrameWidth;
            const y = finalCanvasH / 2;
            const gap = Math.round(textSpace * 0.1);

            ctx.save();
            ctx.fillStyle = tColor;
            const combinedLine1 = `${prefix}${textLine1Main}`;
            if (combinedLine1 && textLine2) {
                drawVerticalText(
                    ctx,
                    combinedLine1,
                    x + (fontSize1 / 2 + gap / 2),
                    y,
                    font1Main,
                );
                drawVerticalText(
                    ctx,
                    textLine2,
                    x - (fontSize2 / 2 + gap / 2),
                    y,
                    font2,
                );
            } else {
                drawVerticalText(
                    ctx,
                    combinedLine1 || textLine2,
                    x,
                    y,
                    font1Main,
                );
            }
            ctx.restore();
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
            );
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

    const handleDownload = () => {
        if (!canvasRef) return;

        let baseName = customExportName().trim();
        if (!baseName) {
            baseName = `framed_${(fileName() || "image").split(".")[0]}`;
        }

        let finalDataUrl = canvasRef.toDataURL(saveFormat(), 0.95);

        if (
            !useCustomTitle() &&
            keepOriginalExif() &&
            rawFileBase64Str &&
            saveFormat() === "image/jpeg"
        ) {
            try {
                const exifDump = piexif.dump(piexif.load(rawFileBase64Str));
                finalDataUrl = piexif.insert(exifDump, finalDataUrl);
            } catch (exifErr) {
                console.error("Failed to insert EXIF metadata:", exifErr);
            }
        }

        setDownloadImageSrc(finalDataUrl);
        setShowMobileSaveModal(true);

        const a = document.createElement("a");
        document.body.appendChild(a);
        a.href = finalDataUrl;
        a.download = `${baseName}.${saveFormat().split("/")[1]}`;
        a.click();
        document.body.removeChild(a);
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
            setTimeout(() => drawFrame(), 0);
        };
        img.src = URL.createObjectURL(file);
    };

    const formatShutterSpeed = (exposure: any) => {
        if (!exposure) return "";
        if (exposure >= 1) return `${exposure}s`;
        return `1/${Math.round(1 / exposure)}s`;
    };

    const handleOptionChange = (setter: any, val: any) => {
        setter(val);
        drawFrame();
    };
    const handleToggleChange = (setter: any, val: any) => {
        setter(val);
        drawFrame();
    };
    const handleTextChange = (setter: any, val: any) => {
        setter(val);
        drawFrame();
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
        drawFrame();
    };
    const rotateImage = () => {
        setImageRotation((prev) => (prev + 90) % 360);
        drawFrame();
    };

    return (
        <div class="h-full w-full p-4 flex flex-col gap-4">
            <For each={fontList}>
                {(f) => (
                    <link
                        rel="stylesheet"
                        href={`https://fonts.googleapis.com/css2?family=${f.link}&display=swap`}
                    />
                )}
            </For>

            <div class="card bg-base-100 shadow-xl p-6 w-full border border-base-300">
                <div class="flex flex-col lg:flex-row gap-8 w-full items-stretch">
                    <div class="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-4 max-h-[85vh] overflow-y-auto pr-1">
                        <div class="flex flex-col gap-2 bg-base-200 p-3 rounded-xl border border-base-300 shadow-xs">
                            <label class="btn btn-primary text-white h-12 px-6 text-sm rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2 w-full">
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
                                    onClick={handleDownload}
                                    class="btn btn-success text-white h-12 px-6 text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 w-full"
                                >
                                    📥 額縁付きで保存
                                </button>
                                <button
                                    onClick={rotateImage}
                                    class="btn btn-outline btn-primary btn-sm h-10 px-4 rounded-xl flex items-center justify-center gap-2 w-full border-base-300 text-xs"
                                >
                                    🔄 画像を右に90度回転
                                </button>
                            </Show>
                        </div>

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
                                                class="radio radio-primary radio-xs"
                                            />{" "}
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
                                                class="radio radio-primary radio-xs"
                                            />{" "}
                                            黒
                                        </label>
                                    </div>
                                </div>
                                <div class="border-t border-base-300/60 pt-2 mt-1 flex items-center justify-between">
                                    <span class="font-bold text-base-content/80">
                                        📸 チェキ風フレーム
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={isChekiMode()}
                                        onChange={(e) => {
                                            setIsChekiMode(
                                                e.currentTarget.checked,
                                            );
                                            setTimeout(() => drawFrame(), 0);
                                        }}
                                        class="toggle toggle-primary toggle-xs"
                                    />
                                </div>
                            </div>
                        </Show>

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
                                        <span class="text-[9px] text-base-content/50 font-medium">
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
                                        class="toggle toggle-primary toggle-xs"
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
                                        class="input input-bordered input-xs w-full mt-1.5 bg-base-100 text-base-content text-xs font-medium border-base-300"
                                        placeholder="例: Shot on "
                                    />
                                </Show>
                            </div>

                            <Show
                                when={useCustomTitle()}
                                fallback={
                                    <div class="flex flex-col gap-2 text-xs">
                                        <div class="flex flex-col gap-1">
                                            <span class="text-[10px] font-bold text-base-content/60">
                                                📷
                                                カメラ記述（1行目・左側または上側）
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="カメラ名"
                                                value={cameraModel()}
                                                onInput={(e) =>
                                                    handleTextChange(
                                                        setCameraModel,
                                                        e.currentTarget.value,
                                                    )
                                                }
                                                class="input input-bordered input-sm w-full bg-base-100 text-base-content text-xs border-base-300"
                                            />
                                        </div>
                                        <div class="flex flex-col gap-1">
                                            <span class="text-[10px] font-bold text-base-content/60">
                                                🔎
                                                レンズ記述（1行目・右側または下側）
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="レンズ名"
                                                value={lensModel()}
                                                onInput={(e) =>
                                                    handleTextChange(
                                                        setLensModel,
                                                        e.currentTarget.value,
                                                    )
                                                }
                                                class="input input-bordered input-sm w-full bg-base-100 text-base-content text-xs border-base-300"
                                            />
                                        </div>
                                    </div>
                                }
                            >
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

                            <details class="collapse collapse-arrow bg-base-100 border border-base-300 rounded-lg text-xs mt-1">
                                <summary class="collapse-title font-bold text-[11px] text-base-content/70 min-h-0 py-2 px-3">
                                    🔤 フォント・表示数値を直接修正
                                </summary>
                                <div class="collapse-content p-3 flex flex-col gap-3 border-t border-base-300">
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
                                            class="select select-bordered select-xs w-full bg-base-100 text-base-content border-base-300"
                                        >
                                            <For each={fontList}>
                                                {(f) => (
                                                    <option value={f.value}>
                                                        {f.name}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
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
                                            class="range range-primary range-xs mt-1"
                                        />
                                    </div>

                                    <Show when={!useCustomTitle()}>
                                        <div class="border-t border-base-300 pt-2 flex flex-col gap-2">
                                            <span class="font-bold text-base-content/60 text-[10px]">
                                                Exif表示フラグと内部数値の書き換え
                                            </span>

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
                                                        class="checkbox checkbox-xs"
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
                                                        class="input input-bordered input-xs flex-1 bg-base-100 font-medium border-base-300"
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
                                                        class="checkbox checkbox-xs"
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
                                                        class="input input-bordered input-xs flex-1 bg-base-100 font-medium border-base-300"
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
                                                        class="checkbox checkbox-xs"
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
                                                        class="input input-bordered input-xs flex-1 bg-base-100 font-medium border-base-300"
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
                                                        class="checkbox checkbox-xs"
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
                                                        class="input input-bordered input-xs flex-1 bg-base-100 font-medium border-base-300"
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
                                                        class="checkbox checkbox-xs"
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
                                                        class="input input-bordered input-xs flex-1 bg-base-100 font-medium border-base-300"
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
                                                        class="checkbox checkbox-xs"
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
                                                        class="input input-bordered input-xs flex-1 bg-base-100 font-medium border-base-300"
                                                        placeholder="例: 100"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            </details>
                        </div>

                        <Show when={!isChekiMode()}>
                            <div class="form-control border border-base-300 p-3 rounded-xl bg-base-200/30 flex flex-col gap-2 text-xs">
                                <div class="flex items-center justify-between border-b border-base-300 pb-1">
                                    <span class="font-bold text-base-content/80 text-[11px]">
                                        📍 配置設定
                                    </span>
                                </div>
                                <div class="flex items-center justify-between gap-2 py-0.5 text-base-content">
                                    <span class="text-base-content/60 font-medium text-[10px]">
                                        帯の位置:
                                    </span>
                                    <div class="flex gap-2">
                                        {[
                                            { val: "bottom", label: "下" },
                                            { val: "top", label: "上" },
                                            { val: "left", label: "左" },
                                            { val: "right", label: "右" },
                                        ].map((pos) => (
                                            <label class="flex gap-1 items-center cursor-pointer font-medium">
                                                <input
                                                    type="radio"
                                                    name="pos"
                                                    checked={
                                                        framePosition() ===
                                                        pos.val
                                                    }
                                                    onChange={() =>
                                                        handleOptionChange(
                                                            setFramePosition,
                                                            pos.val,
                                                        )
                                                    }
                                                    class="radio radio-primary radio-xs"
                                                />{" "}
                                                {pos.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div
                                    class="flex items-center justify-between gap-2 py-0.5 border-t border-base-300 mt-0.5 pt-1.5 transition-all duration-200 text-base-content"
                                    classList={{
                                        "opacity-40 pointer-events-none select-none":
                                            framePosition() === "left" ||
                                            framePosition() === "right",
                                    }}
                                >
                                    <span class="text-base-content/60 font-medium text-[10px]">
                                        文字寄せ:
                                    </span>
                                    <div class="flex gap-3">
                                        {[
                                            { val: "left", label: "左" },
                                            { val: "center", label: "中央" },
                                            { val: "right", label: "右" },
                                        ].map((align) => (
                                            <label class="flex gap-1 items-center cursor-pointer font-medium">
                                                <input
                                                    type="radio"
                                                    name="align"
                                                    checked={
                                                        textAlign() ===
                                                        align.val
                                                    }
                                                    onChange={() =>
                                                        handleOptionChange(
                                                            setTextAlign,
                                                            align.val,
                                                        )
                                                    }
                                                    class="radio radio-primary radio-xs"
                                                    disabled={
                                                        framePosition() ===
                                                            "left" ||
                                                        framePosition() ===
                                                            "right"
                                                    }
                                                />{" "}
                                                {align.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Show>

                        <div class="form-control border border-base-300 p-3 rounded-xl bg-base-200/50">
                            <label class="flex items-center justify-between cursor-pointer text-base-content">
                                <div class="flex flex-col">
                                    <span class="text-xs font-bold text-base-content">
                                        ✍️ 自由なタイトルモードにする
                                    </span>
                                    <span class="text-[9px] text-base-content/50 font-medium">
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
                                    class="input input-bordered input-xs w-full bg-base-100 font-mono text-base-content border-base-300"
                                />
                            </div>
                            <div class="flex gap-2 pt-1 justify-between items-center text-base-content">
                                <span class="text-[10px] font-bold text-base-content/60">
                                    保存形式:
                                </span>
                                <div class="flex gap-2">
                                    {[
                                        "image/jpeg",
                                        "image/png",
                                        "image/webp",
                                    ].map((fmt) => (
                                        <label class="flex gap-1 text-[11px] items-center cursor-pointer font-semibold">
                                            <input
                                                type="radio"
                                                name="fmt"
                                                checked={saveFormat() === fmt}
                                                onChange={() =>
                                                    handleOptionChange(
                                                        setSaveFormat,
                                                        fmt,
                                                    )
                                                }
                                                class="radio radio-primary radio-xs"
                                            />{" "}
                                            {fmt.split("/")[1].toUpperCase()}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div class="form-control border-t border-base-300 pt-2 text-base-content">
                                <label class="flex items-center justify-between cursor-pointer">
                                    <div class="flex flex-col">
                                        <span class="text-[11px] font-bold text-base-content/80">
                                            元のExifデータを引き継ぐ
                                        </span>
                                        <span class="text-[9px] text-base-content/50 font-medium">
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
                                        class="toggle toggle-primary toggle-xs"
                                    />
                                </label>
                                <Show
                                    when={
                                        useCustomTitle() && keepOriginalExif()
                                    }
                                >
                                    <span class="text-[9px] text-error font-bold mt-1.5 block leading-tight">
                                        ⚠️
                                        注意：タイトル入力をONにすると、自動取得したExif情報は画像データに書き込まれません。
                                    </span>
                                </Show>
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
                                                    class="w-7 h-7 rounded cursor-pointer border border-base-300 bg-transparent"
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
                                                    class="w-7 h-7 rounded pointer border border-base-300 bg-transparent"
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
                                                drawFrame();
                                            }}
                                            class="range range-secondary range-xs mt-1"
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
                                                        <span class="text-[9px] font-bold text-base-content/80 leading-tight block">
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
                                                        <span class="text-[9px] font-bold text-base-content/70 mb-1 block">
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
                                                class="toggle toggle-secondary toggle-xs"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>

                    <div class="flex-1 flex flex-col border border-base-300 bg-base-200/30 text-base-content rounded-2xl p-4 justify-center items-center relative min-h-[400px] lg:min-h-0 overflow-hidden shadow-inner">
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
                                onClick={() => setIsMaximized(true)}
                                class="absolute top-4 right-4 btn btn-sm bg-slate-900/80 text-white border-none hover:bg-slate-900 shadow-md z-10 px-3 rounded-lg text-xs h-9"
                            >
                                🔍 大画面で拡大
                            </button>
                            <canvas
                                ref={(el) => (canvasRef = el)}
                                class="w-full h-full max-h-[500px] lg:max-h-[calc(100vh-160px)] object-contain rounded-none shadow-lg bg-transparent transition-all duration-300"
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
                        class="max-w-full max-h-[90vh] object-contain shadow-2xl"
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
                                📥 画像が生成されました
                            </h3>
                            <p class="text-[11px] text-base-content/70 leading-relaxed font-medium mt-1">
                                スマートフォンのブラウザ制限により自動保存が開始されない場合は、
                                <br />
                                下記の画像を
                                <br />
                                <strong class="text-primary font-bold text-xs">
                                    長押し（ロングタップ）
                                </strong>
                                して保存してください。
                            </p>
                        </div>
                        <div class="w-full max-h-[50vh] overflow-y-auto bg-base-200 p-2 rounded-xl flex items-center justify-center">
                            <img
                                src={downloadImageSrc()}
                                alt="Generated masterpiece"
                                class="max-w-full max-h-[45vh] object-contain shadow-md rounded-xs select-none"
                            />
                        </div>

                        <button
                            onClick={() => setShowMobileSaveModal(false)}
                            class="btn btn-primary text-white w-full h-11 text-xs rounded-xl shadow-xs mt-1"
                        >
                            とじる
                        </button>
                    </div>
                </div>
            </Show>
        </div>
    );
}
