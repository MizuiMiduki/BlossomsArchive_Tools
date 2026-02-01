/** @type {any} */
const globalApp = window;

// 状態管理用オブジェクト
const state = {
    /** @type {HTMLImageElement | null} */
    originalImage: null,
    /** @type {any} */
    exifData: null
};

/**
 * シャッタースピードのフォーマット
 * @param {number} value
 */
function formatShutterSpeed(value) {
    if (!value) return "";
    if (value >= 1) return `${value.toFixed(1)}s`;
    const denominator = Math.round(1 / value);
    return `1/${denominator}s`;
}

/**
 * EXIF情報を画像に描画する
 */
function drawImageWithExif() {
    const img = state.originalImage;
    const exif = state.exifData;
    const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("canvas"));
    const preview = /** @type {HTMLImageElement | null} */ (document.getElementById("preview"));

    if (!img || !exif || !canvas || !preview) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // EXIFデータの整理
    const make = exif.Make || "Unknown";
    const model = exif.Model || "Unknown";
    const fnumber = exif.FNumber ? `f/${exif.FNumber}` : "";
    const iso = exif.ISOSpeedRatings ? `ISO ${exif.ISOSpeedRatings}` : "";
    const shutterSpeed = exif.ExposureTime ? `SS ${formatShutterSpeed(exif.ExposureTime)}` : "";
    const focalLength = exif.FocalLength ? `FL ${exif.FocalLength}mm` : "";

    const line1_1 = `${make} ${model}`;
    const line1_2 = [fnumber, shutterSpeed, focalLength, iso].filter(Boolean).join(" | ");

    // スケール計算
    const scale = img.height / 1080;
    const padding = Math.round(60 * scale) * 2;
    const fontSizeBig = Math.round(36 * scale);
    const fontSizeSmall = Math.round(24 * scale);
    const lineSpacing = 16;
    const lineHeightBig = fontSizeBig + lineSpacing;
    const lineHeightSmall = fontSizeSmall + lineSpacing;

    // 設定の取得
    const frameColor = (/** @type {HTMLInputElement} */(document.querySelector('input[name="frameColor"]:checked')))?.value || "black";
    const framePosition = (/** @type {HTMLInputElement} */(document.querySelector('input[name="framePosition"]:checked')))?.value || "bottom";
    const textAlign = (/** @type {HTMLInputElement} */(document.querySelector('input[name="textAlign"]:checked')))?.value || "left";

    const bgColor = frameColor === "white" ? "#fff" : "#000";
    const textColor = frameColor === "white" ? "#000" : "#fff";
    const isVertical = (framePosition === "left" || framePosition === "right");

    // キャンバスサイズ決定
    let canvasWidth = img.width;
    let canvasHeight = img.height;
    if (isVertical) canvasWidth += padding; else canvasHeight += padding;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    let drawX = 0, drawY = 0, bandX = 0, bandY = 0;
    if (framePosition === "bottom") bandY = img.height;
    else if (framePosition === "top") drawY = padding;
    else if (framePosition === "right") bandX = img.width;
    else if (framePosition === "left") drawX = padding;

    // 描画
    context.fillStyle = bgColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, drawX, drawY);

    context.fillStyle = textColor;
    context.textBaseline = "top";

    if (isVertical) {
        // 縦枠（左・右）の描画処理
        context.save();
        context.translate(bandX + padding / 2, canvas.height / 2);
        context.rotate(framePosition === "left" ? Math.PI / 2 : -Math.PI / 2);
        context.textAlign = "center";
        context.textBaseline = "middle";

        context.font = `${fontSizeBig}px sans-serif`;
        context.fillText(line1_1, 0, -lineHeightSmall / 2);
        context.font = `${fontSizeSmall}px sans-serif`;
        context.fillText(line1_2, 0, lineHeightBig / 2);
        context.restore();
    } else {
        // 横枠（上・下）の描画処理
        let textBaseX = textAlign === "left" ? 40 : textAlign === "center" ? canvas.width / 2 : canvas.width - 40;
        context.textAlign = /** @type {CanvasTextAlign} */ (textAlign);

        const textStartY = framePosition === "top"
            ? (padding - (lineHeightBig + lineHeightSmall)) / 2
            : img.height + (padding - (lineHeightBig + lineHeightSmall)) / 2;

        context.font = `${fontSizeBig}px sans-serif`;
        context.fillText(line1_1, textBaseX, textStartY);
        context.font = `${fontSizeSmall}px sans-serif`;
        context.fillText(line1_2, textBaseX, textStartY + lineHeightBig);
    }

    preview.src = canvas.toDataURL("image/jpeg", 0.9);
}

// イベント管理（動的要素対応）
document.addEventListener("change", (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);

    // ファイル選択
    if (target.id === "fileInput" && target.files?.[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // EXIF.jsの呼び出し
                if (globalApp.EXIF) {
                    globalApp.EXIF.getData(img, () => {
                        // 最初に渡した img をそのまま使う
                        // アロー関数 () => を使うことで、this の混乱も防げます
                        state.exifData = globalApp.EXIF.getAllTags(img);
                        state.originalImage = img;
                        drawImageWithExif();
                    });
                }
            };
            img.src = String(event.target?.result || "");
        };
        reader.readAsDataURL(target.files[0]);
    }

    // 設定変更
    if (["frameColor", "framePosition", "textAlign"].includes(target.name)) {
        drawImageWithExif();
    }
});

document.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    // プレビュークリックでモーダル
    if (target.id === "preview") {
        const modal = document.getElementById("modal");
        const modalImg = /** @type {HTMLImageElement | null} */ (document.getElementById("modalImg"));
        if (modal && modalImg) {
            modal.style.display = "flex";
            modalImg.src = (/** @type {HTMLImageElement} */(target)).src;
        }
    }

    // モーダル閉じる
    if (target.id === "modal") {
        target.style.display = "none";
    }

    // ダウンロード
    if (target.id === "downloadBtn") {
        const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("canvas"));
        if (canvas) {
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/jpeg", 0.95);
            a.download = "exif-framed-photo.jpg";
            a.click();
        }
    }
});
