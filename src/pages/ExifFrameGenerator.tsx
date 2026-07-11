// src/pages/ExifFrame.tsx
import { createSignal, Show, For, onCleanup } from "solid-js";
import exifr from "exifr";

export default function ExifFrame() {
    const [fileName, setFileName] = createSignal("");
    const [frameColor, setFrameColor] = createSignal("black");
    const [framePosition, setFramePosition] = createSignal("bottom");
    const [textAlign, setTextAlign] = createSignal("left");
    const [saveFormat, setSaveFormat] = createSignal("image/jpeg");
    const [previewUrl, setPreviewUrl] = createSignal("");
    const [isChekiMode, setIsChekiMode] = createSignal(false);
    const [isMaximized, setIsMaximized] = createSignal(false);
    const [hasImage, setHasImage] = createSignal(false);

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

    const fontList = [
        {
            id: "gothic",
            name: "Noto Sans JP",
            value: "'Noto Sans JP', sans-serif",
            link: "Noto+Sans+JP:wght@400;700",
        },
        {
            id: "serif",
            name: "Noto Serif JP",
            value: "'Noto Serif JP', serif",
            link: "Noto+Serif+JP:wght@400;700",
        },
        {
            id: "italic",
            name: "Playfair Display",
            value: "'Playfair Display', serif",
            link: "Playfair+Display:ital,wght@1,400;1,700",
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
            link: "Kiwi+Maru:wght@400;500",
        },
    ];

    let canvasRef: HTMLCanvasElement | undefined;
    let sourceImage: HTMLImageElement | null = null;

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

        const basePadding = Math.round(Math.max(imgW, imgH) * 0.02);
        const textSpace = Math.round(Math.max(imgW, imgH) * 0.06);

        let canvasW = imgW,
            canvasH = imgH,
            imgX = 0,
            imgY = 0;

        if (isChekiMode()) {
            canvasW += basePadding * 2;
            canvasH += basePadding * 2 + textSpace;
            imgX = basePadding;
            imgY = basePadding;
        } else {
            if (framePosition() === "bottom") canvasH += textSpace;
            else if (framePosition() === "top") {
                canvasH += textSpace;
                imgY = textSpace;
            } else if (framePosition() === "left") {
                canvasW += textSpace;
                imgX = textSpace;
            } else if (framePosition() === "right") canvasW += textSpace;
        }

        canvasRef.width = canvasW;
        canvasRef.height = canvasH;
        ctx.fillStyle = frameColor() === "white" ? "#ffffff" : "#121212";
        ctx.fillRect(0, 0, canvasW, canvasH);

        // 画像の回転描画
        const centerX = imgX + imgW / 2;
        const centerY = imgY + imgH / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((imageRotation() * Math.PI) / 180);
        ctx.drawImage(sourceImage, -origW / 2, -origH / 2, origW, origH);
        ctx.restore();

        const textLine1 = [
            showCamera() ? cameraModel().trim() : "",
            showLens() ? lensModel().trim() : "",
        ]
            .filter(Boolean)
            .join(" | ");
        const textLine2 = [
            showFocal() && focalLength() ? `${focalLength()}mm` : "",
            showFNumber() && fNumber() ? `f/${fNumber()}` : "",
            showSpeed() && shutterSpeed() ? shutterSpeed() : "",
            showIso() && isoValue() ? `ISO ${isoValue()}` : "",
        ]
            .filter(Boolean)
            .join(" | ");

        ctx.fillStyle = frameColor() === "white" ? "#222222" : "#e2e8f0";
        const scale = fontSizeScale() / 100;
        const fontSize1 = Math.round(textSpace * 0.24 * scale);
        const fontSize2 = Math.round(textSpace * 0.18 * scale);
        const font1 = `bold ${fontSize1}px ${selectedFont()}`;
        const font2 = `${fontSize2}px ${selectedFont()}`;

        if (isChekiMode()) {
            const centerY = imgY + imgH + Math.round(textSpace / 2);
            ctx.textAlign = "center";
            if (textLine1 && textLine2) {
                const gap = Math.round(textSpace * 0.05);
                ctx.font = font1;
                ctx.fillText(
                    textLine1,
                    canvasW / 2,
                    centerY - (fontSize1 / 2 + gap / 2),
                );
                ctx.font = font2;
                ctx.fillText(
                    textLine2,
                    canvasW / 2,
                    centerY + (fontSize2 / 2 + gap / 2),
                );
            } else {
                ctx.font = font1;
                ctx.fillText(textLine1 || textLine2, canvasW / 2, centerY);
            }
        } else if (framePosition() === "left" || framePosition() === "right") {
            const x =
                framePosition() === "left"
                    ? Math.round(textSpace * 0.5)
                    : imgW + Math.round(textSpace * 0.5);
            const y = canvasH / 2;
            const gap = Math.round(textSpace * 0.1);
            if (textLine1 && textLine2) {
                drawVerticalText(
                    ctx,
                    textLine1,
                    x + (fontSize1 / 2 + gap / 2),
                    y,
                    font1,
                );
                drawVerticalText(
                    ctx,
                    textLine2,
                    x - (fontSize2 / 2 + gap / 2),
                    y,
                    font2,
                );
            } else {
                drawVerticalText(ctx, textLine1 || textLine2, x, y, font1);
            }
        } else {
            ctx.textAlign =
                textAlign() === "left"
                    ? "start"
                    : textAlign() === "right"
                      ? "end"
                      : "center";
            const x =
                textAlign() === "left"
                    ? imgX + basePadding
                    : textAlign() === "right"
                      ? imgX + imgW - basePadding
                      : canvasW / 2;
            const y =
                framePosition() === "bottom"
                    ? imgH + textSpace / 2
                    : textSpace / 2;
            if (textLine1 && textLine2) {
                const gap = Math.round(textSpace * 0.05);
                ctx.font = font1;
                ctx.fillText(textLine1, x, y - (fontSize1 / 2 + gap / 2));
                ctx.font = font2;
                ctx.fillText(textLine2, x, y + (fontSize2 / 2 + gap / 2));
            } else {
                ctx.font = font1;
                ctx.fillText(textLine1 || textLine2, x, y);
            }
        }
    };

    const handleDownload = () => {
        if (!canvasRef) {
            console.error("Canvas element not found");
            return;
        }
        canvasRef.toBlob(
            (blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const baseName = fileName() || "image";
                a.download = `framed_${baseName.split(".")[0]}.${saveFormat().split("/")[1]}`;
                a.click();
                URL.revokeObjectURL(url);
            },
            saveFormat(),
            0.95,
        );
    };

    const handleFileChange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) return;

        // 参照のズレを防ぐため、新しい画像を読み込む時に一度Showの条件を外す
        setHasImage(false);

        const file = target.files[0];
        setFileName(file.name);
        try {
            const exif = await exifr.parse(file);
            setCameraModel(
                exif?.Model
                    ? `${exif.Make || ""} ${exif.Model}`.trim()
                    : "不明なカメラ",
            );
            setLensModel(exif?.LensModel || "");
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
            console.error(e);
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                sourceImage = img;
                setHasImage(true);
                setImageRotation(0);
                // DOMが組み立てられてrefが新要素を掴むのを確実に待ってから描画
                setTimeout(() => drawFrame(), 0);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
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
        await document.fonts.load(`16px ${val}`);
        drawFrame();
    };
    const handleSizeScaleChange = (val: number) => {
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
            <div class="card bg-base-100 shadow-xl p-6 w-full border border-base-200">
                <div class="flex flex-col lg:flex-row gap-8 w-full items-stretch">
                    <div class="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-5 max-h-[85vh] overflow-y-auto pr-1">
                        <div class="flex flex-col gap-3 border-b border-base-200 pb-4">
                            <label class="btn btn-primary text-white h-14 px-6 text-base rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 w-full">
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
                                    class="btn btn-success text-white h-14 px-6 text-base rounded-xl shadow-md flex items-center justify-center gap-2 w-full"
                                >
                                    📥 額縁付きで保存
                                </button>
                                <button
                                    onClick={rotateImage}
                                    class="btn btn-outline btn-primary h-12 px-6 text-sm rounded-xl flex items-center justify-center gap-2 w-full mt-1 border-slate-300 hover:border-primary"
                                >
                                    🔄 画像を右に90度回転
                                </button>
                            </Show>
                        </div>

                        <div class="flex flex-col gap-4">
                            <div class="form-control border border-primary/20 p-3 rounded-xl bg-primary/5 shadow-sm">
                                <label class="flex items-center justify-between cursor-pointer">
                                    <span class="label-text font-black text-primary text-sm">
                                        📸 チェキ風フレーム
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
                                        class="toggle toggle-primary toggle-sm"
                                    />
                                </label>
                            </div>
                            <div class="form-control border border-slate-200 p-3.5 rounded-xl bg-slate-50/50">
                                <span class="label-text font-black text-slate-700 text-sm mb-2 block">
                                    🔤 フォント
                                </span>
                                <select
                                    value={selectedFont()}
                                    onChange={(e) =>
                                        handleFontChange(e.currentTarget.value)
                                    }
                                    class="select select-bordered select-sm w-full bg-white mb-3 font-medium"
                                >
                                    <For each={fontList}>
                                        {(f) => (
                                            <option value={f.value}>
                                                {f.name}
                                            </option>
                                        )}
                                    </For>
                                </select>
                                <div class="flex flex-col gap-1 border-t border-slate-200/60 pt-2">
                                    <span class="text-xs font-bold text-slate-600">
                                        📏 文字の大きさ ({fontSizeScale()}%)
                                    </span>
                                    <input
                                        type="range"
                                        min="50"
                                        max="180"
                                        value={fontSizeScale()}
                                        onInput={(e) =>
                                            handleSizeScaleChange(
                                                Number(e.currentTarget.value),
                                            )
                                        }
                                        class="range range-primary range-xs mt-1"
                                    />
                                </div>
                            </div>
                            <div class="form-control border border-slate-200 p-4 rounded-xl bg-slate-50/70 flex flex-col gap-3">
                                <span class="label-text font-black text-slate-800 text-sm block border-b border-slate-200 pb-1">
                                    📝 テキスト編集
                                </span>
                                <div class="flex flex-col gap-1">
                                    <label class="flex gap-2 items-center">
                                        <input
                                            type="checkbox"
                                            checked={showCamera()}
                                            onChange={(e) =>
                                                handleToggleChange(
                                                    setShowCamera,
                                                    e.currentTarget.checked,
                                                )
                                            }
                                            class="checkbox checkbox-xs checkbox-primary"
                                        />{" "}
                                        <span class="text-xs font-bold">
                                            カメラ名
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={cameraModel()}
                                        onInput={(e) =>
                                            handleTextChange(
                                                setCameraModel,
                                                e.currentTarget.value,
                                            )
                                        }
                                        class="input input-bordered input-sm w-full bg-white"
                                    />
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="flex gap-2 items-center">
                                        <input
                                            type="checkbox"
                                            checked={showLens()}
                                            onChange={(e) =>
                                                handleToggleChange(
                                                    setShowLens,
                                                    e.currentTarget.checked,
                                                )
                                            }
                                            class="checkbox checkbox-xs checkbox-primary"
                                        />{" "}
                                        <span class="text-xs font-bold">
                                            レンズ名
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={lensModel()}
                                        onInput={(e) =>
                                            handleTextChange(
                                                setLensModel,
                                                e.currentTarget.value,
                                            )
                                        }
                                        class="input input-bordered input-sm w-full bg-white"
                                    />
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="flex flex-col">
                                        <label class="flex gap-1 items-center">
                                            <input
                                                type="checkbox"
                                                checked={showFocal()}
                                                onChange={(e) =>
                                                    handleToggleChange(
                                                        setShowFocal,
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="checkbox checkbox-xs checkbox-primary"
                                            />{" "}
                                            <span class="text-[10px]">
                                                焦点距離
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            value={focalLength()}
                                            onInput={(e) =>
                                                handleTextChange(
                                                    setFocalLength,
                                                    e.currentTarget.value,
                                                )
                                            }
                                            class="input input-bordered input-xs"
                                        />
                                    </div>
                                    <div class="flex flex-col">
                                        <label class="flex gap-1 items-center">
                                            <input
                                                type="checkbox"
                                                checked={showFNumber()}
                                                onChange={(e) =>
                                                    handleToggleChange(
                                                        setShowFNumber,
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="checkbox checkbox-xs checkbox-primary"
                                            />{" "}
                                            <span class="text-[10px]">
                                                絞り値
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            value={fNumber()}
                                            onInput={(e) =>
                                                handleTextChange(
                                                    setFNumber,
                                                    e.currentTarget.value,
                                                )
                                            }
                                            class="input input-bordered input-xs"
                                        />
                                    </div>
                                    <div class="flex flex-col">
                                        <label class="flex gap-1 items-center">
                                            <input
                                                type="checkbox"
                                                checked={showSpeed()}
                                                onChange={(e) =>
                                                    handleToggleChange(
                                                        setShowSpeed,
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="checkbox checkbox-xs checkbox-primary"
                                            />{" "}
                                            <span class="text-[10px]">SS</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={shutterSpeed()}
                                            onInput={(e) =>
                                                handleTextChange(
                                                    setShutterSpeed,
                                                    e.currentTarget.value,
                                                )
                                            }
                                            class="input input-bordered input-xs"
                                        />
                                    </div>
                                    <div class="flex flex-col">
                                        <label class="flex gap-1 items-center">
                                            <input
                                                type="checkbox"
                                                checked={showIso()}
                                                onChange={(e) =>
                                                    handleToggleChange(
                                                        setShowIso,
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="checkbox checkbox-xs checkbox-primary"
                                            />{" "}
                                            <span class="text-[10px]">ISO</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={isoValue()}
                                            onInput={(e) =>
                                                handleTextChange(
                                                    setIsoValue,
                                                    e.currentTarget.value,
                                                )
                                            }
                                            class="input input-bordered input-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class="form-control border border-slate-200/80 p-3.5 rounded-xl bg-slate-50/50">
                                <span class="label-text font-black text-slate-700 text-sm mb-2 block">
                                    ■ 余白の色
                                </span>
                                <label class="flex gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="color"
                                        checked={frameColor() === "black"}
                                        onChange={() =>
                                            handleOptionChange(
                                                setFrameColor,
                                                "black",
                                            )
                                        }
                                        class="radio radio-primary radio-sm"
                                    />{" "}
                                    黒
                                </label>
                                <label class="flex gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="color"
                                        checked={frameColor() === "white"}
                                        onChange={() =>
                                            handleOptionChange(
                                                setFrameColor,
                                                "white",
                                            )
                                        }
                                        class="radio radio-primary radio-sm"
                                    />{" "}
                                    白
                                </label>
                            </div>
                            <Show when={!isChekiMode()}>
                                <div class="form-control border border-slate-200/80 p-3.5 rounded-xl bg-slate-50/50">
                                    <span class="label-text font-black text-slate-700 text-sm mb-2 block">
                                        📍 余白の位置
                                    </span>
                                    <div class="grid grid-cols-2 gap-2">
                                        {[
                                            { val: "bottom", label: "下" },
                                            { val: "top", label: "上" },
                                            { val: "left", label: "左" },
                                            { val: "right", label: "右" },
                                        ].map((pos) => (
                                            <label class="flex gap-2 text-xs">
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
                                                    class="radio radio-primary radio-sm"
                                                />{" "}
                                                {pos.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div class="form-control border border-slate-200/80 p-3.5 rounded-xl bg-slate-50/50">
                                    <span class="label-text font-black text-slate-700 text-sm mb-2 block">
                                        ✍️ 文字寄せ
                                    </span>
                                    <div class="grid grid-cols-3 gap-2">
                                        {[
                                            { val: "left", label: "左" },
                                            { val: "center", label: "中央" },
                                            { val: "right", label: "右" },
                                        ].map((align) => (
                                            <label class="flex gap-2 text-xs">
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
                                                    class="radio radio-primary radio-sm"
                                                />{" "}
                                                {align.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </Show>
                            <div class="form-control border border-slate-200/80 p-3.5 rounded-xl bg-slate-50/50">
                                <span class="label-text font-black text-slate-700 text-sm mb-2 block">
                                    💾 保存形式
                                </span>
                                {["image/jpeg", "image/png", "image/webp"].map(
                                    (fmt) => (
                                        <label class="flex gap-2 text-sm">
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
                                                class="radio radio-primary radio-sm"
                                            />{" "}
                                            {fmt.split("/")[1]}
                                        </label>
                                    ),
                                )}
                            </div>
                        </div>
                    </div>
                    {/* プレビュー */}
                    <div class="flex-1 flex flex-col border border-slate-200 bg-slate-950/5 rounded-2xl p-4 justify-center items-center relative min-h-[400px] lg:min-h-0 overflow-hidden shadow-inner">
                        <Show
                            when={hasImage()}
                            fallback={
                                <div class="text-slate-400 p-8">
                                    📸
                                    写真を読み込むとプレビューが表示されます！
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
        </div>
    );
}
